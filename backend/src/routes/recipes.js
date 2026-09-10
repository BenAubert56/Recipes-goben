const { Router } = require("express");
const { pool } = require("../db");
const { normalizeForMatch, isSameIngredient } = require("../lib/ingredientMatch");

const router = Router();

// Resolves `name` to an existing ingredient id when it's a near-duplicate
// spelling (e.g. "oeuf" vs "oeufs") of one already known, instead of always
// creating a new row — this is what keeps the shopping list from splitting
// the same ingredient into two lines.
async function findOrCreateIngredient(client, name, cache) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  const key = normalizeForMatch(cleanName);
  const existing = cache.find((c) => isSameIngredient(key, c.key));
  if (existing) return existing.id;

  const { rows } = await client.query(
    "INSERT INTO ingredients (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
    [cleanName]
  );
  cache.push({ id: rows[0].id, key });
  return rows[0].id;
}

// List all recipes
router.get("/", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM recipes ORDER BY name");
  res.json(rows);
});

// Get one recipe with ingredients
router.get("/:id", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM recipes WHERE id = $1", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Not found" });

  const { rows: ingredients } = await pool.query(
    `SELECT ri.id, i.id AS ingredient_id, i.name, ri.quantity, ri.unit
     FROM recipe_ingredients ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.recipe_id = $1
     ORDER BY i.name`,
    [req.params.id]
  );
  const { rows: steps } = await pool.query(
    `SELECT id, step_number, instruction FROM recipe_steps
     WHERE recipe_id = $1 ORDER BY step_number`,
    [req.params.id]
  );
  res.json({ ...rows[0], ingredients, steps });
});

// Create recipe
router.post("/", async (req, res) => {
  const { name, description, servings = 2, image_url } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const { rows } = await pool.query(
    "INSERT INTO recipes (name, description, servings, image_url) VALUES ($1,$2,$3,$4) RETURNING *",
    [name, description, servings, image_url || null]
  );
  res.status(201).json(rows[0]);
});

// Update recipe
// Only fields actually present in the request body are updated, so a field
// explicitly set to null (e.g. clearing image_url) isn't ignored like
// COALESCE would do — it needs to distinguish "omitted" from "set to null".
router.put("/:id", async (req, res) => {
  const updatable = ["name", "description", "servings", "image_url"];
  const setClauses = [];
  const values = [];
  for (const field of updatable) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      values.push(req.body[field]);
      setClauses.push(`${field}=$${values.length}`);
    }
  }
  if (!setClauses.length) return res.status(400).json({ error: "no fields to update" });
  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE recipes SET ${setClauses.join(", ")} WHERE id=$${values.length} RETURNING *`,
    values
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// Delete recipe
router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM recipes WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

// --- Ingredients of a recipe ---

// Set all ingredients (replaces existing list)
router.put("/:id/ingredients", async (req, res) => {
  const recipeId = req.params.id;
  const { ingredients } = req.body; // [{name, quantity, unit}]
  if (!Array.isArray(ingredients)) return res.status(400).json({ error: "ingredients array required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM recipe_ingredients WHERE recipe_id=$1", [recipeId]);

    const { rows: existingIngredients } = await client.query("SELECT id, name FROM ingredients");
    const cache = existingIngredients.map((i) => ({ id: i.id, key: normalizeForMatch(i.name) }));

    for (const item of ingredients) {
      const { name, quantity, unit } = item;
      const ingredientId = await findOrCreateIngredient(client, name, cache);
      await client.query(
        "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES ($1,$2,$3,$4)",
        [recipeId, ingredientId, quantity, unit]
      );
    }
    await client.query("COMMIT");
    res.status(204).end();
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

// Set all steps (replaces existing list)
router.put("/:id/steps", async (req, res) => {
  const recipeId = req.params.id;
  const { steps } = req.body; // [{instruction}]
  if (!Array.isArray(steps)) return res.status(400).json({ error: "steps array required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM recipe_steps WHERE recipe_id=$1", [recipeId]);
    for (let i = 0; i < steps.length; i++) {
      await client.query(
        "INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES ($1,$2,$3)",
        [recipeId, i + 1, steps[i].instruction]
      );
    }
    await client.query("COMMIT");
    res.status(204).end();
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

module.exports = router;
