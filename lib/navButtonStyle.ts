import type { CSSProperties } from "react";

export const navButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  minHeight: 40,
  borderRadius: 10,
  border: "1px solid #cfcfcf",
  background: "#ffffff",
  color: "#222222",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
};

export const primaryButtonStyle: CSSProperties = {
  ...navButtonStyle,
  background: "#222222",
  color: "#ffffff",
  border: "1px solid #222222",
};

export const dangerButtonStyle: CSSProperties = {
  ...navButtonStyle,
  background: "#fff5f5",
  color: "#b00020",
  border: "1px solid #f0b8c1",
};