import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api, MealPlan, Recipe } from "../services/api";
import { useToast } from "../components/Toast";

function getMonday(d: Date) {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
const fmt  = (d: Date) => d.toISOString().split("T")[0];
type MealType = "matin" | "midi" | "soir";
const DAYS: MealType[] = ["matin", "midi", "soir"];
const SLOT_LABEL: Record<MealType, string> = {
  matin: "🥐 Matin",
  midi:  "☀️ Midi",
  soir:  "🌙 Soir",
};
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function PlanningPage() {
  const [weekStart,   setWeekStart]   = useState(getMonday(new Date()));
  const [meals,       setMeals]       = useState<MealPlan[]>([]);
  const [recipes,     setRecipes]     = useState<Recipe[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [selDate,     setSelDate]     = useState("");
  const [selType,     setSelType]     = useState<MealType>("midi");
  const [selPortions, setSelPortions] = useState(2);
  const [search,      setSearch]      = useState("");
  const [pickedRecipe, setPickedRecipe] = useState<Recipe | null>(null);
  const toast = useToast();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const from = fmt(days[0]);
  const to   = fmt(days[6]);

  const load = async () => {
    try {
      setLoading(true);
      const [m, r] = await Promise.all([api.getMealPlans(from, to), api.getRecipes()]);
      setMeals(m);
      setRecipes(r);
    } catch {
      toast("Impossible de charger le planning", "error");
    } finally {
      setLoading(false);
    }
  };

  // Rechargement silencieux des repas (sans spinner → conserve le scroll)
  const refreshMeals = async () => {
    try {
      setMeals(await api.getMealPlans(from, to));
    } catch {
      toast("Erreur de rafraîchissement", "error");
    }
  };

  useEffect(() => { load(); }, [from]);

  const slotMeals = (date: Date, type: MealType) =>
    meals.filter(m => m.date.startsWith(fmt(date)) && m.meal_type === type);

  const openModal = (date: Date, type: MealType) => {
    setSelDate(fmt(date));
    setSelType(type);
    setSearch("");
    setPickedRecipe(null);
    setModal(true);
  };

  const filteredRecipes = useMemo(
    () => recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase())),
    [recipes, search]
  );

  // Étape 1 → 2 : les portions par défaut reprennent celles de la recette,
  // pas une valeur fixe arbitraire — l'utilisateur peut ensuite les ajuster.
  const pickRecipe = (recipe: Recipe) => {
    setPickedRecipe(recipe);
    setSelPortions(recipe.servings);
  };

  const confirmAddMeal = async () => {
    if (!pickedRecipe) return;
    const recipe = pickedRecipe;
    setModal(false);
    try {
      await api.addMeal({ date: selDate, meal_type: selType, recipe_id: recipe.id, portions: selPortions });
      refreshMeals();
    } catch {
      toast("Erreur lors de l'ajout", "error");
    }
  };

  const copyMidiToSoir = async (date: Date) => {
    const midiMeals = slotMeals(date, "midi");
    if (!midiMeals.length) return;
    try {
      await Promise.all(
        midiMeals.map(m =>
          api.addMeal({ date: fmt(date), meal_type: "soir", recipe_id: m.recipe_id, portions: m.portions })
        )
      );
      toast("Repas copié sur le soir !");
      refreshMeals();
    } catch {
      toast("Erreur lors de la copie", "error");
    }
  };

  const removeMeal = async (id: number) => {
    // Optimistic: on retire tout de suite de l'UI
    const prev = meals;
    setMeals(m => m.filter(x => x.id !== id));
    try {
      await api.deleteMeal(id);
      toast("Repas retiré");
    } catch {
      setMeals(prev); // rollback si erreur
      toast("Erreur lors de la suppression", "error");
    }
  };

  const changeWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(getMonday(d));
  };

  const weekLabel = `${days[0].getDate()} – ${days[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div className="page-content">
      <div className="week-nav">
        <button onClick={() => changeWeek(-1)}>‹</button>
        <span className="week-label">{weekLabel}</span>
        <button onClick={() => changeWeek(1)}>›</button>
      </div>

      {loading ? <div className="spinner" /> : days.map((day, i) => (
        <div key={i} className="day-block">
          <div className="day-header">
          <span className="day-header-dot" />
          {DAY_NAMES[i]}
          <span className="day-header-num">{day.getDate()}</span>
        </div>
          {DAYS.map((type) => {
            const showCopy = type === "soir"
              && slotMeals(day, "midi").length > 0
              && slotMeals(day, "soir").length === 0;
            const meals = slotMeals(day, type);
            return (
              <div key={type} className="meal-slot">
                <div className="slot-label">{SLOT_LABEL[type]}</div>
                {meals.map((m) => (
                  <div key={m.id} className="meal-chip">
                    <Link to={`/recipe/${m.recipe_id}`} style={{ color: "inherit", textDecoration: "none", minWidth: 0 }}>
                      <div className="meal-chip-name">{m.recipe_name}</div>
                      <div className="meal-chip-portions">{m.portions} portion{m.portions > 1 ? "s" : ""}</div>
                    </Link>
                    <button className="btn btn-danger btn-sm" onClick={() => removeMeal(m.id)}>✕</button>
                  </div>
                ))}
                <div className="slot-actions">
                  {showCopy && (
                    <button className="btn btn-copy btn-sm" onClick={() => copyMidiToSoir(day)}>
                      ⇊ Copier le midi
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => openModal(day, type)}>
                    + {meals.length ? "Ajouter une recette" : "Ajouter"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {modal && createPortal(
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-sheet modal-sheet-tall">
            {!pickedRecipe ? (
              <>
                {/* Étape 1 : choix de la recette */}
                <div className="modal-header">
                  <div className="modal-handle" />
                  <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
                    <h2 style={{ fontWeight: 700, fontSize: 18 }}>
                      Ajouter un repas
                    </h2>
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>✕</button>
                  </div>

                  {recipes.length > 4 && (
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</span>
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher une recette…"
                        style={{ paddingLeft: 38 }}
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* Liste scrollable */}
                <div className="modal-recipe-list">
                  {recipes.length === 0 ? (
                    <p className="text-muted" style={{ textAlign: "center", padding: "40px 0" }}>
                      Aucune recette. Crée-en une d'abord.
                    </p>
                  ) : filteredRecipes.length === 0 ? (
                    <p className="text-muted" style={{ textAlign: "center", padding: "40px 0" }}>
                      Aucune recette ne correspond.
                    </p>
                  ) : (
                    filteredRecipes.map((r, idx) => (
                      <div
                        key={r.id}
                        className="recipe-pick-item"
                        style={{ animationDelay: `${idx * 0.04}s` }}
                        onClick={() => pickRecipe(r)}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{r.name}</div>
                          {r.description && (
                            <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{r.description}</div>
                          )}
                        </div>
                        <span style={{ color: "#e07b39", fontSize: 18, fontWeight: 700 }}>›</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Étape 2 : portions, pré-remplies avec les portions par défaut de la recette */}
                <div className="modal-header">
                  <div className="modal-handle" />
                  <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
                    <h2 style={{ fontWeight: 700, fontSize: 18 }}>{pickedRecipe.name}</h2>
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>✕</button>
                  </div>

                  <div className="portions-row">
                    <span style={{ fontWeight: 600, flex: 1 }}>Portions</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelPortions(p => Math.max(1, p - 1))}>−</button>
                    <span style={{ fontSize: 20, fontWeight: 700, minWidth: 32, textAlign: "center" }}>{selPortions}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelPortions(p => p + 1)}>+</button>
                  </div>
                  <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Par défaut : {pickedRecipe.servings} portion{pickedRecipe.servings > 1 ? "s" : ""} pour cette recette.
                  </p>
                </div>

                <div className="modal-recipe-list" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14 }}>
                  <button className="btn btn-secondary btn-full" onClick={() => setPickedRecipe(null)}>
                    ← Choisir une autre recette
                  </button>
                  <button className="btn btn-primary btn-full" onClick={confirmAddMeal}>
                    Ajouter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
