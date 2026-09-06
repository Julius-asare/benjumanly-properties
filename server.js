const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = !!process.env.DATABASE_URL;

/* ---------- Database ---------- */
let db;

if (isProduction) {
  /* PostgreSQL for production (Render + Supabase) */
  const { Pool } = require('pg');
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    family: 4
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

    /* Seed default admin */
    const adminCheck = await db.query('SELECT id FROM users WHERE email = $1', ['admin@benjumanly.com']);
    if (adminCheck.rows.length === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await db.query('INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)', ['Admin', 'admin@benjumanly.com', hash, 'admin']);
      console.log('Default admin created: admin@benjumanly.com / admin123');
    }

    /* Seed listings */
    const listingCheck = await db.query('SELECT COUNT(*) as cnt FROM listings');
    if (parseInt(listingCheck.rows[0].cnt) === 0) {
      await db.query('INSERT INTO listings (title, description, badge, meta_label, meta_value, image_url) VALUES ($1,$2,$3,$4,$5,$6)', ['Riverside Estate', '6 units, modern amenities, expected completion Q4 2026.', 'Under Construction', '6 units · Riverside', 'Q4 2026', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=400&fit=crop']);
      await db.query('INSERT INTO listings (title, description, badge, meta_label, meta_value, image_url) VALUES ($1,$2,$3,$4,$5,$6)', ['Greenfield Villas', 'Spacious plots near transport links and schools.', 'For Sale', 'Serviced plots', 'Open', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop']);
      await db.query('INSERT INTO listings (title, description, badge, meta_label, meta_value, image_url) VALUES ($1,$2,$3,$4,$5,$6)', ['Urban Renewal Block', 'Mixed-use redevelopment in a high-demand area.', 'Mixed-Use', 'Commercial + Residential', 'Planning', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop']);
      console.log('Default listings seeded.');
    }
    console.log('PostgreSQL database initialized.');
  }
  initDB().catch(err => { console.error('DB init error:', err); process.exit(1); });

} else {
  /* SQLite for local development */
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
    console.log('Default admin created: admin@benjumanly.com / admin123');
  }
  const listingCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM listings').get().cnt;
  if (listingCount === 0) {
    const insert = sqlite.prepare('INSERT INTO listings (title, description, badge, meta_label, meta_value, image_url) VALUES (?, ?, ?, ?, ?, ?)');
    insert.run('Riverside Estate', '6 units, modern amenities, expected completion Q4 2026.', 'Under Construction', '6 units · Riverside', 'Q4 2026', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=400&fit=crop');
    insert.run('Greenfield Villas', 'Spacious plots near transport links and schools.', 'For Sale', 'Serviced plots', 'Open', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop');
    insert.run('Urban Renewal Block', 'Mixed-use redevelopment in a high-demand area.', 'Mixed-Use', 'Commercial + Residential', 'Planning', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop');
    console.log('Default listings seeded.');
  }
  console.log('SQLite database initialized.');

  /* Wrap SQLite in a pg-like query interface for consistency */
  db = {
    async query(sql, params = []) {
      if (sql.includes('RETURNING') || sql.trim().startsWith('INSERT') && sql.includes('RETURNING')) {
        const stmt = sqlite.prepare(sql.replace(/\$\d+/g, '?'));
        const result = stmt.run(...params);
        return { rows: [{ id: result.lastInsertRowid }] };
      }
      if (sql.trim().startsWith('INSERT')) {
        const stmt = sqlite.prepare(sql.replace(/\$\d+/g, '?'));
        const result = stmt.run(...params);
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

/* ---------- Middleware ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------- API: Auth ---------- */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'An account with this email already exists.' });

    const hash = bcrypt.hashSync(password, 10);
    const result = await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id', [name, email, hash]);
    res.status(201).json({ id: result.rows[0].id, name, email, role: 'user' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0 || !bcrypt.compareSync(password, result.rows[0].password)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const user = result.rows[0];
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/* ---------- API: Contact ---------- */
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'All fields are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    await db.query('INSERT INTO contacts (name, email, message) VALUES ($1, $2, $3)', [name, email, message]);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/* ---------- API: Listings ---------- */
app.get('/api/listings', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM listings ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Listings error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/listings', async (req, res) => {
  try {
    const { title, description, badge, meta_label, meta_value, image_url } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Title and description are required.' });

    const result = await db.query('INSERT INTO listings (title, description, badge, meta_label, meta_value, image_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [title, description, badge || '', meta_label || '', meta_value || '', image_url || '']);
    res.status(201).json({ id: result.rows[0].id, title, description, badge, meta_label, meta_value, image_url });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.put('/api/listings/:id', async (req, res) => {
  try {
    const { title, description, badge, meta_label, meta_value, image_url } = req.body;
    const existing = await db.query('SELECT id FROM listings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Listing not found.' });

    await db.query('UPDATE listings SET title=$1, description=$2, badge=$3, meta_label=$4, meta_value=$5, image_url=$6 WHERE id=$7', [title, description, badge || '', meta_label || '', meta_value || '', image_url || '', req.params.id]);
    res.json({ id: Number(req.params.id), title, description, badge, meta_label, meta_value, image_url });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.delete('/api/listings/:id', async (req, res) => {
  try {
    const existing = await db.query('SELECT id FROM listings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Listing not found.' });
    await db.query('DELETE FROM listings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete listing error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/* ---------- API: Admin (contacts, users) ---------- */
app.get('/api/admin/contacts', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM contacts ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role, created_at FROM users ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

app.delete('/api/admin/contacts/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

/* ---------- Static files ---------- */
app.use(express.static(__dirname));

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log(`\n  BENJUMANLY PROPERTIES — Server running`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Database: ${isProduction ? 'PostgreSQL (Supabase)' : 'SQLite (local)'}\n`);
});
