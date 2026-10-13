import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';

const plain=value=>JSON.parse(JSON.stringify(value));
const exists=path=>fs.existsSync(path);
const read=path=>fs.readFileSync(path,'utf8');

function required(path){
  assert.equal(exists(path),true,`${path} fehlt`);
  return read(path);
}

function baseTask(extra={}){
  return {
    id:'TASK-INTERNAL-1',schemaVersion:2,title:'Spedition anmelden',description:'Freigegebene Beschreibung',
    customerId:'9000003004',customerName:'Öffentlicher Kunde',status:'open',priority:'P1',
    dueAt:'2026-10-15T16:15:00+02:00',plannedAt:'2026-10-15T09:00:00+02:00',latestCompletionAt:'2026-10-15T16:15:00+02:00',
    workflowId:'shipping-secret',processId:'registration',shipmentId:'SHIP-SECRET',shipmentRef:'ABC123',orderId:'SO-SECRET',
    contact:'Private Person +49 123',comments:[{text:'Interner Kommentar'}],history:[{action:'private',at:'2026-10-12T08:00:00+02:00'}],
    checklist:[{text:'Öffentlich 1',done:true,public:true},{text:'Intern 2',done:false,public:false},{text:'Ohne Freigabe',done:false}],
    ...extra
  };
}

function loadUi(){
  const context={console,Date,Intl,TextEncoder,TextDecoder,crypto:crypto.webcrypto,location:{origin:'https://www.exporthub360.de'}};
  context.globalThis=context;
  context.__events=[];
  context.dispatchEvent=e=>{context.__events.push(e);return true};
  context.CustomEvent=class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}};
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-ui.js']){
    vm.runInNewContext(required(file),context,{filename:file});
  }
  return context;
}

function sha256(value){return crypto.createHash('sha256').update(String(value)).digest('hex')}

function loadPublicApi(teamStates){
  const source=required('api/task-public/index.js');
  const module={exports:{}};
  function notFound(){const e=new Error('not found');e.statusCode=404;return e}
  const blobService={getContainerClient(){return{getBlockBlobClient(name){return{async download(){
    if(!Object.prototype.hasOwnProperty.call(teamStates,name))throw notFound();
    return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(teamStates[name]))])};
  }}}}}};
  const sandbox={
    module,exports:module.exports,Buffer,console,setTimeout,clearTimeout,
    process:{env:{
      EXPORTHUB_STORAGE_CONNECTION_STRING:'UseFakeStorage=true',
      EXPORTHUB_STORAGE_CONTAINER:'exporthub-data',
      EXPORTHUB_STORAGE_BLOB:'team-state.json',
      EXPORTHUB_TEST_STORAGE_BLOB:'testservice/team-state.json'
    }},
    require(id){
      if(id==='crypto')return crypto;
      if(id==='../shared/blob-rest')return{createBlobServiceClient(){return blobService}};
      throw new Error('Unexpected require '+id);
    }
  };
  vm.runInNewContext(source,sandbox,{filename:'api/task-public/index.js'});
  assert.equal(typeof module.exports,'function','task-public API muss einen Handler exportieren');
  return module.exports;
}

async function invoke(handler,req){
  const context={res:null};
  const returned=await handler(context,req);
  return returned||context.res;
}
function bodyOf(response){try{return JSON.parse(String(response&&response.body||'{}'))}catch{return{}}}
function request(token,{host='www.exporthub360.de',method='GET',environment}={}){
  const query={token};if(environment!==undefined)query.environment=environment;
  return{method,query,headers:{host,'x-forwarded-host':host}};
}

function linkMetadata(token,{fields=['description','status','dueAt','checklist','customerName'],environment='production',revokedAt=''}={}){
  return{schemaVersion:1,tokenHash:sha256(token),fields,environment,createdAt:'2026-10-12T12:00:00+02:00',revokedAt};
}

