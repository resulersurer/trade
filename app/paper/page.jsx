'use client';
import { useMemo, useState } from 'react';
import './paper.css';

const seedSignals = [
  { id:'DEMO-001', symbol:'BTCUSDT', side:'LONG', confidence:72, time:'10:05', outcome:'Kapatıldı', pnl:12.40 },
  { id:'DEMO-002', symbol:'ETHUSDT', side:'WAIT', confidence:46, time:'10:15', outcome:'İşlem yok', pnl:null },
  { id:'DEMO-003', symbol:'SOLUSDT', side:'SHORT', confidence:65, time:'10:30', outcome:'Kapatıldı', pnl:-4.80 },
  { id:'DEMO-004', symbol:'BTCUSDT', side:'WAIT', confidence:51, time:'10:45', outcome:'İşlem yok', pnl:null },
];
const fmt = v => new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
export default function PaperDashboard(){
 const [symbol,setSymbol]=useState('ALL');
 const signals=useMemo(()=>symbol==='ALL'?seedSignals:seedSignals.filter(s=>s.symbol===symbol),[symbol]);
 const closed=signals.filter(x=>x.pnl!==null), pnl=closed.reduce((n,x)=>n+x.pnl,0), wins=closed.filter(x=>x.pnl>0).length;
 return <main className="paper-shell">
  <header className="paper-head">
   <div className="paper-brand"><span className="paper-mark">◈</span><span>TRADE<span className="paper-brand-muted">/DESK</span></span><span className="paper-tag">PAPER LAB</span></div>
   <div className="paper-state"><span className="paper-dot" /> DEMO GÖRÜNÜMÜ <span className="paper-divider">|</span> EMİRLER KAPALI</div>
  </header>
  <section className="paper-hero"><div><p className="paper-overline">FUTURES / ANALYTICS</p><h1>Paper Trading <span>Dashboard</span></h1><p className="paper-intro">AI sinyallerini, sanal işlemleri ve risk metriklerini tek ekrandan izle. Bu ekranda yalnızca örnek veriler gösterilir.</p></div><div className="paper-shield">▣ <span>READ-ONLY<br/>NO REAL ORDERS</span></div></section>
  <div className="paper-notice">● Bu panel örnek veri kullanır. D1 veritabanına bağlı değildir; Binance hesabına veya OpenAI API'sine istek göndermez.</div>
  <section className="paper-controls"><div className="paper-tabs"><span className="active">Genel Bakış</span><span>Sinyaller</span><span>Performans</span></div><label>Parite <select aria-label="Parite seç" value={symbol} onChange={e=>setSymbol(e.target.value)}><option value="ALL">Tüm pariteler</option><option>BTCUSDT</option><option>ETHUSDT</option><option>SOLUSDT</option></select></label></section>
  <section className="paper-metrics" aria-label="Örnek metrikler">
   <Metric label="Net sanal P&L" value={(pnl>=0?'+':'')+fmt(pnl)+' USDT'} detail="Yalnızca örnek kapanmış işlemler" positive={pnl>=0}/>
   <Metric label="Toplam sinyal" value={String(signals.length)} detail="LONG / SHORT / WAIT"/>
   <Metric label="Kapanan işlem" value={String(closed.length)} detail="Sanal işlemler"/>
   <Metric label="Kazanma oranı" value={closed.length?fmt(wins/closed.length*100)+'%':'—'} detail="Kapanan örnek işlemler"/>
  </section>
  <section className="paper-grid"><article className="paper-card"><div className="paper-card-head"><div><p className="paper-overline">SIGNAL STREAM</p><h2>Son AI sinyalleri</h2></div><span className="paper-muted">Örnek veri</span></div><div className="paper-table-scroll"><table><thead><tr><th>Saat</th><th>Parite</th><th>Sinyal</th><th>Güven*</th><th>Durum</th><th>P&L</th></tr></thead><tbody>{signals.map(s=><tr key={s.id}><td>{s.time}</td><td className="paper-symbol">{s.symbol}</td><td><span className={'paper-pill '+s.side.toLowerCase()}>{s.side}</span></td><td>{s.confidence}%</td><td>{s.outcome}</td><td className={s.pnl===null?'':s.pnl>=0?'paper-profit':'paper-loss'}>{s.pnl===null?'—':(s.pnl>=0?'+':'')+fmt(s.pnl)}</td></tr>)}</tbody></table></div><p className="paper-footnote">* Model güven puanı gerçek kazanma olasılığı değildir.</p></article>
  <aside className="paper-card paper-aside"><p className="paper-overline">SYSTEM STATUS</p><h2>Altyapı</h2><Status name="Cloudflare D1" value="Oluşturuldu"/><Status name="Worker binding" value="Tanımlı"/><Status name="OpenAI analiz döngüsü" value="Bağlı değil"/><Status name="Otomatik emir" value="Devre dışı"/><div className="paper-safe">🔒 <strong>Güvenli demo modu</strong><p>Bu sayfa işlem oluşturmaz. Canlı veriler için kimlik doğrulamalı, salt okunur API gereklidir.</p></div></aside></section>
  <footer className="paper-footer"><span>TRADE DESK · DEVELOPMENT</span><span>Demo data · No financial advice</span></footer>
 </main>
}
function Metric({label,value,detail,positive}){return <article className="paper-metric"><p>{label}</p><strong className={positive?'paper-profit':''}>{value}</strong><span>{detail}</span></article>}
function Status({name,value}){return <div className="paper-status"><span>{name}</span><strong>{value}</strong></div>}
