import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import RecipesPage from "./pages/RecipesPage";
import RecipeDetailPage from "./pages/RecipeDetailPage";
import PlanningPage from "./pages/PlanningPage";
import ShoppingPage from "./pages/ShoppingPage";
import "./index.css";

const LogoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M4 14c0-3.3 2.7-6 6-6s6 2.7 6 6H4z" fill="white" />
    <rect x="3" y="14" width="14" height="2.5" rx="1.25" fill="white" />
    <path d="M10 4v4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7.5 5.5 10 8l2.5-2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconRecipes = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="9" y1="7" x2="15" y2="7" />
    <line x1="9" y1="11" x2="13" y2="11" />
  </svg>
);

const IconCalendar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <rect x="8" y="14" width="3" height="3" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

const IconBag = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const NAV = [
  { to: "/",         end: true, icon: <IconRecipes />,  label: "Recettes" },
  { to: "/planning",            icon: <IconCalendar />, label: "Planning" },
  { to: "/courses",             icon: <IconBag />,      label: "Courses"  },
];

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <header className="top-bar">
          <div className="brand">
            <div className="brand-mark"><LogoIcon /></div>
            <span className="brand-name">Recipe<span> Shop</span></span>
          </div>
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
              <span className="nav-pill">{n.icon}</span>
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
