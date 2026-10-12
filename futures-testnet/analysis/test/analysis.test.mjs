import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFutures, validateDecision } from '../src/analysis.mjs';
const candles = async () => Array.from({length:40},(_,i)=>({close:100+i,closeTime:1000+i}));
test('reject invalid signal',()=>assert.throws(()=>validateDecision({signal:'BUY',confidence:90,reason:'x'})));
test('deny execution for LONG',()=>assert.equal(validateDecision({signal:'LONG',confidence:60,reason:'trend'}).canSubmitOrder,false));
test('insufficient candles fail closed',async()=>assert.rejects(analyzeFutures({apiKey:'fake',fetchMarket:async()=>[]}),/Insufficient/));
test('uses both timeframes and OpenAI structured advisory',async()=>{
 const intervals=[];
 const result=await analyzeFutures({apiKey:'fake',now:1750000000000,fetchMarket:async args=>{intervals.push(args.interval);return candles();},fetchImpl:async(url,options)=>{
 assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.method,'POST');
 const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.type,'json_schema');
 return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({signal:'WAIT',confidence:42,reason:'unclear'})}]}]})};
 }});
 assert.deepEqual(intervals,['5m','15m']);assert.equal(result.signal,'WAIT');assert.equal(result.canSubmitOrder,false);
});
