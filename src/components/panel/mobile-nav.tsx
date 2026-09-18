"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Marka, MarkaYazi } from "@/components/marka/logo";
import { SidebarNav } from "./sidebar-nav";
import {
  HizIzleyici,
  ivmeIzdusumu,
  jestKarari,
  lastikBant,
  yayOynat,
  azaltilmisHareket,
  type YayKolu,
} from "@/lib/motion/yay";
import { cn } from "@/lib/utils";

/**
 * Mobil menü çekmecesi — jestle sürülür, bırakıldığında parmağın HIZIYLA
 * devam eder ve her an yakalanıp ters çevrilebilir (Apple §2, §3, §5, §6).
 *
 * · Sürükleme parmağa 1:1 yapışır; perde (scrim) opaklığı sürükleme boyunca
 *   sürekli güncellenir — yalnız jest bitince değil.
 * · Bırakmada hedef, konumdan değil İVME İZDÜŞÜMÜNDEN seçilir; savurma
 *   çekmeceyi gerçekten fırlatır.
 * · Sınırlarda lastik bant direnci — sert duvar yok.
 * · Dikey kaydırma serbest: yatay niyet netleşene kadar (10px histerezis)
 *   jest üstlenilmez.
 *
 * Çekmece TEK bir yerde (kabukta) yaşar; hem üst çubuktaki hamburger hem de
 * alt sekme çubuğundaki "Menü" aynı örneği açar.
 */

/**
 * Sürüklemeyi ÜSTLENME eşiği. Bu mesafenin altındaki hareket "dokunuş"tur ve
 * jest hiç devreye girmez — parmak birkaç piksel kaysa bile menüdeki bağlantı
 * normal şekilde tıklanır. Eşik düşük tutulursa (10 px) sıradan bir dokunuş
 * sürükleme sanılır, pointer yakalanır ve tıklama olayı hiç doğmaz: menüye
 * basılır ama sayfaya gidilmez.
 */
const KLAIM_ESIGI = 16;
/** Yatay niyet, dikeyin en az bu katı olmalı — köşegen dokunuşlar sürükleme sayılmaz. */
const YATAY_ORAN = 1.5;

interface MobilMenuKontrol {
  ac: () => void;
  kapat: () => void;
  acikMi: boolean;
}

const Ctx = createContext<MobilMenuKontrol>({
  ac: () => {},
  kapat: () => {},
  acikMi: false,
});

export function useMobilMenu(): MobilMenuKontrol {
  return useContext(Ctx);
}

