import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, Recipe } from "../services/api";
import IngredientInput from "../components/IngredientInput";

const UNITS = ["g", "kg", "ml", "L", "pièce", "c. à s.", "c. à c.", "pincée"];
type IngRow  = { name: string; quantity: string; unit: string };
type StepRow = { instruction: string };
const emptyIng  = (): IngRow  => ({ name: "", quantity: "", unit: "g" });
const emptyStep = (): StepRow => ({ instruction: "" });

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [recipe,  setRecipe]  = useState<Recipe | null>(null);
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving,  setSaving]  = useState(false);

  const [name,     setName]     = useState("");
  const [desc,     setDesc]     = useState("");
  const [servings, setServings] = useState("2");
  const [ings,     setIngs]     = useState<IngRow[]>([emptyIng()]);
  const [steps,    setSteps]    = useState<StepRow[]>([emptyStep()]);

  const load = async () => {
    if (isNew) return;
    try {
      const r = await api.getRecipe(Number(id));
      setRecipe(r);
      setName(r.name);
      setDesc(r.description || "");
      setServings(String(r.servings));
      setIngs((r.ingredients || []).map((i) => ({ name: i.name, quantity: String(i.quantity), unit: i.unit })));
      setSteps((r.steps || []).map((s) => ({ instruction: s.instruction })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const save = async () => {
    if (!name.trim()) return alert("Le nom est obligatoire.");
    setSaving(true);
    try {
      const validIngs  = ings.filter((i) => i.name.trim() && i.quantity);
      const validSteps = steps.filter((s) => s.instruction.trim());
      const payload = { name: name.trim(), description: desc.trim() || undefined, servings: parseInt(servings) || 2 };
      let rid: number;
      if (isNew) {
        const r = await api.createRecipe(payload);
        rid = r.id;
      } else {
        await api.updateRecipe(Number(id), payload);
        rid = Number(id);
      }
      await Promise.all([
        api.setIngredients(rid, validIngs.map((i) => ({ name: i.name.trim(), quantity: parseFloat(i.quantity), unit: i.unit }))),
        api.setSteps(rid, validSteps),
      ]);
      if (isNew) navigate(`/recipe/${rid}`, { replace: true });
      else { setEditing(false); load(); }
    } finally {
      setSaving(false);
    }
  };

  const updIng  = (i: number, f: keyof IngRow,  v: string) =>
    setIngs((p)  => p.map((r, j) => j === i ? { ...r, [f]: v } : r));
  const updStep = (i: number, v: string) =>
    setSteps((p) => p.map((s, j) => j === i ? { instruction: v } : s));

  if (loading) return <div className="spinner" />;

  /* ── View mode ── */
  if (!editing && recipe) {
    return (
      <div>
        <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/")}>← Retour</button>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>✏️ Modifier</button>
        </div>
        <div className="card">
          <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{recipe.name}</h1>
          {recipe.description && <p className="text-muted" style={{ marginTop: 8, lineHeight: 1.5 }}>{recipe.description}</p>}
          <div className="badge" style={{ marginTop: 12 }}>👥 {recipe.servings} portion{recipe.servings > 1 ? "s" : ""}</div>
        </div>

        <h2 className="section-title">Ingrédients</h2>
        {!recipe.ingredients?.length ? (
          <p className="text-muted">Aucun ingrédient renseigné.</p>
        ) : (
          <div className="card" style={{ padding: "0 14px" }}>
            {recipe.ingredients.map((ing) => (
              <div key={ing.id} className="flex justify-between items-center"
                style={{ padding: "13px 0", borderBottom: "1px solid #f0ede9" }}>
                <span style={{ fontSize: 16 }}>{ing.name}</span>
                <span className="text-muted" style={{ marginLeft: 12, whiteSpace: "nowrap" }}>{ing.quantity} {ing.unit}</span>
              </div>
            ))}
          </div>
        )}

        <h2 className="section-title">Préparation</h2>
        {!recipe.steps?.length ? (
          <p className="text-muted">Aucune étape renseignée.</p>
        ) : (
          <div className="steps-list">
            {recipe.steps.map((s) => (
              <div key={s.id} className="step-item">
                <div className="step-number">{s.step_number}</div>
                <p className="step-text">{s.instruction}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Edit / create mode ── */
  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => isNew ? navigate("/") : setEditing(false)}>
          ← {isNew ? "Annuler" : "Retour"}
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 700 }}>{isNew ? "Nouvelle recette" : "Modifier"}</h1>
      </div>

      <div className="card">
        <label>Nom *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pâtes bolognaise" />
        <label>Description</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description courte…" />
        <label>Portions par défaut</label>
        <input type="number" value={servings} onChange={(e) => setServings(e.target.value)} style={{ width: 90 }} min={1} />
      </div>

      <h2 className="section-title">Ingrédients</h2>
      <div className="card">
        {ings.map((ing, i) => (
          <div key={i} className="ing-row">
            <IngredientInput value={ing.name} onChange={(v) => updIng(i, "name", v)} placeholder="Ingrédient" />
            <input type="number" value={ing.quantity} onChange={(e) => updIng(i, "quantity", e.target.value)} placeholder="Qté" min={0} />
            <select value={ing.unit} onChange={(e) => updIng(i, "unit", e.target.value)}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
            {ings.length > 1 && (
              <button className="btn btn-danger btn-sm" style={{ padding: "8px" }}
                onClick={() => setIngs((p) => p.filter((_, j) => j !== i))}>✕</button>
            )}
          </div>
        ))}
        <button className="btn btn-secondary btn-sm mt-2" onClick={() => setIngs((p) => [...p, emptyIng()])}>
          + Ajouter un ingrédient
        </button>
      </div>

      <h2 className="section-title">Étapes de préparation</h2>
      <div className="card">
        {steps.map((step, i) => (
          <div key={i} className="step-edit-row">
            <div className="step-number">{i + 1}</div>
            <textarea
              value={step.instruction}
              onChange={(e) => updStep(i, e.target.value)}
              placeholder={`Étape ${i + 1}…`}
              style={{ minHeight: 70 }}
            />
            {steps.length > 1 && (
              <button className="btn btn-danger btn-sm" style={{ padding: "8px", alignSelf: "flex-start" }}
                onClick={() => setSteps((p) => p.filter((_, j) => j !== i))}>✕</button>
            )}
          </div>
        ))}
        <button className="btn btn-secondary btn-sm mt-2" onClick={() => setSteps((p) => [...p, emptyStep()])}>
          + Ajouter une étape
        </button>
      </div>

      <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
