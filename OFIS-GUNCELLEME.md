# İNTURLAM Tracker v03 ofis güncelleme ve geçiş kılavuzu

Bu belge iki farklı operasyonu birbirinden ayırır:

1. **v03 → v03:** Zaten v03 kullanan bir ofis kurulumunu yeni v03 koduna güncellemek.
2. **v02 → v03:** Canlı v02 verisini son kez dondurup v03’e geçirmek.

İkinci akış bir rutin güncelleme değildir. Açık geçiş onayı ve yazma kesintisi olmadan
uygulanmaz.

## Değişmeyen veri kuralları

- Ana DB: `data/inturlam.db`
- Kullanıcı dosyaları ve marka logoları: `data/uploads/`
- Tutarlı yedek: `npm run db:backup`
- Yerel yedek kökü: `data/backup/`
- Runtime verisi Git tarafından izlenmez.
- Mevcut ofis DB’sine başlangıç verisi yazmayın.
- v02 ve v03 aynı runtime klasörünü paylaşamaz ve aynı veriye aynı anda yazılamaz.
- DB dosyasını sunucu açıkken Explorer ile kopyalamayın; WAL içindeki son yazmalar
  kaçabilir. `VACUUM INTO` kullanan yedek komutunu kullanın.

## A. v03 → v03 güvenli güncelleme

### 1. Yazmaları durdurun

Ekipten kısa bakım penceresi isteyin ve çalışan v03 sunucusunu `Ctrl+C` ile durdurun.

### 2. Tutarlı yedek alın

```powershell
Set-Location C:\Users\intur\repos\inturlam-tracker-v03
npm run db:backup
```

Komut çıktısındaki yedek klasörünü not edin.

### 3. Çalışma ağacını kontrol edin

```powershell
git status --short
git branch --show-current
git remote -v
```

Kod değişikliği listeleniyorsa üzerine yazmayın. Önce değişikliğin sahibini ve nedenini
belirleyin. `data/` klasörünün listelenmemesi normaldir.

### 4. Onaylanmış kodu alın

```powershell
git switch main
git pull --ff-only origin main
npm install
```

`--ff-only`, ofis kopyasında sessiz merge commit oluşmasını engeller.

### 5. Şemayı ve runtime dosyalarını hazırlayın

```powershell
npm run db:migrate
npm run uploads:audit
```

Migration’lar veri koruyacak ve tekrar çalıştırılabilir biçimde tasarlanmıştır. Upload
denetimindeki eksik/yetim dosyaları çözmeden devam etmeyin.

### 6. Kodu doğrulayın

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

### 7. v03’ü başlatın

```powershell
npm run start
```

Geliştirme/ön geçiş düzeninde adresler:

- Yerel: `http://localhost:3001`
- LAN: `http://<OFIS-PC-IP>:3001`

Başka bir PowerShell’den:

```powershell
npm run smoke:local
```

### 8. Kullanıcı kontrol listesi

- Ekip girişi ve Guest girişi açılıyor mu?
- Bugün, Panom, Görevler, Markalar, Takvim ve Raporlar beklenen yetkiyle açılıyor mu?
- Marka sayfasında aylık ilerleme, sorumlular ve çekim hakları görünüyor mu?
- Guest başka markaya veya ekip rotalarına doğrudan URL ile ulaşamıyor mu?
- Takvim yalnızca etkinlikleri gösteriyor mu?
- Takvim sağlık kartı Google yapılandırmasının gerçek durumunu söylüyor mu?
- Son yüklenen görseller/logolar açılıyor mu?

## B. v02 → v03 kontrollü geçiş

Bu bölüm yalnızca geçiş ayrıca onaylandıktan sonra uygulanır.

### 1. Bakım penceresi ve yazma kilidi

