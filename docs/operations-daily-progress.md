# İşleyiş doğruluğu ve günlük kullanım — teslim notları

6 Eylül 2026. Başlangıç: `6a18970` (aylık kişisel hedefler). Bu teslim G01–G10 kapsamındaki teknik değişiklikleri birleştirir; kapsamlı ürün/rakip denetiminin veya bütün yol haritasının tamamlandığı anlamına gelmez.

## Uygulanan değişiklikler

| İş | Sonuç |
|---|---|
| G01 — Tekrarlayan görev | Tamamlama ve sonraki görevi üretme aynı işlemde; tekil/toplu/eşzamanlı tekrarlarda mükerrer görev engellenir. Puan, sorumlu ve tekrar bilgisi korunur; özel notlar ve müşteri teslimleri kopyalanmaz. |
| G02 — Teslim ve karar | Bekleyen teslim, aktif revize ve onaysız son sürüm kontrolleri ortaklaştırıldı. Eski veya tekrarlanan karar ve yetkisiz marka erişimi sınanır. |
| G03 — Hızlı görev | İçerik ve görev atomik oluşturulur; tekrar gönderme aynı sonucu döndürür. Alan hataları görünür, giriş korunur; arşiv marka, yanlış tarih, pasif sorumlu ve yetkisiz puan değişikliği reddedilir. |
| G04 — Görsel yükleme | Ekip ve müşteri formlarında ortak sınırlar: 6 dosya, dosya başına 8 MiB, toplam 20 MiB, 24 milyon piksel. Sunucu gerçek görseli çözer, MIME/format uyumunu kontrol eder; hata halinde kısmi dosya/veri bırakılmaz. |
| G05 — Dönem ve sayaç | Gerçek ay doğrulaması; çekim sayacının manuel/takvim kaynağı, değiştiren kişi ve zamanı; denetim geçmişi. Yıllık ve aylık sayaçların bağımsızlığı açıklanır. İptalin alt görev ve puanı değiştirmediği işlem öncesi görünür. |
| G06 — Müşteriye paylaşım | Yönetici önizlemesi, açık paylaşım ve geri alma; ekip içi not/puan/sorumlu ayrımı. Liste, detay, yorum, karar, bildirim ve dosya erişiminde ortak paylaşım kontrolü. Teslim göndermeden önce müşteri görünürlüğü onayı. |
| G07 — Büyük görev listesi | Sunucuda filtreleme ve 50 satırlık sayfalar, tutarlı sayaçlar, kararlı sıra; ayrı planlama sayfası; detaydan filtre ve kaydırma konumuna dönüş. |
| G08 — Günlük arayüz | Panom filtre ve görünüm tercihleri; mobil liste varsayılanı; tek eksenli pano; dar başlık alanı düzenlemesi; erişilebilir hızlı görev açma ve odağı geri verme. |
| G09 — Öncelikli işler | Bugün/geciken/revize filtreleri ve sayaçları; kompakt yönetici karar kuyruğu; teslim bağlantısından doğru sekme ve sürüme geçiş. |
| G10 — Fikir, talep ve rapor | Mobil fikir yakalama ve marka seçimi; dönüşmüş talepten göreve bağlantı; rapor metriklerinden aynı kayıt kümesinin listesine ve Excel'ine geçiş. |

Aylık kişisel hedefler ve %100 üzeri ilerleme korunur. Geliştirme; görev yaşam döngüsü, hızlı oluşturma ve liste/arayüz işleri için ayrı ajan çalışma kopyalarında yürütülüp tek dalda bütünleştirildi.

## Doğrulama

- Tam otomatik paket: 538 test, 537 başarılı, 0 başarısız, 1 atlanan. Atlanan mevcut test gerçek veritabanı anlık görüntüsü gerektirir; gerçek veri test amacıyla değiştirilmedi.
- Üretim derlemesi ve TypeScript: `npm run build -- --webpack`. Lint: `npm run lint`. İnceleme kopyasının dış dizine bağlı `node_modules` bağlantısı Turbopack tarafından reddedildiği için webpack kullanılır; bu ortama özgü durum için ürün ayarı değiştirilmedi.
- Ayrı süreçlerle eşzamanlı tekrar/tamamlama ve hızlı oluşturma; işlem geri alma, yanlış giriş ve ay/tarih sınırı testleri.
- Gerçek HTTP kontrolü: paylaşılan müşteri dosyası 200; başka marka 403; oturumsuz istek 401; paylaşımı geri alınmış dosya 403. Geri alınmış görev detayında içerik yok ve Next not-found sonucu var (akışlı yanıtın dış HTTP kodu 200 olabilir).
- Müşteri detayında özel not ve iç içerik başlığı sızıntısı bulunmadı. Yetkisiz rapor istekleri giriş/yetki yönlendirmesiyle engellendi; geçersiz rapor tarihi 400.
- Rapor sayacı, görev listesi ve Excel'deki 9 görev kimliği birebir eşleştirildi.
- 2.000/10.000 görevli üretim HTTP sayfaları sırasıyla 316.400/316.413 bayt, 60/152 ms yerel ısınmış yanıt. Ayrıntılar: [görev listesi ölçümü](task-pagination.md).
- Tarayıcıda hızlı görev doğrulama/oluşturma, müşteri paylaşma ve geri alma, rapor liste bağlantısı, mobil/masaüstü Panom kontrol edildi. 390, 768, 1280 ve 1440 pikselde Panom sayfasında yatay taşma ölçülmedi. Örneklenen fikir bankası metinlerinde en düşük kontrast açık temada 5,36:1, koyu temada 6,16:1; bu tüm uygulama için erişilebilirlik sertifikası değildir.

## Veri ve çalıştırma sınırı

İnceleme `intracker-operations-daily` çalışma kopyasında, ayrı `operations-preview.db`, sentetik veriler ve 3107 portunda yapıldı. Gerçek veritabanı, yüklemeler, yerel `host.log` ve `scripts/host.ps1` korunur. Yeni tablolar eklemelidir; mevcut kayıtları toplu dönüştürme veya silme yoktur. Kaynak güncellemesi canlı sunucunun yeniden başlatıldığı anlamına gelmez. Yeni sürümün gerçek veri üzerindeki ilk açılışında ek tablolar normal şema başlangıcında oluşturulur.

## Kalan kabul ve kapsam dışı işler

1. **İptal politikası:** İptal edilen içeriğin açık alt görevlerinin iş yükü/puan hesabından düşüp düşmeyeceği işletme kararı gerektirir. Mevcut davranış korunmuştur; kullanıcıya etkisi açıkça gösterilir. Bu yeni politika uygulanmış sayılmaz.
2. **Ekip pilotu:** Beş tipik işin gerçek ekip üyeleriyle önce/sonra süre ve hata ölçümü henüz yapılmadı. G08–G09'un insan kullanımı kabulü bu pilotla tamamlanmalıdır.
3. **Daha geniş yol haritası:** Rakiplerin kapsamlı karşılaştırması, bütün modüllerin denetimi, yedekleme/geri yükleme tatbikatı ve çoklu şirket/abonelik gibi ticari ürün işleri bu teknik teslimle tamamlanmış sayılmaz.
