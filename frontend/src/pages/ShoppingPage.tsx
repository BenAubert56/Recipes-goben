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
const fmtQty = (n: number | null) => n == null ? "" : (+n.toFixed(2) % 1 === 0 ? String(Math.round(n)) : +n.toFixed(2).toString());

async function copyToClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
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

const UNITS = ["", "g", "kg", "ml", "L", "pièce", "paquet", "rouleau"];

// Checked items are persisted per week in localStorage: nothing server-side
// tracks them, so without this the list came back fully unchecked on every
// revisit (leaving the week, coming back, reloading…).
const checkedStorageKey = (weekStart: string) => `courses-cochees-${weekStart}`;

function loadChecked(weekStart: string): Set<string> {
  try {
    const raw = localStorage.getItem(checkedStorageKey(weekStart));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveChecked(weekStart: string, checked: Set<string>) {
  try { localStorage.setItem(checkedStorageKey(weekStart), JSON.stringify([...checked])); } catch {}
}

export default function ShoppingPage() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [items,     setItems]     = useState<ShoppingItem[]>([]);
  const [checked,   setChecked]   = useState<Set<string>>(new Set());
  const [loading,   setLoading]   = useState(true);
  const [copyModal, setCopyModal] = useState(false);
  const [copyText,  setCopyText]  = useState("");
  const [addModal,  setAddModal]  = useState(false);
  const [newName,   setNewName]   = useState("");
  const [newQty,    setNewQty]    = useState("");
  const [newUnit,   setNewUnit]   = useState("");
  const [editItem,  setEditItem]  = useState<ShoppingItem | null>(null);
  const [editName,  setEditName]  = useState("");
  const [editQty,   setEditQty]   = useState("");
  const [editUnit,  setEditUnit]  = useState("");
  const toast = useToast();

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekKey = fmt(weekStart);

  const load = async () => {
    try {
      setLoading(true);
      setChecked(loadChecked(weekKey));
      setItems(await api.getShopping(weekKey, fmt(weekEnd)));
    } catch {
      toast("Impossible de charger la liste", "error");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      setItems(await api.getShopping(weekKey, fmt(weekEnd)));
    } catch {
      toast("Erreur de rafraîchissement", "error");
    }
  };

  useEffect(() => { load(); }, [weekKey]);

  const itemKey = (it: ShoppingItem) =>
    it.extra && it.id != null ? `extra-${it.id}` : `${it.ingredient}|${it.unit}`;

  const toggle = (key: string) =>
    setChecked(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      saveChecked(weekKey, n);
      return n;
    });

  const openEdit = (item: ShoppingItem) => {
    setEditItem(item);
    setEditName(item.ingredient);
    setEditQty(item.quantity != null ? String(item.quantity) : "");
    setEditUnit(item.unit || "");
  };

  const saveEdit = async () => {
    if (!editItem) return;
    try {
      if (editItem.extra && editItem.id != null) {
        if (!editName.trim()) { toast("Nom requis", "error"); return; }
        await api.updateShoppingExtra(editItem.id, {
          name: editName.trim(),
          quantity: editQty ? parseFloat(editQty) : null,
          unit: editUnit || null,
        });
      } else {
        if (!editQty) { toast("Quantité requise", "error"); return; }
        await api.setShoppingOverride({
          week_start: weekKey,
          ingredient: editItem.ingredient,
          unit: editItem.unit,
          quantity: parseFloat(editQty),
        });
      }
      setEditItem(null);
      refresh();
      toast("Quantité mise à jour");
    } catch {
      toast("Erreur lors de la modification", "error");
    }
  };

  const resetOverride = async () => {
    if (!editItem) return;
    try {
      await api.clearShoppingOverride({ week_start: weekKey, ingredient: editItem.ingredient, unit: editItem.unit });
      setEditItem(null);
      refresh();
      toast("Quantité réinitialisée");
    } catch {
      toast("Erreur lors de la réinitialisation", "error");
    }
  };

  const changeWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(getMonday(d));
  };

  const addExtra = async () => {
    if (!newName.trim()) { toast("Nom requis", "error"); return; }
    try {
      await api.addShoppingExtra({
        week_start: fmt(weekStart),
        name: newName.trim(),
        quantity: newQty ? parseFloat(newQty) : null,
        unit: newUnit || null,
      });
      setAddModal(false);
      setNewName(""); setNewQty(""); setNewUnit("");
      refresh();
      toast("Article ajouté");
    } catch {
      toast("Erreur lors de l'ajout", "error");
    }
  };

  const removeExtra = async (id: number) => {
    const prev = items;
    setItems(items.filter(i => !(i.extra && i.id === id)));
    try {
      await api.deleteShoppingExtra(id);
      toast("Article retiré");
    } catch {
      setItems(prev);
      toast("Erreur lors de la suppression", "error");
    }
  };

  const share = async () => {
    if (!items.length) { toast("La liste est vide", "error"); return; }
    const header = `🛒 Courses du ${fmtFr(weekStart)} au ${fmtFr(weekEnd)}`;
    const lines  = items.map(i => `• ${i.ingredient}${i.quantity != null ? ` : ${fmtQty(i.quantity)} ${i.unit}` : ""}`).join("\n");
    const text   = `${header}\n\n${lines}`;

    if (navigator.share) {
      try { await navigator.share({ title: "Liste de courses", text }); return; } catch {}
    }

    const copied = await copyToClipboard(text);
    if (copied) { toast("Liste copiée !"); return; }

    setCopyText(text);
    setCopyModal(true);
  };

  const unchecked  = items.filter(i => !checked.has(itemKey(i)));
  const done       = items.filter(i =>  checked.has(itemKey(i)));
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
          <p>Aucun article cette semaine.</p>
          <p className="text-muted" style={{ marginTop: 4 }}>Ajoute des repas dans le Planning, ou ajoute un article ci-dessous.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setAddModal(true)}>
            + Ajouter un article
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            {unchecked.length} article{unchecked.length !== 1 ? "s" : ""} restant{unchecked.length !== 1 ? "s" : ""}
          </div>

          <div className="card" style={{ padding: "0 14px" }}>
            {[...unchecked, ...done].map((item) => {
              const key = itemKey(item);
              const isChecked = checked.has(key);
              return (
                <div key={key} className={`check-item${isChecked ? " done" : ""}`}
                  onClick={() => toggle(key)}>
                  <div className={`checkbox${isChecked ? " checked" : ""}`}>
                    {isChecked && <span style={{ color: "#fff", fontSize: 14, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span className="item-name" style={{ flex: 1, fontSize: 16, minWidth: 0 }}>
                    {item.ingredient}
                    {item.extra && <span style={{ marginLeft: 6, fontSize: 11, color: "#e07b39" }}>★</span>}
                    {item.overridden && <span style={{ marginLeft: 6, fontSize: 11, color: "#888" }} title="Quantité modifiée manuellement">✎</span>}
                  </span>
                  <span className="item-qty" style={{ fontSize: 15, color: "#888", whiteSpace: "nowrap", marginLeft: 8 }}>
                    {item.quantity != null ? `${fmtQty(item.quantity)} ${item.unit}` : ""}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: 8, padding: "4px 8px" }}
                    onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                  >✎</button>
                  {item.extra && item.id != null && (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ marginLeft: 8, padding: "4px 8px" }}
                      onClick={(e) => { e.stopPropagation(); removeExtra(item.id!); }}
                    >✕</button>
                  )}
                </div>
              );
            })}
          </div>

          <button className="btn btn-secondary btn-full" style={{ marginTop: 12 }} onClick={() => setAddModal(true)}>
            + Ajouter un article (lessive, etc.)
          </button>

          <button className="btn btn-primary btn-full" onClick={share}>
            📤 Partager la liste
          </button>
        </>
      )}

      {addModal && createPortal(
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setAddModal(false)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
              <h2 style={{ fontWeight: 700, fontSize: 18 }}>Ajouter un article</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <label>Nom *</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ex: Lessive, papier toilette…"
              autoFocus
            />
            <div className="ing-row" style={{ marginTop: 10 }}>
              <input
                type="number"
                value={newQty}
                onChange={e => setNewQty(e.target.value)}
                placeholder="Qté"
                min={0}
              />
              <select value={newUnit} onChange={e => setNewUnit(e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u || "—"}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={addExtra}>
              Ajouter
            </button>
          </div>
        </div>,
        document.body
      )}

      {editItem && createPortal(
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setEditItem(null)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
              <h2 style={{ fontWeight: 700, fontSize: 18 }}>Modifier la quantité</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditItem(null)}>✕</button>
            </div>
            {editItem.extra ? (
              <>
                <label>Nom *</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
              </>
            ) : (
              <p className="text-muted" style={{ marginBottom: 4 }}>{editItem.ingredient}</p>
            )}
            <div className="ing-row" style={{ marginTop: 10 }}>
              <input
                type="number"
                value={editQty}
                onChange={e => setEditQty(e.target.value)}
                placeholder="Qté"
                min={0}
                autoFocus={!editItem.extra}
              />
              <select value={editUnit} onChange={e => setEditUnit(e.target.value)} disabled={!editItem.extra}>
                {UNITS.map(u => <option key={u} value={u}>{u || "—"}</option>)}
              </select>
            </div>
            {!editItem.extra && (
              <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                Utile si tu en as déjà à la maison : la quantité à acheter sera ajustée pour cette semaine uniquement.
              </p>
            )}
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={saveEdit}>
              Enregistrer
            </button>
            {!editItem.extra && editItem.overridden && (
              <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={resetOverride}>
                Réinitialiser (revenir au calcul automatique)
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

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
