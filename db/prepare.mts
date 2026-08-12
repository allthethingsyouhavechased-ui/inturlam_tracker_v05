// Her sunucu başlangıcında önce tutarlı bir yedek al; ardından eski public
// upload deposunu taşı ve şemayı güncelle. Sıra bilinçli: taşıma veya migration
// yarıda kalsa bile hemen öncesine ait geri dönüş kopyası bulunur.
await import("./backup.mts");
await import("./migrate-runtime-uploads.mts");
await import("./migrate.mts");
