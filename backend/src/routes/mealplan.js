const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

// Get meal plans for a week (query: ?from=YYYY-MM-DD&to=YYYY-MM-DD)
router.get("/", async (req, res) => {
  const { from, to } = req.query;
  const { rows } = await pool.query(
    `SELECT mp.id, mp.date, mp.meal_type, mp.portions,
            r.id AS recipe_id, r.name AS recipe_name, r.servings AS recipe_servings
     FROM meal_plans mp
     JOIN recipes r ON r.id = mp.recipe_id
     WHERE mp.date BETWEEN $1 AND $2
     ORDER BY mp.date, mp.meal_type`,
    [from, to]
  );
  res.json(rows);
});

// Add a meal
router.post("/", async (req, res) => {
  const { date, meal_type, recipe_id, portions } = req.body;
  if (!date || !meal_type || !recipe_id) return res.status(400).json({ error: "date, meal_type, recipe_id required" });
  const { rows } = await pool.query(
    "INSERT INTO meal_plans (date, meal_type, recipe_id, portions) VALUES ($1,$2,$3,$4) RETURNING *",
    [date, meal_type, recipe_id, portions || 2]
  );
  res.status(201).json(rows[0]);
});

// Update a meal (e.g. change portions)
router.put("/:id", async (req, res) => {
  const { date, meal_type, recipe_id, portions } = req.body;
  const { rows } = await pool.query(
    `UPDATE meal_plans SET
       date=COALESCE($1,date),
       meal_type=COALESCE($2,meal_type),
       recipe_id=COALESCE($3,recipe_id),
       portions=COALESCE($4,portions)
     WHERE id=$5 RETURNING *`,
    [date, meal_type, recipe_id, portions, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// Delete a meal
router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM meal_plans WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

module.exports = router;
