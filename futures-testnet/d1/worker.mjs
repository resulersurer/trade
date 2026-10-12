import { handleSignal } from './secure-api.mjs';
// No Binance requests or trading methods; all signal writes require a secret.
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/signals' && request.method==='POST') return handleSignal(request,env);
  if(url.pathname==='/health' && request.method==='GET') {
   const headers={'content-type':'application/json','cache-control':'no-store'};
   try {const row=await env.PAPER_DB.prepare('SELECT COUNT(*) AS n FROM sqlite_master WHERE type=? AND name IN (?,?,?)').bind('table','paper_signals','paper_positions','paper_events').first();const ready=row?.n===3;return new Response(JSON.stringify({status:ready?'ok':'degraded',schemaReady:ready}),{status:ready?200:503,headers});}
   catch{return new Response(JSON.stringify({status:'unavailable'}),{status:503,headers})}
  }
  return new Response(JSON.stringify({error:'Not found'}),{status:404,headers:{'content-type':'application/json','cache-control':'no-store'}});
 }
};
