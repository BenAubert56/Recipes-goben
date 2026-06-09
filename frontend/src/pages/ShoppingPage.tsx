import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, ShoppingItem } from "../services/api";
import { useToast } from "../components/Toast";

function getMonday(d: Date) {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
const fmt   = (d: Date) => d.toISOString().split("T")[0];
const fmtFr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const fmtQty = (n: number) => +n.toFixed(2) % 1 === 0 ? String(Math.round(n)) : +n.toFixed(2).toString();

async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Clipboard API (HTTPS / localhost)
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  // 2. execCommand (HTTP fallback)
  try {
    const el = document.createElement("textarea");
    el.value = text;
    Object.assign(el.style, { position: "fixed", top: "0", left: "0", opacity: "0", pointerEvents: "none" });
    document.body.appendChild(el);
    el.focus(); el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    if (ok) return true;
  } catch {}
  return false;
}

export default function ShoppingPage() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [items,     setItems]     = useState<ShoppingItem[]>([]);
  const [checked,   setChecked]   = useState<Set<string>>(new Set());
  const [loading,   setLoading]   = useState(true);
  const [copyModal, setCopyModal] = useState(false);
  const [copyText,  setCopyText]  = useState("");
  const toast = useToast();

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const load = async () => {
    try {
      setLoading(true);
      setChecked(new Set());
      setItems(await api.getShopping(fmt(weekStart), fmt(weekEnd)));
    } catch {
      toast("Impossible de charger la liste", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [fmt(weekStart)]);

  const toggle = (key: string) =>
    setChecked(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const changeWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(getMonday(d));
  };

  const share = async () => {
    if (!items.length) { toast("La liste est vide", "error"); return; }
    const header = `🛒 Courses du ${fmtFr(weekStart)} au ${fmtFr(weekEnd)}`;
    const lines  = items.map(i => `• ${i.ingredient} : ${fmtQty(i.quantity)} ${i.unit}`).join("\n");
    const text   = `${header}\n\n${lines}`;

    // Native share (mobile HTTPS)
    if (navigator.share) {
      try { await navigator.share({ title: "Liste de courses", text }); return; } catch {}
    }

    // Clipboard fallback
    const copied = await copyToClipboard(text);
    if (copied) { toast("Liste copiée !"); return; }

    // Last resort: show modal with text to copy manually
    setCopyText(text);
    setCopyModal(true);
  };

  const unchecked  = items.filter(i => !checked.has(i.ingredient));
  const done       = items.filter(i =>  checked.has(i.ingredient));
  const weekLabel  = `${fmtFr(weekStart)} – ${fmtFr(weekEnd)}`;

  return (
    <div className="page-content">
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
                    {fmtQty(item.quantity)} {item.unit}
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

      {/* Copy modal — fallback for HTTP contexts */}
      {copyModal && createPortal(
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setCopyModal(false)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
              <h2 style={{ fontWeight: 700, fontSize: 18 }}>Copier la liste</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setCopyModal(false)}>✕</button>
            </div>
            <p className="text-muted" style={{ marginBottom: 12 }}>Sélectionne le texte ci-dessous et copie-le.</p>
            <textarea
              readOnly
              value={copyText}
              style={{ minHeight: 200, fontSize: 14, lineHeight: 1.6 }}
              onFocus={e => e.target.select()}
            />
            <button className="btn btn-primary btn-full" onClick={async () => {
              const ok = await copyToClipboard(copyText);
              if (ok) { toast("Liste copiée !"); setCopyModal(false); }
            }}>
              Copier
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
