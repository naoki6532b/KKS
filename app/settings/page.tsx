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
  const [info,    setInfo]    = useState("");
  const [err,     setErr]     = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push("/login"); return; }
      const { data } = await supabase.from("user_settings").select("tax_rate").eq("user_id", user.id).maybeSingle();
      if (mounted) {
        if (data) setTaxRate(String(data.tax_rate));
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
        { user_id: user.id, tax_rate: rate, updated_at: new Date().toISOString() },
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
          <div className="card-header"><h2 className="card-title">税率設定</h2></div>
          <div className="card-body">
            {loading ? <p className="empty-state">読込中...</p> : (
              <form onSubmit={handleSubmit} className="form-grid">
                {info && <div className="alert alert-success">{info}</div>}
                {err  && <div className="alert alert-error">{err}</div>}
                <div className="field">
                  <label className="field-label">消費税率（%）</label>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <input
                      type="number" min="0" max="100" step="0.1"
                      value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                      className="field-input" style={{ maxWidth:120 }}
                    />
                    <span style={{ color:"var(--text-3)", fontSize:14 }}>%</span>
                  </div>
                  <p style={{ fontSize:12, color:"var(--text-3)", marginTop:6 }}>
                    出入金入力で「消費税込み」にチェックを入れると、この税率で消費税額を自動計算します。<br />
                    現在の日本の消費税率：標準10%、軽減8%
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
