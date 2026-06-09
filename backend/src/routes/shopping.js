const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

// Generate shopping list for a date range
// Aggregates ingredients scaled to planned portions
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

  // Round to 2 decimal places for display
  const list = rows.map((r) => ({
    ingredient: r.ingredient,
    quantity: Math.ceil(parseFloat(r.total_quantity) * 10) / 10,
    unit: r.unit,
  }));

  res.json(list);
});

module.exports = router;
