import { IskeletSayfa } from "@/components/panel/iskelet";

/**
 * Panel rotalarının Suspense sınırı.
 *
 * Bu dosya olmadan sunucu render'ı sürerken kullanıcı boş bir ekrana ya da
 * eski sayfaya bakar. Sınır konunca kabuk (menü + üst çubuk) yerinde kalır,
 * içerik alanı anında iskelete döner ve sayfa hazır olduğunda akar.
 */
export default function PanelYukleniyor() {
  return <IskeletSayfa />;
}
