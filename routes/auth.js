const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// POST /api/auth/register  -> { identifier, password }
// identifier can be an email or mobile number. Separate from donor registration;
// this creates a login account, optionally linked to a donor_id.
router.post('/register', async (req, res) => {
  try {
    const { identifier, password, donorId } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/mobile and password are required.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE identifier = ?', [identifier]);
    if (existing.length) {
      return res.status(409).json({ error: 'An account with this email/mobile already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (identifier, password_hash, donor_id) VALUES (?, ?, ?)',
      [identifier, passwordHash, donorId || null]
    );

    res.status(201).json({ message: 'Account created.', userId: result.insertId });
  } catch (err) {
    console.error('POST /api/auth/register failed:', err);
    res.status(500).json({ error: 'Could not create account.' });
  }
});

// POST /api/auth/login -> { identifier, password }
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/mobile and password are required.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE identifier = ?', [identifier]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign({ userId: user.id, identifier: user.identifier }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful.', token });
  } catch (err) {
    console.error('POST /api/auth/login failed:', err);
    res.status(500).json({ error: 'Could not log in.' });
  }
});

module.exports = router;
