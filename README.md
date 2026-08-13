# İNTURLAM Tracker v03

İNTURLAM’ın marka, içerik, görev, ekip ve etkinlik operasyonlarını tek yerde yöneten
Next.js tabanlı iç takip sistemi. v03, çalışan v02’den ayrı geliştirilir ve varsayılan
olarak `http://localhost:3001` adresinde çalışır.

## Belge haritası

- Günlük ürün kullanımı: [KULLANIM-KILAVUZU.md](KULLANIM-KILAVUZU.md)
- v03 yerel kurulum ve servisler: [docs/v03-local-setup.md](docs/v03-local-setup.md)
- Güvenli ofis güncellemesi ve v02’den geçiş: [OFIS-GUNCELLEME.md](OFIS-GUNCELLEME.md)
- Mimari kararlar ve kod tuzakları: [CLAUDE.md](CLAUDE.md)
- Korunan tasarım sistemi: [design-system/inturlam-tracker/MASTER.md](design-system/inturlam-tracker/MASTER.md)

## v03’te neler var?

- **Birleşik hesap altyapısı:** Ana girişte Ekip girişi ve Guest girişi ayrıdır.
  Ekip hesapları kişi rolleriyle, guest hesapları tek bir markayla kapsamlanır.
- **Guest marka portalı:** Guest yalnızca kendi marka dashboard’unu, bu hesaptan açılan
  görevleri ve açıkça paylaşılmış etkinlikleri görür. İç teslim tarihi, görev sahibi,
  ağırlık, iç notlar ve iç yorumlar guest veri sözleşmesine girmez.
- **Zorunlu ekip teslim tarihi:** Ekip tarafından açılan yeni görevlerde teslim tarihi
  zorunludur. Eski tarihsiz işler korunur ve “Tarih bekleyenler” kuyruğunda gösterilir.
- **Guest planlama kuyruğu:** Guest görev açarken İstenen tarih girer. İç teslim tarihi
  ekip tarafından verilene kadar görev “Planlanacak” akışında kalır ve aylık ilerlemeye
  katılmaz.
- **Ağırlıklı aylık ilerleme:** Görevler 1–100 arasında ağırlık puanı taşır. Beklemede,
  Devam Ediyor, İncelemede, Onaylandı ve Yayınlandı durumları sırasıyla %0, %25, %60,
  %90 ve %100 katsayıyla hesaplanır.
- **Kişisel ve marka analizleri:** Bugün, Panom, Bu ayki katkım, Üzerimdeki markalar ve
  marka detay ekranları seçilen aya göre ağırlıklı ilerlemeyi gösterir.
- **Fikir Bankası:** Marka veya Ofis geneli kapsamındaki içerik, kampanya, görsel dil,
  strateji ve süreç fikirleri; Instagram ve diğer kaynak bağlantılarıyla birlikte aranabilir,
  etiketlenebilir ve fikir durumuna göre geliştirilebilir.
- **Versiyonlu teslim ve onay:** Görev çalışmaları V1, V2… olarak bağlantı ve önizlemelerle
  sunulur. Onay veya gerekçeli revize kararı mühürlenir; yeni teslim aktif revize turunu
  otomatik tamamlar. Guest yalnızca açıkça paylaşılan teslimleri görür ve karara bağlar.
- **Marka operasyon özeti:** Marka sorumluları, aylık/yıllık çekim hakları, aylık içerik
  akışı, ilerleme ve yaklaşan toplantı/çekimler marka sayfasındadır.
- **Merkezi etkinlik takvimi:** Toplantı, Çekim ve Diğer etkinlikleri marka ve renkle
  planlanır. Çok günlük etkinlikler kesintisiz şerit olarak görünür. Görev teslim tarihleri etkinlik takviminde gösterilmez.
- **Google Calendar senkronu:** Ayrı bir Google takvimiyle çift yönlü, kimlik bilgileri
  Git dışında kalan ve beş dakikalık tekrar kuyruğu bulunan senkron altyapısı vardır.
- **Görev şablonları:** `/templates` ekranından şablon ve şablon adımları yönetilir;
  hedef tarihi bulunan içeriklere uygulanabilir.
- **Sosyal operasyon:** Hesap sessizliği, hazır içerik varlığı, paylaşım takvimi ve
  marka bazlı “Aylık içerikler tamamlandı” kapanışı birbirinden ayrıdır.
- **Raporlama:** Dönem, kişi, departman ve marka detaylarıyla birlikte teslimlerin ilk-onay
  oranı ve revize nedenleri izlenir; CSV, Excel ve yazdırma çıktıları yönetici kapsamındadır.

## Teknoloji ve runtime verisi

- Next.js 16 App Router, React 19, TypeScript ve Tailwind CSS 4
- Node.js yerleşik `node:sqlite` sürücüsü
- Ana veritabanı: `data/inturlam.db`
- Kullanıcı yüklemeleri ve marka logoları: `data/uploads/`
- Yedekler: `data/backup/`
- Takvim logları: `data/logs/`
- Yerel sırlar: `.env.local`

