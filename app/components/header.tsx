import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="site-logo">
        <span className="site-logo-gem" aria-hidden="true" />
        <span>Money Manager</span>
      </Link>
      <nav className="site-nav">
        <Link href="/" className="site-nav-link">ホーム</Link>
        <Link href="/transactions" className="site-nav-link">取引一覧</Link>
        <Link href="/transactions/new" className="site-nav-link">出入金入力</Link>
        <Link href="/balance" className="site-nav-link">収支</Link>
        <Link href="/subscriptions" className="site-nav-link">サブスク</Link>
        <Link href="/budgets" className="site-nav-link">月度予算</Link>
        <Link href="/masters" className="site-nav-link">マスタ管理</Link>
        <form action="/logout" method="post" style={{ margin: 0 }}>
          <button type="submit" className="site-nav-logout">ログアウト</button>
        </form>
      </nav>
    </header>
  );
}
