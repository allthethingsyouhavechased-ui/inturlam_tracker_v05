# Ofis PC'sini Güncelleme

Bu belge, ofiste hâlihazırda kullanılan İNTURLAM İş Takip kurulumunu GitHub'daki
son sürüme geçirirken mevcut marka, içerik, görev, yorum ve aktivite verilerini
korumak içindir.

## En önemli bilgi

Kod ve gerçek kullanım verisi ayrı tutulur:

- Kod GitHub'dan gelir.
- Ofis verisi `data/inturlam.db` dosyasında, yüklenen görseller `public/uploads/`
  klasöründe durur.
- Bu iki veri yolu Git tarafından izlenmez. Normal bir `git pull` görevleri silmez.
- Mevcut ofis kurulumunda **`npm run db:seed` çalıştırma**. Seed ilk kurulum içindir.

## Güncelleme adımları

Ofis PC'sinde uygulamanın bulunduğu klasörde PowerShell aç:

1. Çalışan sunucuyu, açık terminalde `Ctrl+C` ile durdur.
2. Geri dönebilmek için yedek al:

   ```powershell
   npm run db:backup
   ```

3. Yerel kod değişikliği olmadığını kontrol et:

   ```powershell
   git status --short
   ```

   Çıktı boşsa devam et. Kod dosyaları listelenirse üzerine yazma; önce değişiklikleri
   kaydet veya Yunus Emre ile kontrol et. `data/` görünmez, bu normaldir.

4. Son sürümü ve bağımlılıkları al:

   ```powershell
   git switch main
   git pull --ff-only origin main
   npm install
   ```

5. Veritabanı şemasını yükselt:

   ```powershell
   npm run db:migrate
   ```

6. Bu geçişte istenen temiz başlangıcı ofis veritabanına da uygula. Önce kapsamı
   göster, sonra tek seferlik temizliği çalıştır:

   ```powershell
   npm run db:clear-work
   npm run db:clear-work -- --force
   ```

   İkinci komut yeniden yedek alır; tüm görevleri, bunların yorum/durum kayıtlarını,
   görev bildirimlerini ve aktivite akışını siler. Marka, ekip, içerik/proje,
   şablon ve aktif marka seçimleri kalır.

7. Üretim sürümünü hazırla ve başlat:

   ```powershell
   npm run build
   npm run start
   ```

8. Tarayıcıda `http://localhost:3000` adresini aç. Aynı ağdaki diğer kişiler
   `http://<OFIS-PC-IP>:3000` adresini kullanır. IP için:

   ```powershell
   ipconfig
   ```

## Güncellemeden sonra kontrol listesi

- Markalar, ekip üyeleri, içerikler ve mevcut görevler duruyor mu?
- Hesap seçip şifreyle giriş yapılabiliyor mu?
- **Ekip** sayfasındaki aktif marka kanbanı açılıyor mu?
- **Görevler** sayfasında filtreler ile pano/liste geçişi çalışıyor mu?
- **Raporlar** sayfasında dönem ve tablolar açılıyor mu?

## Sorun olursa geri dönme

Önce sunucuyu `Ctrl+C` ile durdur. Yedekleri listele:

```powershell
npm run db:restore
```

Geri yüklenecek yedeği seçtikten sonra:

```powershell
npm run db:restore -- <YEDEK-KLASORU> --force
npm run start
```

Geri yükleme komutu mevcut veritabanını da ayrıca yedekler. Yedek klasörünü elle
kopyalamak yerine bu komutu kullan.
