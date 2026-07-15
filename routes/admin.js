const express = require('express');
const router = express.Router();

const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

// GET /api/admin/verify
// Header required: x-admin-key
// Used by the Admin Login tab to confirm the key is correct before letting
// the person into the dashboard (instant feedback, instead of finding out
// only when they try to edit/delete something).
router.get('/verify', (req, res) => {
  const key = req.get('x-admin-key');
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Incorrect admin key.' });
  }
  res.json({ ok: true });
});

module.exports = router;
