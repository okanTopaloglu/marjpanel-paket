/**
 * Senkron tarih penceresi hesabı — SAF fonksiyonlar (G/Ç yok, test edilir).
 *
 * Trendyol sipariş ucu iki haftadan uzun aralığı REDDEDER: `startDate` ile
 * `endDate` arası 14 günü geçtiğinde istek hata döner. PartnerSys tek istekle
 * 30 günlük ilk senkronu denediği için ilk kurulumda sürekli hata alıyordu;
 * burada aralık parçalara bölünür ve her parça ayrı sayfalanır.
 *
 * Azami gün SAĞLAYICIDAN gelir (`Yetenekler.azamiPencereGun`); `null` tek
 * pencere demektir (Amazon `LastUpdatedAfter` ile açık uçlu ister).
 */

export interface TarihPenceresi {
  /** Pencere başlangıcı (epoch ms, dâhil). */
  baslangic: number;
  /** Pencere bitişi (epoch ms, dâhil). */
  bitis: number;
}

const GUN_MS = 86_400_000;

/**
 * `[baslangicMs, bitisMs]` aralığını en fazla `azamiGunSayisi` günlük
 * parçalara böler. Parçalar ESKİDEN YENİYE sıralıdır: ilk senkronda en eski
 * siparişler önce yazılır, akış yarıda kesilse bile boşluk sonda kalır.
 *
 * Aralık geçersizse (bitiş başlangıçtan küçük/eşit) boş dizi döner — çağıran
 * "çekilecek bir şey yok" olarak okur.
 */
export function tarihPencereleri(
  baslangicMs: number,
  bitisMs: number,
  azamiGunSayisi: number | null = 14,
): TarihPenceresi[] {
  if (!Number.isFinite(baslangicMs) || !Number.isFinite(bitisMs)) return [];
  if (bitisMs <= baslangicMs) return [];
  if (azamiGunSayisi === null) return [{ baslangic: baslangicMs, bitis: bitisMs }];

  const adim = Math.max(1, Math.floor(azamiGunSayisi)) * GUN_MS;
  const pencereler: TarihPenceresi[] = [];
  for (let t = baslangicMs; t < bitisMs; t += adim) {
    pencereler.push({ baslangic: t, bitis: Math.min(t + adim, bitisMs) });
  }
  return pencereler;
}

/** İlk senkronda geriye gidilen varsayılan gün sayısı (PartnerSys ile aynı: 30). */
export const ILK_SENKRON_GUN = 30;

/** Art arda senkronlarda çakışma payı: sipariş kaçırmamak için 5 dk geri. */
export const CAKISMA_PAYI_MS = 5 * 60 * 1000;

/**
 * Senkronun başlangıç anı (epoch ms).
 *
 * - Daha önce senkron olduysa: son senkrondan 5 dk GERİ. Pazaryerinin yazma
 *   gecikmesi ve saat kayması yüzünden tam son senkron anından başlamak
 *   aradaki siparişleri kaçırırdı; çakışan kayıtlar upsert'te zaten aynı
 *   satıra düşer.
 * - Hiç senkron olmadıysa: `ilkGun` günlük geçmiş (sağlayıcıya göre).
 */
export function senkronBaslangici(
  sonSenkron: Date | null,
  simdi: Date = new Date(),
  ilkGun: number = ILK_SENKRON_GUN,
): number {
  if (sonSenkron && !Number.isNaN(sonSenkron.getTime())) {
    return sonSenkron.getTime() - CAKISMA_PAYI_MS;
  }
  return simdi.getTime() - ilkGun * GUN_MS;
}
