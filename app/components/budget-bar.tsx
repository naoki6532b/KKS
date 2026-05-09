"use client";

export function BudgetBar({ expense, budget, loading = false }: { expense: number; budget: number; loading?: boolean }) {
  if (loading) return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><h2 className="card-title">予算消化状況</h2></div>
      <div className="card-body">
        <div style={{ height: 60, background: "var(--surface-2)", borderRadius: 8, opacity: 0.6 }} />
      </div>
    </div>
  );
  if (budget <= 0) return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><h2 className="card-title">予算消化状況</h2></div>
      <div className="card-body" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, padding:"20px 0" }}>
        <span style={{ color:"var(--text-3)", fontSize:13 }}>この月の予算が設定されていません</span>
        <a href="/budgets" className="btn btn-secondary" style={{ fontSize:12, padding:"5px 14px" }}>予算を設定 →</a>
      </div>
    </div>
  );

  const over     = expense > budget;
  const scale    = Math.max(expense, budget) * 1.18;
  const greenPct = Math.min(expense, budget) / scale * 100;
  const redPct   = Math.max(0, expense - budget) / scale * 100;
  const linePct  = budget / scale * 100;
  const usedPct  = Math.round(expense / budget * 100);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><h2 className="card-title">予算消化状況</h2></div>
      <div className="card-body">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:12 }}>
          <div>
            <span style={{ fontSize:12, color:"var(--text-3)" }}>当月支出</span>
            <span style={{ fontSize:22, fontWeight:800, marginLeft:8, color: over ? "var(--red)" : "var(--green)" }}>
              {expense.toLocaleString()}<span style={{ fontSize:13, fontWeight:400 }}> 円</span>
            </span>
          </div>
          <div style={{ textAlign:"right" }}>
            <span style={{ fontSize:12, color:"var(--text-3)" }}>予算</span>
            <span style={{ fontSize:16, fontWeight:600, marginLeft:8, color:"var(--sapphire)" }}>
              {budget.toLocaleString()}<span style={{ fontSize:12, fontWeight:400 }}> 円</span>
            </span>
          </div>
        </div>

        <div style={{ position:"relative", height:36, marginTop:24, marginBottom:10 }}>
          <div style={{ position:"absolute", inset:0, background:"var(--surface-2)", borderRadius:10 }} />
          <div style={{
            position:"absolute", left:0, top:0, bottom:0,
            width:`${greenPct}%`,
            background:"linear-gradient(90deg,#16a34a,#4ade80)",
            borderRadius: over ? "10px 0 0 10px" : 10,
            transition:"width 0.7s cubic-bezier(.4,0,.2,1)",
          }} />
          {over && (
            <div style={{
              position:"absolute", left:`${greenPct}%`, top:0, bottom:0,
              width:`${redPct}%`,
              background:"linear-gradient(90deg,#dc2626,#f87171)",
              borderRadius:"0 10px 10px 0",
              transition:"width 0.7s cubic-bezier(.4,0,.2,1)",
            }} />
          )}
          <div style={{
            position:"absolute", left:`${linePct}%`, top:-10, bottom:-10,
            width:3, background:"var(--sapphire)", borderRadius:2, zIndex:10,
            transform:"translateX(-50%)",
          }}>
            <div style={{
              position:"absolute", bottom:"calc(100% + 4px)", left:"50%",
              transform:"translateX(-50%)",
              fontSize:10, fontWeight:700, color:"var(--sapphire)", whiteSpace:"nowrap",
              background:"var(--surface)", padding:"1px 4px", borderRadius:4,
            }}>予算ライン</div>
          </div>
          {greenPct > 12 && (
            <div style={{
              position:"absolute", left:10, top:0, bottom:0,
              display:"flex", alignItems:"center",
              fontSize:12, fontWeight:700, color:"#fff",
              textShadow:"0 1px 2px rgba(0,0,0,0.3)",
            }}>
              {usedPct}%
            </div>
          )}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:6 }}>
          <span style={{ color: over ? "var(--red)" : "var(--green)", fontWeight:600 }}>
            {over
              ? `⚠ 予算超過 +${(expense - budget).toLocaleString()}円`
              : `✓ 予算内  残り ${(budget - expense).toLocaleString()}円`}
          </span>
          <span style={{ color:"var(--text-3)" }}>{usedPct}% 消化</span>
        </div>
      </div>
    </div>
  );
}
