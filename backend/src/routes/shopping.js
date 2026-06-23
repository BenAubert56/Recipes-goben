const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

// Generate shopping list for a date range
// Aggregates ingredients scaled to planned portions, plus custom extras
router.get("/", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from and to dates required" });

  const { rows } = await pool.query(
    `SELECT
       i.name                                                     AS ingredient,
       ri.unit,
       SUM(ri.quantity * mp.portions::numeric / r.servings::numeric) AS total_quantity
     FROM meal_plans mp
     JOIN recipes r ON r.id = mp.recipe_id
     JOIN recipe_ingredients ri ON ri.recipe_id = r.id
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE mp.date BETWEEN $1 AND $2
     GROUP BY i.name, ri.unit
     ORDER BY i.name`,
    [from, to]
  );

  const items = rows.map((r) => ({
    ingredient: r.ingredient,
    quantity: Math.ceil(parseFloat(r.total_quantity) * 10) / 10,
    unit: r.unit,
    extra: false,
  }));

  const { rows: extras } = await pool.query(
    `SELECT id, name AS ingredient, quantity, unit
     FROM shopping_extras
     WHERE week_start BETWEEN $1 AND $2
     ORDER BY name`,
    [from, to]
  );

  for (const e of extras) {
    items.push({
      id: e.id,
      ingredient: e.ingredient,
      quantity: e.quantity != null ? parseFloat(e.quantity) : null,
      unit: e.unit || "",
      extra: true,
    });
  }

  res.json(items);
});

// Add custom item (lessive, etc.)
router.post("/extras", async (req, res) => {
  const { week_start, name, quantity, unit } = req.body;
  if (!week_start || !name) return res.status(400).json({ error: "week_start and name required" });
  const { rows } = await pool.query(
    `INSERT INTO shopping_extras (week_start, name, quantity, unit)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [week_start, name.trim(), quantity ?? null, unit ?? null]
  );
  res.status(201).json(rows[0]);
});

// Delete custom item
router.delete("/extras/:id", async (req, res) => {
  await pool.query("DELETE FROM shopping_extras WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

module.exports = router;
