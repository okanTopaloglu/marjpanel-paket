import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker imajı tek-klasör çıktı (standalone) ile derlenir; yerelde kapalı
  // (Windows'ta symlink EPERM). Dockerfile BUILD_STANDALONE=true ayarlar.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  // GECICI (M3 dogrulamasi): ikinci dev sunucusu ayri cikti dizini kullansin.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  experimental: {
    // Excel içe aktarım ve profil görseli yüklemeleri için gövde limiti.
    serverActions: { bodySizeLimit: "10mb" },
  },
  // Native / yalnız-sunucu paketler dış bağımlılık kalsın.
  serverExternalPackages: ["@node-rs/argon2", "postgres", "exceljs"],
};

export default nextConfig;
