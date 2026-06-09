const express = require("express");
const cors = require("cors");
const { migrate } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/recipes", require("./routes/recipes"));
app.use("/ingredients", require("./routes/ingredients"));
app.use("/meal-plans", require("./routes/mealplan"));
app.use("/shopping", require("./routes/shopping"));

app.get("/health", (_, res) => res.json({ ok: true }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;

async function start() {
  // Retry connection until Postgres is ready
  for (let i = 0; i < 10; i++) {
    try {
      await migrate();
      break;
    } catch (e) {
      console.log(`DB not ready, retrying (${i + 1}/10)...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`API ready on port ${PORT}`));
}

start();
