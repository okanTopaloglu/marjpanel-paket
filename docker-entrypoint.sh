#!/bin/sh
# MarjPanel Paket konteyner başlangıcı: migration + seed (idempotent) → sunucu.
# Postgres ayrı kaynakta; hazır olana kadar migrate tekrar denenir.
set -e

echo "[init] Veritabanı migration'ları uygulanıyor..."
i=0
until node dist/migrate.cjs; do
  i=$((i + 1))
  if [ "$i" -ge 15 ]; then
    echo "[init] Veritabanına ulaşılamadı (15 deneme). Çıkılıyor."
    exit 1
  fi
  echo "[init] Veritabanı hazır değil, bekleniyor ($i/15)..."
  sleep 3
done

echo "[init] Seed (idempotent) çalıştırılıyor..."
node dist/seed.cjs || echo "[init] Seed uyarı verdi, devam ediliyor."

echo "[init] Next.js sunucusu başlatılıyor."
exec node server.js
