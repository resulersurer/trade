# Trade Desk

Binance USDⓈ-M Futures için canlı piyasa verisi, teknik piyasa görüşü ve kullanıcı onaylı long/short emir akışı sunan Next.js uygulaması.

## Binance bağlantısı

Binance API Yönetimi ekranında **Self-generated / RSA** anahtarı oluşturun ve RSA public key'i yükleyin. Karşılık gelen PKCS#8 private key'i sunucuda `BINANCE_RSA_PRIVATE_KEY` olarak saklayın. Binance’in verdiği API Key'i uygulamadaki **Eklentiler → Binance Futures** ekranından girin. Private key tarayıcıya gönderilmez. Oluşturulan yerel anahtarlar `.vercel/binance-keys/` altında tutulur; Git ve dağıtım yüklemelerine dahil edilmez.

Futures işlem izni açık, para çekme izni kapalı olmalıdır. Hesabınızın RSA anahtarları için sunduğu IP izinlerini Binance üzerinden kontrol edin.

## Emir akışı

- Yalnızca USDT teminatlı sürekli USDⓈ-M sözleşmeleri ve piyasa emirleri desteklenir.
- Pozisyon açma/artırma ve azaltma/kapatma ayrı işlemlerdir; long ve short yönü açıkça seçilir.
- Girilen USDT tutarı toplam emir değeridir; kaldıraçla çarpılmaz. Tahmini tek emir değeri 100 USDT ile sınırlıdır. Piyasa kayması nedeniyle gerçekleşen değer değişebilir.
- Binance'teki kaldıraç, marjin türü ve Hedge/Tek yön modu okunur ve onay ekranında gösterilir. Uygulama bu ayarları değiştirmez.
- Tek yön modunda ters pozisyon varsa yeni açılış engellenir. Kapatma emri `reduceOnly` kullanır. Hedge modunda `positionSide` gönderilir, kapatma miktarı mevcut pozisyonu aşamaz.
- Bekleyen standart veya koşullu emirler yeni pozisyon açmayı engeller.
- Her emir önce `/fapi/v1/order/test` ile doğrulanır. 60 saniyelik önizleme, tek kullanımlık kayıt ve `EMRİ ONAYLIYORUM` onayı gerekir.
- Onay sırasında seçilen miktar, hesap ayarları ve mevcut pozisyon yeniden doğrulanır.
- Ağ hatası veya belirsiz Binance yanıtından sonra gerçek emir otomatik tekrar gönderilmez. İşlem Defteri yenilendiğinde emir durumu Binance'ten sorgulanır; kesin sonuç alınmadan yeni emir engellenir.
- Bakiye, açık pozisyonlar ve gerçekleşen PnL Binance hesabından okunur. Stop-loss / take-profit emir yönetimi bu sürümde bulunmaz.

Binance API Key ve RSA private key bağlantı doğrulandıktan sonra AES-256-GCM ile şifrelenerek Postgres'te saklanır. Hiçbir API yanıtında geri gönderilmez.

## Kurulum

Node.js 20.9 veya üzeri gerekir.

```sh
npm ci
cp .env.example .env.local
npm test
npm run build
npm run dev
```

`DATABASE_URL`, Neon Postgres bağlantı dizesi olmalıdır. `VAULT_ENCRYPTION_KEY`, 32 baytlık rastgele değerin 64 karakterlik hex gösterimidir. `BINANCE_RSA_PRIVATE_KEY`, Binance'e yüklediğiniz public key'in karşılık gelen PEM private key'idir.

Veritabanı şemasını [`migrations/001_initial.sql`](migrations/001_initial.sql) ile oluşturun. Vercel'de sunucu değişkenlerini Production ve Preview ortamlarına Secret olarak ekleyin. Preview ortamı için gerçek Binance hesabını bağlamayın; gerçek emir akışı yalnızca kullanıcı onayıyla test edilmelidir.

Binance API Key ve OpenAI API Key ortam değişkeni değildir; **Eklentiler** ekranından eklenir. Oturum 30 gün sürer ve bu tarayıcıya bağlıdır. Süresi dolduğunda API Key'i yeniden ekleyin.
