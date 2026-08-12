# İNTURLAM Tracker v02

İNTURLAM'ın 19 markası için içerik & görev takip aracı + marka araştırma paneli —
ftrack mantığında ("Marka → İçerik/Proje → Görev") ama İNTURLAM'a özel, tek dosyalık,
kurulumu basit bir iç araç.

**Ne işe yarar:**
- **Görev takibi:** Her marka için içerik/proje planla (Reel, Foto, Kampanya…), altına
  görevler düş (brief, çekim, kurgu, onay, yayın), kime atandığını ve son tarihini
  işaretle, yorum bırak.
- **Marka bilgileri:** Her markanın Instagram verisi (takipçi, gönderi sayısı, haftalık
  tazelenme takibi) ve öne çıkan bulgu, marka sayfasında bir bakışta.
- **"Panom" sayfası:** Herkes kendi açık görevlerini, gecikmişleri ve o hafta teslim
  olacakları tek ekranda görür — durumunu da göreve girmeden, doğrudan bu listeden
  değiştirebilir.
- **Aktif marka kanbanı:** Ekip sayfasında herkes o an çalıştığı markayı seçer; seçilen
  markadaki açık görevleri kişinin sütununda görünür.
- **Departman bazlı görünüm:** Her kişinin bir departmanı var (Video / Tasarım / Sosyal
  Medya / Yönetim). Görevler sayfasındaki ekip sekmeleriyle tek tıkla "sadece video
  ekibinin işleri"ne inilir; ekip kanbanı ve raporlar da aynı ayrımı kullanır.
- **Müşteri talepleri:** Briefler önce talep kuyruğuna girer. Yunus, Sıla, Erhan ve
  Sosyal Medya ekibi talebi değerlendirir, hedef departmandaki kişiye atar, yorum ekler
  ve onayladığında içerik ile görevi tek işlemde oluşturur.
- **Kişisel görünüm tercihleri:** Panom ve Görevler için seçilen Pano/Liste görünümü
  tarayıcıda ayrı ayrı hatırlanır.
- **Yayın → arşiv akışı:** "Yayınlandı" işaretlenen görev panodan anında kaybolmaz;
  7 gün daha durup arşive düşer. Yanlışlıkla işaretlemek geri alınabilir bir hata olur,
  arşivdeki iş de silinmez — tek tıkla panoya döner.
- **Operasyon raporları:** Dönem, departman, ekip ve marka bazında iş yükü, gecikme,
  tamamlanma ve iş akışı dağılımını gösterir.
- **Excel dökümü:** Raporlardaki "Excel dökümü" düğmesi 5 sayfalık bir `.xlsx` indirir:
  ekrandaki özet görünümün kendisi + satır satır görev listesi (işin **adı**,
  **kategorisi**, markası, içeriği, sorumlusu, tarihleri) + departman, ekip ve marka
  tabloları. Kişi ve departman raporlarından indirilen döküm yalnızca o kapsamı taşır.
- **Kişi bazlı detaylı rapor:** Raporlar → ekip tablosundaki "Detaylı rapor" bağlantısı
  bir kişinin tam görünümünü açar — düz Türkçe özet, ekip ortalamasıyla karşılaştırma,
  durum/öncelik/marka dağılımı ve sayının arkasındaki gerçek görev listeleri (gecikmiş,
  önümüzdeki 7 gün, son tamamlananlar). CSV, Excel ve yazdırma dahil.
- **Departman bazlı detaylı rapor:** Raporlar → departman tablosundaki "Detaylı rapor"
  bağlantısı aynı görünümü bir departmanın tamamı için açar: kişi başına düşen açık iş,
  portföy içindeki pay, departmandaki kişilerin tek tek yükü ve kim ne yapıyor bilgisiyle
  görev listeleri. Departman kişinin alanı olduğu için atanmamış görevler bu sayılara
  girmez; departmanı boş olan kişiler "Diğer" satırında toplanır.

Her ekip üyesi kendi hesabını seçip şifresiyle giriş yapar. Oturumlar sunucuda özetlenmiş
token olarak tutulur; rapor ekranları ve dışa aktarımlar yalnızca yönetici rolüne açıktır.
Veri tek bir yerel dosyada tutulur (`data/inturlam.db`, SQLite) — ayrı bir veritabanı
sunucusu kurmaya gerek yok.

**Ofis içinde günlük kullanım için** (kurulum bilmeden, sadece "nasıl kullanırım")
→ **[KULLANIM-KILAVUZU.md](KULLANIM-KILAVUZU.md)** dosyasına bak. Aşağıdaki bölümler
kurulum/geliştirme/dağıtım içindir.

