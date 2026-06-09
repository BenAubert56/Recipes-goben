import { useEffect, useState } from "react";
import { api, ShoppingItem } from "../services/api";

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
const fmt   = (d: Date) => d.toISOString().split("T")[0];
const fmtFr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export default function ShoppingPage() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [items, setItems]         = useState<ShoppingItem[]>([]);
  const [checked, setChecked]     = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const load = async () => {
    setLoading(true);
    setChecked(new Set());
    setItems(await api.getShopping(fmt(weekStart), fmt(weekEnd)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [fmt(weekStart)]);

  const toggle = (key: string) =>
    setChecked((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const changeWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(getMonday(d));
  };

  const share = async () => {
    if (!items.length) return alert("Liste vide.");
    const header = `🛒 Courses du ${fmtFr(weekStart)} au ${fmtFr(weekEnd)}`;
    const lines  = items.map((i) => `• ${i.ingredient} : ${i.quantity} ${i.unit}`).join("\n");
    const text   = `${header}\n\n${lines}`;
    if (navigator.share) {
      await navigator.share({ title: "Liste de courses", text });
    } else {
      await navigator.clipboard.writeText(text);
      alert("Liste copiée dans le presse-papier !");
    }
  };

  const unchecked = items.filter((i) => !checked.has(i.ingredient));
  const done      = items.filter((i) =>  checked.has(i.ingredient));
  const weekLabel = `${fmtFr(weekStart)} – ${fmtFr(weekEnd)}`;

  return (
    <div>
      <div className="week-nav">
        <button onClick={() => changeWeek(-1)}>‹</button>
        <span className="week-label">{weekLabel}</span>
        <button onClick={() => changeWeek(1)}>›</button>
      </div>

      {loading ? <div className="spinner" /> : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🛒</div>
          <p>Aucun repas planifié cette semaine.</p>
          <p className="text-muted" style={{ marginTop: 4 }}>Ajoute des repas dans le Planning.</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            {unchecked.length} article{unchecked.length !== 1 ? "s" : ""} restant{unchecked.length !== 1 ? "s" : ""}
          </div>

          <div className="card" style={{ padding: "0 14px" }}>
            {[...unchecked, ...done].map((item) => {
              const isChecked = checked.has(item.ingredient);
              return (
                <div key={item.ingredient} className={`check-item${isChecked ? " done" : ""}`}
                  onClick={() => toggle(item.ingredient)}>
                  <div className={`checkbox${isChecked ? " checked" : ""}`}>
                    {isChecked && <span style={{ color: "#fff", fontSize: 14, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span className="item-name" style={{ flex: 1, fontSize: 16, minWidth: 0 }}>{item.ingredient}</span>
                  <span className="item-qty" style={{ fontSize: 15, color: "#888", whiteSpace: "nowrap", marginLeft: 8 }}>
                    {item.quantity} {item.unit}
                  </span>
                </div>
              );
            })}
          </div>

          <button className="btn btn-primary btn-full" onClick={share}>
            📤 Partager la liste
          </button>
        </>
      )}
    </div>
  );
}
