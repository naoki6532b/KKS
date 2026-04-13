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

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
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

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }

      setInfoMessage(
        "新規登録を受け付けました。確認メールが送られる設定の場合は、メールをご確認ください。"
      );
    } catch (err) {
      setErrorMessage("新規登録処理でエラーが発生しました。");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Money Manager</h1>

        {errorMessage ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: "#ffe8e8",
              color: "#b00020",
              fontSize: 14,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {infoMessage ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: "#e8f4ff",
              color: "#0b57a4",
              fontSize: 14,
            }}
          >
            {infoMessage}
          </div>
        ) : null}

        <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
          <input
            name="email"
            type="email"
            placeholder="メールアドレス"
            required
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            style={{ padding: 12, fontSize: 16 }}
          />
          <input
            name="password"
            type="password"
            placeholder="パスワード"
            required
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            style={{ padding: 12, fontSize: 16 }}
          />
          <button
            type="submit"
            disabled={loading !== null}
            style={{ padding: 12, fontSize: 16 }}
          >
            {loading === "login" ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <hr style={{ margin: "20px 0" }} />

        <form onSubmit={handleSignUp} style={{ display: "grid", gap: 12 }}>
          <input
            name="signup_email"
            type="email"
            placeholder="新規登録用メールアドレス"
            required
            value={signUpEmail}
            onChange={(e) => setSignUpEmail(e.target.value)}
            style={{ padding: 12, fontSize: 16 }}
          />
          <input
            name="signup_password"
            type="password"
            placeholder="新規登録用パスワード"
            required
            value={signUpPassword}
            onChange={(e) => setSignUpPassword(e.target.value)}
            style={{ padding: 12, fontSize: 16 }}
          />
          <button
            type="submit"
            disabled={loading !== null}
            style={{ padding: 12, fontSize: 16 }}
          >
            {loading === "signup" ? "登録中..." : "新規登録"}
          </button>
        </form>
      </div>
    </main>
  );
}