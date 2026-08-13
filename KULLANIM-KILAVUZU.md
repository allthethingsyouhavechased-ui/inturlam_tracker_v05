# İNTURLAM Tracker v03 — kullanım kılavuzu

Bu belge günlük kullanım içindir. Kurulum ve sunucu işlemleri için
[README.md](README.md) ve [docs/v03-local-setup.md](docs/v03-local-setup.md) belgelerine
bakın.

## 1. Sistem nasıl düzenlenir?

Temel iş yapısı:

**Marka → İçerik/Proje → Görev → Yorum ve dosyalar**

Örnek:

**Hacıbaba Coffee House → Yaz menüsü çekimi → 3 adet Reel kurgusu → revize yorumu**

Takvim bu görev yapısından ayrıdır. Toplantı, çekim ve ajans etkinliklerini planlar.

## 2. Giriş

Ana giriş ekranında iki seçenek vardır:

- **Ekip girişi:** İNTURLAM çalışanları kendi kullanıcı adı/hesabı ve şifresiyle girer.
- **Guest girişi:** Marka dışı kullanıcı, yöneticinin o marka için oluşturduğu ortak guest
  kullanıcı adı ve şifresiyle girer.

Oturum tarayıcı oturumuyla sınırlıdır ve en fazla 12 saat geçerlidir. Şifreniz yoksa
yöneticiden **Ekip → Hesap yönetimi** alanından ilk şifreyi belirlemesini isteyin.

Giriş yapılmadan uygulama menüsü ve operasyon sayfaları gösterilmez.

## 3. Ekip ve guest arasındaki fark

### Ekip hesabı

Ekip hesabı ortak operasyon alanlarına erişir. Yetkiye göre görev, marka, talep, rapor,
hesap yönetimi ve dışa aktarım işlemleri açılır.

### Guest hesabı

Guest yalnızca:

- kendi markasının dashboard’unu,
- bu guest hesabından açılan görevleri,
- kendi markasına bağlı ve **Guest ile paylaş** seçeneği açılmış etkinlikleri görür.

Guest; başka markaları, ekip üyelerini, raporları, export’ları, sosyal medya yönetimini,
arama sonuçlarını veya iç aktivite akışını göremez. İç teslim tarihi, görevin atandığı
kişi, ağırlık puanı, iç notlar ve iç yorumlar guest’e gösterilmez.

## 4. Sol menü

| Bölüm | İşlevi |
|---|---|
| **Bugün** | Güncel operasyon sayıları, kişisel iş akışı ve marka ilerlemeleri |
| **Panom** | Kişisel teslim radarı, üzerinizdeki markalar ve aylık katkınız |
| **Talepler** | Müşteriden gelen brieflerin ekip içi değerlendirme kuyruğu |
| **Görevler** | Tüm görevler, filtreler, pano/liste ve tarih bekleyen eski işler |
| **Takvim** | Toplantı, çekim ve diğer etkinlikler |
| **Markalar** | Marka çalışma alanları, içerikler ve operasyon özeti |
| **Sosyal** | Hesap sağlığı, içerik varlığı ve paylaşım planı |
| **Ekip** | Aktif marka kanbanı ve yetkili kullanıcı yönetimi |
| **Raporlar** | Yöneticiye açık dönem, kişi, departman ve marka raporları |
| **Aktivite** | Ekip içi işlem geçmişi |

Sağ üstte arama, hızlı görev oluşturma, bildirimler, tema ve profil menüsü bulunur.

## 5. Bugün sayfası

Bugün sayfası sabah bakılacak ortak özet alanıdır:

- aktif marka sayısı,
- açık, gecikmiş ve bu hafta teslim görev sayıları,
- sosyal hesap uyarıları,
- kişisel aylık ilerleme,
- size atanmış markaların birleşik ilerlemesi,
- portföyde en çok dikkat isteyen markalar,
- son hareketler ve yaklaşan işler.

Açık, gecikmiş ve bu hafta metriklerine tıklanınca Görevler sayfası ilgili filtreyle
açılır. Ay kontrolüyle geçmiş veya gelecek ayın ilerlemesi incelenebilir.

## 6. Panom

Panom’da üç kişisel araç aynı sırada bulunur ve ayrı ayrı açılıp kapanabilir:

