"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log full detail server-side/console only never render raw error
    // details (stack traces, internal messages) to the end user, since
    // they can leak implementation details useful to an attacker
    console.error("Critical Runtime Error:", error);
  }, [error]);

  return (
    <div
      style={{
        padding: "100px 20px",
        textAlign: "center",
        background: "var(--bg-primary, #121212)",
        color: "var(--text-primary, #f5f5f0)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ fontSize: "2rem", marginBottom: "20px" }}>
        Ada yang salah!
      </h2>
      <p
        style={{
          color: "var(--text-secondary, #b8b4a8)",
          marginBottom: "30px",
          maxWidth: "500px",
        }}
      >
        Terjadi kesalahan tak terduga. Coba muat ulang halaman ini.
      </p>
      <button
        onClick={() => reset()}
        style={{
          background: "var(--accent, #ffdb00)",
          color: "var(--accent-ink, #121212)",
          border: "none",
          padding: "12px 24px",
          borderRadius: "8px",
          fontWeight: "600",
          cursor: "pointer",
        }}
      >
        Coba lagi
      </button>
    </div>
  );
}
