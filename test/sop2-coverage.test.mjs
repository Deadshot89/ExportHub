import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sources=[
 'assets/sop/rc1505-sop-function-registry.js',
 'assets/sop/rc1505-sop-coverage.js',
 'assets/sop/rc1506-sop-coverage-dashboard.js',
 'assets/sop2/sop2-coverage.js'
].map(p=>[p,fs.readFileSync(p,'utf8')]);
const legacyRender=fs.readFileSync('assets/sop/rc1506-sop-coverage-dashboard.js','utf8');
const legacyCss=fs.readFileSync('assets/sop/rc1506-sop-coverage-dashboard.css','utf8');

function context(){
 const ctx=vm.createContext({console});
 for(const [path,source] of sources)vm.runInContext(source,ctx,{filename:path});
 return ctx;
}
function sop(status='approved',overrides={}){
 return {
  schemaVersion:1,id:'SOP-EH-060',revision:3,title:'Zollverfahren',area:'Export / Zoll',
  historyIntegrity:{ok:true,brokenAt:0},
  versions:[{
    version:'1.0',status,author:'anna',lastEditor:'anna',
    approvedBy:status==='approved'?'lena':undefined,
    approvedAt:status==='approved'?'2026-11-13T18:00:00.000Z':undefined,
    content:{
      de:{purpose:'Versand prüfen'},en:{purpose:'Check export'},
      steps:[{id:'step-1',de:'ABD prüfen',en:'Check ABD',screenshot:'/uploads/sop/abd.png',tourTarget:'shipment-abd-decision'}]
    }
  }],
  ...overrides
 };
}
function own(x){return JSON.parse(JSON.stringify(x));}
function fakeHost(){
 const listeners={};
 const document={createElement(name){
   return {tagName:name,className:'',textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
 }};
 const host={
  ownerDocument:document,children:[],html:'',appendChild(x){this.children.push(x);return x;},
  replaceChildren(){this.children=[];this.html='';},
  addEventListener(k,fn){listeners[k]=fn;},
  removeEventListener(k){delete listeners[k];},
  set innerHTML(value){this.html=value;this.children=[];},
  get innerHTML(){return this.html;}
 };
 return {host,listeners};
}
function action(row,kind){
 return {target:{closest(selector){
  if(selector==='[data-coverage-reset]')return null;
  if(selector==='[data-coverage-nav]')return {getAttribute(key){
   return key==='data-coverage-row'?row.id:key==='data-coverage-nav'?kind:'';
  }};
  return null;
 }}};
}
test('RC1505 register remains exactly 25 required process/coverage entries',()=>{
 const c=context(),entries=c.ExportHubSopFunctionRegistry.entries;
 assert.equal(entries.length,25);
 assert.ok(entries.every(x=>x.required===true));
 assert.equal(new Set(entries.map(e=>e.id)).size,25);
});
test('empty SOP2 API list is not replaced by legacy handbooks: all 25 registered areas are red',()=>{
 const c=context(),docs=c.Sop2Coverage.toCoverageDocuments([],c.ExportHubSopFunctionRegistry.entries);
 assert.equal(docs.length,0);
 const model=c.ExportHubSopCoverageDashboard.buildModel({
   entries:c.ExportHubSopFunctionRegistry.entries,documents:docs
 });
 assert.equal(model.summary.total,25);
 assert.equal(model.summary.red,25);
 assert.equal(model.summary.yellow,0);
 assert.equal(model.summary.green,0);
 assert.equal(model.summary.percentage,0);
});
test('approved SOP without verified tour, image and exam is incomplete, never complete',()=>{
 const c=context(),docs=c.Sop2Coverage.toCoverageDocuments([sop()]);
 assert.equal(docs.length,1);
 assert.equal(docs[0].status,'Freigegeben');
 assert.equal(docs[0].currentVersion,'1.0');
 const model=c.ExportHubSopCoverageDashboard.buildModel({
   entries:c.ExportHubSopFunctionRegistry.entries,documents:docs
 });
 const rows=model.items.filter(x=>x.sopNumber==='SOP-EH-060');
 assert.equal(rows.length,2);
 assert.ok(rows.every(x=>x.status==='yellow'));
 assert.ok(rows.every(x=>x.reasons.includes('TOUR_MISSING')));
 assert.ok(rows.every(x=>x.reasons.includes('EXAM_MISSING')));
 assert.ok(rows.every(x=>x.reasons.includes('IMAGE_MISSING')));
 assert.equal(model.summary.green,0);
 assert.equal(model.summary.yellow,2);
 assert.equal(model.summary.red,23);
 assert.equal(model.summary.percentage,0);
});
test('a draft is not a valid SOP even when it carries a forged old release label',()=>{
 const c=context(),fake=sop('draft');
 fake.status='Freigegeben';fake.approvedBy='RC1016 fake approval';fake.versions[0].approvedBy='RC1016';
 assert.equal(c.Sop2Coverage.toCoverageDocuments([fake]).length,0);
 const model=c.ExportHubSopCoverageDashboard.buildModel({
  entries:c.ExportHubSopFunctionRegistry.entries,documents:c.Sop2Coverage.toCoverageDocuments([fake])
 });
 assert.equal(model.summary.red,25);
});
test('SOP2 API history integrity must be positively verified, not merely absent or truthy',()=>{
 const c=context();
 for(const broken of [undefined,{ok:false,brokenAt:1},{ok:true,brokenAt:1},{ok:'true',brokenAt:0}]){
  const d=sop();d.historyIntegrity=broken;
  assert.equal(c.Sop2Coverage.toCoverageDocuments([d]).length,0);
 }
});
test('a missing approval stamp, two approved versions or invalid schema never counts as released',()=>{
 const c=context();
 const missing=sop();delete missing.versions[0].approvedBy;
 const missingAt=sop();delete missingAt.versions[0].approvedAt;
 const two=sop();two.versions.push({...two.versions[0],version:'1.1'});
 const schema=sop();schema.schemaVersion=2;
 for(const d of [missing,missingAt,two,schema])
  assert.equal(c.Sop2Coverage.toCoverageDocuments([d]).length,0);
});
test('a new unpublished draft does not revoke the existing one valid approved version',()=>{
 const c=context(),d=sop();
 d.versions.push({version:'1.1',status:'draft',author:'anna',lastEditor:'anna',content:{de:{},en:{},steps:[]}});
 const output=c.Sop2Coverage.toCoverageDocuments([d]);
 assert.equal(output.length,1);
 assert.equal(output[0].currentVersion,'1.0');
 assert.equal(output[0].versions.length,1);
});
test('duplicate document IDs cannot inflate a register and unregistered SOPs do not count',()=>{
 const c=context(),d=sop(),another=sop('approved',{id:'SOP-EH-999'});
 const result=c.Sop2Coverage.toCoverageDocuments([d,d,another]);
 assert.equal(result.length,1);
 assert.equal(result[0].number,'SOP-EH-060');
});
test('only actual SOP2 approval fields are carried over, never fabricated approval metadata',()=>{
 const c=context(),d=sop();
 const input=JSON.stringify(d),out=c.Sop2Coverage.toCoverageDocuments([d])[0];
 assert.equal(out.approvedBy,'lena');
 assert.equal(out.versions[0].approvedBy,'lena');
 assert.equal(out.status,'Freigegeben');
 assert.equal(out.versions[0].status,'Freigegeben');
 assert.equal(JSON.stringify(d),input);
 assert.equal(out.versions[0].content.steps[0].target.stableKey,'');
 assert.equal(out.versions[0].content.steps[0].tour.enabled,false);
 assert.equal(out.versions[0].content.steps[0].exam.relevant,false);
 assert.deepEqual(own(out.versions[0].visuals),[]);
});
test('screenshot paths are only references; they do not count as verified image evidence',()=>{
 const c=context(),rows=c.Sop2Coverage.toCoverageDocuments([sop()]);
 assert.equal(rows[0].versions[0].visuals.length,0);
 const report=c.ExportHubSopCoverageDashboard.buildModel({
  entries:c.ExportHubSopFunctionRegistry.entries,documents:rows,assetExists:()=>true
 });
 assert.equal(report.summary.image,0);
});
test('exact RC1506 dashboard markup classes and action attributes are reused without modifying the renderer',()=>{
 const c=context();
 const model=c.ExportHubSopCoverageDashboard.buildModel({
  entries:c.ExportHubSopFunctionRegistry.entries,documents:c.Sop2Coverage.toCoverageDocuments([sop()])
 });
 const html=c.ExportHubSopCoverageDashboard.render(model,{});
 for(const name of ['rc1506-dashboard','rc1506-header','rc1506-kpis','rc1506-kpi',
  'rc1506-table-wrap','rc1506-table','rc1506-status','rc1506-filters','rc1506-action'])
  assert.ok(html.includes(name),name);
 for(const attr of ['data-coverage-nav="sop"','data-coverage-nav="step"','data-coverage-filter="area"',
  'data-coverage-filter="status"','data-coverage-filter="capability"'])
  assert.ok(html.includes(attr),attr);
 // The wrapper calls the original RC1506 renderer verbatim: no forked HTML/CSS.
 assert.doesNotMatch(sources.at(-1)[1],/innerHTML|<table|<article|<section/);
 assert.match(legacyRender,/class="rc1506-dashboard"/);
 assert.match(legacyCss,/\.rc1506-dashboard/);
});
test('mount renders unchanged RC1506 markup from authenticated SOP2 client data',async()=>{
 const c=context(),{host}=fakeHost();
 const doc=sop(),client={async list(){return [doc];}};
 const controller=c.Sop2Coverage.mount(host,{client,onOpen(){}});
 await controller.ready;
 assert.equal(controller.getStatus(),'ready');
 assert.ok(host.innerHTML.includes('rc1506-dashboard'));
 assert.ok(host.innerHTML.includes('SOP unvollständig'));
 assert.equal(controller.getModel().summary.yellow,2);
 assert.equal(controller.getModel().summary.green,0);
 controller.destroy();
});
test('SOP öffnen and Schritt öffnen call onOpen with SOP2 number and step ID, never legacy navigation',async()=>{
 const c=context(),{host,listeners}=fakeHost(),opened=[];
 const controller=c.Sop2Coverage.mount(host,{client:{async list(){return [sop()];}},onOpen:x=>opened.push(own(x))});
 await controller.ready;
 const row=controller.getModel().items.find(x=>x.sopNumber==='SOP-EH-060');
 listeners.click(action(row,'sop'));
 listeners.click(action(row,'step'));
 assert.deepEqual(opened,[{number:'SOP-EH-060',stepId:''},{number:'SOP-EH-060',stepId:'step-1'}]);
 assert.equal(c.__EXPORTHUB_SOP_PENDING_NAV__,undefined);
 controller.destroy();
});
test('missing onOpen handler is rejected rather than falling back to old handbook click',()=>{
 const c=context(),{host}=fakeHost();
 assert.throws(()=>c.Sop2Coverage.mount(host,{client:{list:async()=>[]}}),
  /SOP2_COVERAGE_OPEN_HANDLER_REQUIRED/);
});
test('SOP2 disabled or authorization failure displays an error, never false zero coverage',async()=>{
 const c=context();
 for(const code of ['SOP2_DISABLED','AUTH_REQUIRED']){
  const {host}=fakeHost();
  const ctrl=c.Sop2Coverage.mount(host,{client:{async list(){throw Object.assign(new Error(code),{code});}},onOpen(){}});
  assert.equal(await ctrl.ready,null);
  assert.equal(ctrl.getStatus(),'error');
  assert.equal(ctrl.getModel(),null);
  assert.equal(host.innerHTML,'');
  assert.equal(host.children.length,1);
  assert.equal(host.children[0].attrs.role,'alert');
  assert.ok(host.children[0].textContent.length>20);
  ctrl.destroy();
 }
});
test('a previous successful dashboard is cleared upon a subsequent API outage, not served as stale live data',async()=>{
 const c=context(),{host}=fakeHost();let fail=false;
 const ctrl=c.Sop2Coverage.mount(host,{client:{async list(){
  if(fail)throw Object.assign(new Error('network'),{code:'NETWORK_UNAVAILABLE'});
  return [sop()];
 }},onOpen(){}});
 await ctrl.ready;assert.equal(ctrl.getStatus(),'ready');
 fail=true;
 assert.equal(await ctrl.refresh(),null);
 assert.equal(ctrl.getStatus(),'error');
 assert.equal(ctrl.getModel(),null);
 assert.equal(host.innerHTML,'');
 assert.equal(host.children[0].attrs.role,'alert');
 ctrl.destroy();
});
test('failed request can recover with a new authenticated read and the same RC1506 layout',async()=>{
 const c=context(),{host}=fakeHost();let count=0;
 const ctrl=c.Sop2Coverage.mount(host,{client:{async list(){
   if(++count===1)throw Object.assign(new Error('OFF'),{code:'SOP2_DISABLED'});
   return [sop()];
 }},onOpen(){}});
 await ctrl.ready;assert.equal(ctrl.getModel(),null);
 await ctrl.refresh();assert.equal(ctrl.getModel().summary.yellow,2);
 assert.ok(host.innerHTML.includes('rc1506-dashboard'));
 ctrl.destroy();
});
test('a slower old request cannot overwrite the result of a newer refresh',async()=>{
 const c=context(),{host}=fakeHost();let releaseFirst;
 const pending=new Promise(resolve=>{releaseFirst=resolve;});
 let index=0;
 const ctrl=c.Sop2Coverage.mount(host,{client:{async list(){return ++index===1?pending:[sop()];}},onOpen(){}});
 await ctrl.refresh();
 assert.equal(ctrl.getModel().summary.yellow,2);
 releaseFirst([]);
 await ctrl.ready;
 assert.equal(ctrl.getModel().summary.yellow,2);
 ctrl.destroy();
});
test('destroy invalidates in-flight reads and removes its handlers',async()=>{
 const c=context(),{host,listeners}=fakeHost();let release;
 const read=new Promise(resolve=>{release=resolve;});
 const ctrl=c.Sop2Coverage.mount(host,{client:{async list(){return read;}},onOpen(){}});
 ctrl.destroy();release([sop()]);await ctrl.ready;
 assert.equal(ctrl.getModel(),null);
 assert.equal(Object.keys(listeners).length,0);
 assert.equal(host.innerHTML,'');
 assert.equal(host.children.length,0);
});
test('explicit document list is honored and never silently populated from legacy shared state',()=>{
 const c=context();c.__EXPORTHUB_GET_STATE__=()=>({isoSops:[{number:'SOP-EH-060',status:'Freigegeben'}]});
 const model=c.ExportHubSopCoverageDashboard.buildModel({
  entries:c.ExportHubSopFunctionRegistry.entries,
  documents:c.Sop2Coverage.toCoverageDocuments([])
 });
 assert.equal(model.summary.red,25);
 assert.equal(model.summary.green,0);
});
