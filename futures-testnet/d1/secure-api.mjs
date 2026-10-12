// Internal-use D1 signal handler. No trading or external exchange requests.
// Do not deploy without provisioning WRITE_TOKEN as a Cloudflare Secret.
function secureEquals(a,b){if(typeof a!=='string'||typeof b!=='string'||!b)return false;let diff=a.length^b.length;const max=Math.max(a.length,b.length);for(let i=0;i<max;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
export async function handleSignal(request,env){
 const headers={'content-type':'application/json','cache-control':'no-store'};
 const reply=(body,status)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(!env?.WRITE_TOKEN||!env?.PAPER_DB)return reply({error:'Not configured'},503);
 if(!secureEquals(request.headers.get('authorization'), 'Bearer '+env.WRITE_TOKEN))return reply({error:'Unauthorized'},401);
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply({error:'JSON required'},415);
 const raw=await request.text();if(raw.length>4096)return reply({error:'Too large'},413);
 let s;try{s=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
 if(!s||typeof s.id!=='string'||!(/^[a-zA-Z0-9_-]{1,80}$/).test(s.id)||!(/^[A-Z0-9]{5,20}$/).test(s.symbol)||!['LONG','SHORT','WAIT'].includes(s.signal)||typeof s.confidence!=='number'||!Number.isFinite(s.confidence)||s.confidence<0||s.confidence>100||typeof s.reason!=='string'||s.reason.length>600||!Number.isSafeInteger(s.time)||s.time<=0)return reply({error:'Invalid signal'},400);
 try {await env.PAPER_DB.prepare('INSERT INTO paper_signals(id,symbol,signal,confidence,reason,created_at) VALUES(?,?,?,?,?,?)').bind(s.id,s.symbol,s.signal,s.confidence,s.reason,s.time).run();return reply({saved:true,id:s.id,mode:'PAPER_ONLY'},201)}catch{return reply({error:'Could not save signal (or duplicate ID)'},409)}
}
