const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const VALID_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key');
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid or missing admin key.' });
  }
  next();
}

// POST /api/request-blood
// Body: { requesterName, requesterMobile, city, bloodGroup, hospital, message }
// No email is sent — the request is just saved to the database. It also
// reports back how many currently-active donors match, so the requester has
// some idea of availability without anyone's contact details being exposed.
router.post('/', async (req, res) => {
  try {
    const { requesterName, requesterMobile, city, bloodGroup, hospital, message } = req.body;

    if (!requesterName || !requesterMobile || !city || !bloodGroup) {
      return res.status(400).json({ error: 'Your name, mobile, city and blood group are required.' });
    }
    if (!VALID_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ error: 'Invalid blood group.' });
    }

    await pool.query(
      `INSERT INTO blood_requests (requester_name, requester_mobile, city, blood_group, hospital, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [requesterName, requesterMobile, city, bloodGroup, hospital || null, message || null]
    );

    const [matchRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM donors WHERE city = ? AND blood_group = ? AND is_active = 1`,
      [city, bloodGroup]
    );
    const matched = matchRows[0].total;

    res.status(201).json({
      message: matched > 0
        ? `Request saved. There are currently ${matched} active ${bloodGroup} donor(s) in ${city}.`
        : `Request saved, but there are no active ${bloodGroup} donors in ${city} right now.`,
      matched
    });
  } catch (err) {
    console.error('POST /api/request-blood failed:', err);
    res.status(500).json({ error: 'Could not save the blood request.' });
  }
});

// GET /api/request-blood  -> list recent requests (admin only)
// Header required: x-admin-key
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, requester_name, requester_mobile, city, blood_group, hospital, message, created_at
       FROM blood_requests ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error('GET /api/request-blood failed:', err);
    res.status(500).json({ error: 'Could not fetch blood requests.' });
  }
});

module.exports = router;
