const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requirePatient } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requirePatient, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, age, balance, created_at FROM patients WHERE id = $1',
      [req.session.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load profile.' });
  }
});

router.put('/me', requirePatient, async (req, res) => {
  try {
    const { name, age, password } = req.body;
    const patientId = req.session.user.id;

    const fields = [];
    const values = [];
    let i = 1;

    if (name) { fields.push(`name = $${i++}`); values.push(name.trim()); }
    if (age) { fields.push(`age = $${i++}`); values.push(age); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      fields.push(`password_hash = $${i++}`);
      values.push(hash);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }
    values.push(patientId);

    const result = await pool.query(
      `UPDATE patients SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, email, age, balance`,
      values
    );
    if (name) req.session.user.name = name.trim();
    res.json({ message: 'Profile updated.', patient: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

module.exports = router;
