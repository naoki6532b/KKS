"use client";
import { useEffect, useRef, useState } from "react";

function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  tl: number, tr: number, br: number, bl: number,
) {
  if (w <= 0 || h <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
  ctx.fill();
}

export function BudgetBarCanvas({
  expense,
  budget,
  label = "当月支出",
  height,
  width,
  dark = false,
}: {
  expense: number;
  budget: number;
  label?: string;
  height: number;
  width?: number;
  dark?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [measuredW, setMeasuredW] = useState(0);

  useEffect(() => {
    if (width != null) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setMeasuredW(el.clientWidth));
    ro.observe(el);
    setMeasuredW(el.clientWidth);
    return () => ro.disconnect();
  }, [width]);

  const canvasW = width != null ? width : measuredW;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasW || !height) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(canvasW * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width  = `${canvasW}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasW, height);

    const textColor = dark ? "#94a3b8" : "#64748b";
    const bgColor   = dark ? "rgba(255,255,255,0.07)" : "#e2e8f0";

    const pad  = 40;
    const pw   = canvasW - pad * 2;
    const barH = Math.min(72, Math.max(24, height - 96));
    const barY = (height - barH) / 2;
    const r    = barH / 2;

    ctx.fillStyle = bgColor;
    rr(ctx, pad, barY, pw, barH, r, r, r, r);

    if (budget > 0) {
      const over    = expense > budget;
      const scale   = Math.max(expense, budget) * 1.18;
      const greenW  = pw * Math.min(expense, budget) / scale;
      const redW    = over ? pw * (expense - budget) / scale : 0;
      const lineX   = pad + pw * (budget / scale);
      const usedPct = Math.round(expense / budget * 100);

      if (greenW > 0) {
        const grd = ctx.createLinearGradient(pad, 0, pad + greenW, 0);
        grd.addColorStop(0, "#16a34a");
        grd.addColorStop(1, "#4ade80");
        ctx.fillStyle = grd;
        rr(ctx, pad, barY, greenW, barH, r, over ? 0 : r, over ? 0 : r, r);
      }

      if (over && redW > 0) {
        const rx = pad + greenW;
        const grd = ctx.createLinearGradient(rx, 0, rx + redW, 0);
        grd.addColorStop(0, "#dc2626");
        grd.addColorStop(1, "#f87171");
        ctx.fillStyle = grd;
        rr(ctx, rx, barY, redW, barH, 0, r, r, 0);
      }

      const lineColor = dark ? "#93c5fd" : "#2563eb";
      ctx.strokeStyle = lineColor;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.moveTo(lineX, barY - 8);
      ctx.lineTo(lineX, barY + barH + 8);
      ctx.stroke();

      ctx.fillStyle    = lineColor;
      ctx.font         = "bold 11px system-ui,sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("予算ライン", lineX, barY - 10);

      const pctSize = Math.min(24, barH * 0.45);
      if (greenW > pctSize * 2.8) {
        ctx.fillStyle    = "#fff";
        ctx.font         = `bold ${pctSize}px system-ui,sans-serif`;
        ctx.textAlign    = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`${usedPct}%`, pad + Math.max(10, barH * 0.18), barY + barH / 2);
      }

      const expColor = dark ? (over ? "#fca5a5" : "#86efac") : (over ? "#dc2626" : "#16a34a");
      const labelSize = Math.min(15, height / 10);

      ctx.font         = `bold ${labelSize}px system-ui,sans-serif`;
      ctx.textAlign    = "left";
      ctx.textBaseline = "bottom";
      ctx.fillStyle    = expColor;
      ctx.fillText(`${label}  ${expense.toLocaleString()} 円`, pad, barY - 12);

      ctx.fillStyle    = lineColor;
      ctx.textAlign    = "right";
      ctx.fillText(`予算  ${budget.toLocaleString()} 円`, pad + pw, barY - 12);

      const statusSize = Math.min(12, height / 12);
      ctx.font         = `${statusSize}px system-ui,sans-serif`;
      ctx.textAlign    = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle    = expColor;
      ctx.fillText(
        over
          ? `⚠ 予算超過 +${(expense - budget).toLocaleString()}円`
          : `✓ 予算内  残り ${(budget - expense).toLocaleString()}円`,
        pad,
        barY + barH + 12,
      );

      ctx.fillStyle = textColor;
      ctx.textAlign = "right";
      ctx.fillText(`${usedPct}% 消化`, pad + pw, barY + barH + 12);
    } else {
      ctx.fillStyle    = textColor;
      ctx.font         = "14px system-ui,sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("予算が設定されていません", canvasW / 2, height / 2);
    }
  }, [expense, budget, label, canvasW, height, dark]);

  return (
    <div ref={containerRef} style={{ width: "100%", height }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
