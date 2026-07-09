const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// List all specialities (categories) - at least 7, we ship 10
router.get('/specialities', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM specialities ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load specialities.' });
  }
});

// List doctors, optionally filtered by speciality id
router.get('/doctors', async (req, res) => {
  try {
    const { specialityId } = req.query;
    let query = `
      SELECT d.id, d.name, d.email, d.room_no, d.fee, d.bio,
             s.name AS speciality, s.icon AS speciality_icon
      FROM doctors d
      JOIN specialities s ON s.id = d.speciality_id`;
    const params = [];
    if (specialityId) {
      query += ' WHERE d.speciality_id = $1';
      params.push(specialityId);
    }
    query += ' ORDER BY d.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load doctors.' });
  }
});

// Get a single doctor's available (unbooked, future/today) slots
router.get('/doctors/:id/slots', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, slot_date, start_time, end_time
       FROM doctor_slots
       WHERE doctor_id = $1 AND is_booked = FALSE AND slot_date >= CURRENT_DATE
       ORDER BY slot_date, start_time`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load doctor slots.' });
  }
});

module.exports = router;
