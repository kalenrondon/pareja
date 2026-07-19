const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const MONGODB_URI = process.env.MONGODB_URI;

let mongoose = null;
let DataModel = null;
let useMongo = false;

const defaultData = {
  names: { person1: '', person2: '' },
  transactions: [],
  debts: [],
  goals: [
    { id: 1, name: 'Prenda de vestir del mes', saved: 0, target: 500 },
    { id: 2, name: 'Producto para la casa', saved: 0, target: 1000 },
    { id: 3, name: 'Viaje', saved: 0, target: 5000 },
    { id: 4, name: 'Ahorro extra / libre', saved: 0, target: 2000 }
  ],
  goalContributions: {},
  budgets: {},
  settings: { darkMode: false, goalDeadlineDay: 15 }
};

function mergeGoals(data) {
  if (!data) return JSON.parse(JSON.stringify(defaultData));
  data.goals = defaultData.goals.map((dg, i) => {
    const existing = data.goals && data.goals[i];
    return existing ? { ...dg, ...existing } : { ...dg };
  });
  if (!data.goalContributions) data.goalContributions = {};
  if (!data.budgets) data.budgets = {};
  if (!data.settings) data.settings = { darkMode: false, goalDeadlineDay: 15 };
  return data;
}

// ---- JSON file backend ----
function loadJSON() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return mergeGoals(JSON.parse(raw));
    }
  } catch (e) {
    console.error('Error loading JSON:', e);
  }
  return JSON.parse(JSON.stringify(defaultData));
}

function saveJSON(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

if (MONGODB_URI) {
  try {
    mongoose = require('mongoose');
    const conn = mongoose.createConnection(MONGODB_URI);
    const schema = new mongoose.Schema({}, { strict: false, timestamps: true, collection: 'finanzas' });
    DataModel = conn.model('FinanceData', schema);
    conn.asPromise().then(() => {
      useMongo = true;
      console.log('Connected to MongoDB');
    }).catch(err => {
      console.error('MongoDB connection error, falling back to JSON:', err.message);
    });
  } catch (e) {
    console.error('Mongoose load error, falling back to JSON:', e.message);
  }
}

async function loadData() {
  if (useMongo && DataModel) {
    try {
      let doc = await DataModel.findOne({ key: 'main' }).lean();
      if (!doc) {
        doc = { ...defaultData, key: 'main' };
        await DataModel.create(doc);
      }
      delete doc._id;
      delete doc.__v;
      delete doc.createdAt;
      delete doc.updatedAt;
      delete doc.key;
      return mergeGoals(doc);
    } catch (e) {
      console.error('Mongo load error:', e);
      return loadJSON();
    }
  }
  return loadJSON();
}

async function saveData(data) {
  if (useMongo && DataModel) {
    try {
      const toSave = { ...data, key: 'main' };
      await DataModel.updateOne({ key: 'main' }, { $set: toSave }, { upsert: true });
      return;
    } catch (e) {
      console.error('Mongo save error, falling back to JSON:', e);
    }
  }
  saveJSON(data);
}

if (!useMongo && !fs.existsSync(DATA_FILE)) {
  saveJSON(defaultData);
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/data', async (req, res) => {
  try {
    const data = await loadData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error loading data' });
  }
});

app.post('/api/data', async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid data' });
    }
    await saveData(body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error saving data' });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    const fresh = JSON.parse(JSON.stringify(defaultData));
    await saveData(fresh);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error resetting data' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Finanzas app running at http://localhost:${PORT}`);
  if (useMongo) console.log('Storage: MongoDB');
  else console.log('Storage: JSON file');
  console.log('Set MONGODB_URI env var to use MongoDB');
});
