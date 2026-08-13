# Hobistok.com — Yasal Sayfa Taslakları (Türkçe)

Bu klasör, **hobistok.com** (çevrim içi hobi / el sanatları malzemeleri mağazası) gibi bir Türk
e-ticaret sitesinin yürürlükteki mevzuata göre yayımlaması gereken yasal metinlerin **taslaklarını**
içerir. Metinler; hobistok.com'un yaptığı iş (fiziksel ürünlerin internetten perakende satışı, üyelik
hesapları, sepet/ödeme akışı) baz alınarak hazırlanmıştır.

> ⚠️ **AVUKAT ONAYI GEREKİR.** Bu metinler bir hukukçu tarafından hazırlanmış nihai sözleşmeler
> değil, mevzuata dayalı **taslaklardır**. Yayımlamadan önce bir avukat tarafından; (a) şirketin
> gerçek ticari/mali bilgileriyle, (b) fiili teslimat–iade–ödeme süreçleriyle ve (c) **Resmî
> Gazete'deki güncel yönetmelik metniyle** (özellikle madde numaraları) karşılaştırılarak
> kesinleştirilmelidir. Aşağıdaki madde numaraları güncel yönetmeliğe göre teyit edilmelidir.

---

## Dosyalar ve neden gerekli oldukları

| # | Dosya | Sayfa adı | Yasal dayanak (özet) | Durum |
|---|-------|-----------|----------------------|-------|
| 01 | `01-on-bilgilendirme-formu.md` | Ön Bilgilendirme Formu | 6502 s. TKHK m.48 · Mesafeli Sözleşmeler Yönetmeliği **m.5** | Zorunlu |
| 02 | `02-mesafeli-satis-sozlesmesi.md` | Mesafeli Satış Sözleşmesi | 6502 s. TKHK m.48 · Mesafeli Sözleşmeler Yönetmeliği | Zorunlu |
| 03 | `03-kvkk-aydinlatma-metni.md` | KVKK Aydınlatma Metni / Gizlilik Politikası | 6698 s. KVKK **m.10** · Aydınlatma Yük. Tebliği | Zorunlu |
| 04 | `04-acik-riza-metni.md` | Açık Rıza Metni (Ticari İleti) | 6698 s. KVKK m.5 · 6563 s. Kanun · İYS | Zorunlu (ileti gönderiliyorsa) |
| 05 | `05-cerez-politikasi.md` | Çerez Politikası | 6698 s. KVKK · KVK Kurumu Çerez Rehberi | Zorunlu (çerez kullanılıyorsa) |
| 06 | `06-iptal-iade-ve-cayma-hakki.md` | İptal, İade ve Cayma Hakkı | Mesafeli Sözleşmeler Yönetmeliği m.9 vd. ve **m.15** | Zorunlu |
| 07 | `07-teslimat-ve-kargo.md` | Teslimat ve Kargo Koşulları | 6502 s. TKHK m.48/4 (azami 30 gün) | Zorunlu |
| 08 | `08-uyelik-sozlesmesi.md` | Üyelik Sözleşmesi | 6563 s. Kanun · 6098 s. TBK (genel hükümler) | Üyelik varsa zorunlu |
| 09 | `09-kullanim-kosullari.md` | Kullanım Koşulları | 5651 s. Kanun · 6563 s. Kanun · 6769 s. SMK | Önerilen / fiilen zorunlu |

**Ayrıca (ayrı sayfa değil, sitede görünür olması gereken bilgiler):**

- **Hizmet sağlayıcı kimlik bilgileri** (6563 s. E-Ticaret Kanunu ve Yönetmeliği m.5): ticaret unvanı,
  MERSİS numarası, açık adres, telefon ve e-posta, iletişim bilgileri sitede **kolay ulaşılabilir**
  şekilde bulunmalı (footer + İletişim sayfası). Placeholder alanlar aşağıda.
- **ETBİS kaydı** (Elektronik Ticaret Bilgi Sistemi): e-ticaret siteleri ETBİS'e kayıtlı olmalı;
  doğrulama rozeti/kaydı sitede gösterilir.
- **Güvenli alışveriş / ödeme** bilgisi: 3D Secure, ödeme kuruluşu (`[ÖDEME KURULUŞU]`) bilgisi.

---

## Placeholder (yer tutucu) sözlüğü

Aşağıdaki köşeli parantezli alanlar, yayımdan önce hobistok'un gerçek bilgileriyle doldurulmalıdır.
(Mevcut Studio Luminant sayfalarındaki `[GG.AA.2026]` konvansiyonuyla uyumludur.)

| Yer tutucu | Anlamı |
|------------|--------|
| `[TİCARİ UNVAN]` | Şirketin tam ticari unvanı (ör. "… Ticaret Ltd. Şti.") |
| `[MERSİS NO]` | 16 haneli MERSİS numarası |
| `[TİCARET SİCİL NO]` | Ticaret sicil numarası ve tescilli olduğu oda |
| `[MERKEZ ADRES]` | Kayıtlı merkez / iade adresi |
| `[VERGİ DAİRESİ]` / `[VERGİ NO]` | Bağlı olunan vergi dairesi ve VKN |
| `[TELEFON]` | Müşteri hizmetleri telefonu |
| `[E-POSTA]` | İletişim / bildirim e-postası (ör. info@hobistok.com) |
| `[KEP ADRESİ]` | Kayıtlı Elektronik Posta adresi (varsa) |
| `[WEB SİTESİ]` | www.hobistok.com |
| `[ETBİS KAYIT]` | ETBİS kayıt/doğrulama bilgisi |
| `[İYS MARKA ADI]` | İleti Yönetim Sistemi'ndeki marka adı |
| `[KARGO FİRMASI]` | Anlaşmalı kargo firması / firmaları |
| `[İADE KARGO KODU]` | İade için anlaşmalı kargo kodu |
| `[ÖDEME KURULUŞU]` | Ödeme/sanal POS sağlayıcısı (ör. iyzico, PayTR) |
| `[KARGO ÜCRETİ EŞİĞİ]` | Ücretsiz kargo alt limiti (TL) |
| `[TESLİM SÜRESİ]` | Taahhüt edilen teslim süresi (azami 30 gün) |
| `[GG.AA.YYYY]` | Son güncelleme tarihi |
| `{{...}}` | Sipariş sırasında otomatik dolan alanlar (ör. `{{siparis_no}}`, `{{alici_ad}}`) |

---

## Uygulama notları

- **Ön Bilgilendirme Formu + Mesafeli Satış Sözleşmesi**, sipariş akışında ödeme adımından **önce**
  tüketiciye sunulmalı ve tüketici bunları **onay kutusuyla** ("Okudum, onaylıyorum") kabul etmelidir.
  Onayın ve metinlerin **kalıcı veri saklayıcısı** (e-posta vb.) ile tüketiciye iletildiği ispatlanabilmelidir.
- Sözleşmedeki **SATICI** bilgileri sabittir; **ALICI**, **ürün**, **fiyat**, **teslimat** alanları her
  siparişte otomatik doldurulur (`{{...}}` alanları).
- **Cayma hakkı** kural olarak 14 gündür; ancak **kişiye özel/istek üzerine hazırlanan** ürünler,
  **hijyenik** olarak iadesi uygun olmayan açılmış ürünler vb. için istisnalar vardır (bkz. dosya 06).
- Bu taslaklar hukuki danışmanlık değildir.
