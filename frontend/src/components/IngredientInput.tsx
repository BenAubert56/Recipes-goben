import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export default function IngredientInput({ value, onChange, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) { setSuggestions([]); setOpen(false); return; }

    timer.current = setTimeout(async () => {
      const results = await api.searchIngredients(value);
      // Only show if suggestion differs from exact current value
      const filtered = results.filter((s) => s.toLowerCase() !== value.toLowerCase());
      setSuggestions(filtered);
      setOpen(filtered.length > 0);
    }, 220);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value]);

  const pick = (name: string) => {
    onChange(name);
    setSuggestions([]);
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {open && (
        <ul className="autocomplete-list">
          {suggestions.map((s) => (
            <li key={s} className="autocomplete-item" onMouseDown={() => pick(s)}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
