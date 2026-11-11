import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const runtime=fs.readFileSync('assets/rc1558-dashboard-overview.js','utf8');
const qualityApi=fs.readFileSync('api/quality-capa/index.js','utf8');
const complaintApi=fs.readFileSync('api/shipment-evidence/index.js','utf8');
function fn(name){
  const candidates=['\nfunction '+name+'(', '\nasync function '+name+'('];
  const found=candidates.map(needle=>runtime.indexOf(needle)).find(index=>index>=0);
  assert.ok(found>=0,name+' missing');
  const begin=found+1,end=runtime.indexOf('\n}\n',begin);
  assert.ok(end>begin,name+' end missing');
  return runtime.slice(begin,end+2);
}

test('Open-work dashboard renders independently actionable counts; unavailable never becomes 0',()=>{
  const ctx={w:{},openWorkCounts:{urgent:8,quality:3,complaints:4},t:key=>({
    'dashboard.overview.tile.openWork':'Offene Vorgänge',
    'dashboard.overview.tile.openUrgent':'Urgent Orders',
    'dashboard.overview.tile.openQuality':'Fehler & Verbesserungen',
    'dashboard.overview.tile.openComplaints':'Offene Reklamationen',
    'dashboard.overview.tile.openModule':'Öffnen',
    'dashboard.overview.tile.unavailable':'Nicht verfügbar'
  }[key]||key),esc:v=>String(v),icon:()=>''};
  vm.createContext(ctx);vm.runInContext(fn('openWorkTopKpi'),ctx);
  const html=ctx.openWorkTopKpi();
  assert.equal((html.match(/<button type="button" class="rc1558-kpi"/g)||[]).length,3,'all three counts must be regular top KPI cards');
  assert.doesNotMatch(html,/rc1558-kpi-openwork|rc1558-openwork-action|role="group"/,'no nested subcards or wider special wrapper');
  assert.match(html,/data-rc1558-open-module="urgentorders"/);
  assert.match(html,/data-rc1558-open-module="quality"/);
  assert.match(html,/data-rc1558-open-module="shipmentevidence"/);
  assert.match(html,/aria-label="Urgent Orders: 8"/);
  assert.match(html,/aria-label="Fehler & Verbesserungen: 3"/);
  assert.match(html,/aria-label="Offene Reklamationen: 4"/);
  assert.equal((html.match(/class="rc1558-kpi-top"/g)||[]).length,3,'same header structure as existing KPI cards');
  assert.equal((html.match(/class="rc1558-kpi-value"/g)||[]).length,3,'same large KPI number as existing cards');
  assert.equal((html.match(/class="rc1558-kpi-sub"/g)||[]).length,3,'same small descriptive line as existing cards');
  ctx.openWorkCounts.quality=null;
  const unavailable=ctx.openWorkTopKpi();
  assert.match(unavailable,/Fehler & Verbesserungen: Nicht verfügbar/);
  assert.match(unavailable,/data-unavailable="1"/,'missing values are not silently treated as zero');
  assert.doesNotMatch(unavailable,/Fehler & Verbesserungen: 0/);
  ctx.openWorkCounts.quality=0;
  ctx.openWorkCounts.complaints=0;
  const zero=ctx.openWorkTopKpi();
  assert.match(zero,/data-zero="1"/,'known zero uses the same subdued style as other KPI cards');
  assert.doesNotMatch(zero,/data-unavailable="1"/,'known zero is not missing');
});

