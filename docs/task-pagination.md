# Görev listesi: sınırlı veri ve dönüş bağlamı

Görevler sunucuda filtrelenir ve 50 satırlık sayfalar halinde okunur. Tüm sonuç sayısı ve departman sayıları aynı filtre kümesinden hesaplanır. Sıra eşitliğinde görev kimliği kullanılır. Pano ve toplu seçim yalnız gösterilen sayfayı kapsar; tarih bekleyen müşteri talepleri ayrı planlama sayfasındadır.

Liste sütunu, yönü, filtreleri ve sayfa adres çubuğundadır. Detaydan dönüş bağlantısı aynı adresi ve kaydırma konumunu oturumluk tarayıcı saklamasından geri getirir. Tarayıcı saklaması kapalıysa normal görev listesi bağlantısı çalışır. Kişisel hedef tarihi yalnız oturumdaki kişiye atanmış satıra eklenir. Aktif ekip oturumu sorgu sınırında da kontrol edilir.

## Tekrarlanabilir ölçüm

`node --import ./scripts/register.mjs --test tests/taskPagination.test.ts`

Windows, Node 24.18.0, Intel Core i5-14400F; geçici SQLite, eşit tarihli ve uzun notlu temsili kayıtlar:

| Görev | Dönen satır | JSON boyutu | İlk sorgu |
|---:|---:|---:|---:|
| 2.000 | 50 | 48.628 bayt | 29,20 ms |
| 10.000 | 50 | 48.632 bayt | 117,69 ms |

Bu ilk ölçüm repository DTO'sudur. 6 Eylül 2026'da ayrı SQLite veritabanı ve webpack üretim derlemesiyle yerel HTTP yanıtı da ölçüldü:

| Görev | Dönen satır | Sıkıştırılmamış HTML + React yanıtı | Isınmış HTTP yanıt süresi |
|---:|---:|---:|---:|
| 2.000 | 50 | 316.400 bayt | 60 ms |
| 10.000 | 50 | 316.413 bayt | 152 ms |

Her iki sayfa yanıtı da 500 KB sınırının altında kaldı. Bu ölçüm ayrı indirilen JavaScript, CSS ve fontları kapsamaz; yerel makine ölçümüdür, ağ performansı veya kullanıcı SLA'sı değildir. Not/brief listede taşınmaz. Testler sayfa sınırı, kararlı sıra, filtre/sayaç uyumu, Türkçe arama, parametre güvenliği, aktif ekip erişimi, kişisel hedef ayrımı, arşiv/planlama sınırı ve dönüş adresi/kaydırma davranışını kapsar.
