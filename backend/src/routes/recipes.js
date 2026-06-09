const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

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
  const { name, description, servings = 2 } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const { rows } = await pool.query(
    "INSERT INTO recipes (name, description, servings) VALUES ($1,$2,$3) RETURNING *",
    [name, description, servings]
  );
  res.status(201).json(rows[0]);
});

// Update recipe
router.put("/:id", async (req, res) => {
  const { name, description, servings } = req.body;
  const { rows } = await pool.query(
    "UPDATE recipes SET name=COALESCE($1,name), description=COALESCE($2,description), servings=COALESCE($3,servings) WHERE id=$4 RETURNING *",
    [name, description, servings, req.params.id]
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

    for (const item of ingredients) {
      const { name, quantity, unit } = item;
      const ing = await client.query(
        "INSERT INTO ingredients (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        [name]
      );
      await client.query(
        "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES ($1,$2,$3,$4)",
        [recipeId, ing.rows[0].id, quantity, unit]
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
