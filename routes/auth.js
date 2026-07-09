const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const router = express.Router();

// ---------------------------------------------------------
// PATIENT SIGNUP
// ---------------------------------------------------------
router.post('/patient/signup', async (req, res) => {
  try {
    const { name, email, age, password } = req.body;
    if (!name || !email || !age || !password) {
      return res.status(400).json({ error: 'All fields (name, email, age, password) are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await pool.query('SELECT id FROM patients WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO patients (name, email, age, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, age, balance`,
      [name.trim(), email.toLowerCase().trim(), age, passwordHash]
    );

    const patient = result.rows[0];
    req.session.user = { id: patient.id, role: 'patient', name: patient.name, email: patient.email };
    res.json({ message: 'Account created successfully!', user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while creating your account.' });
  }
});

// ---------------------------------------------------------
// PATIENT LOGIN
// ---------------------------------------------------------
router.post('/patient/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM patients WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const patient = result.rows[0];
    const match = await bcrypt.compare(password, patient.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    req.session.user = { id: patient.id, role: 'patient', name: patient.name, email: patient.email };
    res.json({ message: 'Welcome back!', user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ---------------------------------------------------------
// PATIENT FORGOT PASSWORD (no OTP - verifies with email + age)
// ---------------------------------------------------------
router.post('/patient/forgot-password', async (req, res) => {
  try {
    const { email, age, newPassword } = req.body;
    if (!email || !age || !newPassword) {
      return res.status(400).json({ error: 'Email, age and a new password are required.' });
    }
    const result = await pool.query('SELECT id FROM patients WHERE email = $1 AND age = $2', [email.toLowerCase().trim(), age]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found matching that email and age.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE patients SET password_hash = $1 WHERE id = $2', [passwordHash, result.rows[0].id]);
    res.json({ message: 'Password updated! You can now log in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reset password.' });
  }
});

// ---------------------------------------------------------
// DOCTOR SIGNUP
// ---------------------------------------------------------
router.post('/doctor/signup', async (req, res) => {
  try {
    const { name, email, password, specialityId, roomNo, fee, bio, slots } = req.body;
    if (!name || !email || !password || !specialityId || !roomNo || !fee) {
      return res.status(400).json({ error: 'Name, email, password, speciality, room number and fee are required.' });
    }

    const existing = await pool.query('SELECT id FROM doctors WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO doctors (name, email, password_hash, speciality_id, room_no, fee, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, speciality_id, room_no, fee`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, specialityId, roomNo, fee, bio || '']
    );
    const doctor = result.rows[0];

    // Optional: doctor can define initial slots right at signup
    if (Array.isArray(slots) && slots.length > 0) {
      for (const s of slots) {
        if (s.date && s.startTime && s.endTime) {
          await pool.query(
            `INSERT INTO doctor_slots (doctor_id, slot_date, start_time, end_time)
             VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
            [doctor.id, s.date, s.startTime, s.endTime]
          );
        }
      }
    }

    req.session.user = { id: doctor.id, role: 'doctor', name: doctor.name, email: doctor.email };
    res.json({ message: 'Doctor account created!', user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while creating your account.' });
  }
});

// ---------------------------------------------------------
// DOCTOR LOGIN
// ---------------------------------------------------------
router.post('/doctor/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM doctors WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const doctor = result.rows[0];
    const match = await bcrypt.compare(password, doctor.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    req.session.user = { id: doctor.id, role: 'doctor', name: doctor.name, email: doctor.email };
    res.json({ message: 'Welcome back,' + doctor.name, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ---------------------------------------------------------
// DOCTOR FORGOT PASSWORD (no OTP - verifies with email + room no)
// ---------------------------------------------------------
router.post('/doctor/forgot-password', async (req, res) => {
  try {
    const { email, roomNo, newPassword } = req.body;
    if (!email || !roomNo || !newPassword) {
      return res.status(400).json({ error: 'Email, room number and a new password are required.' });
    }
    const result = await pool.query('SELECT id FROM doctors WHERE email = $1 AND room_no = $2', [email.toLowerCase().trim(), roomNo]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found matching that email and room number.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE doctors SET password_hash = $1 WHERE id = $2', [passwordHash, result.rows[0].id]);
    res.json({ message: 'Password updated! You can now log in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reset password.' });
  }
});

// ---------------------------------------------------------
// ADMIN LOGIN (fixed credentials from .env, no signup)
// ---------------------------------------------------------
router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    req.session.user = { id: 0, role: 'admin', name: 'Administrator', email };
    return res.json({ message: 'Welcome, Admin!', user: req.session.user });
  }
  res.status(401).json({ error: 'Invalid admin credentials.' });
});

// ---------------------------------------------------------
// LOGOUT (any role)
// ---------------------------------------------------------
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out.' });
  });
});

// Who am I (used by frontend to restore session on page load)
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  res.status(401).json({ user: null });
});

module.exports = router;
