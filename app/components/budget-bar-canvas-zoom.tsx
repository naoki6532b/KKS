"use client";
import { ChartZoom } from "@/app/components/chart-zoom";
import { BudgetBarCanvas } from "@/app/components/budget-bar-canvas";

export function BudgetBarCanvasZoom({
  expense,
  budget,
  label,
}: {
  expense: number;
  budget: number;
  label?: string;
}) {
  if (budget <= 0) return null;
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><h2 className="card-title">予算消化状況（グラフ）</h2></div>
      <div className="card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
        <ChartZoom title="予算消化状況" normalHeight={160}>
          {(h, zoomed, w) => (
            <BudgetBarCanvas
              expense={expense}
              budget={budget}
              label={label}
              height={h as number}
              width={w}
              dark={zoomed}
            />
          )}
        </ChartZoom>
      </div>
    </div>
  );
}