**Ofis PC'sindeki mevcut kurulumu bu sürüme yükseltmek için**
→ **[OFIS-GUNCELLEME.md](OFIS-GUNCELLEME.md)** dosyasındaki adımları sırayla uygula.

## Gereksinimler

- Node.js 20.9+ (24 önerilir — `node:sqlite` ve native TypeScript için). Kurulu.
- Ekstra bir veritabanı/servis **gerekmez**. SQLite Node'un içinde geliyor.

## İlk kurulum

```powershell
npm install
npm run db:seed   # 19 markayı, kişileri, marka ilişkilerini ve (varsa) tam denetim metinlerini yazar
```

Tam denetim metinleri (her markanın 7 katmanlı Instagram analizi) paylaşımlı Obsidian
vault'undan (`Obsidian Vault (Ofis PC)/İNTURLAM/Marka Denetimleri/`) okunur. O klasör bu
bilgisayarda bağlı değilse (ör. Drive bağlı değilse) seed yine çalışır, sadece marka
sayfalarındaki "Tam Denetim Raporu" bölümü boş kalır — takipçi/performans/bulgu gibi
temel veriler zaten `db/seed.mts`'e gömülü olduğu için etkilenmez.

### Kişileri düzenleme

Kullanacak kişileri `db/seed.mts` içindeki `PEOPLE` listesinde düzenle
(`id` sabit kalsın, `name`'i değiştir), sonra tekrar çalıştır:

```powershell
npm run db:seed
```

`db:seed` yalnızca ilk kurulum veya bilinçli veri yenileme içindir. Mevcut ofis
veritabanını güncellerken çalıştırma; ofisteki kullanıcı verisini korumak için
`OFIS-GUNCELLEME.md` akışını kullan.

## Ofis PC'sine ilk kurulum

Kod GitHub'daki private depoda tutulur. Yeni bir ofis bilgisayarına ilk kez kurarken:

```powershell
git clone https://github.com/allthethingsyouhavechased-ui/inturlam_tracker_v02.git
cd inturlam_tracker_v02
npm install
npm run db:seed
npm run build
npm run start
```

Node.js 20.9+ gerekir; güncel LTS sürümü önerilir. Bu komutlar yeni ve boş kurulum
içindir. Ofis PC'sinde uygulama zaten kuruluysa tekrar clone veya seed yapma;
**[OFIS-GUNCELLEME.md](OFIS-GUNCELLEME.md)** dosyasını kullan.

Görev ve aktivite geçmişini kontrollü temizlemek için önce kapsamı gösteren,
`--force` verildiğinde otomatik yedek alıp temizleyen bakım komutu:

```powershell
npm run db:clear-work
npm run db:clear-work -- --force
```

## Geliştirme (tek makinede)

```powershell
npm run dev
```

→ http://localhost:3000

## Ofiste kullanım (LAN'da paylaşma)

```powershell
npm run build
npm run start     # 0.0.0.0:3000 — ağdaki diğer bilgisayarlar erişebilir
```

1. Uygulamayı çalıştıran bilgisayarın IP'sini bul:

   ```powershell
   ipconfig    # "IPv4 Address" satırı, örn. 192.168.1.20
   ```

2. Meslektaşların tarayıcıdan `http://<O_IP>:3000` adresine girsin.

### Windows Firewall (bir kez)

- `npm run start` ilk çalıştığında Windows "izin ver" penceresi açarsa
  **Özel ağlar**'ı işaretleyip izin ver.
- Pencere çıkmazsa, yönetici PowerShell'de:

  ```powershell
  New-NetFirewallRule -DisplayName "Inturlam Tracker 3000" -Direction Inbound `
    -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
  ```

- Ofis ağın **Public** görünüyorsa Windows gelen bağlantıları engeller. Kontrol:

  ```powershell
  Get-NetConnectionProfile | Select-Object Name, NetworkCategory
  ```

  Güvenilir ofis ağıysa profili **Ayarlar → Ağ ve Internet → (ağ) → Özel**'e çevir,
  ya da yukarıdaki kurala `-Profile Private,Public` ekle.

## Ekip günlük nasıl kullanacak

- **Sunucuyu biri (muhtemelen sen) sabah bir kere başlatır** ve o bilgisayar gün
  boyu açık kalır: `npm run start`. Kapanırsa herkesin bağlantısı düşer, tekrar
  `npm run start` yeterli — veri kaybolmaz (SQLite dosyada duruyor).
- **Herkes kendi bilgisayarından/telefonundan** (aynı ofis Wi-Fi'ında) tarayıcıdan
  `http://<sunucu-IP>:3000` adresine girer. Bu adresi herkesin tarayıcısına
  yer imi (bookmark) olarak eklemesi işi kolaylaştırır.
- **İlk girişte** herkes kendi hesabını seçip şifresini girer. Yeni hesap ve ilk şifre
  yöneticiler tarafından **Ekip → Hesap yönetimi** ekranından oluşturulur. Şifresi olmayan
  eski hesaplar dışarıdan sahiplenilemez; yöneticinin ilk şifreyi belirlemesi gerekir.
- **Günlük akış:** ana sayfadan marka seç → içerik/proje seç → görev panosunda
  kendi görevini bul, durumunu ilerlet (Beklemede → Devam Ediyor → İncelemede →
  Onaylandı → Yayınlandı), gerekirse yorum/not bırak. "Panom" sekmesi herkese
  kendi açık görevlerini ve o hafta teslim olacakları özetler.
- **Yeni görev eklemek** için üst çubuktaki veya marka sayfasındaki **Görev oluştur**
  düğmesini kullan. Yeni çalışma ve görev türü aynı akışta seçilir; istenirse görev mevcut
  bir çalışmaya bağlanır.

## Tekrar eden görevler

Şablon arayüzü v02'de geçici olarak menüden ve görev oluşturma akışından kaldırıldı.
Eski şablon verileri silinmedi; ileride tekrar etkinleştirilebilmesi için korunuyor.

**Tekrar eden görevler:** görev detayında **Tekrar** seçimi (Yok / Haftalık /
2 haftada bir / Aylık). Görevi *Yayınlandı* yaptığında bir sonraki örneği otomatik
açılır — aynı başlık, atanan, öncelik ve not; durumu *Beklemede*.

Yeni teslim tarihi **eski görevin teslim tarihine** göre kayar, bugüne göre değil:
20 Temmuz teslimli haftalık bir işi 1 Ağustos'ta kapatırsan yenisi 27 Temmuz olur,
takvim kaymaz. (Teslim tarihi hiç yoksa bugünden itibaren hesaplanır.)

## Görev arşivi

*Yayınlandı* yapılan bir görev panolardan **anında düşmez** — "Yayınlandı" sütununda
**7 gün** daha durur ve kartında kaç gün sonra arşivleneceği yazar. Süre dolunca
`tasks.archived_at` damgalanır ve görev pano/listelerden çekilir.

- **Silme değil:** kayıt duruyor. Görevler sayfasındaki **Arşiv** düğmesiyle listeye
  geri katılır, içerik sayfasında panonun altındaki **Arşiv** bölümünde durur,
  raporlarda ve takvimde okunmaya devam eder.
- **Geri alma:** görev detayındaki **"Arşivden çıkar"**, ya da doğrudan durumu
  değiştirmek. Her durum değişikliği arşiv damgasını siler ve sayacı sıfırlar.
- **Elle arşivleme:** 7 günü beklemeden temizlemek istersen görev detayındaki
  **"Arşivle"**. Durumu değiştirmez.

Süre `lib/taskArchive.ts` içindeki `ARCHIVE_AFTER_DAYS` sabitiyle değişir (tek satır).

## Instagram takibi (sessiz hesap uyarısı)

Markaların Instagram hesapları düzenli taranır; **3 günden uzun süre paylaşım
yapmayan** hesaplar **ana sayfada**, **Sosyal** sayfasında, Panom'daki kartta ve
yöneticiler + Sosyal Medya ekibine giden bildirimlerde işaretlenir. Taranacak hesap listesi ayrıca tutulmuyor — marka
kaydındaki **Instagram kullanıcı adı** alanı neyse o taranır.

### Kurulum (tek seferlik)

1. [apify.com](https://apify.com) üzerinde ücretsiz hesap aç.
2. **Settings → Integrations**'tan API token'ı kopyala.
3. Proje kökündeki `.env.local` dosyasına yapıştır:

   ```
   APIFY_TOKEN=apify_api_...
   ```

4. Bir kez elle çalıştırıp doğrula:

   ```bash
   npm run social:sync
   ```

Maliyet: kullanılan aktör (`apify/instagram-post-scraper`) sonuç başına ücretlendirilir,
~$2,7 / 1.000 gönderi. 19 hesap × 3 gönderi × günde 1 tarama ≈ **ayda ~$5**; Apify'ın
ücretsiz planındaki aylık kredi bunu büyük ölçüde karşılar. Hesap başına çekilen gönderi
sayısı `SOCIAL_POSTS_PER_ACCOUNT` ile ayarlanır ve maliyeti doğrudan etkiler.

### Günlük otomatik çalıştırma (Windows Görev Zamanlayıcı)

Ofis PC'sinde **kurulu**: `Inturlam Instagram Takip` görevi her gün **09:00**'da çalışır.
PC o saatte kapalıysa, açıldığında ilk fırsatta çalışır (`-StartWhenAvailable`).

Durumu görmek / elle tetiklemek:

```powershell
Get-ScheduledTaskInfo -TaskName "Inturlam Instagram Takip"   # son çalışma + sonuç (0 = başarılı)
Start-ScheduledTask   -TaskName "Inturlam Instagram Takip"   # hemen çalıştır
```

Başka bir makinede kurmak ya da saati değiştirmek için:

```powershell
$args = '/c cd /d "C:\Users\intur\repos\inturlam-tracker" && npm run social:sync >> "data\runtime\social-sync.log" 2>&1'
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $args
$trigger = New-ScheduledTaskTrigger -Daily -At 09:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName "Inturlam Instagram Takip" -Action $action -Trigger $trigger -Settings $settings -Force
```

Sunucuyu (`npm run start`) yeniden başlatmaya gerek yok — script ayrı bir süreç,
aynı veritabanını WAL modunda paylaşır. Log `data/runtime/social-sync.log` altına
yazılır (git'e girmez).

### Nasıl okunur

- **Sessiz** (kırmızı): hesap gerçekten uzun süredir paylaşım yapmamış.
- **Veri yok / Hata** (sarı): tarama o hesap için sonuç döndüremedi — hesap özel
  olabilir, kullanıcı adı değişmiş olabilir, sağlayıcı hata vermiş olabilir.
  **Bu "paylaşım yapmıyor" demek değildir** ve bildirim üretmez; yanlış alarm
  vermemek için bilinçli olarak ayrılmıştır.
- Tarama komple başarısız olursa hiçbir sessizlik bildirimi gönderilmez, tüm
  hesaplar "hata" olarak damgalanır ve Sosyal sayfasının üstünde son taramanın
  durumu görünür.

Eşikler `.env.local` ile ayarlanır: `SOCIAL_SILENCE_DAYS` (kaç gün sonra sessiz),
`SOCIAL_REALERT_DAYS` (aynı marka için bildirim tekrarı aralığı).

### Sağlayıcıyı değiştirmek

Veri kaynağı `lib/social/` altında soyutlandı (`SocialProvider` arayüzü). Apify
bozulur ya da resmi Meta API'ye geçilirse yalnızca yeni bir adaptör yazılıp
`resolveSocialProvider()`'a eklenir; şema, kurallar ve ekranlar değişmez.
Test için `SOCIAL_PROVIDER=mock` + `SOCIAL_MOCK_FILE=...json` ile ağa çıkmadan
tüm zincir denenebilir.

## Yedekleme

Tüm veri tek dosyada: `data/inturlam.db`, çalışma zamanı dosya ekleri `data/uploads/` altında.

```bash
npm run db:backup
```

`data/backup/<YYYYAAGG-SSDDss>/` altına veritabanının tutarlı bir anlık görüntüsünü
(`VACUUM INTO`) ve dosya eklerini kopyalar. **Sunucu açıkken de güvenle çalışır** —
dosyayı elle kopyalamak `.db-wal` içindeki son yazmaları kaçırabilir, bu komut kaçırmaz.

`npm run dev` ve `npm run start` bu komutu otomatik olarak önce çalıştırır
(`predev` / `prestart`), yani sunucuyu her açtığında bir yedek alınır.
Son 14 yedek saklanır, eskisi silinir.

İsteğe bağlı ikinci hedef (ör. ofis PC ile paylaşılan Drive klasörü):

```bash
INTURLAM_BACKUP_DIR="G:\Drive'ım\INTURLAM_YEDEK" npm run db:backup
# saklanacak yedek sayısı: INTURLAM_BACKUP_KEEP (varsayılan 14)
```

### Geri yükleme

```bash
npm run db:restore                                  # yedekleri listeler
npm run db:restore -- 20260725-164325 --force       # geri yükler
```

`--force` olmadan hiçbir şey yazmaz. Yazmadan önce yedeğin `integrity_check`'ini
doğrular ve mevcut veritabanını `data/backup/restore-oncesi-*` altına alır.
**Geri yüklemeden önce sunucuyu durdur** — açık bir bağlantı dosyanın değiştiğini
görmez ve yeni yedeğin üzerine eski sayfaları yazabilir.

## Mimari notlar

Detaylı mimari kararlar ve tuzaklar için `CLAUDE.md` dosyasına bak.
