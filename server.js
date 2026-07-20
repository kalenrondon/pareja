const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let supabase = null;
let useSupabase = false;

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

// ---- JSON file fallback ----
function loadJSON() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return mergeGoals(JSON.parse(raw));
    }
  } catch (e) { console.error('Error loading JSON:', e); }
  return JSON.parse(JSON.stringify(defaultData));
}

function saveJSON(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---- Supabase backend ----
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    useSupabase = true;
    console.log('Supabase client initialized');
  } catch (e) {
    console.error('Supabase init error, falling back to JSON:', e.message);
  }
}

async function loadData() {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('finanzas').select('data').eq('key', 'main').single();
      if (error && error.code === 'PGRST116') {
        const doc = JSON.parse(JSON.stringify(defaultData));
        await supabase.from('finanzas').insert({ key: 'main', data: doc });
        return doc;
      }
      if (error) throw error;
      return mergeGoals(data.data);
    } catch (e) {
      console.error('Supabase load error:', e.message);
      return loadJSON();
    }
  }
  return loadJSON();
}

async function saveData(data) {
  if (useSupabase && supabase) {
    try {
      const toSave = { key: 'main', data, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('finanzas').upsert(toSave, { onConflict: 'key' });
      if (error) throw error;
      return;
    } catch (e) {
      console.error('Supabase save error, falling back to JSON:', e.message);
    }
  }
  saveJSON(data);
}

if (!useSupabase && !fs.existsSync(DATA_FILE)) {
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
  console.log(useSupabase ? 'Storage: Supabase' : 'Storage: JSON file');
  if (!useSupabase) console.log('Set SUPABASE_URL and SUPABASE_KEY env vars to use Supabase');
});
