# ---- MarjPanel Paket: Next.js standalone (tek konteyner) ----
# Coolify: Build Pack = Dockerfile, Port = 3000. Postgres ayrı kaynak.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml* .npmrc ./
RUN pnpm install --frozen-lockfile || pnpm install

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Standalone çıktı yalnız Docker derlemesinde (yerelde Windows symlink sorunu).
ENV BUILD_STANDALONE=true
# Derleme anı yer tutucu env'leri: modül yükleme kontrollerini geçmek için.
# Bu stage çalışma zamanına TAŞINMAZ; gerçek değerler Coolify'dan gelir.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    AUTH_SECRET=build_dummy_secret_runtime_da_gecersiz \
    APP_ENCRYPTION_KEY=build_dummy_key_runtime_da_gecersiz
RUN pnpm build
# Migration + seed'i tek dosya CJS'e paketle (imajda tsx/kaynak gerekmez).
# Native @node-rs/argon2 hariç her şey paketlenir; o standalone node_modules'tan gelir.
RUN pnpm exec esbuild src/lib/db/migrate.ts src/lib/db/seed.ts \
    --bundle --platform=node --format=cjs --external:@node-rs/argon2 \
    --outdir=dist --out-extension:.js=.cjs

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY docker-entrypoint.sh ./docker-entrypoint.sh
# Next.js ISR önbelleği .next/cache'e yazar; standalone kopyada dizin yok.
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next/cache
# Profil görselleri (GORSEL_DIZIN=/app/uploads). Coolify'da bu yola volume ŞART,
# yoksa her deploy'da silinir (docs/DEPLOY-COOLIFY.md).
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0 GORSEL_DIZIN=/app/uploads
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
