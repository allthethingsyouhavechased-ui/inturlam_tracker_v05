// Her sunucu başlangıcında önce tutarlı bir yedek al, ardından eski public
// upload deposu varsa özel runtime klasörüne taşı. Sıra bilinçli: taşıma yarıda
// kalsa bile başlangıçtan hemen önce alınmış geri dönüş kopyası bulunur.
await import("./backup.mts");
await import("./migrate-runtime-uploads.mts");