test('Open-work API reads authenticated aggregate count only; rejects unauthorized and invalid responses',async()=>{
  const calls=[];
  const ctx={w:{
    ExportHUBClean:{runtime:{authToken:'test-token'}},
    sessionStorage:{getItem:()=>null},
    fetch:async(path,options)=>{
      calls.push({path,options});
      return {ok:true,redirected:false,type:'basic',headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>({ok:true,open:5})};
    }
  },q:v=>String(v).trim(),JSON,Number,Error};
  vm.createContext(ctx);vm.runInContext('var openWorkEpoch=0,openWorkLoggedOut=false,openWorkAuthBackoff={urgent:0,quality:0,complaints:0},OPEN_WORK_AUTH_BACKOFF_MS=300000;\n'+fn('openWorkToken')+'\n'+fn('requestOpenWorkCount'),ctx);
  assert.equal(await ctx.requestOpenWorkCount('/api/urgent-orders'),5);
  assert.equal(calls[0].path,'/api/urgent-orders');
  assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[0].options.credentials,'same-origin');
  assert.equal(calls[0].options.cache,'no-store');
  assert.equal(calls[0].options.headers['X-ExportHUB-Token'],'test-token');
  assert.equal(JSON.parse(calls[0].options.body).action,'counts');
  assert.equal(await ctx.requestOpenWorkCount('/api/shipment-evidence'),5);
  assert.equal(calls[1].path,'/api/shipment-evidence?action=counts');
  assert.equal(calls[1].options.method,'GET','Complaint count uses a read-only endpoint');
  assert.equal(calls[1].options.body,undefined,'No write payload or case details');
  ctx.w.fetch=async()=>({ok:false,status:403});
  await assert.rejects(ctx.requestOpenWorkCount('/api/quality-capa'),/COUNT_UNAVAILABLE/);
  // A denied session must respect its backoff; a new login then resets the gate.
  await assert.rejects(ctx.requestOpenWorkCount('/api/quality-capa'),/COUNT_AUTH_BACKOFF/);
  ctx.openWorkEpoch++;
  ctx.openWorkAuthBackoff={urgent:0,quality:0,complaints:0};
  ctx.w.fetch=async()=>({ok:true,redirected:false,type:'basic',headers:{get:()=> 'application/json'},json:async()=>({ok:true,open:'0'})});
  await assert.rejects(ctx.requestOpenWorkCount('/api/quality-capa'),/COUNT_INVALID/);
});

test('QM counts stay server-side after read rights, omit case details, and exclude closed cases',()=>{
  const read=qualityApi.indexOf("requireRight(canRead(user),'Qualitätsabweichungen');");
  const counts=qualityApi.indexOf("if(action==='counts')");
  const list=qualityApi.indexOf("if(action==='list')");
  assert.ok(read>=0&&counts>read&&list>counts,'only authorized viewer may count QM cases');
  const snippet=qualityApi.slice(counts,list);
  assert.match(snippet,/status!=='abgeschlossen'/);
  assert.match(snippet,/open,closed:items.length-open,total:items.length/);
  assert.doesNotMatch(snippet,/items:items\.map|title:|description:|customer:/,'counts must not expose case details');
});