1. Ekipten v02’ye yeni kayıt girmemesini isteyin.
2. v02 sunucusunu durdurun.
3. v02’nin gerçekten port 3000’i dinlemediğini kontrol edin.

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
```

Bu andan sonra v02’ye yeniden yazı kabul etmeyin.

### 2. Son v02 snapshot’ını alın

```powershell
Set-Location C:\Users\intur\repos\inturlam-tracker
npm run db:backup
```

Çıktıdaki son yedek klasörünü kaydedin. Bu klasörde `inturlam.db` ve varsa `uploads/`
birlikte bulunmalıdır.

### 3. v03 geliştirme verisini de koruyun

v03 sunucusunu durdurun ve mevcut geliştirme snapshot’ını alın:

```powershell
Set-Location C:\Users\intur\repos\inturlam-tracker-v03
npm run db:backup
```

### 4. Son v02 snapshot’ını v03 runtime alanına yerleştirin

Aşağıdaki değişkeni gerçek son v02 yedek klasörüyle doldurun:

```powershell
$v02Snapshot = "C:\Users\intur\repos\inturlam-tracker\data\backup\YYYYAAGG-SSDDss"
$v03Repo = "C:\Users\intur\repos\inturlam-tracker-v03"
```

Önce hedeflerin doğru olduğunu görün:

```powershell
Resolve-Path -LiteralPath $v02Snapshot
Resolve-Path -LiteralPath $v03Repo
Get-ChildItem -LiteralPath $v02Snapshot
```

Mevcut v03 upload alanını silmek yerine geri alınabilir biçimde yeniden adlandırın,
sonra snapshot’ı kopyalayın:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$v03Uploads = Join-Path $v03Repo "data\uploads"
if (Test-Path -LiteralPath $v03Uploads) {
  Move-Item -LiteralPath $v03Uploads -Destination (Join-Path $v03Repo "data\uploads-dev-oncesi-$stamp")
}
Copy-Item -LiteralPath (Join-Path $v02Snapshot "inturlam.db") -Destination (Join-Path $v03Repo "data\inturlam.db") -Force
if (Test-Path -LiteralPath (Join-Path $v02Snapshot "uploads")) {
  Copy-Item -LiteralPath (Join-Path $v02Snapshot "uploads") -Destination $v03Uploads -Recurse
}
```

Her iki sunucu kapalıyken eski WAL/SHM yan dosyalarının yeni snapshot’a karışmadığını
kontrol edin. Varsa yalnızca v03 hedefindeki açıkça doğrulanmış iki yan dosyayı kaldırın:

```powershell
Remove-Item -LiteralPath (Join-Path $v03Repo "data\inturlam.db-wal") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $v03Repo "data\inturlam.db-shm") -Force -ErrorAction SilentlyContinue
```

### 5. v03 migration’ını çalıştırın

```powershell
Set-Location $v03Repo
npm run db:migrate
npm run uploads:audit
```

### 6. DB bütünlüğünü ve satırları doğrulayın

```powershell
@'
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/inturlam.db", { readOnly: true });
console.log("PRAGMA integrity_check", db.prepare("PRAGMA integrity_check").get());
console.log("PRAGMA foreign_key_check", db.prepare("PRAGMA foreign_key_check").all());
for (const table of ["brands", "people", "accounts", "content_items", "tasks", "comments", "comment_attachments"]) {
  console.log(table, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get());
}
db.close();
'@ | node --input-type=module -
```

Beklenenler:

- `integrity_check` sonucu `ok`
- `foreign_key_check` sonucu boş liste
- v02’deki marka, kişi, içerik, görev ve yorum sayılarının korunması
- `npm run uploads:audit` sonucunda eksik runtime dosyası olmaması
- Guest hesapları ve yeni v03 tablolarının migration sonrası oluşması

### 7. Uygulama doğrulaması

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run start
```

Önce port 3001’de `npm run smoke:local` ve kullanıcı kontrol listesini tamamlayın.

### 8. Port 3000 cutover

Repository’nin `start` scripti geliştirme boyunca port 3001’e sabittir. v03’ü port
3000’e alma değişikliği, doğrulamalar tamamlandıktan sonra ayrıca onaylanıp kod/servis
yapılandırmasına uygulanmalıdır. Doğrulanmamış bir build’i yalnızca komut satırında port
değiştirerek canlıya almayın.

Cutover anında:

1. v02 kapalı kalır.
2. v03 yalnızca doğrulanmış son v02 snapshot’ıyla açılır.
3. LAN smoke ve iki gerçek ekip hesabıyla giriş kontrolü yapılır.
4. Bundan sonra yeni yazmalar yalnızca v03’e gider.

## Google üretim takvimi

Google test takviminden üretim takvimine geçiş veri cutover’ından ayrı onaylanır. Calendar
ID değiştirilmeden önce test senkron kuyruğu temiz ve sağlık kartı başarılı olmalıdır.
Service account anahtarı ve Calendar ID Git’e eklenmez.

## Geri dönüş sınırı

### v03’e yeni veri yazılmadan önce

v03 durdurulup v02, geçiş öncesi snapshot’ıyla yeniden açılabilir. Hangi snapshot’ın
kullanıldığı kayda geçirilmelidir.

### v03’e yeni veri yazıldıktan sonra

Otomatik v02 rollback desteklenmez. v03’te oluşan guest görevleri, hesaplar, takvim
etkinlikleri ve diğer yeni alanlar v02 şemasına kendiliğinden dönüştürülemez. Böyle bir
geri dönüş ayrı veri dönüşümü ve yeni bakım penceresi gerektirir.

## Sorun halinde v03 yedeğini geri yükleme

Sunucuyu durdurun:

```powershell
npm run db:restore
npm run db:restore -- <YEDEK-KLASORU> --force
npm run start
```

`db:restore`, yazmadan önce seçilen yedeğin bütünlüğünü doğrular ve mevcut DB’nin ayrıca
`restore-oncesi-*` güvenlik kopyasını alır.
