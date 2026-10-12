// D1 repository, to be injected through env.PAPER_DB. No exchange or order APIs.
const valid = v => typeof v === 'number' && Number.isFinite(v);
export async function saveSignal(db, {id,symbol,signal,confidence,reason='',time}) {
 if(!id||!(/^[A-Z0-9]{5,20}$/).test(symbol)||!['LONG','SHORT','WAIT'].includes(signal)||!valid(confidence)||confidence<0||confidence>100||!valid(time)||reason.length>600)throw Error('Invalid signal');
 await db.prepare('INSERT INTO paper_signals(id,symbol,signal,confidence,reason,created_at) VALUES (?,?,?,?,?,?)').bind(id,symbol,signal,confidence,reason,time).run();
 return id;
}
export async function savePosition(db,p){
 if(!p||!p.id||!p.signalId||!['LONG','SHORT'].includes(p.side)||!valid(p.entry)||!valid(p.qty)||!valid(p.margin)||!valid(p.leverage)||!valid(p.openedAt))throw Error('Invalid paper position');
 await db.prepare('INSERT INTO paper_positions(id,signal_id,symbol,side,status,entry,mark,qty,margin,leverage,entry_fee,funding_paid,opened_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(p.id,p.signalId,p.symbol,p.side,'OPEN',p.entry,p.mark,p.qty,p.margin,p.leverage,p.entryFee,0,p.openedAt).run();
 return p.id;
}
export async function updateMark(db,{id,price,time,eventId}){
 if(!id||!eventId||!valid(price)||price<=0||!valid(time))throw Error('Invalid mark');
 const p=await db.prepare('SELECT id FROM paper_positions WHERE id=? AND status=?').bind(id,'OPEN').first();
 if(!p)throw Error('Position not open');
 await db.batch([db.prepare('UPDATE paper_positions SET mark=? WHERE id=? AND status=?').bind(price,id,'OPEN'),db.prepare('INSERT INTO paper_events(id,position_id,event_type,price,created_at) VALUES (?,?,?,?,?)').bind(eventId,id,'MARK',price,time)]);
}
export async function recordFunding(db,{id,rate,payment,time,eventId}){
 if(!id||!eventId||!valid(rate)||Math.abs(rate)>.05||!valid(payment)||!valid(time))throw Error('Invalid funding');
 const p=await db.prepare('SELECT id FROM paper_positions WHERE id=? AND status=?').bind(id,'OPEN').first();
 if(!p)throw Error('Position not open');
 await db.batch([db.prepare('UPDATE paper_positions SET funding_paid=funding_paid+? WHERE id=? AND status=?').bind(payment,id,'OPEN'),db.prepare('INSERT INTO paper_events(id,position_id,event_type,rate,payment,created_at) VALUES (?,?,?,?,?,?)').bind(eventId,id,'FUNDING',rate,payment,time)]);
}
export async function getSummary(db){
 const [s,p]=await Promise.all([db.prepare('SELECT signal, COUNT(*) AS count FROM paper_signals GROUP BY signal').all(),db.prepare('SELECT status, COUNT(*) AS count, SUM(COALESCE(net,0)) AS pnl, SUM(entry_fee+exit_fee) AS fees, SUM(funding_paid) AS funding FROM paper_positions GROUP BY status').all()]);
 return {signals:s.results,positions:p.results};
}
