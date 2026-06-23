import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Recipe } from "../services/api";
import { useToast } from "../components/Toast";

const AVATAR_GRADIENTS = [
  ["#C55A2B", "#E8722A"],
  ["#2B6EC5", "#2A8FE8"],
  ["#2BA87A", "#2AC877"],
  ["#C59A2B", "#E8C02A"],
  ["#8B2BC5", "#AA4AE8"],
  ["#C52B5A", "#E84A88"],
];

function avatarGradient(name: string) {
  const i = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  return `linear-gradient(135deg, ${AVATAR_GRADIENTS[i][0]}, ${AVATAR_GRADIENTS[i][1]})`;
}

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

  const del = async (e: React.MouseEvent, id: number, name: string) => {
    e.preventDefault();
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes recettes</h1>
          {recipes.length > 0 && (
            <p className="page-subtitle">{recipes.length} recette{recipes.length > 1 ? "s" : ""}</p>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate("/recipe/new")}>
          + Nouvelle
        </button>
      </div>

      {error && <div className="alert alert-error">⚠ {error}</div>}

      {loading ? <div className="spinner" /> : recipes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🍳</span>
          <p>Aucune recette pour l'instant.</p>
          <p className="text-muted" style={{ marginTop: 6 }}>Commence par créer ta première recette.</p>
          <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => navigate("/recipe/new")}>
            Créer une recette
          </button>
        </div>
      ) : (
        recipes.map((r, idx) => (
          <Link
            key={r.id}
            to={`/recipe/${r.id}`}
            className="recipe-card"
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            {r.image_url ? (
              <img
                src={r.image_url}
                alt=""
                className="recipe-avatar"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div
                className="recipe-avatar"
                style={{ background: avatarGradient(r.name) }}
              >
                {r.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="recipe-card-body">
              <div className="recipe-card-name">{r.name}</div>
              {r.description && (
                <div className="recipe-card-desc">{r.description}</div>
              )}
              <div className="recipe-card-meta">
                <span className="badge">👥 {r.servings} portion{r.servings > 1 ? "s" : ""}</span>
              </div>
            </div>

            <button
              className="btn btn-danger btn-sm"
              style={{ flexShrink: 0, borderRadius: "50%", width: 36, height: 36, padding: 0, minHeight: 36 }}
              onClick={(e) => del(e, r.id, r.name)}
            >
              🗑
            </button>
          </Link>
        ))
      )}
    </div>
  );
}