test('öffentlicher Task-Link verwendet kryptografischen Zufall und persistiert ausschließlich den Hash',async()=>{
  const ctx=loadUi(),api=ctx.ExportHUBTaskUIV2,state={tasks:[baseTask()]};let saves=0;
  assert.equal(typeof api.createPublicLink,'function');
  assert.equal(typeof api.revokePublicLink,'function');
  const result=await api.createPublicLink('TASK-INTERNAL-1',['description','status','dueAt','checklist','customerName','history','workflowId','contact'],{state,persist:()=>saves++,now:'2026-10-12T12:00:00+02:00',environment:'production'});
  assert.match(result.token,/^[a-f0-9]{64}$/i,'Token muss 256 Bit kryptografischen Zufall enthalten');
  const stored=state.tasks[0].publicLink;
  assert.equal(stored.tokenHash,sha256(result.token));
  assert.equal(JSON.stringify(stored).includes(result.token),false,'Roh-Token darf nicht im State landen');
  assert.deepEqual(plain(stored.fields),['description','status','dueAt','checklist','customerName']);
  assert.equal(saves,1);
  assert.equal(state.tasks[0].history.at(-1).action,'public_link_created');
  const source=read('assets/taskplanner-v2-ui.js');
  const createStart=source.indexOf('function createPublicLink('),createEnd=source.indexOf('function revokePublicLink(',createStart);
  const randomStart=source.indexOf('function randomPublicToken('),randomEnd=source.indexOf('async function hashPublicToken(',randomStart);
  assert.ok(createStart>=0&&createEnd>createStart,'createPublicLink Implementierung fehlt');
  assert.ok(randomStart>=0&&randomEnd>randomStart,'randomPublicToken Implementierung fehlt');
  const createBlock=source.slice(createStart,createEnd),randomBlock=source.slice(randomStart,randomEnd);
  assert.match(createBlock,/randomPublicToken\(\)/,'createPublicLink muss den kryptografischen Token-Helper verwenden');
  assert.match(randomBlock,/getRandomValues|randomBytes/);
  assert.doesNotMatch(createBlock+randomBlock,/Math\.random/);
});

test('Widerruf läuft über normalen Task-State-Pfad und protokolliert Historie',async()=>{
  const ctx=loadUi(),api=ctx.ExportHUBTaskUIV2,state={tasks:[baseTask()]};let saves=0;
  const issued=await api.createPublicLink('TASK-INTERNAL-1',['description','dueAt'],{state,persist:()=>saves++,now:'2026-10-12T12:00:00+02:00',environment:'production'});
  assert.ok(issued.token);saves=0;
  const revoked=api.revokePublicLink('TASK-INTERNAL-1',{state,persist:()=>saves++,now:'2026-10-12T12:05:00+02:00'});
  assert.equal(revoked.changed,true);
  assert.equal(state.tasks[0].publicLink.revokedAt,'2026-10-12T12:05:00+02:00');
  assert.equal(state.tasks[0].history.at(-1).action,'public_link_revoked');
  assert.equal(saves,1);
});

test('task-public API liefert nur explizit freigegebene Read-only-Felder und niemals interne Metadaten',async()=>{
  const token='a'.repeat(64),task=baseTask({publicLink:linkMetadata(token)});
  const handler=loadPublicApi({'team-state.json':{state:{tasks:[task]}}});
  const res=await invoke(handler,request(token));
  assert.equal(res.status,200);
  const body=bodyOf(res),text=JSON.stringify(body);
  assert.equal(body.title,'Spedition anmelden');
  assert.equal(body.description,'Freigegebene Beschreibung');
  assert.equal(body.status,'open');
  assert.equal(body.dueAt,'2026-10-15T16:15:00+02:00');
  assert.equal(body.customerName,'Öffentlicher Kunde');
  assert.deepEqual(plain(body.checklist),[{text:'Öffentlich 1',done:true}]);
  for(const secret of ['TASK-INTERNAL-1','9000003004','shipping-secret','SHIP-SECRET','SO-SECRET','Private Person','Interner Kommentar','Intern 2','Ohne Freigabe'])assert.equal(text.includes(secret),false,`Öffentliche Antwort leakt ${secret}`);
  for(const forbidden of ['id','taskId','customerId','workflowId','processId','shipmentId','shipmentRef','orderId','contact','comments','history'])assert.equal(Object.prototype.hasOwnProperty.call(body,forbidden),false,forbidden+' darf nicht ausgegeben werden');
  assert.equal(Object.values(body).some(v=>typeof v==='function'),false);
  assert.match(String(res.headers&&res.headers['Cache-Control']||''),/no-store/);
  assert.equal(res.headers['Referrer-Policy'],'no-referrer');
  assert.match(String(res.headers['X-Robots-Tag']||''),/noindex/);
});

test('ungültige und widerrufene Tokens geben 404/410 ohne Task-Metadaten zurück',async()=>{
  const good='b'.repeat(64),revoked='c'.repeat(64);
  const tasks=[
    baseTask({title:'TOP SECRET GOOD',publicLink:linkMetadata(good)}),
    baseTask({id:'T2',title:'TOP SECRET REVOKED',publicLink:linkMetadata(revoked,{revokedAt:'2026-10-12T12:00:00+02:00'})})
  ];
  const handler=loadPublicApi({'team-state.json':{state:{tasks}}});
  const invalid=await invoke(handler,request('x'.repeat(64))),invalidText=JSON.stringify(bodyOf(invalid));
  assert.equal(invalid.status,404);assert.equal(/TOP SECRET|TASK-INTERNAL|T2/.test(invalidText),false);
  const gone=await invoke(handler,request(revoked)),goneText=JSON.stringify(bodyOf(gone));
  assert.equal(gone.status,410);assert.equal(/TOP SECRET|TASK-INTERNAL|T2/.test(goneText),false);
});