- **Kişisel teslim radarı:** Size atanmış işlerin yakın teslim görünümü.
- **Üzerimdeki markalar:** Yönetici tarafından size bağlanan markaların aylık ilerlemesi.
- **Bu ayki katkım:** Tamamladığınız aşamaların ağırlıklı katkısı.

“Üzerimdeki markalar” ve “Bu ayki katkım” kartları kendi detay sayfalarına gider. Ay
değiştirildiğinde seçilen ay detay linklerinde korunur.

Marka ataması ekip erişimini kısıtlamaz; Panom’daki kişisel portföy özetini belirler.

## 7. Marka sayfası

Marka çalışma alanında şunlar birlikte görünür:

- marka özeti, Instagram hesabı ve temel veriler,
- aylık içerik hedefleri,
- **Aylık içerikler tamamlandı** düğmesi ve teslim durumu,
- seçilen ayın ağırlıklı iş ilerlemesi,
- marka sorumluları,
- aylık ve yıllık çekim hakları,
- bu aya ait içerik akışı,
- yaklaşan toplantı, çekim ve diğer etkinlikler,
- projeler/içerikler ve marka hareketleri.

**Toplantılar** ve **Çekimler** düğmeleri Takvim sayfasını o marka ve etkinlik türüyle
filtreli açar.

### Aylık içerik teslimini kapatma

Marka, o ay için planlanan içerik setini teslim ettiğinde **Aylık içerikler tamamlandı**
düğmesini kullanın. Bu işaret canlı stok sayısından bağımsızdır.

Örneğin dört Reel teslim edip ikisini yayınladıysanız hazır Reel stoku 4’ten 2’ye iner.
Bu, ayı eksik teslim ettiğiniz anlamına gelmez; aylık teslim rozeti kapanmış kalır. Yanlış
işaretlendiğinde aynı kontrolle ay yeniden açılabilir.

## 8. İçerik/proje oluşturma

Marka sayfasından yeni içerik/proje oluştururken başlık, tür ve hedef tarih belirlenir.
Hedef tarih, Görev şablonları uygulanacaksa zorunludur; sistem yapay tarih üretmez.

İçerik sayfasında görevler beş aşamada görünür:

**Beklemede → Devam Ediyor → İncelemede → Onaylandı → Yayınlandı**

Kartlar pano üzerinde sürüklenebilir. Liste görünümünde de durum, öncelik, sorumlu,
teslim tarihi ve ağırlık puanı okunabilir.

## 9. Ekip görevi oluşturma

Ekip tarafından oluşturulan her yeni görevde teslim tarihi zorunludur. Bu kural hızlı
ekleme, görev formu, talep onayı, şablon ve tekrar eden görev akışlarında geçerlidir.
Teslim tarihi sonradan temizlenemez; yalnızca başka bir geçerli tarihe taşınabilir.

Görev alanları:

- marka ve içerik/proje,
- başlık ve not/brief,
- içerik türü,
- sorumlu kişi,
- öncelik,
- teslim tarihi,
- tekrar kuralı,
- ağırlık puanı.

Eski tarihsiz kayıtlar silinmez. Yöneticiler bunları Görevler sayfasındaki
**Tarih bekleyenler** düğmesinden bulup gerçek tarihleriyle planlar.

## 10. Görev ağırlığı ve aylık ilerleme

Her görev 1–100 arasında bir **Ağırlık puanı** taşır. Varsayılan değer 1’dir ve yalnızca
yöneticiler değiştirebilir. Ağırlık kartta ve liste görünümünde yazılıdır.

Durumların ilerleme katsayısı:

| Durum | Katkı |
|---|---:|
| Beklemede | %0 |
| Devam Ediyor | %25 |
| İncelemede | %60 |
| Onaylandı | %90 |
| Yayınlandı | %100 |

Yüzde, basit görev adediyle değil ağırlıklı katkı toplamının ağırlık toplamına oranıyla
hesaplanır. O ay planlanmış görev yoksa `%0` yerine **Bu ay plan yok** görünür.

Ay kapsamı görevin iç teslim tarihine göre belirlenir. İlgili aya ait arşivlenmiş işler
hesapta kalır; henüz iç teslim tarihi verilmeyen guest talepleri hesaplamaya girmez.

