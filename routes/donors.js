const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const VALID_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

// Simple shared-secret gate for admin-only actions (edit/delete).
// The admin page asks for this key once and sends it as a header on every request.
function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key');
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid or missing admin key.' });
  }
  next();
}

// GET /api/donors?city=Erode&group=O+&q=arun&activeOnly=true
// All filters are optional. "All Cities" / "All Groups" (or missing) means no filter.
// q does a partial match against the donor's name (used by the admin search box).
// activeOnly=true restricts results to donors currently marked active — the
// public Search page uses this so people only find donors who are available
// right now; the Admin dashboard omits it so admins can see everyone.
router.get('/', async (req, res) => {
  try {
    const { city, group, q, activeOnly } = req.query;
    const conditions = [];
    const params = [];

    if (city && city !== 'All Cities') {
      conditions.push('city = ?');
      params.push(city);
    }
    if (group && group !== 'All Groups') {
      conditions.push('blood_group = ?');
      params.push(group);
    }
    if (q && q.trim()) {
      conditions.push('name LIKE ?');
      params.push(`%${q.trim()}%`);
    }
    if (activeOnly === 'true') {
      conditions.push('is_active = 1');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT id, name, gender, dob, blood_group, weight_kg, street, area, city, pincode, mobile, email, is_active, created_at
       FROM donors ${where} ORDER BY created_at DESC`,
      params
    );

    res.json({ donors: rows });
  } catch (err) {
    console.error('GET /api/donors failed:', err);
    res.status(500).json({ error: 'Could not fetch donors.' });
  }
});

// GET /api/donors/stats/count -> { total }
// Declared before /:id so Express doesn't treat "stats" as an :id.
router.get('/stats/count', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM donors');
    res.json({ total: rows[0].total });
  } catch (err) {
    console.error('GET /api/donors/stats/count failed:', err);
    res.status(500).json({ error: 'Could not fetch donor count.' });
  }
});

// GET /api/donors/:id -> a single donor (used to prefill the admin edit form)
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM donors WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Donor not found.' });
    res.json({ donor: rows[0] });
  } catch (err) {
    console.error('GET /api/donors/:id failed:', err);
    res.status(500).json({ error: 'Could not fetch donor.' });
  }
});

// POST /api/donors  -> register a new donor
router.post('/', async (req, res) => {
  try {
    const {
      name, gender, dob, bloodGroup, weight,
      street, area, city, pincode, mobile, email, isActive
    } = req.body;

    if (!name || !dob || !bloodGroup || !weight || !city || !mobile) {
      return res.status(400).json({ error: 'Name, date of birth, blood group, weight, city and mobile are required.' });
    }
    if (!VALID_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ error: 'Invalid blood group.' });
    }

    const activeFlag = isActive === false || isActive === 'false' || isActive === 0 || isActive === '0' ? 0 : 1;

    const [result] = await pool.query(
      `INSERT INTO donors (name, gender, dob, blood_group, weight_kg, street, area, city, pincode, mobile, email, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, gender || 'Male', dob, bloodGroup, weight, street || null, area || null, city, pincode || null, mobile, email || null, activeFlag]
    );

    res.status(201).json({ message: 'Donor registered successfully.', donorId: result.insertId });
  } catch (err) {
    console.error('POST /api/donors failed:', err);
    res.status(500).json({ error: 'Could not register donor.' });
  }
});

// PATCH /api/donors/status  -> a donor updates their own active/inactive status
// Body: { mobile, email, isActive }
// Self-service, no admin key — but requires BOTH the mobile and email on
// file to match, as a lightweight identity check (this app has no per-donor
// login session to check against instead).
router.patch('/status', async (req, res) => {
  try {
    const { mobile, email, isActive } = req.body;

    if (!mobile || !email || typeof isActive === 'undefined') {
      return res.status(400).json({ error: 'Mobile, email and status are required.' });
    }

    const activeFlag = isActive === false || isActive === 'false' || isActive === 0 || isActive === '0' ? 0 : 1;

    const [result] = await pool.query(
      'UPDATE donors SET is_active = ? WHERE mobile = ? AND email = ?',
      [activeFlag, mobile.trim(), email.trim()]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No donor found with that mobile and email combination.' });
    }

    res.json({ message: activeFlag ? 'You are now marked as an active donor.' : 'You are now marked as inactive — you will not show up in donor search until you switch back.' });
  } catch (err) {
    console.error('PATCH /api/donors/status failed:', err);
    res.status(500).json({ error: 'Could not update your status.' });
  }
});

// PUT /api/donors/:id  -> update a donor (admin only)
// Header required: x-admin-key
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name, gender, dob, bloodGroup, weight,
      street, area, city, pincode, mobile, email, isActive
    } = req.body;

    if (!name || !dob || !bloodGroup || !weight || !city || !mobile) {
      return res.status(400).json({ error: 'Name, date of birth, blood group, weight, city and mobile are required.' });
    }
    if (!VALID_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ error: 'Invalid blood group.' });
    }

    const activeFlag = isActive === false || isActive === 'false' || isActive === 0 || isActive === '0' ? 0 : 1;

    const [result] = await pool.query(
      `UPDATE donors SET
         name = ?, gender = ?, dob = ?, blood_group = ?, weight_kg = ?,
         street = ?, area = ?, city = ?, pincode = ?, mobile = ?, email = ?, is_active = ?
       WHERE id = ?`,
      [name, gender || 'Male', dob, bloodGroup, weight, street || null, area || null, city, pincode || null, mobile, email || null, activeFlag, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Donor not found.' });
    }

    res.json({ message: 'Donor updated successfully.' });
  } catch (err) {
    console.error('PUT /api/donors/:id failed:', err);
    res.status(500).json({ error: 'Could not update donor.' });
  }
});

// DELETE /api/donors/:id  -> remove a donor (admin only)
// Header required: x-admin-key
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM donors WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Donor not found.' });
    }
    res.json({ message: 'Donor deleted successfully.' });
  } catch (err) {
    console.error('DELETE /api/donors/:id failed:', err);
    res.status(500).json({ error: 'Could not delete donor.' });
  }
});

module.exports = router;
