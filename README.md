# Trade Desk

Binance Spot için canlı piyasa verisi, OpenAI destekli teknik görüş ve kullanıcı onaylı gerçek emir akışı sunan Next.js uygulaması.

## Güvenlik modeli

- Binance ve OpenAI anahtarları yalnızca sunucu rotalarına gönderilir.
- Anahtarlar AES-256-GCM ile şifrelenerek Postgres'te saklanır ve hiçbir API yanıtında geri döndürülmez.
- Binance bağlantısı kaydedilmeden önce imzalı hesap isteğiyle doğrulanır.
- Her gerçek emir önce Binance `/api/v3/order/test` ile doğrulanır, 60 saniyelik tek kullanımlık önizleme oluşturur ve `EMRİ ONAYLIYORUM` ifadesiyle ikinci onay ister.
- Tek emir değeri uygulama katmanında 100 USDT ile sınırlandırılmıştır.
- Belirsiz Binance zaman aşımları tekrar gönderilmez; kullanıcı emir geçmişini kontrol etmelidir.

Binance API anahtarında yalnızca okuma ve Spot işlem izni açılmalı, para çekme izni kapalı tutulmalıdır. Mümkünse Binance tarafında IP kısıtı kullanılmalıdır.

## Kurulum

Node.js 20.9 veya üzeri gerekir.

```sh
npm ci
cp .env.example .env.local
npm run build
npm run dev
```

`DATABASE_URL`, Neon Postgres bağlantı dizesi olmalıdır. `VAULT_ENCRYPTION_KEY`, 32 baytlık rastgele değerin 64 karakterlik hex gösterimidir.

Veritabanı şemasını [`migrations/001_initial.sql`](migrations/001_initial.sql) ile oluşturun. Vercel'de iki değişkeni Production, Preview ve Development ortamlarına Secret olarak ekleyin.

Binance ve OpenAI kullanıcı anahtarları ortam değişkeni değildir; uygulamadaki **Eklentiler** ekranından eklenir.

## Komutlar

```sh
npm run dev
npm run build
npm start
```