Bu runtime yolları Git tarafından izlenmez. v02 ve v03 aynı veritabanını veya upload
klasörünü paylaşmaz.

## Gereksinimler

- Node.js 20.9 veya üzeri; Node.js 24 önerilir.
- Windows/PowerShell mevcut operasyon scriptleri için önerilen ortamdır.
- Uygulamanın kendisi için ayrı bir veritabanı sunucusu gerekmez.

## Geliştirme kurulumu

Mevcut v03 snapshot’ıyla çalışırken:

```powershell
Set-Location C:\Users\intur\repos\inturlam-tracker-v03
npm install
npm run dev
```

`predev` önce tutarlı yedek alır, eski runtime upload yapısını taşır ve migration’ları
uygular. Uygulama `http://localhost:3001` adresinde açılır.

Tamamen boş ve yeni bir geliştirme veritabanı kurmak dışında `npm run db:seed`
çalıştırmayın. Mevcut snapshot’ı veya ofis verisini seed ile “yenilemeyin”.

## Doğrulama

```powershell
npm test
npm run lint
npx tsc --noEmit
git diff --check
```

Çalışan bir v03 sunucusunda oturumlu ana rotaları doğrulamak için:

```powershell
npm run smoke:local
```

Başka bir adres kullanılıyorsa:

```powershell
$env:INTURLAM_SMOKE_URL = "http://127.0.0.1:3001"
npm run smoke:local
Remove-Item Env:INTURLAM_SMOKE_URL
```

## Production modunda yerel/LAN çalışma

```powershell
npm run build
npm run start
```

`npm run start`, `0.0.0.0:3001` üzerinde dinler. Aynı ağdaki cihazlar
`http://<OFIS-PC-IP>:3001` adresini kullanır. IP’yi `ipconfig` ile yeniden kontrol edin;
DHCP nedeniyle değişebilir.

Port 3001 için firewall kuralı gerekiyorsa yönetici PowerShell’de:

```powershell
New-NetFirewallRule -DisplayName "Inturlam Tracker v03 3001" `
  -Direction Inbound -Protocol TCP -LocalPort 3001 `
  -Action Allow -Profile Private
```

v03’ün port 3000’e alınması normal geliştirme adımı değildir; yalnızca onaylı v02 → v03
geçişinde, son veri snapshot’ı doğrulandıktan sonra yapılır.

## Yedekleme ve geri yükleme

Sunucu açıkken güvenli snapshot:

```powershell
npm run db:backup
```

Komut SQLite `VACUUM INTO` kullanır ve aynı snapshot içine `data/uploads/` dosyalarını
ekler. Son 14 yerel yedek tutulur. İsteğe bağlı ikinci hedef:

```powershell
$env:INTURLAM_BACKUP_DIR = "G:\Drive'ım\INTURLAM_YEDEK"
npm run db:backup
Remove-Item Env:INTURLAM_BACKUP_DIR
```

Yedekleri listelemek ve geri yüklemek:

```powershell
npm run db:restore
npm run db:restore -- 20260813-120000 --force
```

Geri yükleme canlı verinin üzerine yazar. Önce sunucuyu durdurun. Komut yedeğin
`integrity_check` sonucunu doğrular ve mevcut DB’nin ayrıca güvenlik kopyasını alır.

Upload/DB ilişkisini salt okunur denetlemek için:

```powershell
npm run uploads:audit
```

## Veriyi silen bakım komutları

`npm run db:clear-work` ve `npm run db:seed` rutin güncelleme, geliştirme başlatma veya
yayın adımı değildir. İlk komut iş kayıtlarını siler; ikinci komut başlangıç verisi
yazar. Yalnızca kapsam açıkça onaylandığında kullanılmalıdır.

## Google Calendar ve Instagram

Google test takvimi kurulumu, service account değişkenleri, scheduler ve sağlık kontrolü
[docs/v03-local-setup.md](docs/v03-local-setup.md) içinde anlatılır.

Instagram sessizlik senkronu için `.env.local` içinde en az `APIFY_TOKEN` tanımlanır:

```powershell
npm run social:sync
```

Desteklenen ayarlar: `APIFY_INSTAGRAM_ACTOR`, `SOCIAL_SILENCE_DAYS`,
`SOCIAL_POSTS_PER_ACCOUNT`, `SOCIAL_TIMEOUT_MS`, `SOCIAL_REALERT_DAYS`,
`SOCIAL_PROVIDER` ve test için `SOCIAL_MOCK_FILE`.

## Git izolasyonu

- `origin`: `inturlam_tracker_v03` private deposu
- `upstream-v02`: v02 geçmişini okumak için fetch referansı
- `upstream-v02` push URL’si bilinçli olarak devre dışıdır

Commit, push, production takvimine bağlama, deploy veya port değişikliği ayrı operasyon
kararlarıdır; testlerin geçmesi bu işlemleri otomatik olarak yetkilendirmez.