## 11. Görev detayı, yorum ve dosyalar

Görev detayında durum, öncelik, sorumlu, teslim tarihi, tekrar kuralı, notlar, yorumlar,
dosyalar ve hareket geçmişi bulunur.

- Bir ekip üyesini yorumda tam adıyla `@` etiketlemek bildirim üretir.
- Guest kaynaklı görevlerde yorum ve ekler **internal** veya **guest-visible** kapsamla
  ayrılır.
- Guest-visible yazılan ekip cevabı guest portalında görünür; iç yorum görünmez.
- Yayınlanan görev yedi gün pano üzerinde kalır, sonra arşivlenir.
- Arşivleme silme değildir; görev tekrar panoya alınabilir.
- Kalıcı silme gibi geri dönüşü zor işlemler yönetici yetkisine bağlıdır.

## 12. Guest görev akışı

Guest görev açarken şu alanları doldurur:

- başlık,
- brief,
- **İstenen tarih**,
- görsel ekler.

Yeni kayıt ekip tarafında **Planlanacak** kuyruğuna düşer. İstenen tarih müşterinin
beklentisidir; iç teslim tarihi değildir. Ekip gerçek teslim tarihini atayana kadar görev
aktif ekip panolarına, aylık ilerlemeye ve raporlara katılmaz.

Görev Beklemede iken guest başlık, brief, İstenen tarih ve kendi eklerini düzenleyebilir.
Görev Devam Ediyor olduğunda brief kilitlenir. Sonrasında guest yalnızca paylaşılan
konuşmaya yorum ve dosya ekleyebilir.

İlk planlama, ekip cevabı ve durum değişiklikleri guest bildirim zincirine girer.

## 13. Görevler sayfası

Görevler sayfası ekip kapsamındaki tüm görevleri gösterir. Marka, durum, öncelik,
sorumlu, departman ve metin filtreleri kullanılabilir. Pano ve liste tercihleri tarayıcıda
saklanır.

Bugün sayfasındaki metriklerden gelindiğinde açık/gecikmiş/bu hafta filtresi otomatik
uygulanır. **Tarih bekleyenler** üst alandaki kompakt düğmeden açılır; ana listeyi sürekli
kaplamaz.

## 14. Etkinlik takvimi

Takvim yalnızca operasyon etkinlikleri içindir:

- Toplantı
- Çekim
- Diğer

Görev teslim tarihleri bu takvimde gösterilmez. Teslim işleri Görevler ve Panom üzerinden
izlenir.

Takvimde:

- gün hücresine tıklayarak o gün ve varsayılan saatle etkinlik formu açılır,
- ay, marka ve tür filtresi kullanılabilir,
- bugünden uzaklaşıldığında **Bugün** düğmesi belirir,
- etkinlik rengi gerçek renk örneklerinden seçilir,
- çok günlük etkinlik aynı renkte kesintisiz şerit olarak görünür,
- markasız “Ajans geneli” etkinlik oluşturulabilir.

**Guest ile paylaş** yalnızca marka seçilmiş bir etkinlikte açılır. Açıldığında o markanın
aktif guest hesabına bildirim gider ve etkinlik guest takviminde tarih/saat bilgisiyle
görünür. Bu paylaşım görev teslim tarihlerini açmaz.

## 15. Görev şablonları ve tekrar eden işler

**Görev şablonları** Görevler sayfasındaki bağlantıdan veya `/templates` ekranından
yönetilir. Şablona adımlar, gün kaymaları, sorumlular ve varsayılan alanlar eklenebilir.

Şablon yalnızca hedef tarihi bulunan içeriğe uygulanır. Her adımın teslim tarihi içerik
hedef tarihine göre hesaplanır; tarihsiz görev oluşturulmaz.

Tekrar eden görev, mevcut teslim tarihini baz alır. Görev Yayınlandı olduğunda haftalık,
iki haftalık veya aylık sonraki örnek açılır. Eski tarihsiz bir kayıt için sonraki örnek
oluşturulmaz; önce gerçek tarih verilmelidir.

## 16. Sosyal sayfaları

Sosyal alan üç görünüm taşır:

