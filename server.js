const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Config from environment variables ─────────────────────────────────────
const ADMIN_PIN   = process.env.ADMIN_PIN   || '1234';
const TEACHER_PIN = process.env.TEACHER_PIN || '5678';
const DATA_DIR    = process.env.DATA_DIR    || path.join(__dirname, 'data');
const DATA_FILE   = path.join(DATA_DIR, 'tracker.json');

// ── Ensure data directory exists ───────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Default data structure ─────────────────────────────────────────────────
const DEFAULT_DATA = {
  tripConfig: {
    name: 'School Trip 2025',
    amountDue: '350',
    currency: 'AED',
    school: '',
    organiser: 'Poulton Consultancy'
  },
  records: []
};

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
      return { ...DEFAULT_DATA };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Read error:', e);
    return { ...DEFAULT_DATA };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware ────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const pin = req.headers['x-pin'] || req.query.pin;
  if (pin === ADMIN_PIN) return next();
  res.status(403).json({ error: 'Admin PIN required' });
}

function requireTeacherOrAdmin(req, res, next) {
  const pin = req.headers['x-pin'] || req.query.pin;
  if (pin === ADMIN_PIN || pin === TEACHER_PIN) return next();
  res.status(403).json({ error: 'Invalid PIN' });
}

// ── Auth endpoint ──────────────────────────────────────────────────────────
app.post('/api/auth', (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN)   return res.json({ role: 'admin',   ok: true });
  if (pin === TEACHER_PIN) return res.json({ role: 'teacher', ok: true });
  res.status(401).json({ error: 'Invalid PIN' });
});

// ── Get all data ───────────────────────────────────────────────────────────
app.get('/api/data', requireTeacherOrAdmin, (req, res) => {
  res.json(readData());
});

// ── Update trip config (admin only) ───────────────────────────────────────
app.put('/api/config', requireAdmin, (req, res) => {
  const data = readData();
  data.tripConfig = { ...data.tripConfig, ...req.body };
  writeData(data);
  res.json({ ok: true, tripConfig: data.tripConfig });
});

// ── Add record (admin only) ────────────────────────────────────────────────
app.post('/api/records', requireAdmin, (req, res) => {
  const data = readData();
  const record = {
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    payerName:   req.body.payerName   || '',
    payerEmail:  req.body.payerEmail  || '',
    stripeId:    req.body.stripeId    || '',
    amount:      req.body.amount      || '0',
    amountDue:   req.body.amountDue   || data.tripConfig.amountDue || '350',
    status:      req.body.status      || 'Pending',
    date:        req.body.date        || new Date().toISOString().split('T')[0],
    studentName: req.body.studentName || '',
    grade:       req.body.grade       || '',
    notes:       req.body.notes       || '',
    createdAt:   new Date().toISOString()
  };
  data.records.push(record);
  writeData(data);
  res.json({ ok: true, record });
});

// ── Bulk import (admin only) ───────────────────────────────────────────────
app.post('/api/records/bulk', requireAdmin, (req, res) => {
  const data     = readData();
  const incoming = req.body.records || [];
  const existing = new Set(data.records.map(r => r.stripeId).filter(Boolean));
  let added = 0;
  incoming.forEach(rec => {
    if (rec.stripeId && existing.has(rec.stripeId)) return; // skip duplicate
    data.records.push({
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      payerName:   rec.payerName   || '',
      payerEmail:  rec.payerEmail  || '',
      stripeId:    rec.stripeId    || '',
      amount:      rec.amount      || '0',
      amountDue:   rec.amountDue   || data.tripConfig.amountDue || '350',
      status:      rec.status      || 'Pending',
      date:        rec.date        || new Date().toISOString().split('T')[0],
      studentName: rec.studentName || '',
      grade:       rec.grade       || '',
      notes:       rec.notes       || '',
      createdAt:   new Date().toISOString()
    });
    added++;
  });
  writeData(data);
  res.json({ ok: true, added, skipped: incoming.length - added });
});

// ── Update record ──────────────────────────────────────────────────────────
// Admin can update anything; teacher can only update studentName and grade
app.put('/api/records/:id', requireTeacherOrAdmin, (req, res) => {
  const pin  = req.headers['x-pin'] || req.query.pin;
  const role = pin === ADMIN_PIN ? 'admin' : 'teacher';
  const data = readData();
  const idx  = data.records.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Record not found' });

  if (role === 'teacher') {
    // Teachers may only fill in student name and grade
    if (req.body.studentName !== undefined) data.records[idx].studentName = req.body.studentName;
    if (req.body.grade       !== undefined) data.records[idx].grade       = req.body.grade;
  } else {
    // Admin can update any field
    data.records[idx] = { ...data.records[idx], ...req.body, id: req.params.id };
  }
  data.records[idx].updatedAt = new Date().toISOString();
  writeData(data);
  res.json({ ok: true, record: data.records[idx] });
});

// ── Delete record (admin only) ─────────────────────────────────────────────
app.delete('/api/records/:id', requireAdmin, (req, res) => {
  const data = readData();
  const before = data.records.length;
  data.records = data.records.filter(r => r.id !== req.params.id);
  if (data.records.length === before) return res.status(404).json({ error: 'Not found' });
  writeData(data);
  res.json({ ok: true });
});

// ── Serve app for any other route ──────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Poulton Tracker running on port ${PORT}`);
  console.log(`   Data file: ${DATA_FILE}`);
  console.log(`   Admin PIN: ${ADMIN_PIN} | Teacher PIN: ${TEACHER_PIN}`);
});
