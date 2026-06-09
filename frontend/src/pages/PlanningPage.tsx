import { useEffect, useState } from "react";
import { api, MealPlan, Recipe } from "../services/api";

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
const fmt = (d: Date) => d.toISOString().split("T")[0];
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MEALS: Array<"midi" | "soir"> = ["midi", "soir"];

export default function PlanningPage() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modal, setModal] = useState(false);
  const [selDate, setSelDate] = useState("");
  const [selType, setSelType] = useState<"midi" | "soir">("midi");
  const [selPortions, setSelPortions] = useState(2);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const from = fmt(days[0]);
  const to = fmt(days[6]);

  const load = async () => {
    setLoading(true);
    const [m, r] = await Promise.all([api.getMealPlans(from, to), api.getRecipes()]);
    setMeals(m);
    setRecipes(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, [from]);

  const slotMeals = (date: Date, type: "midi" | "soir") =>
    meals.filter((m) => m.date.startsWith(fmt(date)) && m.meal_type === type);

  const openModal = (date: Date, type: "midi" | "soir") => {
    setSelDate(fmt(date));
    setSelType(type);
    setSelPortions(2);
    setModal(true);
  };

  const addMeal = async (recipe: Recipe) => {
    setModal(false);
    await api.addMeal({ date: selDate, meal_type: selType, recipe_id: recipe.id, portions: selPortions });
    load();
  };

  const removeMeal = async (id: number) => {
    if (!confirm("Retirer ce repas ?")) return;
    await api.deleteMeal(id);
    load();
  };

  const changeWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(getMonday(d));
  };

  const weekLabel = `${days[0].getDate()} – ${days[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div>
      <div className="week-nav">
        <button onClick={() => changeWeek(-1)}>‹</button>
        <span className="week-label">{weekLabel}</span>
        <button onClick={() => changeWeek(1)}>›</button>
      </div>

      {loading ? <div className="spinner" /> : days.map((day, i) => (
        <div key={i} className="day-block">
          <div className="day-header">{DAYS[i]} {day.getDate()}</div>
          {MEALS.map((type) => (
            <div key={type} className="meal-slot">
              <div className="slot-label">{type === "midi" ? "☀️ Midi" : "🌙 Soir"}</div>
              {slotMeals(day, type).map((m) => (
                <div key={m.id} className="meal-chip">
                  <div>
                    <div className="meal-chip-name">{m.recipe_name}</div>
                    <div className="meal-chip-portions">{m.portions} portion{m.portions > 1 ? "s" : ""}</div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => removeMeal(m.id)}>✕</button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} onClick={() => openModal(day, type)}>
                + Ajouter
              </button>
            </div>
          ))}
        </div>
      ))}

      {modal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
              <h2 style={{ fontWeight: 700, fontSize: 18 }}>Choisir une recette</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="flex items-center gap-3" style={{ marginBottom: 16, background: "#fdf0e8", borderRadius: 10, padding: "10px 14px" }}>
              <span style={{ fontWeight: 600 }}>Portions :</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelPortions((p) => Math.max(1, p - 1))}>−</button>
              <span style={{ fontSize: 20, fontWeight: 700, minWidth: 28, textAlign: "center" }}>{selPortions}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelPortions((p) => p + 1)}>+</button>
            </div>
            {recipes.length === 0 ? (
              <p className="text-muted">Aucune recette. Crée-en une d'abord.</p>
            ) : (
              recipes.map((r) => (
                <div key={r.id} className="card flex justify-between items-center" style={{ cursor: "pointer" }} onClick={() => addMeal(r)}>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span className="text-muted">›</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
