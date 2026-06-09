import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import RecipesPage from "./pages/RecipesPage";
import RecipeDetailPage from "./pages/RecipeDetailPage";
import PlanningPage from "./pages/PlanningPage";
import ShoppingPage from "./pages/ShoppingPage";
import "./index.css";

const NAV = [
  { to: "/",        end: true, icon: "🍽",  label: "Recettes" },
  { to: "/planning",           icon: "📅",  label: "Planning" },
  { to: "/courses",            icon: "🛒",  label: "Courses"  },
];

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <header className="top-bar">
          <span className="top-bar-title">🍽 Recipe Shop</span>
          <nav className="top-bar-links">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>
            ))}
          </nav>
        </header>

        <main className="main">
          <Routes>
            <Route path="/"           element={<RecipesPage />} />
            <Route path="/recipe/:id" element={<RecipeDetailPage />} />
            <Route path="/planning"   element={<PlanningPage />} />
            <Route path="/courses"    element={<ShoppingPage />} />
          </Routes>
        </main>

        <nav className="bottom-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </ToastProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);
