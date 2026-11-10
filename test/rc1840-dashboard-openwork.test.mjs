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
