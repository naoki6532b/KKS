import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Money Manager",
  description: "個人のお金管理アプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: "Meiryo UI, Meiryo, sans-serif",
          margin: 0,
          background: "#f7f7f7",
          color: "#222",
        }}
      >
        {children}
      </body>
    </html>
  );
}