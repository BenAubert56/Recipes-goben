import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Recipe } from "../services/api";
import { useToast } from "../components/Toast";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setRecipes(await api.getRecipes());
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    try {
      await api.deleteRecipe(id);
      toast(`"${name}" supprimée`);
      load();
    } catch {
      toast("Erreur lors de la suppression", "error");
    }
  };

  return (
    <div className="page-content">
      <div className="flex justify-between items-center" style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Mes recettes</h1>
        <button className="btn btn-primary btn-sm" onClick={() => navigate("/recipe/new")}>+ Nouvelle</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? <div className="spinner" /> : recipes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🍳</div>
          <p>Aucune recette.</p>
          <p className="text-muted" style={{ marginTop: 4 }}>Appuie sur "+ Nouvelle" pour commencer.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate("/recipe/new")}>
            Créer ma première recette
          </button>
        </div>
      ) : (
        recipes.map((r) => (
          <div key={r.id} className="card flex justify-between items-center" style={{ gap: 10 }}>
            <Link to={`/recipe/${r.id}`} style={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.name}
              </div>
              {r.description && (
                <div className="text-muted" style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.description}
                </div>
              )}
              <div className="badge" style={{ marginTop: 6 }}>👥 {r.servings} portion{r.servings > 1 ? "s" : ""}</div>
            </Link>
            <button className="btn btn-danger btn-sm" style={{ flexShrink: 0 }} onClick={() => del(r.id, r.name)}>🗑</button>
          </div>
        ))
      )}
    </div>
  );
}
