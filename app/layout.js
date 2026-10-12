import './globals.css';
import './ledger.css';

export const metadata = {
  title: 'Trade Desk',
  description: 'Binance Spot için kontrollü analiz ve emir çalışma alanı.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