test('Request-Host entscheidet Umgebung; query environment darf niemals TESTSERVICE-Daten umschalten',async()=>{
  const prod='d'.repeat(64),testToken='e'.repeat(64);
  const handler=loadPublicApi({
    'team-state.json':{state:{tasks:[baseTask({title:'PROD TASK',publicLink:linkMetadata(prod,{environment:'production'})})]}},
    'testservice/team-state.json':{state:{tasks:[baseTask({title:'TEST TASK',publicLink:linkMetadata(testToken,{environment:'testservice'})})]}}
  });
  const switched=await invoke(handler,request(testToken,{host:'www.exporthub360.de',environment:'testservice'}));
  assert.equal(switched.status,404,'Produktionshost darf Query-Umschaltung auf TESTSERVICE nicht akzeptieren');
  const testRes=await invoke(handler,request(testToken,{host:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',environment:'production'}));
  assert.equal(testRes.status,200,'TESTSERVICE-Host muss sein eigenes State lesen unabhängig vom Query-Parameter');
  assert.equal(bodyOf(testRes).title,'TEST TASK');
});

test('öffentlicher Endpoint und Seite sind strikt read-only und standalone',()=>{
  const cfg=JSON.parse(required('api/task-public/function.json'));
  const trigger=cfg.bindings.find(x=>x.type==='httpTrigger');
  assert.ok(trigger);assert.equal(trigger.authLevel,'anonymous');assert.equal(trigger.route,'task-public');
  assert.deepEqual(trigger.methods.slice().sort(),['get','options']);
  const page=required('task.html'),runtime=required('assets/task-public-read.js');
  assert.match(page,/<meta name="viewport"[^>]*width=device-width/i);
  assert.match(page,/name="robots"[^>]*noindex/i);
  assert.match(page,/name="referrer"[^>]*no-referrer/i);
  assert.match(page,/id="status"[^>]*role="status"[^>]*aria-live="polite"/i);
  assert.match(page,/\/assets\/task-public-read\.js/);
  assert.doesNotMatch(page,/rc1014-task|ExportHUBClean|loginBtn|taskplanner-v2-core/i,'Öffentliche Seite darf internen App-Bootstrap nicht laden');
  assert.match(runtime,/fetch\([^\n]+method\s*:\s*['"]GET['"]/i);
  assert.doesNotMatch(runtime,/method\s*:\s*['"](?:POST|PATCH|PUT|DELETE)['"]/i);
  assert.doesNotMatch(runtime,/ExportHUBClean|queueSave|state\.tasks|completeTask|cancelTask/i);
});

test('nicht-GET Methoden werden ohne Task-Metadaten mit 405 abgewiesen',async()=>{
  const token='f'.repeat(64),handler=loadPublicApi({'team-state.json':{state:{tasks:[baseTask({title:'METHOD SECRET',publicLink:linkMetadata(token)})]}}});
  for(const method of ['POST','PATCH','PUT','DELETE']){
    const res=await invoke(handler,request(token,{method}));
    assert.equal(res.status,405,method);
    assert.equal(JSON.stringify(bodyOf(res)).includes('METHOD SECRET'),false,method+' darf keine Taskdaten enthalten');
  }
});

test('öffentliche Task-Routen tragen No-Store-/No-Referrer-Sicherheitsheader in Produktion und TESTSERVICE',()=>{
  for(const file of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
    const config=JSON.parse(required(file));
    for(const route of ['/task','/task.html']){
      const row=(config.routes||[]).find(r=>r.route===route);
      assert.ok(row,`${file}: ${route} fehlt`);
      assert.match(String(row.headers&&row.headers['Cache-Control']||''),/no-store/);
      assert.equal(row.headers['Referrer-Policy'],'no-referrer');
      assert.equal(row.headers['X-Content-Type-Options'],'nosniff');
    }
  }
});

test('Build-/Pretest-Wiring liefert task.html und task-public-read.js aus',()=>{
  const patch=required('scripts/taskplanner-v2-pretest.mjs');
  assert.match(patch,/task-public-read\.js/);
  assert.match(patch,/task\.html/);
  const pretest=required('scripts/rc1462-pretest.mjs');
  assert.match(pretest,/task-public-read\.js/);
  assert.match(pretest,/task\.html/);
});