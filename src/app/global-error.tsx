"use client";

/**
 * Kök hata ekranı - kabuk yüklenemediğinde gösterilir, bu yüzden CSS'siz
 * (satır içi stil) çalışması gerekir. Renkler panelin "Mürekkep & Nane"
 * paletiyle elle eşlenir (zemin, mürekkep, nane).
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif',
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "1.5rem",
          margin: 0,
          background: "#F5F7F6",
          color: "#0F1B2D",
        }}
      >
        <div
          style={{
            marginBottom: "0.75rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#5C6878",
          }}
        >
          MarjPanel Paket
        </div>
        <h1
          style={{
            fontSize: "1.3125rem",
            fontWeight: 650,
            letterSpacing: "-0.017em",
            margin: 0,
          }}
        >
          Beklenmeyen bir hata oluştu
        </h1>
        <p style={{ marginTop: "0.5rem", color: "#5C6878", fontSize: "0.875rem" }}>
          Uygulama yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            minHeight: "44px",
            cursor: "pointer",
            borderRadius: "0.5625rem",
            border: "none",
            background: "#0F8A5F",
            padding: "0 1.5rem",
            fontWeight: 600,
            fontSize: "0.9375rem",
            color: "#fff",
            boxShadow: "0 1px 2px rgb(15 27 45 / 0.06), 0 4px 12px -4px rgb(15 27 45 / 0.08)",
          }}
        >
          Tekrar dene
        </button>
      </body>
    </html>
  );
}
