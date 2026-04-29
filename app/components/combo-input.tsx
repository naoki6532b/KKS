"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
};

export function ComboInput({ value, onChange, suggestions, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions
    .filter((s) => !value || s.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 12);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: "absolute", zIndex: 200, top: "calc(100% + 2px)", left: 0, right: 0,
          background: "var(--surface)", border: "1px solid var(--border-strong)",
          borderRadius: "var(--r)", boxShadow: "0 4px 20px rgba(13,43,94,0.14)",
          listStyle: "none", margin: 0, padding: "4px 0",
          maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
              style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, color: "var(--text)", transition: "background 0.1s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sapphire-light)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
