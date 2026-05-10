"use client";

import { useEffect, useRef, useState } from "react";

export function ChartZoom({
  title,
  normalHeight = 460,
  children,
}: {
  title?: string;
  normalHeight?: number;
  children: (height: number | `${number}%`) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Native capture-phase listener — fires before React/Recharts synthetic events
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = () => setOpen(true);
    el.addEventListener("click", handler, true);
    return () => el.removeEventListener("click", handler, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        ref={wrapperRef}
        style={{ cursor: "zoom-in", position: "relative" }}
        title="クリックで拡大"
      >
        {children(normalHeight)}
        <span style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          fontSize: 13,
          color: "#94a3b8",
          pointerEvents: "none",
          userSelect: "none",
          background: "rgba(255,255,255,0.78)",
          borderRadius: 4,
          padding: "1px 5px",
          lineHeight: 1.6,
        }}>⤢</span>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.93)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            cursor: "zoom-out",
            padding: "14px 24px 20px",
          }}
        >
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            flexShrink: 0,
          }}>
            {title && (
              <span style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 700 }}>{title}</span>
            )}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
              クリックまたは Esc で閉じる ✕
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
            {children("100%")}
          </div>
        </div>
      )}
    </>
  );
}
