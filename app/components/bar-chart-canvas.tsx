"use client";
import { useEffect, useRef, useState } from "react";

export type CanvasBar = {
  name: string;
  income: number;
  expense: number;
  isTotal: boolean;
};

function niceMax(v: number): number {
  if (v <= 0) return 100000;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / e) * e;
}

function fmtV(v: number): string {
  const a = Math.abs(v);
  if (a >= 10000) return `${Math.round(a / 10000)}万`;
  if (a >= 1000)  return `${Math.round(a / 1000)}k`;
  return String(Math.round(a));
}

function drawRoundRect(
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

export function BarChartCanvas({
  data,
  height,
  width,
  dark = false,
}: {
  data: CanvasBar[];
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
    if (!canvas || !canvasW || !height || !data.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(canvasW * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width  = `${canvasW}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasW, height);

    const mg = { top: 28, right: 56, bottom: 22, left: 54 };
    const pw = canvasW - mg.left - mg.right;
    const ph = height  - mg.top  - mg.bottom;

    const maxInc = Math.max(...data.map(d => d.income), 0);
    const maxExp = Math.max(...data.map(d => Math.abs(d.expense)), 0);
    const yMax   = niceMax(Math.max(maxInc, maxExp, 1));

    const toY  = (v: number) => mg.top + ph / 2 * (1 - v / yMax);
    const zero = toY(0);

    const textColor = dark ? "#94a3b8" : "#64748b";
    const gridColor = dark ? "rgba(255,255,255,0.07)" : "#e2e8f0";
    const zeroColor = dark ? "#94a3b8" : "#475569";

    for (const frac of [-1, -0.5, 0, 0.5, 1]) {
      const v = frac * yMax;
      const y = toY(v);
      ctx.strokeStyle = frac === 0 ? zeroColor : gridColor;
      ctx.lineWidth   = frac === 0 ? 1.5 : 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(mg.left, y);
      ctx.lineTo(mg.left + pw, y);
      ctx.stroke();
      ctx.fillStyle    = textColor;
      ctx.font         = "11px system-ui,sans-serif";
      ctx.textAlign    = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(frac === 0 ? "0" : (v > 0 ? fmtV(v) : `-${fmtV(-v)}`), mg.left - 5, y);
    }

    const gw = pw / data.length;
    const bw = Math.min(24, gw * 0.34);

    for (let i = 0; i < data.length; i++) {
      const d  = data[i];
      const cx = mg.left + (i + 0.5) * gw;

      if (d.income > 0) {
        const top  = toY(d.income);
        const barH = zero - top;
        ctx.fillStyle = d.isTotal ? "#22c55e" : "#86efac";
        drawRoundRect(ctx, cx - bw - 1, top, bw, barH, 4, 4, 0, 0);
        if (barH > 14) {
          ctx.fillStyle    = dark ? "#bbf7d0" : "#15803d";
          ctx.font         = "bold 9px system-ui,sans-serif";
          ctx.textAlign    = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(fmtV(d.income), cx - bw / 2 - 1, top - 2);
        }
      }

      if (d.expense < 0) {
        const bot  = toY(d.expense);
        const barH = bot - zero;
        ctx.fillStyle = d.isTotal ? "#ef4444" : "#f87171";
        drawRoundRect(ctx, cx + 1, zero, bw, barH, 0, 0, 4, 4);
        if (barH > 14) {
          ctx.fillStyle    = dark ? "#fecaca" : "#dc2626";
          ctx.font         = "bold 9px system-ui,sans-serif";
          ctx.textAlign    = "center";
          ctx.textBaseline = "top";
          ctx.fillText(fmtV(Math.abs(d.expense)), cx + bw / 2 + 1, bot + 2);
        }
      }

      ctx.fillStyle    = textColor;
      ctx.font         = "10px system-ui,sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "top";
      ctx.fillText(d.name, cx, height - mg.bottom + 3);
    }
  }, [data, canvasW, height, dark]);

  return (
    <div ref={containerRef} style={{ width: "100%", height }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
