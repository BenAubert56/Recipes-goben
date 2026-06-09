import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; message: string; type: ToastType; leaving: boolean };

const Ctx = createContext<(msg: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setList(p => [...p, { id, message, type, leaving: false }]);
    setTimeout(() => setList(p => p.map(t => t.id === id ? { ...t, leaving: true } : t)), 2600);
    setTimeout(() => setList(p => p.filter(t => t.id !== id)), 3100);
  }, []);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {list.map(t => (
          <div key={t.id} className={`toast toast-${t.type}${t.leaving ? " toast-out" : ""}`}>
            <span className="toast-icon">
              {t.type === "success" ? "✓" : t.type === "error" ? "!" : "i"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
