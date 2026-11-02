import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const pack=require('../api/pack-notification/index.js');
const store=require('../api/shared/pack-notification-store.js');

test('RC1755: opening the public Packtisch session marks a metadata-only write, not a document upload',async()=>{
 const token='test-valid-pack-token',initial={packStations:[{id:'PACK-SHARED',name:'Packbereich',tokenHash:store.hashStationToken(token),active:true}],packSessions:[],packNotifications:[],tasks:[],deliveryFiles:[{name:'historical.pdf',storage:'blob',blobName:'rc1059/testservice/aa/'+'a'.repeat(64)}]};
 let state=initial,marker=false,environment='';
 const handler=pack.createHandler({
  mutateState:async(env,mutator)=>{environment=env;const result=await mutator(state);marker=result.skipDocumentExternalization===true;state=result.state;return result;},
  now:()=>new Date('2026-11-02T09:00:00.000Z')
 });
 const res=await handler({method:'POST',query:{action:'session'},headers:{host:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'},body:{stationToken:token}});
 assert.equal(res.status,201,JSON.stringify(res.body));
 assert.equal(environment,'testservice');
 assert.equal(marker,true);
 assert.equal(state.deliveryFiles[0].blobName,initial.deliveryFiles[0].blobName);
 assert.equal(state.packSessions.length,1);
});

test('RC1755: only initial session creation bypasses costly historical document externalization',()=>{
 const code=fs.readFileSync('api/pack-notification/index.js','utf8');
 assert.ok(code.includes("result.skipDocumentExternalization===true?{state:result.state}:await require('../shared/document-blob-store').externalizeDocumentCollections"),'session must skip historical documents entirely');
 assert.match(code,/return\{state:created\.state,session:created\.session,station,skipDocumentExternalization:true\}/);
 assert.match(code,/const result=await mutateState\(environment,state=>\{const station=packStore\.validateStationToken\(state,token\);validateSessionForStation/,'draft-save still uses normal persistence');
});
