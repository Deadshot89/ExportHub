import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1558-dashboard-overview.js','utf8');
const qualityApi=fs.readFileSync('api/quality-capa/index.js','utf8');
function fn(name){
  const candidates=['\nfunction '+name+'(', '\nasync function '+name+'('];
  const found=candidates.map(needle=>runtime.indexOf(needle)).find(index=>index>=0);
  assert.ok(found>=0,name+' missing');
  const begin=found+1,end=runtime.indexOf('\n}\n',begin);
  assert.ok(end>begin,name+' end missing');
  return runtime.slice(begin,end+2);
}

test('Open-work dashboard renders independently actionable counts; unavailable never becomes 0',()=>{
  const ctx={w:{},openWorkCounts:{urgent:8,quality:3},t:key=>({
    'dashboard.overview.tile.openWork':'Offene Vorgänge',
    'dashboard.overview.tile.openUrgent':'Urgent Orders',
    'dashboard.overview.tile.openQuality':'Fehler & Verbesserungen',
    'dashboard.overview.tile.openModule':'Öffnen',
    'dashboard.overview.tile.unavailable':'Nicht verfügbar'
  }[key]||key),esc:v=>String(v)};
  vm.createContext(ctx);vm.runInContext(fn('openWorkMetric')+'\n'+fn('tileHtml'),ctx);
  const html=ctx.tileHtml('openwork',[]);
  assert.match(html,/data-rc1558-open-module="urgentorders"/);
  assert.match(html,/data-rc1558-open-module="quality"/);
  assert.match(html,/aria-label="Urgent Orders: 8"/);
  assert.match(html,/aria-label="Fehler & Verbesserungen: 3"/);
  ctx.openWorkCounts.quality=null;
  const unavailable=ctx.tileHtml('openwork',[]);
  assert.match(unavailable,/Fehler & Verbesserungen: Nicht verfügbar/);
  assert.doesNotMatch(unavailable,/Fehler & Verbesserungen: 0/);
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
  vm.createContext(ctx);vm.runInContext(fn('openWorkToken')+'\n'+fn('requestOpenWorkCount'),ctx);
  assert.equal(await ctx.requestOpenWorkCount('/api/urgent-orders'),5);
  assert.equal(calls[0].path,'/api/urgent-orders');
  assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[0].options.credentials,'same-origin');
  assert.equal(calls[0].options.cache,'no-store');
  assert.equal(calls[0].options.headers['X-ExportHUB-Token'],'test-token');
  assert.equal(JSON.parse(calls[0].options.body).action,'counts');
  ctx.w.fetch=async()=>({ok:false,status:403});
  await assert.rejects(ctx.requestOpenWorkCount('/api/quality-capa'),/COUNT_UNAVAILABLE/);
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

test('Open-work does not navigate to new windows or to external apps',()=>{
  assert.match(runtime,/ExportHUBEmbeddedModules\.open\(name\)/);
  assert.doesNotMatch(fn('bindTiles'),/window\.open\(|w\.open\(/);
});

test('Sessionwechsel startet Zähler sofort neu; alte Antworten dürfen weder Zahlen noch Sperre überschreiben',async()=>{
  const queued=[];
  const ctx={
    w:{fetch:()=>{},document:{hidden:false}},
    isDashboard:()=>true,
    readTiles:()=>({on:{openwork:true}}),
    requestOpenWorkCount:()=>new Promise(resolve=>queued.push(resolve)),
    Promise,Date,
    refreshNow:()=>ctx.loadOpenWorkCounts()
  };
  vm.createContext(ctx);
  vm.runInContext(
    'var openWorkCounts={urgent:null,quality:null},openWorkLastFetch=0,openWorkInFlight=false,openWorkEpoch=0,openWorkLoggedOut=false;\n'+
    fn('resetOpenWorkCounts')+'\n'+fn('loadOpenWorkCounts'),ctx
  );
  ctx.loadOpenWorkCounts();
  assert.equal(queued.length,2,'first session starts two count calls');
  ctx.resetOpenWorkCounts(false);
  assert.equal(queued.length,4,'new login immediately starts its own two calls despite the old pending pair');

  queued[0](91);queued[1](92);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ctx.openWorkCounts.urgent,null,'old user count never appears');
  assert.equal(ctx.openWorkCounts.quality,null,'old QM count never appears');
  assert.equal(ctx.openWorkInFlight,true,'old finally must not release the new session lock');
  ctx.loadOpenWorkCounts();
  assert.equal(queued.length,4,'no duplicate calls while the new request is pending');

  queued[2](5);queued[3](6);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ctx.openWorkCounts.urgent,5);
  assert.equal(ctx.openWorkCounts.quality,6);
  assert.equal(ctx.openWorkInFlight,false);
  ctx.resetOpenWorkCounts(true);
  assert.equal(ctx.openWorkCounts.urgent,null,'logout clears the dashboard');
  assert.equal(ctx.openWorkCounts.quality,null,'logout clears QM count');
  assert.equal(queued.length,4,'logout never calls a protected API');
});
