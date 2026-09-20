---
type: "architecture"
date: "2026-09-20T00:00:00+00:00"
question: "Yeni kiraci sirket eklenince domain nasil calisir, deploy gerekir mi?"
contributor: "graphify"
source_nodes: ["Coolify Dagitimi (tek uygulama + PostgreSQL)", "Cok Kiracili Domain", "hosttanMarka()", "girisKarari()", "sirketKaydetForm()", "alanAdi"]
---

# Q: Yeni kiraci sirket eklenince domain nasil calisir, deploy gerekir mi?

## Answer

HAYIR, deploy gerekmez (2026-09-20 itibariyle). `*.marjpanel.com` icin wildcard SSL kuruldu:

1. Cloudflare DNS: `*.marjpanel.com` -> 152.53.156.237 (Coolify sunucusu). Zone: marjpanel.com.
2. Coolify proxy (Traefik v3.6) konfigurasyonunda IKINCI bir ACME resolver var: adi `cloudflare`,
   DNS-01 challenge, `CF_DNS_API_TOKEN` environment degiskeni (Cloudflare "Edit zone DNS" token,
   yalniz marjpanel.com zone'u), depolama `/traefik/acme-cloudflare.json`, resolvers 1.1.1.1:53.
   Mevcut `letsencrypt` (HTTP-01) resolver'i DURUYOR; partnercosmetics.com alanlari onu kullanir.
3. Uygulamanin (uuid bywqirlsulpara4x54pxrxl7) Container labels ayari "Managed manually" yapildi
   ve su router'lar eklendi: `http-wild-<uuid>` + `https-wild-<uuid>`,
   kural `HostRegexp(^[a-z0-9-]+\.marjpanel\.com$)`, `tls.certresolver=cloudflare`,
   `tls.domains[0].main=marjpanel.com`, `tls.domains[0].sans=*.marjpanel.com`, port 3000.

Sonuc: super admin panelde Sirketler > alan adi olarak `xyz.marjpanel.com` yazip kaydeder, adres
ANINDA calisir. Sertifika tek wildcard sertifikadir (CN=marjpanel.com, SAN *.marjpanel.com).
Dogrulandi: test.marjpanel.com ve deneme.marjpanel.com (hic tanimlanmamis) HTTPS 200 donuyor;
sirket tanimliysa kiraci kimligi (orn. "Giris | Partner Cosmetics Paket"), tanimli degilse
platform kimligi ("Giris | MarjPanel Paket") cikar - bunu `hosttanMarka()` + `girisKarari()` cozer.

ONEMLI TUZAKLAR:
- Etiketler artik MANUEL. Coolify Domains listesine `*.marjpanel.com` DISINDA bir domain eklenirse
  (orn. yeni bir partnercosmetics adresi) etiketleri ELLE guncellemek gerekir; Coolify artik
  otomatik uretmiyor.
- Wildcard YALNIZ marjpanel.com icin. mamaaura.partnercosmetics.com hala Coolify Domains listesi +
  letsencrypt resolver ile calisir.
- Claude Code auto-mode siniflandiricisi Coolify domain/etiket PATCH isteklerini ENGELLIYOR
  ("DNS / Domain / Cert Changes"). Bu tur degisiklikleri kullanici Coolify arayuzunden yapmali;
  API'den denemek bos token yakar.
- Auto deploy acik: GitHub main'e push -> Coolify webhook -> rolling update (Container naming
  "Generated name (rolling updates)"). API'den ayrica deploy tetiklemeye gerek yok.

## Source Nodes

- Coolify Dagitimi (tek uygulama + PostgreSQL)
- Cok Kiracili Domain
- hosttanMarka()
- girisKarari()
- sirketKaydetForm()
- alanAdi