export function MobilMenuSaglayici({ children }: { children: React.ReactNode }) {
  const [monte, setMonte] = useState(false);
  const [gorunur, setGorunur] = useState(false); // DOM'da mı
  const [acik, setAcik] = useState(false); // mantıksal durum
  // Açma İSTEĞİ sayacı. Açılış efektini `gorunur`a bağlamak yetmez: kapanma
  // animasyonu sürerken `gorunur` hâlâ true olduğu için ikinci bir "aç" isteği
  // hiçbir değişiklik yaratmaz ve menü açılmaz. Sayaç her istekte artar.
  const [acIstek, setAcIstek] = useState(0);
  const pathname = usePathname();

  const cekmeceRef = useRef<HTMLElement | null>(null);
  const perdeRef = useRef<HTMLDivElement | null>(null);
  const genislikRef = useRef(320);
  const xRef = useRef(0); // 0 = tam açık, -genişlik = kapalı
  const yayRef = useRef<YayKolu | null>(null);
  const hizRef = useRef(new HizIzleyici());
  const jestRef = useRef<{
    aktif: boolean;
    karar: "yok" | "yatay" | "dikey";
    x0: number;
    y0: number;
    baz: number;
    id: number;
    /** pointerDown çalışan bir yayı kesti mi? (tap ise yay devam ettirilir) */
    yayKesildi: boolean;
  } | null>(null);
  /** Gerçek bir sürükleme yapıldı mı? Yapıldıysa ardından gelen tıklama yutulur. */
  const suruklendiRef = useRef(false);
  /** `acik` durumunun ref kopyası — yay bittiğinde bayat değer okunmasın. */
  const acikRef = useRef(false);
  acikRef.current = acik;

  useEffect(() => setMonte(true), []);

  /* Konumu ekrana yaz — yalnız transform + opacity (kompozitör dostu). */
  const ciz = useCallback((x: number) => {
    xRef.current = x;
    const g = genislikRef.current;
    if (cekmeceRef.current) {
      cekmeceRef.current.style.transform = `translate3d(${x}px,0,0)`;
    }
    if (perdeRef.current) {
      const oran = g > 0 ? Math.min(1, Math.max(0, 1 + x / g)) : 0;
      perdeRef.current.style.opacity = String(oran);
    }
  }, []);

  const yayaBirak = useCallback(
    (hedef: number, hiz: number) => {
      yayRef.current?.durdur();
      const ivmeliMi = Math.abs(hiz) > 200;
      yayRef.current = yayOynat({
        baslangic: xRef.current,
        hedef,
        hiz,
        tepki: 0.3, // Apple: çekmece/sheet
        sonum: ivmeliMi ? 0.82 : 1, // taşma yalnız ivme taşındıysa
        adim: (d) => ciz(d),
        bitti: () => {
          // Kapanış bitti — ama animasyon sürerken kullanıcı menüyü yeniden
          // açtıysa (acikRef true) portalı söküp isteği yutmayalım.
          if (hedef !== 0 && !acikRef.current) setGorunur(false);
        },
      });
    },
    [ciz],
  );

  const kapat = useCallback(() => {
    setAcik(false);
    if (azaltilmisHareket()) {
      setGorunur(false);
      return;
    }
    yayaBirak(-genislikRef.current, Math.min(hizRef.current.hiz(), 0));
  }, [yayaBirak]);

  const ac = useCallback(() => {
    setGorunur(true);
    setAcik(true);
    setAcIstek((n) => n + 1);
  }, []);

  /* Açılış: her "aç" isteğinde çekmece içeri yaylanır. Kapanış animasyonu
     SÜRERKEN gelen istek, çekmeceyi kapalı konuma ışınlamak yerine hareketi
     olduğu yerden hızıyla geri çevirir (Apple §3: kesilebilirlik). */
  useEffect(() => {
    if (acIstek === 0) return;
    const el = cekmeceRef.current;
    if (!el) return;
    genislikRef.current = el.offsetWidth || 320;

    const kol = yayRef.current;
    if (kol?.calisiyor()) {
      const anlik = kol.durdur();
      xRef.current = anlik.deger;
      yayaBirak(0, anlik.hiz);
      return;
    }

    ciz(-genislikRef.current);
    const id = requestAnimationFrame(() => yayaBirak(0, 0));
    return () => cancelAnimationFrame(id);
  }, [acIstek, ciz, yayaBirak]);

  /* Rota değişince kapat. Bağlantıya dokunulduğunda kapanış zaten başlamıştır
     (acikRef false); o hâlde yayı kesmeyiz, çekmece kayarak çıkar. Rota başka
     bir yolla değiştiyse (geri tuşu vb.) çekmece anında kapatılır. */
  useEffect(() => {
    if (!acikRef.current) return;
    yayRef.current?.durdur();
    setAcik(false);
    setGorunur(false);
  }, [pathname]);

  /* Açıkken arka planı kilitle + ESC */
  useEffect(() => {
    if (!gorunur) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") kapat();
    };
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", onKey);
    };
  }, [gorunur, kapat]);

  useEffect(() => () => void yayRef.current?.durdur(), []);

  /* --------------------------- Jest --------------------------- */

  function pointerDown(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    suruklendiRef.current = false;
    // Çalışan animasyonu ANLIK değerinden yakala — sıçrama olmaz (Apple §3).
    const yayCalisiyordu = yayRef.current?.calisiyor() ?? false;
    const anlik = yayRef.current?.durdur();
    if (anlik) xRef.current = anlik.deger;
    jestRef.current = {
      aktif: true,
      karar: "yok",
      x0: e.clientX,
      y0: e.clientY,
      baz: xRef.current,
      id: e.pointerId,
      yayKesildi: yayCalisiyordu,
    };
    hizRef.current.sifirla(e.clientX);
  }

  function pointerMove(e: React.PointerEvent<HTMLElement>) {
    const j = jestRef.current;
    if (!j?.aktif || j.id !== e.pointerId) return;
    const dx = e.clientX - j.x0;
    const dy = e.clientY - j.y0;

    if (j.karar === "yok") {
      const karar = jestKarari(dx, dy, KLAIM_ESIGI, YATAY_ORAN);
      if (karar === "belirsiz") return; // dokunuş olma ihtimali sürüyor
      if (karar === "dikey") {
        j.karar = "dikey";
        j.aktif = false; // dikey kaydırma tarayıcıya bırakılır
        return;
      }
      j.karar = "yatay";
      suruklendiRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (j.karar !== "yatay") return;

    hizRef.current.ekle(e.clientX);
    const g = genislikRef.current;
    let x = j.baz + dx;
    if (x > 0) x = lastikBant(x, g);
    if (x < -g) x = -g + lastikBant(x + g, g);
    ciz(x);
  }

  function pointerUp(e: React.PointerEvent<HTMLElement>) {
    const j = jestRef.current;
    jestRef.current = null;
    if (!j?.aktif || j.karar !== "yatay") {
      // Sürükleme çıkmadı (dokunuş/dikey kaydırma). pointerDown bir animasyonu
      // kestiyse yarım kalan hareketi HEDEFİNE devam ettir — yoksa çekmece
      // ekranın ortasında donmuş kalır.
      if (j?.yayKesildi) {
        yayaBirak(acikRef.current ? 0 : -genislikRef.current, 0);
      }
      return;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* zaten bırakılmış olabilir */
    }

    const hiz = hizRef.current.hiz();
    const g = genislikRef.current;
    // Hedefi bırakma noktasından değil, ivmenin gittiği yerden seç.
    const varis = xRef.current + ivmeIzdusumu(hiz);
    if (varis < -g / 2) {
      setAcik(false);
      yayaBirak(-g, hiz);
    } else {
      setAcik(true);
      yayaBirak(0, hiz);
    }
  }

  const kontrol = useMemo<MobilMenuKontrol>(
    () => ({ ac, kapat, acikMi: gorunur }),
    [ac, kapat, gorunur],
  );

  return (
    <Ctx.Provider value={kontrol}>
      {children}
      {gorunur &&
        monte &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-0 z-[60] md:hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Kapanış animasyonu sürerken perde dokunuşları YUTMAMALI (Apple §3:
                girdi asla kilitlenmez). Aksi hâlde kapanırken menü düğmesine
                basan kullanıcının dokunuşu görünmez perdeye gider ve "menü
                bir daha açılmıyor" olur. */}
            <div
              ref={perdeRef}
              onClick={kapat}
              style={{
                opacity: 0,
                background: "var(--scrim)",
                pointerEvents: acik ? "auto" : "none",
              }}
              className="absolute inset-0"
            />
            <aside
              ref={cekmeceRef}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
              onClickCapture={(e) => {
                // İki durumda parmağın altındaki bağlantı YANLIŞLIKLA
                // tetiklenmesin: (1) az önce sürükleme yapıldıysa, (2) çekmece
                // KAPANIRKEN dokunulduysa. İkincisi ayrıca gerçek bir çökme
                // kaynağıydı: kapanış animasyonu ortasında başlayan navigasyon,
                // portal sökümüyle yarışıp React'i "removeChild null" ile
                // düşürüyordu — sonrasında hiçbir menü açılmıyordu.
                if (suruklendiRef.current || !acikRef.current) {
                  suruklendiRef.current = false;
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              style={{ transform: "translate3d(-100%,0,0)", touchAction: "pan-y" }}
              className={cn(
                "pointer-events-auto absolute inset-y-0 left-0 flex w-[86%] max-w-[20rem] flex-col",
                // Çekmece masaüstü menüyle AYNI mürekkep: aynı menü, başka
                // bir kabuk. Farklı zemin iki ayrı yer gibi okunuyordu.
                "bg-ink shadow-soft will-move pl-safe",
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe">
                <div className="flex items-center gap-2.5 pt-3">
                  <Marka boyut={28} />
                  <MarkaYazi className="text-title-3 text-ink-foreground" altAd="Paket" />
                </div>
                <button
                  type="button"
                  onClick={kapat}
                  aria-label="Menüyü kapat"
                  className="mt-3 flex h-9 w-9 min-w-touch items-center justify-center rounded-full bg-white/10 text-ink-foreground transition-transform duration-dokunma ease-out active:scale-95"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <SidebarNav onGit={kapat} />
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-3 pb-safe">
                <span className="text-caption text-ink-foreground/60">
                  Kapatmak için sola sürükleyin
                </span>
                <span
                  aria-hidden="true"
                  className="h-8 w-1 rounded-full bg-white/20"
                />
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

/** Üst çubuktaki hamburger — çekmeceyi açar. */
export function MobilMenuButonu() {
  const { ac, acikMi } = useMobilMenu();
  return (
    <button
      type="button"
      onClick={ac}
      aria-label="Menüyü aç"
      aria-expanded={acikMi}
      className={cn(
        "flex h-10 w-10 min-w-touch items-center justify-center rounded-[--radius-kontrol] text-muted-foreground",
        "transition-[background-color,color,transform] duration-dokunma ease-out",
        "active:scale-[0.97] md:hidden",
        "[@media(hover:hover)and(pointer:fine)]:hover:bg-muted [@media(hover:hover)and(pointer:fine)]:hover:text-foreground",
      )}
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
