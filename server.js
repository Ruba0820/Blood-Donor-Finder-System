require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const donorRoutes = require('./routes/donors');
const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/donors', donorRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/request-blood', requestRoutes);
app.use('/api/admin', adminRoutes);

// The site now opens on Login first. This must be registered BEFORE
// express.static below — otherwise static's default `index: 'index.html'`
// behavior would serve index.html for '/' before this route ever runs.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve the frontend (login.html, index.html, main.js, login.js, style.css) as static files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for any other non-API route (simple SPA-style routing
// for the logged-in app; index.html's own script redirects back to
// login.html if there's no active session).
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`LifeDrop server running at http://localhost:${PORT}`);
});
