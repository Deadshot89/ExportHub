import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const provider=require('../api/shared/customs-ai-provider.js');

const base={
  systemInstructions:'Nur beratend. Nutze Quellen.',
  question:'Was muss ich bei dieser Ausfuhr prüfen?',
  context:{reference:'ABC123',destinationCountry:'CH'},
  sources:[
    {id:'S1',title:'Quelle 1',excerpt:'Geprüfter Inhalt',sourceName:'Zoll',sourceUrl:'https://www.zoll.de/',checkedAt:'2026-10-14'},
    {id:'S2',title:'Quelle 2',excerpt:'Weiterer Inhalt',sourceName:'EU',sourceUrl:'https://taxation-customs.ec.europa.eu/',checkedAt:'2026-10-13'}
  ]
};

test('RC1532 provider: fehlende Server-Konfiguration ist explizit und recoverable',async()=>{
  const result=await provider.askCustomsModel({...base,env:{},fetchImpl:async()=>{throw new Error('fetch darf nicht aufgerufen werden')}});
  assert.equal(result.ok,false);
  assert.equal(result.code,'AI_UNAVAILABLE');
  assert.equal(result.recoverable,true);
  assert.deepEqual(result.citations,[]);
});

test('RC1532 provider: Responses-API Request enthält keine API-Keys im Body und speichert nicht persistent',async()=>{
  let captured=null;
  const fetchImpl=async(url,init)=>{
    captured={url,init};
    return {ok:true,status:200,json:async()=>({model:'gpt-6-sol',output:[{type:'message',content:[{type:'output_text',text:'Geprüfte Antwort [[S1]] und keine erfundene Quelle [[FAKE]].'}]}]})};
  };
  const env={EXPORTHUB_CUSTOMS_AI_API_KEY:'server-secret-key',EXPORTHUB_CUSTOMS_AI_MODEL:'gpt-6-sol'};
  const result=await provider.askCustomsModel({...base,env,fetchImpl});

  assert.equal(result.ok,true);
  assert.equal(result.answer,'Geprüfte Antwort [[S1]] und keine erfundene Quelle [[FAKE]].');
  assert.deepEqual(result.citations,['S1']);
  assert.equal(result.modelInfo.provider,'openai');
  assert.equal(result.modelInfo.model,'gpt-6-sol');
  assert.equal(captured.url,'https://api.openai.com/v1/responses');
  assert.equal(captured.init.method,'POST');
  assert.equal(captured.init.headers.Authorization,'Bearer server-secret-key');
  const body=JSON.parse(captured.init.body);
  assert.equal(body.model,'gpt-6-sol');
  assert.equal(body.store,false);
  assert.match(body.instructions,/Nur beratend/);
  assert.doesNotMatch(JSON.stringify(body),/server-secret-key/);
  assert.match(JSON.stringify(body),/ABC123/);
  assert.match(JSON.stringify(body),/\[S1\]/);
});

test('RC1532 provider: fremde Citation-IDs werden verworfen',async()=>{
  const fetchImpl=async()=>({ok:true,status:200,json:async()=>({output_text:'Antwort [[S2]] [[S999]] [[S2]]'})});
  const result=await provider.askCustomsModel({...base,env:{EXPORTHUB_CUSTOMS_AI_API_KEY:'x',EXPORTHUB_CUSTOMS_AI_MODEL:'gpt-6-sol'},fetchImpl});
  assert.equal(result.ok,true);
  assert.deepEqual(result.citations,['S2']);
});

test('RC1532 provider: HTTP-Fehler werden normalisiert und blockieren die UI nicht',async()=>{
  const fetchImpl=async()=>({ok:false,status:429,text:async()=>'{"error":"rate limit"}'});
  const result=await provider.askCustomsModel({...base,env:{EXPORTHUB_CUSTOMS_AI_API_KEY:'x',EXPORTHUB_CUSTOMS_AI_MODEL:'gpt-6-sol'},fetchImpl});
  assert.equal(result.ok,false);
  assert.equal(result.code,'AI_PROVIDER_ERROR');
  assert.equal(result.status,429);
  assert.equal(result.recoverable,true);
  assert.doesNotMatch(result.message||'',/rate limit/i);
});

test('RC1532 provider: Timeout wird als recoverable AI_TIMEOUT zurückgegeben',async()=>{
  const fetchImpl=async()=>{const error=new Error('aborted');error.name='AbortError';throw error};
  const result=await provider.askCustomsModel({...base,env:{EXPORTHUB_CUSTOMS_AI_API_KEY:'x',EXPORTHUB_CUSTOMS_AI_MODEL:'gpt-6-sol'},fetchImpl,timeoutMs:5});
  assert.equal(result.ok,false);
  assert.equal(result.code,'AI_TIMEOUT');
  assert.equal(result.recoverable,true);
});
