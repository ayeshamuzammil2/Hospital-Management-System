const express = require('express');
const pool = require('../config/db');
const { requirePatient, requireDoctor } = require('../middleware/auth');
const { buildDoctorQueue } = require('../utils/queue');
const { buildHistory } = require('../utils/linkedlist');

const router = express.Router();

function generateReceiptNo() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RCPT-${stamp}-${rand}`;
}

// ---------------------------------------------------------
// PATIENT: Book an appointment (slot + payment in one step)
// body: { doctorId, slotId, paymentMethod: 'card'|'cash', card: {number, name, expiry, cvv} }
// ---------------------------------------------------------
router.post('/book', requirePatient, async (req, res) => {
  const client = await pool.connect();
  try {
    const patientId = req.session.user.id;
    const { doctorId, slotId, paymentMethod, card } = req.body;

    if (!doctorId || !slotId || !paymentMethod) {
      return res.status(400).json({ error: 'Doctor, slot and payment method are required.' });
    }

    await client.query('BEGIN');

    // Lock the slot row to avoid two patients grabbing the same slot
    const slotResult = await client.query(
      'SELECT * FROM doctor_slots WHERE id = $1 AND doctor_id = $2 FOR UPDATE',
      [slotId, doctorId]
    );
    if (slotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'That slot no longer exists.' });
    }
    const slot = slotResult.rows[0];
    if (slot.is_booked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Sorry, this slot was just booked by someone else. Please choose another.' });
    }

    const doctorResult = await client.query('SELECT * FROM doctors WHERE id = $1', [doctorId]);
    const doctor = doctorResult.rows[0];
    const fee = parseFloat(doctor.fee);

    let paymentStatus = 'pending';
    let cardLast4 = null;

    if (paymentMethod === 'card') {
      if (!card || !card.number || !card.name || !card.expiry || !card.cvv) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Card details are required (any test values are fine).' });
      }
      const patientResult = await client.query('SELECT balance FROM patients WHERE id = $1 FOR UPDATE', [patientId]);
      const balance = parseFloat(patientResult.rows[0].balance);
      if (balance < fee) {
        await client.query('ROLLBACK');
        return res.status(402).json({ error: `Insufficient wallet balance. You have Rs. ${balance}, the fee is Rs. ${fee}.` });
      }
      // Deduct from patient wallet, credit doctor wallet immediately for card payments
      await client.query('UPDATE patients SET balance = balance - $1 WHERE id = $2', [fee, patientId]);
      await client.query('UPDATE doctors SET balance = balance + $1 WHERE id = $2', [fee, doctorId]);
      paymentStatus = 'paid';
      cardLast4 = String(card.number).replace(/\s/g, '').slice(-4);
    }
    // cash -> stays 'pending' until doctor confirms receiving cash in person

    // Mark slot booked
    await client.query('UPDATE doctor_slots SET is_booked = TRUE WHERE id = $1', [slotId]);

    // Create appointment
    const apptResult = await client.query(
      `INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'waiting', $7) RETURNING *`,
      [patientId, doctorId, slotId, slot.slot_date, slot.start_time, slot.end_time, paymentStatus]
    );
    const appointment = apptResult.rows[0];

    // Create payment/receipt record
    const receiptNo = generateReceiptNo();
    const paymentResult = await client.query(
      `INSERT INTO payments (appointment_id, patient_id, doctor_id, amount, method, status, receipt_no, card_last4)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [appointment.id, patientId, doctorId, fee, paymentMethod, paymentStatus, receiptNo, cardLast4]
    );

    await client.query('COMMIT');

    res.json({
      message: `Appointment booked with Dr. ${doctor.name}! Please visit Room ${doctor.room_no} on ${slot.slot_date.toISOString().slice(0,10)} at ${slot.start_time}.`,
      appointment,
      payment: paymentResult.rows[0],
      doctor: { name: doctor.name, room_no: doctor.room_no }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not complete booking. Please try again.' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------
// PATIENT: My appointments (upcoming + history via linked list)
// ---------------------------------------------------------
router.get('/mine', requirePatient, async (req, res) => {
  try {
    const patientId = req.session.user.id;
    const result = await pool.query(
      `SELECT a.*, d.name AS doctor_name, d.room_no, d.fee, s.name AS speciality,
              p.status AS payment_status_detail, p.method AS payment_method, p.receipt_no
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialities s ON s.id = d.speciality_id
       LEFT JOIN payments p ON p.appointment_id = a.id
       WHERE a.patient_id = $1
       ORDER BY a.appointment_date DESC, a.start_time DESC`,
      [patientId]
    );
    const history = buildHistory(result.rows); // DSA: threaded through a linked list
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load your appointments.' });
  }
});

// ---------------------------------------------------------
// PATIENT: Cancel an upcoming waiting appointment
// ---------------------------------------------------------
router.put('/:id/cancel', requirePatient, async (req, res) => {
  const client = await pool.connect();
  try {
    const patientId = req.session.user.id;
    const { id } = req.params;
    await client.query('BEGIN');
    const apptResult = await client.query(
      'SELECT * FROM appointments WHERE id = $1 AND patient_id = $2 AND status = $3 FOR UPDATE',
      [id, patientId, 'waiting']
    );
    if (apptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found or cannot be cancelled.' });
    }
    const appt = apptResult.rows[0];
    await client.query('UPDATE appointments SET status = $1 WHERE id = $2', ['cancelled', id]);
    await client.query('UPDATE doctor_slots SET is_booked = FALSE WHERE id = $1', [appt.slot_id]);
    await client.query('COMMIT');
    res.json({ message: 'Appointment cancelled.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not cancel appointment.' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------
// DOCTOR: Today's live queue (DSA Queue) + full appointment list
// ---------------------------------------------------------
router.get('/queue/today', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.session.user.id;
    const result = await pool.query(
      `SELECT a.*, p.name AS patient_name, p.age, pay.status AS payment_status_detail, pay.method AS payment_method
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN payments pay ON pay.appointment_id = a.id
       WHERE a.doctor_id = $1 AND a.appointment_date = CURRENT_DATE AND a.status = 'waiting'
       ORDER BY a.start_time ASC`,
      [doctorId]
    );
    const queue = buildDoctorQueue(result.rows); // DSA: real enqueue/dequeue pass
    res.json(queue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load today\'s queue.' });
  }
});

// ---------------------------------------------------------
// DOCTOR: All appointments (any date), with payment status
// ---------------------------------------------------------
router.get('/doctor/all', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.session.user.id;
    const result = await pool.query(
      `SELECT a.*, p.name AS patient_name, p.age, p.email AS patient_email,
              pay.status AS payment_status_detail, pay.method AS payment_method, pay.amount, pay.receipt_no
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN payments pay ON pay.appointment_id = a.id
       WHERE a.doctor_id = $1
       ORDER BY a.appointment_date DESC, a.start_time DESC`,
      [doctorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load appointments.' });
  }
});

// ---------------------------------------------------------
// DOCTOR: Mark a patient as checked (dequeues them from the live queue)
// ---------------------------------------------------------
router.put('/:id/check-in', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.session.user.id;
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE appointments SET status = 'checked'
       WHERE id = $1 AND doctor_id = $2 AND status = 'waiting' RETURNING *`,
      [id, doctorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    res.json({ message: 'Marked as checked. Patient removed from queue.', appointment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update appointment.' });
  }
});

// ---------------------------------------------------------
// DOCTOR: Confirm a cash payment was received in person
// ---------------------------------------------------------
router.put('/:id/confirm-cash', requireDoctor, async (req, res) => {
  const client = await pool.connect();
  try {
    const doctorId = req.session.user.id;
    const { id } = req.params;
    await client.query('BEGIN');

    const payResult = await client.query(
      `SELECT * FROM payments WHERE appointment_id = $1 AND doctor_id = $2 AND method = 'cash' AND status = 'pending' FOR UPDATE`,
      [id, doctorId]
    );
    if (payResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No pending cash payment found for this appointment.' });
    }
    const payment = payResult.rows[0];

    await client.query('UPDATE payments SET status = $1 WHERE id = $2', ['paid', payment.id]);
    await client.query('UPDATE appointments SET payment_status = $1 WHERE id = $2', ['paid', id]);
    await client.query('UPDATE doctors SET balance = balance + $1 WHERE id = $2', [payment.amount, doctorId]);

    await client.query('COMMIT');
    res.json({ message: 'Cash payment confirmed and added to your balance.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not confirm payment.' });
  } finally {
    client.release();
  }
});

module.exports = router;