test('Complaint totals only include active cases, not shipments or deleted records',()=>{
  const cases=requireComplaintOps();
  const records=[
   {complaints:[{state:'offen'},{state:'in_pruefung'},{state:'abgeschlossen'}]},
   {complaints:[{state:'abgeschlossen'},{state:'offen'}]},
   {deletedAt:'2026-11-11',complaints:[{state:'offen'}]},
   {complaints:[]}
  ];
  assert.equal(cases.openCount(records),3);
  assert.equal(cases.openCount([]),0);
  assert.match(complaintApi,/if\(method==='GET'&&action==='counts'\)return complaintCounts\(ctx\)/);
  assert.match(complaintApi,/async function complaintCounts\(ctx\)/);
  const countStart=complaintApi.indexOf('async function complaintCounts(ctx)');
  const listStart=complaintApi.indexOf('async function list(ctx,query)');
  assert.ok(countStart>=0&&listStart>countStart);
  assert.doesNotMatch(complaintApi.slice(countStart,listStart),/fields:|customer:|complaints:batch/);
});
function requireComplaintOps(){return require('../api/shipment-evidence/complaints.js')}
test('Open-work does not navigate to new windows or to external apps',()=>{
  assert.match(runtime,/ExportHUBEmbeddedModules\.open\(name\)/);
  assert.doesNotMatch(fn('bind'),/window\.open\(|w\.open\(/);
  assert.match(fn('bind'),/data-rc1558-open-module/);
  assert.match(runtime,/kpis\+openWorkTopKpi\(\)/,'top KPI is part of the existing dashboard band');
  assert.match(fn('bind'),/ExportHUBStandaloneEvidence\.open\(\)/,'Complaint card opens the in-app documentation view');
  assert.doesNotMatch(runtime,/if\(id==='openwork'\)/,'no duplicate lower card');
});

test('Sessionwechsel startet Zähler sofort neu; alte Antworten dürfen weder Zahlen noch Sperre überschreiben',async()=>{
  const queued=[];
  const ctx={
    w:{fetch:()=>{},document:{hidden:false}},
    isDashboard:()=>true,
    readTiles:()=>({on:{openwork:false}}),
    boundedOpenWorkCount:()=>new Promise(resolve=>queued.push(resolve)),
    Promise,Date,
    refreshNow:()=>ctx.loadOpenWorkCounts()
  };
  vm.createContext(ctx);
  vm.runInContext(
    'var openWorkCounts={urgent:null,quality:null,complaints:null},openWorkLastFetch=0,openWorkInFlight=false,openWorkEpoch=0,openWorkLoggedOut=false,openWorkAuthBackoff={urgent:0,quality:0,complaints:0};\n'+
    fn('resetOpenWorkCounts')+'\n'+fn('loadOpenWorkCounts'),ctx
  );
  ctx.loadOpenWorkCounts();
  assert.equal(queued.length,3,'first session starts three independent count calls');
  ctx.resetOpenWorkCounts(false);
  assert.equal(queued.length,6,'new login immediately starts its own three calls despite old pending requests');

  queued[0](91);queued[1](92);queued[2](93);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ctx.openWorkCounts.urgent,null,'old user count never appears');
  assert.equal(ctx.openWorkCounts.quality,null,'old QM count never appears');
  assert.equal(ctx.openWorkCounts.complaints,null,'old complaint count never appears');
  assert.equal(ctx.openWorkInFlight,true,'old finally must not release the new session lock');
  ctx.loadOpenWorkCounts();
  assert.equal(queued.length,6,'no duplicate calls while the new request is pending');

  queued[3](5);queued[4](6);queued[5](7);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ctx.openWorkCounts.urgent,5);
  assert.equal(ctx.openWorkCounts.quality,6);
  assert.equal(ctx.openWorkCounts.complaints,7);
  assert.equal(ctx.openWorkInFlight,false);
  ctx.resetOpenWorkCounts(true);
  assert.equal(ctx.openWorkCounts.urgent,null,'logout clears the dashboard');
  assert.equal(ctx.openWorkCounts.quality,null,'logout clears QM count');
  assert.equal(ctx.openWorkCounts.complaints,null,'logout clears complaint count');
  assert.equal(queued.length,6,'logout never calls a protected API');
});

test('401/403 counts: getrennte Fünf-Minuten-Sperren, keine Dauerabfragen und Login-Recovery',async()=>{
  for(const denial of [401,403]){
    let now=1000000,qualityStatus=denial;
    const calls=[];
    const ctx={
      w:{ExportHUBClean:{runtime:{authToken:'token'}},sessionStorage:{getItem:()=>null},
        fetch:async(path)=>{
          calls.push(path);
          if(path==='/api/quality-capa'&&qualityStatus!==200)return {ok:false,status:qualityStatus};
          return {ok:true,redirected:false,type:'basic',
            headers:{get:()=> 'application/json'},
            json:async()=>({ok:true,open:path==='/api/urgent-orders'?7:2})};
        }},
      q:v=>String(v).trim(),JSON,Number,Error,Date:{now:()=>now},
      openWorkEpoch:0,openWorkLoggedOut:false,
      openWorkAuthBackoff:{urgent:0,quality:0,complaints:0},OPEN_WORK_AUTH_BACKOFF_MS:300000
    };
    vm.createContext(ctx);
    vm.runInContext(fn('openWorkToken')+'\n'+fn('requestOpenWorkCount'),ctx);
    await assert.rejects(ctx.requestOpenWorkCount('/api/quality-capa'),/COUNT_UNAVAILABLE/);
    assert.equal(calls.length,1,'first denied QM count is requested');
    await assert.rejects(ctx.requestOpenWorkCount('/api/quality-capa'),/COUNT_AUTH_BACKOFF/);
    assert.equal(calls.length,1,'repeat QM request during backoff never hits API');
    assert.equal(await ctx.requestOpenWorkCount('/api/urgent-orders'),7,'Urgent counter remains independent');
    now+=299999;
    await assert.rejects(ctx.requestOpenWorkCount('/api/quality-capa'),/COUNT_AUTH_BACKOFF/);
    assert.equal(calls.length,2,'permission denial cannot cause a request flood');
    now+=2;
    qualityStatus=200;
    assert.equal(await ctx.requestOpenWorkCount('/api/quality-capa'),2,'QM count recovers after backoff');
    assert.equal(ctx.openWorkAuthBackoff.quality,0,'success clears auth backoff');

    // A late 403 belonging to the old session cannot block the new account.
    let resolveOld;
    ctx.w.fetch=()=>new Promise(resolve=>{resolveOld=resolve});
    const pending=ctx.requestOpenWorkCount('/api/quality-capa');
    ctx.openWorkEpoch++;
    ctx.openWorkAuthBackoff={urgent:0,quality:0};
    resolveOld({ok:false,status:denial});
    await assert.rejects(pending,/COUNT_UNAVAILABLE/);
    assert.equal(ctx.openWorkAuthBackoff.quality,0,'stale rejection cannot throttle a different login');
  }
});

