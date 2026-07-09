const express = require('express');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/patients', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, age, balance, created_at FROM patients ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load patients.' });
  }
});

router.get('/doctors', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.name, d.email, d.room_no, d.fee, d.balance, s.name AS speciality
       FROM doctors d JOIN specialities s ON s.id = d.speciality_id
       ORDER BY d.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load doctors.' });
  }
});

// Overall stats + last 14 days revenue chart data
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const totals = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM patients) AS total_patients,
        (SELECT COUNT(*) FROM doctors) AS total_doctors,
        (SELECT COUNT(*) FROM appointments) AS total_appointments,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status = 'paid') AS total_revenue,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status = 'pending') AS pending_revenue
    `);

    const dailyRevenue = await pool.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COALESCE(SUM(amount),0) AS revenue
      FROM payments
      WHERE status = 'paid' AND created_at >= CURRENT_DATE - INTERVAL '13 days'
      GROUP BY day ORDER BY day ASC
    `);

    const bySpeciality = await pool.query(`
      SELECT s.name AS speciality, COUNT(a.id) AS appointment_count,
             COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'),0) AS revenue
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialities s ON s.id = d.speciality_id
      LEFT JOIN payments p ON p.appointment_id = a.id
      GROUP BY s.name ORDER BY revenue DESC
    `);

    res.json({
      totals: totals.rows[0],
      dailyRevenue: dailyRevenue.rows,
      bySpeciality: bySpeciality.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load stats.' });
  }
});

module.exports = router;
