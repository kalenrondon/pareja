-- Ejecuta esto en el SQL Editor de Supabase (https://supabase.com/dashboard/project/_/sql/new)

CREATE TABLE IF NOT EXISTS finanzas (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE finanzas ENABLE ROW LEVEL SECURITY;

-- Permitir lectura anónima
CREATE POLICY "anon_select" ON finanzas FOR SELECT USING (true);

-- Permitir inserción/actualización anónima
CREATE POLICY "anon_insert" ON finanzas FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON finanzas FOR UPDATE USING (true);

-- Insertar fila inicial
INSERT INTO finanzas (key, data)
VALUES ('main', '{
  "names": {"person1": "", "person2": ""},
  "transactions": [],
  "debts": [],
  "goals": [
    {"id": 1, "name": "Prenda de vestir del mes", "saved": 0, "target": 500},
    {"id": 2, "name": "Producto para la casa", "saved": 0, "target": 1000},
    {"id": 3, "name": "Viaje", "saved": 0, "target": 5000},
    {"id": 4, "name": "Ahorro extra / libre", "saved": 0, "target": 2000}
  ],
  "goalContributions": {},
  "budgets": {},
  "settings": {"darkMode": false, "goalDeadlineDay": 15}
}')
ON CONFLICT (key) DO NOTHING;
