const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireDoctor } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireDoctor, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.name, d.email, d.room_no, d.fee, d.balance, d.bio,
              s.name AS speciality, s.id AS speciality_id
       FROM doctors d JOIN specialities s ON s.id = d.speciality_id
       WHERE d.id = $1`,
      [req.session.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load profile.' });
  }
});

router.put('/me', requireDoctor, async (req, res) => {
  try {
    const { name, fee, roomNo, bio, password } = req.body;
    const doctorId = req.session.user.id;

    const fields = [];
    const values = [];
    let i = 1;

    if (name) { fields.push(`name = $${i++}`); values.push(name.trim()); }
    if (fee) { fields.push(`fee = $${i++}`); values.push(fee); }
    if (roomNo) { fields.push(`room_no = $${i++}`); values.push(roomNo); }
    if (bio !== undefined) { fields.push(`bio = $${i++}`); values.push(bio); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      fields.push(`password_hash = $${i++}`);
      values.push(hash);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }
    values.push(doctorId);

    const result = await pool.query(
      `UPDATE doctors SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, email, fee, room_no, bio, balance`,
      values
    );
    if (name) req.session.user.name = name.trim();
    res.json({ message: 'Profile updated.', doctor: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

// Add new open slots
router.post('/me/slots', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.session.user.id;
    const { slots } = req.body; // [{date, startTime, endTime}]
    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: 'Provide at least one slot.' });
    }
    const inserted = [];
    for (const s of slots) {
      const result = await pool.query(
        `INSERT INTO doctor_slots (doctor_id, slot_date, start_time, end_time)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING *`,
        [doctorId, s.date, s.startTime, s.endTime]
      );
      if (result.rows[0]) inserted.push(result.rows[0]);
    }
    res.json({ message: `${inserted.length} slot(s) added.`, slots: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add slots.' });
  }
});

// View own slots (booked + open)
router.get('/me/slots', requireDoctor, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM doctor_slots WHERE doctor_id = $1 ORDER BY slot_date, start_time`,
      [req.session.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load slots.' });
  }
});

// Update a single slot (date/start/end) - only allowed while it's still open (not booked)
router.put('/me/slots/:id', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.session.user.id;
    const { id } = req.params;
    const { date, startTime, endTime } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Date, start time and end time are all required.' });
    }
    if (startTime >= endTime) {
      return res.status(400).json({ error: 'Start time must be before end time.' });
    }

    const existing = await pool.query(
      'SELECT * FROM doctor_slots WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found.' });
    }
    if (existing.rows[0].is_booked) {
      return res.status(409).json({ error: 'This slot is already booked by a patient and cannot be edited. Cancel the appointment first.' });
    }

    try {
      const result = await pool.query(
        `UPDATE doctor_slots SET slot_date = $1, start_time = $2, end_time = $3
         WHERE id = $4 AND doctor_id = $5 RETURNING *`,
        [date, startTime, endTime, id, doctorId]
      );
      res.json({ message: 'Slot updated.', slot: result.rows[0] });
    } catch (dbErr) {
      if (dbErr.code === '23505') { // unique_violation (doctor_id, slot_date, start_time)
        return res.status(409).json({ error: 'You already have another slot at that exact date and time.' });
      }
      throw dbErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update slot.' });
  }
});

// Delete a single slot - only allowed while it's still open (not booked)
router.delete('/me/slots/:id', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.session.user.id;
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT * FROM doctor_slots WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found.' });
    }
    if (existing.rows[0].is_booked) {
      return res.status(409).json({ error: 'This slot is already booked by a patient and cannot be deleted. Cancel the appointment first.' });
    }

    await pool.query('DELETE FROM doctor_slots WHERE id = $1 AND doctor_id = $2', [id, doctorId]);
    res.json({ message: 'Slot deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete slot.' });
  }
});

module.exports = router;
