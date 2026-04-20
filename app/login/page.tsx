"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  const [loading, setLoading] = useState<"login" | "signup" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");
    setLoading("login");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) { setErrorMessage(error.message); return; }
      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("ログイン処理でエラーが発生しました。");
    } finally {
      setLoading(null);
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");
    setLoading("signup");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail.trim(),
        password: signUpPassword,
      });
      if (error) { setErrorMessage(error.message); return; }
      if (data.session) { router.push("/"); router.refresh(); return; }
      setInfoMessage("新規登録を受け付けました。確認メールが届いた場合はご確認ください。");
    } catch {
      setErrorMessage("新規登録処理でエラーが発生しました。");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-gem" aria-hidden="true" />
          <span className="login-logo-text">Money Manager</span>
        </div>

        {errorMessage && <div className="alert alert-error">{errorMessage}</div>}
        {infoMessage  && <div className="alert alert-success">{infoMessage}</div>}

        <div className="login-section-label">ログイン</div>
        <form onSubmit={handleLogin} className="form-grid">
          <div className="field">
            <label className="field-label">メールアドレス</label>
            <input
              type="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="field-input"
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label className="field-label">パスワード</label>
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="field-input"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading !== null} className="btn btn-primary btn-lg">
            {loading === "login" ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="login-divider"><span>または</span></div>

        <div className="login-section-label">新規登録</div>
        <form onSubmit={handleSignUp} className="form-grid">
          <div className="field">
            <label className="field-label">メールアドレス</label>
            <input
              type="email"
              required
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
              className="field-input"
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label className="field-label">パスワード</label>
            <input
              type="password"
              required
              value={signUpPassword}
              onChange={(e) => setSignUpPassword(e.target.value)}
              className="field-input"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading !== null} className="btn btn-secondary btn-lg">
            {loading === "signup" ? "登録中..." : "新規登録"}
          </button>
        </form>
      </div>
    </div>
  );
}
