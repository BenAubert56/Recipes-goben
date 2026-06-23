const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipes (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      servings    INTEGER NOT NULL DEFAULT 2,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_url TEXT;

    CREATE TABLE IF NOT EXISTS ingredients (
      id   SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id            SERIAL PRIMARY KEY,
      recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
      quantity      NUMERIC NOT NULL,
      unit          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_plans (
      id         SERIAL PRIMARY KEY,
      date       DATE NOT NULL,
      meal_type  TEXT NOT NULL,
      recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      portions   INTEGER NOT NULL DEFAULT 2
    );

    ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_meal_type_check;
    ALTER TABLE meal_plans ADD CONSTRAINT meal_plans_meal_type_check
      CHECK (meal_type IN ('matin','midi','soir'));

    CREATE TABLE IF NOT EXISTS recipe_steps (
      id          SERIAL PRIMARY KEY,
      recipe_id   INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      instruction TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shopping_extras (
      id         SERIAL PRIMARY KEY,
      week_start DATE NOT NULL,
      name       TEXT NOT NULL,
      quantity   NUMERIC,
      unit       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

module.exports = { pool, migrate };
