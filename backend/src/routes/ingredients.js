const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

// Search ingredients by name (for autocomplete)
router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  const { rows } = await pool.query(
    "SELECT name FROM ingredients WHERE name ILIKE $1 ORDER BY name LIMIT 10",
    [`%${q}%`]
  );
  res.json(rows.map((r) => r.name));
});

module.exports = router;
