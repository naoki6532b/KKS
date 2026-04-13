import { signInAction, signUpAction } from "./actions";

export default function LoginPage() {
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

        <form action={signInAction} style={{ display: "grid", gap: 12 }}>
          <input
            name="email"
            type="email"
            placeholder="メールアドレス"
            required
            style={{ padding: 12, fontSize: 16 }}
          />
          <input
            name="password"
            type="password"
            placeholder="パスワード"
            required
            style={{ padding: 12, fontSize: 16 }}
          />
          <button type="submit" style={{ padding: 12, fontSize: 16 }}>
            ログイン
          </button>
        </form>

        <hr style={{ margin: "20px 0" }} />

        <form action={signUpAction} style={{ display: "grid", gap: 12 }}>
          <input
            name="email"
            type="email"
            placeholder="新規登録用メールアドレス"
            required
            style={{ padding: 12, fontSize: 16 }}
          />
          <input
            name="password"
            type="password"
            placeholder="新規登録用パスワード"
            required
            style={{ padding: 12, fontSize: 16 }}
          />
          <button type="submit" style={{ padding: 12, fontSize: 16 }}>
            新規登録
          </button>
        </form>
      </div>
    </main>
  );
}