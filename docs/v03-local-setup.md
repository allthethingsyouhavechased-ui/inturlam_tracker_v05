# İNTURLAM Tracker v03 yerel çalışma notları

## İzolasyon

- v02: `C:\Users\intur\repos\inturlam-tracker`, port `3000`
- v03: `C:\Users\intur\repos\inturlam-tracker-v03`, port `3001`
- v03 kendi `data/inturlam.db` ve `data/uploads` dizinini kullanır. Runtime dosyaları v02 ile paylaşılmaz.
- `upstream-v02` yalnızca fetch referansıdır; push URL'si bilinçli olarak devre dışıdır.

## Google Calendar test bağlantısı

1. Ayrı bir test Google takvimi oluşturun.
2. Google Cloud service account oluşturun ve takvimi service account e-posta adresiyle düzenleme yetkisi vererek paylaşın.
3. `config/google-calendar.env.example` içeriğini `.env.local` dosyasına kopyalayıp gerçek Calendar ID, e-posta ve private key değerlerini yalnızca burada saklayın.
4. Tek seferlik doğrulama için `npm run calendar:sync` çalıştırın.
5. Başarılı testten sonra yönetici PowerShell oturumunda `powershell -ExecutionPolicy Bypass -File scripts/install-calendar-sync-task.ps1` ile beş dakikalık yerel görevi kurun.

Görev oluşturma/düzenleme işlemleri Google'a hemen yazmayı dener. Bağlantı veya kimlik bilgisi yoksa kayıt yerel `pending/error` kuyruğunda kalır; beş dakikalık iş inbound değişiklikleri alır ve outbound kuyruğunu yeniden dener. Üretim takvimine geçiş ayrıca onaylanmalıdır.

## Çalıştırma

- Geliştirme: `npm run dev`
- Production build yerel smoke: `npm run build`, ardından `npm start`
- v03 adresi: `http://localhost:3001`

v02 servisinin yeniden başlatılması, v03'ün port 3000'e alınması, GitHub repo oluşturma, commit, push ve deploy ayrı yetki gerektirir.