test('Stalled count request times out and releases the refresh path without leaking data',async()=>{
  let fireTimeout=null,aborts=0,cleared=[];
  class Controller{
    constructor(){this.signal={aborted:false}}
    abort(){this.signal.aborted=true;aborts++}
  }
  const ctx={w:{
    AbortController:Controller,
    setTimeout(fn,ms){assert.equal(ms,12000);fireTimeout=fn;return 17},
    clearTimeout(id){cleared.push(id)}
  },requestOpenWorkCount:()=>new Promise(()=>{}),Promise,Error};
  vm.createContext(ctx);
  vm.runInContext(fn('boundedOpenWorkCount'),ctx);
  const pending=ctx.boundedOpenWorkCount('/api/quality-capa');
  assert.equal(typeof fireTimeout,'function','timeout must be armed');
  fireTimeout();
  await assert.rejects(pending,/COUNT_TIMEOUT/,'hanging count must settle as unavailable');
  assert.equal(aborts,1,'pending network request is aborted where supported');
  assert.deepEqual(cleared,[17],'completed timeout is cleared');
});

test('Open-work counters are three equal top KPI cards with no separate lower widget',()=>{
  const css=fs.readFileSync('assets/rc1558-dashboard-overview.css','utf8');
  const desktop=css.slice(css.lastIndexOf('/* RC1965/RC1911: top KPI cards are equal-width siblings'));
  assert.match(runtime,/kpis\+openWorkTopKpi\(\)/,'the three cards are inside the original status grid');
  assert.doesNotMatch(fn('tileHtml'),/id==='openwork'/,'no lower duplicate card');
  assert.match(runtime,/var TILE_IDS=\['quick','lager','abd','pallet','week'\]/,'the lower tile editor has no open-work option');
  assert.doesNotMatch(css,/\.rc1558-kpi-openwork|\.rc1558-openwork-action/,'old special tile styling is removed');
  assert.match(desktop,/nth-child\(9\)\)\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)\}/,'desktop uses five equal columns');
  assert.match(desktop,/data-rc1569-fit="1".*nth-child\(9\)\)\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important\}/,'fitted dashboard uses identical grid');
  assert.match(desktop,/nth-child\(10\)\)\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/,'tablet avoids narrow last tile at ten cards');
  assert.match(desktop,/@media\(max-width:640px\)/,'phone retains two equal columns');
  assert.match(desktop,/nth-child\(11\)/,'eleven KPI cards share a balanced six-column layout');
  for(const total of [9,10])assert.equal(Math.ceil(total/5),2,`desktop ${total} normal-sized top KPI cards require two rows`);
  assert.equal(Math.ceil(11/6),2,'eleven dashboard cards use two rows on a wide screen');
});
