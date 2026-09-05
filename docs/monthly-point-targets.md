# Aylık kişisel puan hedefleri

Yönetici, **Ekip → Aylık hedefler → Hedefleri düzenle** alanında ayı seçerek hedefleri belirler. **Hesap yönetimi → Aylık puan hedefleri** bağlantısı da aynı yere gider.

1. Ortak hedefi yazıp **Aktif ekibe uygula** ile formdaki tüm aktif kişilere aktarın; gerekirse kişi değerlerini değiştirin.
2. **Hedefleri kaydet** ile değişiklikleri birlikte kaydedin. Değişmeyen/boş hedef alanları aynen kalır.
3. Hedefler kişi ve ay bazında saklanır; sonraki aya otomatik taşınmaz. Geçmiş ay değişiklikleri yalnız seçilen ayı etkiler. Son 100 değişiklik, eski/yeni değer ve değiştiren kişiyle görünür.

Hedef pozitif tam sayıdır (1–100.000). **50 örnek değerdir; gerçek hesaplara veya geçmiş aylara otomatik atanmaz.** Normal ekip üyesi hedef değiştiremez. Aynı kaydı tekrar göndermek çoğaltmaz; başka yönetici arada farklı bir hedef kaydettiyse eski form yenileme ister. Toplu işlem hatasında bütün değişiklikler geri alınır.

## Puanın anlamı

**Hedef gerçekleşmesi = kazanılan katkı puanı / aylık kişisel hedef × 100.** Yüzde veya kazanım %100'de kesilmez: 65/50 = %130 ve +15; 70/50 = %140 ve +20. Atanan işler 85 puana yükselse de hedef 50 kalır. Bir kişinin fazlası başka kişinin şahsi yükümlülüğünü tamamlamaz.

Bu sürüm mevcut katkı kurallarını korur: görev iç teslim ayına ve mevcut sorumlusuna sayılır; Beklemede 0, Devam Ediyor 0,25, İncelemede 0,6, Onaylandı 0,9, Yayınlandı 1 katsayısı uygulanır. Arşivlenmiş yayınlar puanda kalır. Yeniden açma, atama veya termin değişimi katkıyı bu kurala göre yeniden hesaplar. Bu nedenle değer yalnız biten işleri değil, sürmekte olan işlerin aşama katkısını da içerir. Tamamlanma tarihine dayalı sabit geçmiş hakediş kaydı değildir.

Hedefi olmayan kişiye “Hedef tanımlanmadı” gösterilir. Takım oranında yalnız hedefi olan kişilerin kazanımı ve hedefi birlikte toplanır; eksik hedef sayısı ayrıca gösterilir. Marka/portföy ilerlemesi ve kişisel atanmış plan ilerlemesi mevcut anlamını korur.

## Ekranlar ve dışa aktarma

Bugün, üst başlık, Katkım, ekibin aylık hedefler sayfası, kişi ekranı ve yönetici/kişi/departman raporları aynı hedef hesabını kullanır. Katkım ekranı hedef ile atanmış plan ilerlemesini ayrı sunar.

Ekip sayfası doğrudan aktif iş dağılımıyla açılır; **Hesap yönetimi** yanındaki **Aylık hedefler** düğmesi ayrı `/team/targets` sayfasını açar. Panom'daki **Aylık hedefim** düğmesi, Katkı analizi yanından kişisel hedef ayrıntısına götürür. Raporlar sayfasında aylık hedef bölümü ana analizlerin altında yer alır.

Raporlardaki **Aylık kişisel hedefler** bölümü kendi ay seçicisine sahiptir; genel rapor tarih aralığından bağımsız tam ayı gösterir. Bu bölümdeki **Hedefleri Excel indir**, seçilen ayın ve kişi/departman kapsamının hedef, kazanılan, atanan, yüzde, kalan ve fazla puan alanlarını indirir. Mevcut genel raporun dışa aktarma biçimi değişmez.

## Veri ve doğrulama

İki ek tablo: `person_monthly_point_targets` ve `person_monthly_point_target_changes`. Mevcut `getDb()` şema hazırlama mekanizması ilk açılışta bunları ekler; mevcut görev/kişi verisini dönüştürmez ve geçmişe varsayılan hedef yazmaz. Canlıya geçişte normal yedekleme prosedürü uygulanmalıdır.

18 yeni test; sınır örnekleri, hedef/atanan ayrımı, yetki, atomik işlem, eski form çatışması, iki eşzamanlı süreç, dönem/atama/durum davranışı, Excel ve eski şemaya kayıpsız ekleme kapsanır. Toplam 485 test: 484 başarılı, eski gerçek snapshot dosyası bulunmadığı için 1 atlandı. Lint ve üretim derlemesi başarılı.

Sentetik verilerle yönetici ekranından 12 kişiye toplu hedef kaydedildi. 65/50 ve 70/50 UI/Excel hesapları, farklı kişi/departman export kapsamı, yetkisiz erişim ve 390 px görünüm kontrol edildi. Gerçek hesaplara test hedefi yazılmadı.
