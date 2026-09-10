const { Pool } = require("pg");
const { normalizeForMatch, isSameIngredient } = require("../lib/ingredientMatch");

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

    -- Per-week manual override of an auto-computed shopping list quantity
    -- (e.g. "j'en ai déjà 2 à la maison, n'affiche que 1"). Deleting the row
    -- reverts the item to the auto-computed quantity.
    CREATE TABLE IF NOT EXISTS shopping_overrides (
      week_start DATE NOT NULL,
      ingredient TEXT NOT NULL,
      unit       TEXT NOT NULL DEFAULT '',
      quantity   NUMERIC NOT NULL,
      PRIMARY KEY (week_start, ingredient, unit)
    );
  `);

  await mergeDuplicateIngredients();
}

// Ingredient names that were typed with slightly different spellings
// (e.g. "oeuf" vs "oeufs") end up as separate rows, causing duplicate lines
// on the shopping list. This repoints recipe_ingredients from any duplicate
// onto the oldest (lowest id) match and drops the duplicate row. Idempotent:
// once merged there is nothing left to merge on the next startup.
async function mergeDuplicateIngredients() {
  const { rows } = await pool.query("SELECT id, name FROM ingredients ORDER BY id");
  const groups = [];
  for (const ing of rows) {
    const key = normalizeForMatch(ing.name);
    const group = groups.find((g) => isSameIngredient(key, g.key));
    if (group) group.members.push(ing.id);
    else groups.push({ key, members: [ing.id] });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const group of groups) {
      if (group.members.length < 2) continue;
      const [canonicalId, ...dupIds] = group.members;
      for (const dupId of dupIds) {
        await client.query(
          "UPDATE recipe_ingredients SET ingredient_id=$1 WHERE ingredient_id=$2",
          [canonicalId, dupId]
        );
        await client.query("DELETE FROM ingredients WHERE id=$1", [dupId]);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, migrate };