- **Takip:** Instagram hesabının son paylaşımı, sessizlik ve veri sağlığı.
- **Varlık:** Hazır Post, Story ve Reels stokları ile aylık teslim rozeti.
- **Takvim:** İçerik paylaşım planı.

Hazır içerik sayısının paylaşıldıkça azalması normal tüketimdir. Eksik teslim anlamına
gelmez. Marka bazında aylık teslim durumu Varlık sayfasındaki rozetle ayrıca gösterilir.

“Sessiz” gerçek paylaşım yokluğunu, “Veri yok/Hata” ise sağlayıcıdan güvenilir sonuç
alınamadığını anlatır. Hata durumu sessizlik gibi yorumlanmaz.

## 17. Talepler

Yetkili ekip üyeleri müşteriden gelen briefi marka, tür, departman, tarih, bağlantı ve
görsellerle kaydeder. Talep değerlendirilirken hedef departmandaki sorumlu ve öncelik
seçilir.

Onay anında ekip görevi oluşturulacağı için gerçek teslim tarihi zorunludur. Onaylanan
talep içerik ve göreve dönüşür; reddetme gerekçesi geçmişte kalır. Kararı yedi günü geçen
onaylı/reddedilmiş talepler arşive taşınır.

## 18. Raporlar

Raporlar yöneticilere açıktır. Dönem seçimiyle:

- açılan, tamamlanan, açık ve geciken işler,
- aktif iş akışı,
- **Ekip aylık puanı**,
- teslim sağlığı ve tamamlanma süresi,
- kişi, departman ve marka dağılımları incelenir.

Ekip aylık puanı, Aktif iş akışı kartının altında açılıp kapanabilir. Kişi ve departman
detay raporları gerçek görev listelerine bağlanır. CSV, Excel ve yazdırma çıktıları seçilen
kapsamı korur.

## 19. Ekip ve hesap yönetimi

Ekip sayfasında herkes o an çalıştığı aktif markayı seçebilir. Yöneticiler ayrıca:

- ekip hesabı açar/pasife alır,
- ilk şifreyi belirler veya sıfırlar,
- yönetici rolünü yetki sınırları içinde düzenler,
- Panom için bir kişiye birden fazla marka atar,
- her marka için en fazla bir ortak guest hesabı oluşturur,
- guest hesabını aktif/pasif yapar.

Guest şifreleri düz metin olarak gösterilmez veya sonradan okunmaz. Şifre unutulduysa
yönetici yeni şifre belirler.

## 20. Bildirimler

Ekip bildirimleri şunlardan oluşabilir:

- yorumda `@` etiketi,
- guest’in yeni görev talebi,
- guest’in paylaşılan yorumu,
- ilgili iş akışı hareketleri.

Guest bildirimleri:

- görevin ekip tarafından ilk planlanması,
- guest-visible ekip yanıtı,
- görev durum değişikliği,
- markalı ve **Guest ile paylaş** açık etkinlik oluşturulması.

Bildirim bağlantısı yalnızca hesabın erişebildiği hedefe gider.

## 21. Sorun giderme

- **Adrese girilmiyorsa:** Aynı ofis ağına bağlı olduğunuzu ve sunucu PC’nin açık
  olduğunu kontrol edin.
- **Giriş yapılamıyorsa:** Doğru Ekip/Guest girişini kullandığınızı doğrulayın; yönetici
  hesabı veya şifreyi sıfırlayabilir.
- **Yetkisiz sayfa görünmüyorsa:** Bu çoğunlukla beklenen rol sınırıdır; doğrudan URL de
  aynı sunucu kontrolünden geçer.
- **Form işlemiyorsa:** Ekrandaki hata mesajını okuyun; gönderim sırasında düğme yeniden
  tıklamayı önlemek için geçici olarak kilitlenir.
- **Mobil takvim dar görünüyorsa:** Günlerin devamını görmek için takvimi yatay kaydırın.
- **Google etkinliği gelmiyorsa:** Yönetici Takvim sayfasındaki senkron sağlık kartına ve
  scheduler durumuna bakmalıdır.
- **Sayfa eski görünüyorsa:** Bir kez yenileyin. Sorun sürerse hangi sayfa ve işlemde
  olduğunu Yunus Emre’ye iletin.
