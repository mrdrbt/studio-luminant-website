# ÖN BİLGİLENDİRME FORMU

*Son güncelleme: [GG.AA.YYYY]*

> Bu form, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği'nin
> **5. maddesi** uyarınca, siparişinizi tamamlamadan (herhangi bir ödeme yükümlülüğü altına girmeden)
> **önce** tarafınıza sunulan zorunlu bilgilendirmedir. Sipariş akışında bu formu ve Mesafeli Satış
> Sözleşmesi'ni onaylamanız istenecektir.

---

## 1. SATICI (Hizmet Sağlayıcı) Bilgileri

| | |
|---|---|
| **Ticaret unvanı** | [TİCARİ UNVAN] |
| **MERSİS numarası** | [MERSİS NO] |
| **Ticaret sicil no** | [TİCARET SİCİL NO] |
| **Merkez adresi** | [MERKEZ ADRES] |
| **Vergi dairesi / no** | [VERGİ DAİRESİ] / [VERGİ NO] |
| **Telefon** | [TELEFON] |
| **E-posta** | [E-POSTA] |
| **KEP adresi** | [KEP ADRESİ] |
| **Web sitesi** | [WEB SİTESİ] |
| **ETBİS** | [ETBİS KAYIT] |

Şikâyet ve talepleriniz için yukarıdaki telefon ve e-posta üzerinden Satıcı'ya ulaşabilirsiniz.

## 2. ALICI (Tüketici) Bilgileri

Ad-soyad, teslimat/fatura adresi, telefon ve e-posta bilgileriniz sipariş sırasında beyan ettiğiniz
şekilde işleme alınır: `{{alici_ad}}`, `{{alici_adres}}`, `{{alici_telefon}}`, `{{alici_eposta}}`.

## 3. Sözleşme Konusu Mal/Hizmetin Temel Nitelikleri

Sipariş konusu ürün(ler)in adı, adedi, temel nitelikleri ve satış fiyatı, ürün sayfasında ve
sipariş özetinde belirtildiği gibidir: `{{urun_listesi}}`. Ürün görsellerindeki renk ve detaylar,
ekran/çözünürlük farkları nedeniyle küçük sapmalar gösterebilir.

## 4. Fiyat ve Ödeme Bilgileri

| | |
|---|---|
| **Ürün(ler) toplam bedeli (KDV dâhil)** | `{{urun_toplam}}` |
| **Kargo / teslimat ücreti** | `{{kargo_ucreti}}` (Sipariş tutarı [KARGO ÜCRETİ EŞİĞİ] TL ve üzeri ise ücretsizdir.) |
| **Toplam (KDV dâhil)** | `{{genel_toplam}}` |
| **Ödeme şekli** | Kredi/banka kartı (3D Secure), havale/EFT, kapıda ödeme (varsa) |
| **Ödeme kuruluşu** | [ÖDEME KURULUŞU] |

Fiyatlara KDV dâhildir. Vergi, harç ve benzeri yasal yükümlülükler alıcıya aittir (aksi belirtilmedikçe
fiyata dâhildir). Kampanya ve indirim fiyatları, kampanya süresince geçerlidir.

## 5. Teslimat Bilgileri

- **Teslim şekli:** [KARGO FİRMASI] aracılığıyla, alıcının bildirdiği teslimat adresine.
- **Teslim süresi:** Sipariş onayından itibaren en geç **[TESLİM SÜRESİ]** (yasal azami süre
  **30 gündür** — 6502 s. Kanun m.48/4). Stok ve hazırlık durumuna göre daha kısa sürede teslim edilebilir.
- **Teslim masrafı:** Kargo ücreti yukarıda belirtilmiştir; farklı taahhüt yoksa alıcıya aittir.
- Ürünü teslim alırken **kargo paketini kontrol ediniz**; hasarlı/ezik paketi tutanakla teslim
  almayınız ve durumu Satıcı'ya bildiriniz.

## 6. Cayma Hakkı

Tüketici, malın teslim tarihinden itibaren **14 (on dört) gün** içinde herhangi bir gerekçe göstermeksizin
ve cezai şart ödemeksizin sözleşmeden **cayma hakkına** sahiptir (Mesafeli Sözleşmeler Yönetmeliği).

- **Süre:** Mal tesliminde 14 gün, teslim tarihinden; hizmet ifasında sözleşme tarihinden başlar.
- **Kullanım:** Cayma bildirimini süre dolmadan **[E-POSTA]** adresine ya da **[MERKEZ ADRES]**
  adresine yazılı olarak, veya site üzerindeki iade talep formuyla iletmeniz yeterlidir.
- **İade:** Satıcı, cayma bildiriminden itibaren **14 gün** içinde tüm ödemeyi (teslimat masrafları
  dâhil) iade eder. Alıcı, malı **10 gün** içinde Satıcı'ya geri gönderir.
- **İade kargo masrafı:** İade, Satıcı'nın bildirdiği anlaşmalı kargo firması (**[KARGO FİRMASI]**,
  iade kodu **[İADE KARGO KODU]**) ile yapılırsa iade masrafı **alıcıya yüklenmez**. Farklı kargo
  ile gönderimde masraf alıcıya ait olabilir.

Cayma hakkının kullanımına ilişkin ayrıntı için: **İptal, İade ve Cayma Hakkı** sayfası (dosya 06).

## 7. Cayma Hakkının İstisnaları (Cayma Hakkı Kullanılamayan Durumlar)

Mesafeli Sözleşmeler Yönetmeliği **m.15** uyarınca, aşağıdaki ürün/sözleşmelerde cayma hakkı
kullanılamaz (taraflarca aksi kararlaştırılmadıkça):

- Tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda **kişiye özel hazırlanan** ürünler
  (ör. isme/ölçüye özel üretim, özel kesim/karışım hobi malzemeleri),
- Ambalaj, bant, mühür, paket gibi **koruyucu unsurları açılmış**, iadesi **sağlık/hijyen** açısından
  uygun olmayan ürünler (ör. açılmış boya/tutkal/kozmetik nitelikli malzemeler),
- Teslimden sonra başka ürünlerle **karışan ve doğası gereği ayrıştırılamayan** ürünler,
- **Çabuk bozulabilen** veya son kullanma tarihi geçebilecek ürünler,
- Koruyucu unsurları açılmış maddi ortamdaki **kitap, dijital içerik ve bilgisayar sarf malzemeleri**,
- Elektronik ortamda **anında ifa edilen** hizmetler / anında teslim edilen **gayrimaddi** ürünler
  (ör. dijital indirilebilir kalıp, e-kitap, kupon kodu),
- İlgili mevzuattaki diğer istisnalar.

## 8. Uyuşmazlık / Şikâyet Başvurusu

Sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığı'nca her yıl belirlenen parasal sınırlar
dâhilinde **Tüketici Hakem Heyetleri**'ne, bu sınırların üzerindeki uyuşmazlıklarda **Tüketici
Mahkemeleri**'ne başvurabilirsiniz. Başvurular, alıcının veya satıcının yerleşim yerindeki heyet/mahkemeye yapılabilir.

## 9. Onay

Bu Ön Bilgilendirme Formu'nu; SATICI'nın kimlik ve iletişim bilgileri, ürünün temel nitelikleri,
KDV dâhil toplam fiyat, ödeme ve teslimat bilgileri, cayma hakkı ile istisnaları ve şikâyet
başvuru yolları hakkında **bilgilendirildiğimi** kabul ederek onaylıyorum.

---

*Bu belge taslaktır; yayımdan önce avukat onayı ve güncel Resmî Gazete metniyle madde numarası
teyidi gerekir.*
