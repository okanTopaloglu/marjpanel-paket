/*
 * MAMA AURA Paket service worker.
 *
 * Bilinçli olarak dar kapsamlı: sayfa ve veri istekleri HER ZAMAN ağdan gelir
 * (oturum/veri bayatlamasın); yalnız ikon/manifest ve çevrimdışı yedek sayfa
 * önbelleğe alınır. Web push YOK; bu uygulama depo içi kullanım için, anlık
 * bildirim gerektirmiyor.
 */

const CACHE = "mamaaura-paket-v3";
const CEVRIMDISI = "/offline.html";
const ASSETS = [
  CEVRIMDISI,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon-32.png",
  // Çevrimdışı sayfa kelime işaretini gösterir; önbellekte olmazsa kırık resim.
  "/marka/mamaaura.png",
];

/**
 * Precache: her varlık AYRI AYRI ve yalnız temiz 200 ise alınır.
 *
 * `cache.add` yönlendirmeyi takip eder: middleware bir görseli /giris'e
 * 307'lediğinde giriş sayfasının HTML'i "resim" diye önbelleğe giriyor ve
 * fetch tarafı önbellek-öncelikli olduğu için sunucu düzelse bile tarayıcı
 * kırık resim gösteriyordu. `redirect: "error"` yönlendirmede fırlatır,
 * `ok` kontrolü 4xx/5xx'i eler; ikisi de allSettled ile yutulur — tek bir
 * varlık yüzünden kurulum çökmez, ama yanlış bir şey de saklanmaz.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        Promise.allSettled(
          ASSETS.map((a) =>
            fetch(a, { redirect: "error", cache: "no-cache" }).then((r) => {
              if (!r.ok) throw new Error(`${a}: ${r.status}`);
              return c.put(a, r);
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.tip === "hemen-devral") self.skipWaiting();
});

/* ------------------------------------------------------------------ */
/* Ağ                                                                  */
/* ------------------------------------------------------------------ */

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Sayfa gezinmeleri: ağ öncelikli, ağ yoksa çevrimdışı yedek.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(CEVRIMDISI).then((r) => r || Response.error()),
      ),
    );
    return;
  }

  // Statik varlıklar: önbellek öncelikli.
  if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});
