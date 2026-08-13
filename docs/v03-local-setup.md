# İNTURLAM Tracker v03 yerel kurulum ve operasyon

Bu belge v03 geliştirme kopyasını v02’den izole çalıştırmayı, runtime verisini
doğrulamayı ve Google test takvimini bağlamayı anlatır.

## 1. Değişmeyen izolasyon sözleşmesi

| Sürüm | Repo | Port | Veritabanı | Upload alanı |
|---|---|---:|---|---|
| v02 | `C:\Users\intur\repos\inturlam-tracker` | 3000 | kendi `data/inturlam.db` dosyası | kendi runtime klasörü |
| v03 | `C:\Users\intur\repos\inturlam-tracker-v03` | 3001 | kendi `data/inturlam.db` dosyası | `data/uploads/` |

- İki sürüm hiçbir runtime dosyasını paylaşmaz.
- `origin`, v03 private deposuna gider.
- `upstream-v02` yalnızca geçmiş karşılaştırması için fetch referansıdır; push URL’si
  `no_push://upstream-v02` olarak kapalıdır.
- v02 geliştirme sırasında port 3000’de ve kendi canlı verisiyle çalışmaya devam edebilir.
- İki sürüme aynı veriyi eşzamanlı yazdırmayın.

Kontrol:

```powershell
Set-Location C:\Users\intur\repos\inturlam-tracker-v03
git remote -v
git status --short
Get-NetTCPConnection -State Listen -LocalPort 3000,3001 -ErrorAction SilentlyContinue
```

## 2. Kurulum

```powershell
Set-Location C:\Users\intur\repos\inturlam-tracker-v03
npm install
```

Mevcut v03 snapshot’ıyla çalışırken `npm run db:seed` çalıştırmayın. İş geçmişini
silen `npm run db:clear-work` komutunu da çalıştırmayın. Bu iki komut normal kurulum,
güncelleme veya sunucu başlatma adımı değildir.

İlk sunucu başlangıcında `predev`/`prestart` sırasıyla:

1. `npm run db:backup` ile tutarlı snapshot alır.
2. Eski runtime upload yolunu `data/uploads/` altına taşır.
3. Veritabanı migration’larını uygular.

Elle ve ayrı doğrulamak isterseniz:

```powershell
npm run db:backup
npm run db:migrate
npm run uploads:audit
```

## 3. Çalıştırma

Geliştirme:

```powershell
npm run dev
```

Production modu:

```powershell
npm run build
npm run start
```

Adresler:

- Yerel: `http://localhost:3001`
- LAN: `http://<OFIS-PC-IP>:3001`

`npm run start`, `0.0.0.0:3001` üzerinde dinler. IP adresi DHCP ile değişebileceği için
`ipconfig` ile güncel IPv4 adresini kontrol edin.

## 4. Veri bütünlüğü

DB bütünlüğü ve yabancı anahtarlar:

```powershell
@'
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/inturlam.db", { readOnly: true });
console.log("integrity_check:", db.prepare("PRAGMA integrity_check").get());
console.log("foreign_key_check:", db.prepare("PRAGMA foreign_key_check").all());
db.close();
'@ | node --input-type=module -
```

Beklenen sonuç `integrity_check: { integrity_check: 'ok' }` ve boş
`foreign_key_check` listesidir. Runtime dosya referansları için ayrıca:

```powershell
npm run uploads:audit
```

Yedekler `data/backup/<YYYYAAGG-SSDDss>/` altındadır. Her snapshot DB ile upload
dosyalarını aynı klasörde tutar.

## 5. Test ve smoke kontrolü

Kod doğrulaması:

```powershell
npm test
npm run lint
npx tsc --noEmit
git diff --check
```

Sunucu çalışırken oturumlu kritik rotaları doğrulama:

```powershell
npm run smoke:local
```

Smoke komutu varsayılan olarak `http://127.0.0.1:3001` adresini kullanır ve geçici
oturum kaydını test sonunda temizler. Farklı hedef için yalnızca o PowerShell oturumunda:

```powershell
$env:INTURLAM_SMOKE_URL = "http://192.168.1.20:3001"
npm run smoke:local
Remove-Item Env:INTURLAM_SMOKE_URL
```

## 6. Google Calendar test bağlantısı

