"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
      <div style={{ position: "relative" }}>
        {children(normalHeight)}
        <div
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          style={{ position: "absolute", inset: 0, cursor: "zoom-in", zIndex: 10 }}
          title="クリックで拡大"
        />
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
          zIndex: 11,
        }}>⤢</span>
      </div>

      {mounted && open && createPortal(
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
        </div>,
        document.body
      )}
    </>
  );
}
