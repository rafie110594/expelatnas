// ============================================================
// Express application — PB EX PELATNAS backend
// ============================================================
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const env = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// ---------- Keamanan & parsing ----------
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true, // dibutuhkan untuk httpOnly cookie refresh token
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
if (!env.isProduction) app.use(morgan('dev'));

// ---------- Health check ----------
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'PB EX PELATNAS API aktif',
    env: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// ---------- Routes ----------
// Gambar hasil upload (driver lokal) — disajikan statis di /uploads
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(env.uploads.dir, { dotfiles: 'deny', index: false, maxAge: '7d' })
);

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/members', require('./routes/member.routes'));
app.use('/api/matches', require('./routes/match.routes'));
app.use('/api/leaderboard', require('./routes/leaderboard.routes'));
app.use('/api/settings', require('./routes/setting.routes'));
app.use('/api/gallery', require('./routes/gallery.routes'));
app.use('/api/events', require('./routes/event.routes'));
app.use('/api/audit-logs', require('./routes/audit.routes'));

// ---------- 404 & error terpusat ----------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
