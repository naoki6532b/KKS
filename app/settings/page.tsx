"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/app/components/header";

export default function SettingsPage() {
  const router  = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [taxRate, setTaxRate] = useState("10");
  const [strictDisplay, setStrictDisplay] = useState(false);
  const [info,    setInfo]    = useState("");
  const [err,     setErr]     = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push("/login"); return; }
      const { data } = await supabase
        .from("user_settings")
        .select("tax_rate, strict_display")
        .eq("user_id", user.id)
        .maybeSingle();
      if (mounted) {
        if (data) {
          setTaxRate(String(data.tax_rate));
          if (data.strict_display != null) setStrictDisplay(Boolean(data.strict_display));
        }
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setInfo(""); setErr("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const rate = Number(taxRate);
      if (Number.isNaN(rate) || rate < 0 || rate > 100) { setErr("消費税率は0〜100の数値で入力してください。"); return; }
      const { error } = await supabase.from("user_settings").upsert(
        { user_id: user.id, tax_rate: rate, strict_display: strictDisplay, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) { setErr(error.message); return; }
      setInfo("保存しました。");
    } catch { setErr("保存中にエラーが発生しました。"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <Header />
      <main className="page-sm">
        <div className="page-heading"><h1 className="page-title">設定</h1></div>
        <div className="card">
          <div className="card-header"><h2 className="card-title">表示 / 計算設定</h2></div>
          <div className="card-body">
            {loading ? <p className="empty-state">読込中...</p> : (
              <form onSubmit={handleSubmit} className="form-grid">
                {info && <div className="alert alert-success">{info}</div>}
                {err  && <div className="alert alert-error">{err}</div>}

                <div className="field">
                  <label className="field-label">消費税率（%）</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number" min="0" max="100" step="0.1"
                      value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                      className="field-input" style={{ maxWidth: 120 }}
                    />
                    <span style={{ color: "var(--text-3)", fontSize: 14 }}>%</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6 }}>
                    出入金入力で「消費税込み」にチェックを入れると、この税率で消費税額を自動計算します。<br />
                    現在の日本の消費税率：標準10%、軽減8%
                  </p>
                </div>

                <div className="field">
                  <label className="field-label">給与・賞与の表示モード</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none" }}>
                    <span style={{
                      display: "inline-block",
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: strictDisplay ? "var(--sapphire-mid)" : "var(--border)",
                      position: "relative",
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}>
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: strictDisplay ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                        transition: "left 0.2s",
                      }} />
                      <input
                        type="checkbox"
                        checked={strictDisplay}
                        onChange={(e) => setStrictDisplay(e.target.checked)}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                      />
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {strictDisplay ? "ON（詳細表示）" : "OFF（シンプル表示）"}
                    </span>
                  </label>
                  <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8, lineHeight: 1.7 }}>
                    <b>OFF（シンプル・デフォルト）:</b> 給与・賞与は差引支給額のみを1件の収入として表示します。<br />
                    <b>ON（詳細）:</b> 給与明細の各項目を個別に入金・出金として表示します。予算は控除合計分が自動加算されます。
                  </p>
                </div>

                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? "保存中..." : "保存する"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
