const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bjml-secret-change-in-production-' + (process.env.NODE_ENV || 'dev');
const isProduction = !!process.env.DATABASE_URL;

/* ---------- Env Validation ---------- */
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('FATAL: JWT_SECRET must be set to a secure random string (min 32 chars) in production.');
  process.exit(1);
}

/* ---------- Account Lockout ---------- */
const loginAttempts = new Map();
const LOCKOUT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000;

function checkLockout(email) {
  const record = loginAttempts.get(email);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > LOCKOUT_WINDOW) { loginAttempts.delete(email); return false; }
  return record.lockedUntil && Date.now() < record.lockedUntil;
}

function recordFailedAttempt(email) {
  let record = loginAttempts.get(email) || { attempts: 0, lastAttempt: 0, lockedUntil: 0 };
  record.attempts++;
  record.lastAttempt = Date.now();
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }
  loginAttempts.set(email, record);
}

function clearAttempts(email) { loginAttempts.delete(email); }

/* ---------- Database ---------- */
let db;

if (isProduction) {
  const { Pool } = require('pg');
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    family: 4,
    max: 10
  });

  async function initDB() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK(role IN ('user','admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        badge TEXT DEFAULT '',
        meta_label TEXT DEFAULT '',
        meta_value TEXT DEFAULT '',
        image_url TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const adminCheck = await db.query('SELECT id FROM users WHERE email = $1', ['admin@benjumanly.com']);
    if (adminCheck.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.query('INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)', ['Admin', 'admin@benjumanly.com', hash, 'admin']);
    }

    const listingCheck = await db.query('SELECT COUNT(*) as cnt FROM listings');
    if (parseInt(listingCheck.rows[0].cnt) === 0) {
      await db.query('INSERT INTO listings (title, description, badge, meta_label, meta_value, image_url) VALUES ($1,$2,$3,$4,$5,$6)', ['Riverside Estate', '6 units, modern amenities, expected completion Q4 2026.', 'Under Construction', '6 units · Riverside', 'Q4 2026', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=400&fit=crop']);
      await db.query('INSERT INTO listings (title, description, badge, meta_label, meta_value, image_url) VALUES ($1,$2,$3,$4,$5,$6)', ['Greenfield Villas', 'Spacious plots near transport links and schools.', 'For Sale', 'Serviced plots', 'Open', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop']);
      await db.query('INSERT INTO listings (title, description, badge, meta_label, meta_value, image_url) VALUES ($1,$2,$3,$4,$5,$6)', ['Urban Renewal Block', 'Mixed-use redevelopment in a high-demand area.', 'Mixed-Use', 'Commercial + Residential', 'Planning', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop']);
    }
  }
  initDB().catch(err => { console.error('DB init error:', err.message); process.exit(1); });

} else {
  const Database = require('better-sqlite3');
  const sqlite = new Database(path.join(__dirname, 'data.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('user','admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      badge TEXT DEFAULT '',
      meta_label TEXT DEFAULT '',
      meta_value TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const adminExists = sqlite.prepare('SELECT id FROM users WHERE email = ?').get('admin@benjumanly.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    sqlite.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Admin', 'admin@benjumanly.com', hash, 'admin');
  }
  const listingCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM listings').get().cnt;
  if (listingCount === 0) {
    const insert = sqlite.prepare('INSERT INTO listings (title, description, badge, meta_label, meta_value, image_url) VALUES (?, ?, ?, ?, ?, ?)');
    insert.run('Riverside Estate', '6 units, modern amenities, expected completion Q4 2026.', 'Under Construction', '6 units · Riverside', 'Q4 2026', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=400&fit=crop');
    insert.run('Greenfield Villas', 'Spacious plots near transport links and schools.', 'For Sale', 'Serviced plots', 'Open', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop');
    insert.run('Urban Renewal Block', 'Mixed-use redevelopment in a high-demand area.', 'Mixed-Use', 'Commercial + Residential', 'Planning', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop');
  }

  db = {
    async query(sql, params = []) {
      if (sql.includes('RETURNING') && sql.trim().startsWith('INSERT')) {
        const stmt = sqlite.prepare(sql.replace(/\$\d+/g, '?'));
        const result = stmt.run(...params);
        return { rows: [{ id: result.lastInsertRowid }] };
      }
      if (sql.trim().startsWith('INSERT')) {
        const stmt = sqlite.prepare(sql.replace(/\$\d+/g, '?'));
        stmt.run(...params);
        return { rows: [] };
      }
      if (sql.trim().startsWith('UPDATE') || sql.trim().startsWith('DELETE')) {
        const stmt = sqlite.prepare(sql.replace(/\$\d+/g, '?'));
        stmt.run(...params);
        return { rows: [] };
      }
      const stmt = sqlite.prepare(sql.replace(/\$\d+/g, '?'));
      const rows = stmt.all(...params);
      return { rows };
    }
  };
}

/* ---------- Security Middleware ---------- */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || false, credentials: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again later.' }
});
app.use('/api/auth/', authLimiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/* ---------- Auth Middleware ---------- */
function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

/* ---------- API: Auth ---------- */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required.' });
    if (typeof name !== 'string' || name.length > 100) return res.status(400).json({ error: 'Invalid name.' });
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be 8-128 characters.' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, role', [name.trim(), email.toLowerCase(), hash]);
    const user = result.rows[0];
    const token = generateToken(user);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const normalizedEmail = email.toLowerCase();
    if (checkLockout(normalizedEmail)) {
      return res.status(429).json({ error: 'Account temporarily locked. Try again later.' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (result.rows.length === 0 || !(await bcrypt.compare(password, result.rows[0].password))) {
      recordFailedAttempt(normalizedEmail);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    clearAttempts(normalizedEmail);
    const user = result.rows[0];
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

/* ---------- API: Contact ---------- */
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'All fields are required.' });
    if (typeof name !== 'string' || name.length > 100) return res.status(400).json({ error: 'Invalid name.' });
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (typeof message !== 'string' || message.length > 2000) return res.status(400).json({ error: 'Message must be under 2000 characters.' });

    await db.query('INSERT INTO contacts (name, email, message) VALUES ($1, $2, $3)', [name.trim(), email.toLowerCase(), message.trim()]);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/* ---------- API: Listings (public read) ---------- */
app.get('/api/listings', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM listings ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

/* ---------- API: Listings (admin write) ---------- */
app.post('/api/listings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, description, badge, meta_label, meta_value, image_url } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Title and description are required.' });
    if (typeof title !== 'string' || title.length > 200) return res.status(400).json({ error: 'Invalid title.' });
    if (typeof description !== 'string' || description.length > 2000) return res.status(400).json({ error: 'Description must be under 2000 characters.' });

    const result = await db.query('INSERT INTO listings (title, description, badge, meta_label, meta_value, image_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [title.trim(), description.trim(), (badge || '').trim(), (meta_label || '').trim(), (meta_value || '').trim(), (image_url || '').trim()]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

app.put('/api/listings/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, description, badge, meta_label, meta_value, image_url } = req.body;
    const existing = await db.query('SELECT id FROM listings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Listing not found.' });

    await db.query('UPDATE listings SET title=$1, description=$2, badge=$3, meta_label=$4, meta_value=$5, image_url=$6 WHERE id=$7', [(title || '').trim(), (description || '').trim(), (badge || '').trim(), (meta_label || '').trim(), (meta_value || '').trim(), (image_url || '').trim(), req.params.id]);
    res.json({ id: Number(req.params.id), title, description, badge, meta_label, meta_value, image_url });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

app.delete('/api/listings/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const existing = await db.query('SELECT id FROM listings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Listing not found.' });
    await db.query('DELETE FROM listings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

/* ---------- API: Admin (protected) ---------- */
app.get('/api/admin/contacts', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM contacts ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role, created_at FROM users ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

app.delete('/api/admin/contacts/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

/* ---------- Static files (restricted) ---------- */
app.use(express.static(path.join(__dirname, 'images'), { maxAge: '1y', immutable: true }));
app.use(express.static(path.join(__dirname, 'css'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'js'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'pages'), { maxAge: '1d' }));
app.use(express.static(__dirname, { maxAge: '1d', index: 'index.html' }));

/* ---------- SPA fallback ---------- */
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
  } else {
    next();
  }
});

/* ---------- Error handler ---------- */
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message);
});

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log(`BENJUMANLY PROPERTIES — Server running on port ${PORT} (${isProduction ? 'PostgreSQL' : 'SQLite'})`);
});