Önce ayrı bir test takvimi kullanın. Üretim takvimine geçiş bu doğrulamadan farklı ve
ayrıca onaylanması gereken bir işlemdir.

### 6.1 Google tarafı

1. Google Calendar’da ayrı bir test takvimi oluşturun.
2. Google Cloud projesinde bir service account oluşturun.
3. Service account için JSON anahtarı üretin.
4. Test takvimini service account e-posta adresiyle paylaşın ve etkinlikleri değiştirme
   yetkisi verin.
5. Google Calendar ayarlarından Calendar ID değerini alın.

### 6.2 Yerel sırlar

```powershell
Copy-Item config\google-calendar.env.example .env.local
```

`.env.local` içinde gerçek test değerlerini yazın:

```dotenv
GOOGLE_CALENDAR_ID=test-takvimi@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=tracker@example-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Private key içindeki satır sonları `\n` olarak kalmalıdır. `.env.local` ve anahtar
dosyaları Git’e girmez; gerçek değerleri örnek config dosyasına yazmayın.

### 6.3 Elle senkron testi

```powershell
npm run calendar:sync
```

Ardından yönetici hesabıyla Takvim sayfasındaki senkron sağlık kartını kontrol edin:

- “Yapılandırıldı” durumu görünmeli.
- Bekleyen/hatalı outbound sayısı açıklanmalı.
- Son başarılı inbound/outbound zamanı görünmeli.
- Aynı etkinlik ikinci kez oluşmamalı.

Tracker’da oluşturulan etkinlik Google’a gitmeli; test takviminde metadata olmadan
oluşturulan etkinlik Tracker’a `Ajans geneli + Toplantı + guest kapalı` olarak gelmelidir.

### 6.4 Beş dakikalık scheduler

PowerShell’de:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-calendar-sync-task.ps1
```

Kurulan görev adı: `Inturlam Tracker v03 Calendar Sync`.

```powershell
Get-ScheduledTask -TaskName "Inturlam Tracker v03 Calendar Sync"
Start-ScheduledTask -TaskName "Inturlam Tracker v03 Calendar Sync"
Get-ScheduledTaskInfo -TaskName "Inturlam Tracker v03 Calendar Sync"
Get-Content data\logs\calendar-sync.log -Tail 80
```

Görev `.env.local` içindeki üç zorunlu Google değişkenini kurulumdan önce doğrular,
gizli PowerShell runner’ını kullanır ve çakışan iki örneği aynı anda çalıştırmaz.

### 6.5 Senkron davranışı

- Tracker değişikliği Google’a hemen gönderilmeye çalışılır.
- Bağlantı yoksa kayıt `pending/error` kuyruğunda tutulur.
- Beş dakikalık görev outbound kuyruğunu yeniden dener ve inbound değişiklikleri alır.
- Eşleme yerel Google event ID/ETag ile Google private extended properties üzerinden
  yapılır; idempotenttir.
- Çakışmada güncelleme zamanı daha yeni olan taraf kazanır.
- Silme iki tarafta tombstone/iptal olarak taşınır; eşlenen kayıt körlemesine hard-delete
  edilmez.
- “Guest ile paylaş” yalnızca markalı bir etkinlikte açılabilir. Bu izin guest’e görev
  teslim tarihini veya iç görev alanlarını göstermez.

## 7. İsteğe bağlı Instagram senkronu

`.env.local`:

```dotenv
APIFY_TOKEN=apify_api_...
```

Elle doğrulama:

```powershell
npm run social:sync
```

Provider tamamen başarısız olduğunda hesaplar “sessiz” sayılmaz; hata durumu ayrı
gösterilir ve yanlış sessizlik bildirimi üretilmez.

## 8. Yetki sınırı

Bu belge yerel teknik kurulumu anlatır. Aşağıdakiler kendiliğinden yetkilendirilmiş
sayılmaz:

- v02 servisini durdurmak veya yeniden başlatmak
- v03’ü port 3000’e almak
- production Google takvimine bağlamak
- commit, push veya deploy yapmak
- canlı veriyi geri yüklemek ya da silmek

Onaylı geçiş akışı için [../OFIS-GUNCELLEME.md](../OFIS-GUNCELLEME.md) belgesini kullanın.
