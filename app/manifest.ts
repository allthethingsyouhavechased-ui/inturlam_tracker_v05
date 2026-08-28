import type { MetadataRoute } from "next";

// Telefondan LAN adresine girip "ana ekrana ekle" diyen ekip üyesi için:
// adres çubuğu olmayan, kendi ikonu ve rengi olan bir uygulama penceresi.
// Çevrimdışı desteği YOK ve bilerek yok — service worker eklemek, tek SQLite
// dosyasına yazan bu araçta çözdüğünden çok senkronizasyon sorunu yaratırdı.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "INTracker",
    short_name: "INTracker",
    description: "Marka, içerik ve görev operasyon merkezi",
    lang: "tr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f5f2",
    theme_color: "#326b61",
    icons: [
      { src: "/inturlam-logo.jpg", sizes: "512x512", type: "image/jpeg", purpose: "any" },
    ],
  };
}
