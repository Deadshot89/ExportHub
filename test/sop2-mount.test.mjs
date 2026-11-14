import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {injectSop2,integrateSop2,SOP2_ASSETS} from '../.github/sop2/integrate.mjs';

const mountSrc=fs.readFileSync('assets/sop2/sop2-mount.js','utf8');
const langSrc=fs.readFileSync('assets/i18n/sop2.js','utf8');
const styleSrc=fs.readFileSync('assets/sop2/sop2-mount.css','utf8');
const buildSrc=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const routes=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));

function fakeDOM(){
 class Element{
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.parentNode=null;
   this.className='';this.hidden=false;this.disabled=false;this.value='';this.listeners={};
   this.attrs={};this._text='';this.type='';this.required=false;}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  appendChild(child){child.parentNode=this;this.children.push(child);return child;}
  removeChild(child){this.children=this.children.filter(x=>x!==child);child.parentNode=null;}
  replaceChildren(){this._text='';this.children=[];}
  get firstChild(){return this.children[0]||null;}
  setAttribute(k,v){this.attrs[k]=String(v);}
  addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}
  removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(f=>f!==fn);}
  trigger(k){for(const fn of this.listeners[k]||[])fn({preventDefault(){},target:this});}
  click(){if(!this.disabled&&!this.hidden)this.trigger('click');}
  querySelectorAll(selector){return selector==='.sop2-reader-step'?this.children.filter(e=>e.className==='sop2-reader-step'):[];}
 }
 const document={createElement(tag){return new Element(tag,document);},querySelector(){return null;}};
 return {document,host:document.createElement('div')};
}
function tree(node){return[node,...node.children.flatMap(tree)];}
function byClass(host,cls){return tree(host).find(el=>el.className.split(' ').includes(cls));}
function identity(name='Lena',edit=true){return {user:name,active:true,rights:{sop:{level:edit?'edit':'read'}},edit};}
function documentRecord(){
 return {schemaVersion:1,id:'SOP-EH-060',revision:2,title:'Zollabwicklung',area:'Export',
  historyIntegrity:{ok:true,brokenAt:0},
  versions:[{version:'1.0',status:'approved',author:'anna',lastEditor:'anna',
    approvedBy:'lena',approvedAt:'2026-11-13T19:00:00.000Z',
    content:{de:{purpose:'Prüfen'},en:{purpose:'Check'},steps:[{id:'step-1',de:'Prüfen',en:'Check'}]}}]};
}
function setup({hostname='www.exporthub360.de',pathname='/index.html',flag=false,
  user=identity(),client=null,missing=false,leave=true}={}){
 const {document,host}=fakeDOM(),state={legacy:0,coverage:0,stops:0,opens:[],reader:[],editor:[],requests:[],creations:[]};
 const root={location:{hostname,pathname},document,__EXPORTHUB_SOP2_PHASE1__:flag,
   __EXPORTHUB_GET_STATE__:()=>({currentUser:user}),
   ExportHubIsoSopUi:{mount(){state.legacy++;return {legacy:true};},renderOverview(){return'old';}},
   ExportHubSopCoverageRuntime:{stop(){state.stops++;}},
   ExportHubSopCoverageDashboard:{},
   ExportHubSopFunctionRegistry:{entries:[{id:'customs.abd',sopNumber:'SOP-EH-060',area:'Export'}]},
   Sop2Client:client||{async list(){return [];},async get(id){state.requests.push(id);return documentRecord();},
    async act(action,payload){state.creations.push({action,payload});return {ok:true,item:documentRecord()};}},
   Sop2Coverage:{mount(target,options){state.coverage++;state.options=options;
     return {ready:Promise.resolve(),refresh(){state.refreshed=true;return Promise.resolve();},
       getModel(){return {summary:{total:25}};},destroy(){state.coverageDestroyed=true;}};}},
   Sop2Reader:{render(target,options){state.reader.push(options);
     const frame=document.createElement('div');frame.className='fake-reader';target.appendChild(frame);}},
   Sop2Editor:{canEdit(who){return !!(who&&who.edit);},
     mount(target,opts){state.editor.push(opts);return {isDirty(){return !leave;},
       canLeave(){return leave;},unmount(){return leave;}};}}
 };
 vm.runInNewContext(langSrc,{window:root,document});
 vm.runInNewContext(mountSrc,{window:root,document});
 return{root,host,state};
}
const testHost='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
const oldTestHost='wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net';

test('SOP2 is NEVER active on production even with flag, spoofed URL or demo route',()=>{
 for(const host of ['www.exporthub360.de','exporthub360.de','my-other-host.example.org']){
  for(const route of ['/index.html','/demo.html','/TESTVERSION.html']){
   const x=setup({hostname:host,pathname:route,flag:true});
   assert.equal(x.root.ExportHubSop2.enabled(),false);
   const result=x.root.ExportHubIsoSopUi.mount(x.host,{documents:[]});
   assert.equal(result.legacy,true);
   assert.equal(x.state.legacy,1);
   assert.equal(x.state.coverage,0);
   assert.equal(x.host.children.length,0);
  }
 }
});
test('TESTSERVICE and demo require explicit opt-in, no URL or localStorage activation',()=>{
 for(const hostname of [testHost,oldTestHost]){
  const off=setup({hostname,flag:false});
  assert.equal(off.root.ExportHubSop2.environment(),'testservice');
  assert.equal(off.root.ExportHubSop2.enabled(),false);
  assert.equal(off.root.ExportHubIsoSopUi.mount(off.host).legacy,true);
  const on=setup({hostname,flag:true});
  assert.equal(on.root.ExportHubSop2.enabled(),true);
  assert.ok(on.root.ExportHubIsoSopUi.mount(on.host));
  assert.equal(on.state.legacy,0);
  assert.equal(on.state.coverage,1);
 }
 const demo=setup({hostname:'localhost',pathname:'/demo.html',flag:true});
 assert.equal(demo.root.ExportHubSop2.environment(),'demo');
 assert.equal(demo.root.ExportHubSop2.enabled(),true);
 const noDemo=setup({hostname:'localhost',pathname:'/index.html',flag:true});
 assert.equal(noDemo.root.ExportHubSop2.enabled(),false);
});
test('legacy method remains identical for production without touching old SOP properties',()=>{
 const x=setup();
 assert.equal(x.root.ExportHubIsoSopUi.renderOverview(),'old');
 assert.equal(x.root.ExportHubIsoSopUi.__sop2Wrapped,true);
 assert.equal(x.root.ExportHubSop2.install(),true);
 assert.equal(x.root.ExportHubIsoSopUi.mount(x.host).legacy,true);
 assert.equal(x.state.stops,0);
});
test('missing SOP2 dependencies fall back to original UI without clearing its host',()=>{
 const x=setup({hostname:testHost,flag:true});
 const before=x.host.ownerDocument.createElement('p');x.host.appendChild(before);
 x.root.Sop2Editor=null;
 const result=x.root.ExportHubIsoSopUi.mount(x.host);
 assert.equal(result.legacy,true);
 assert.equal(x.state.legacy,1);
 assert.equal(x.host.children[0],before);
 assert.equal(x.state.stops,0);
});
test('enabled SOP2 mounts isolated workspace and stops legacy coverage runtime',()=>{
 const x=setup({hostname:testHost,flag:true});
 const original=x.host.ownerDocument.createElement('p');x.host.appendChild(original);
 const view=x.root.ExportHubIsoSopUi.mount(x.host);
 assert.ok(view&&typeof view.open==='function');
 assert.equal(x.state.coverage,1);
 assert.equal(x.state.stops,1);
 assert.equal(x.state.legacy,0);
 assert.ok(!tree(x.host).includes(original));
 assert.ok(byClass(x.host,'sop2-workspace'));
 assert.ok(byClass(x.host,'sop2-workspace-coverage'));
 assert.ok(byClass(x.host,'sop2-workspace-detail'));
 assert.equal(x.state.options.client,x.root.Sop2Client);
 assert.equal(typeof x.state.options.onOpen,'function');
});
test('coverage navigation opens SOP2 reader with number and step, not old handbook',async()=>{
 const x=setup({hostname:testHost,flag:true});
 const view=x.root.ExportHubIsoSopUi.mount(x.host);
 x.state.options.onOpen({number:'SOP-EH-060',stepId:'step-1'});
 for(let i=0;i<5;i++)await Promise.resolve();
 assert.deepEqual(x.state.requests,['SOP-EH-060']);
 assert.equal(x.state.reader.length,1);
 assert.equal(x.state.reader[0].doc.id,'SOP-EH-060');
 assert.equal(x.state.legacy,0);
 assert.equal(byClass(x.host,'sop2-workspace-detail').hidden,false);
 assert.equal(byClass(x.host,'sop2-workspace-coverage').hidden,true);
 assert.equal(view.back(),true);
 assert.equal(byClass(x.host,'sop2-workspace-coverage').hidden,false);
});
test('SOP2 edit shows only with edit rights, never inferred from old SOP admin UI',async()=>{
 const no=setup({hostname:testHost,flag:true,user:identity('Otto',false)});
 const view=no.root.ExportHubIsoSopUi.mount(no.host);
 await view.open('SOP-EH-060');
 assert.equal(byClass(no.host,'sop2-workspace-editor').hidden,true);
 assert.equal(no.state.editor.length,0);
 const yes=setup({hostname:testHost,flag:true,user:identity('Lena',true)});
 const edit=yes.root.ExportHubIsoSopUi.mount(yes.host);
 await edit.open('SOP-EH-060');
 byClass(yes.host,'sop2-workspace-editor').click();
 assert.equal(yes.state.editor.length,1);
 assert.equal(yes.state.editor[0].doc.id,'SOP-EH-060');
 assert.equal(yes.state.legacy,0);
});
test('unsaved SOP2 edits block back, another SOP open and destroy, not silently discarded',async()=>{
 const x=setup({hostname:testHost,flag:true,leave:false});
 const view=x.root.ExportHubIsoSopUi.mount(x.host);
 await view.open('SOP-EH-060');
 byClass(x.host,'sop2-workspace-editor').click();
 assert.equal(await view.open('SOP-EH-020'),false);
 assert.equal(x.state.requests.length,1);
 assert.equal(view.back(),false);
 assert.equal(view.destroy(),false);
 assert.equal(x.state.coverageDestroyed,undefined);
});
test('missing SOP allows only an editor to explicitly create a registered draft',async()=>{
 const calls=[];
 const client={async list(){return [];},async get(){throw Object.assign(new Error('missing'),{code:'SOP_NOT_FOUND'});},
  async act(name,payload){calls.push({name,payload});return {ok:true,item:documentRecord()};}};
 const x=setup({hostname:testHost,flag:true,client});
 const view=x.root.ExportHubIsoSopUi.mount(x.host);
 assert.equal(await view.open('SOP-EH-060'),false);
 assert.equal(byClass(x.host,'sop2-workspace-create').hidden,false);
 const inputs=tree(x.host).filter(n=>n.className==='sop2-workspace-create-input');
 assert.equal(inputs.length,3);
 inputs[0].value='Prüfablauf';inputs[1].value='Export';inputs[2].value='customs.abd';
 byClass(x.host,'sop2-workspace-create').trigger('submit');
 for(let i=0;i<5;i++)await Promise.resolve();
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'create');
 assert.equal(calls[0].payload.id,'SOP-EH-060');
 assert.equal(calls[0].payload.functionId,'customs.abd');
 assert.equal(x.state.legacy,0);
 assert.equal(x.state.editor.length,1);
});
test('reader only never offers draft creation when the SOP is missing',async()=>{
 const client={async list(){return[];},async get(){throw Object.assign(new Error('missing'),{code:'SOP_NOT_FOUND'});},
  async act(){throw Error('unexpected write');}};
 const x=setup({hostname:testHost,flag:true,user:identity('Otto',false),client});
 const view=x.root.ExportHubIsoSopUi.mount(x.host);
 assert.equal(await view.open('SOP-EH-060'),false);
 assert.equal(byClass(x.host,'sop2-workspace-create').hidden,true);
 assert.equal(x.state.editor.length,0);
});
test('new draft version is always explicit, revision-bound, and not created on view',async()=>{
 const calls=[];
 const client={async list(){return[];},async get(){return documentRecord();},
  async act(name,payload){calls.push({name,payload});const item=documentRecord();
   item.revision=3;
   item.versions.push({version:'1.1',status:'draft',author:'lena',lastEditor:'lena',content:item.versions[0].content});
   return {ok:true,item};}};
 const x=setup({hostname:testHost,flag:true,client});
 const view=x.root.ExportHubIsoSopUi.mount(x.host);
 await view.open('SOP-EH-060');
 assert.equal(calls.length,0);
 byClass(x.host,'sop2-workspace-new-version').click();
 for(let i=0;i<6;i++)await Promise.resolve();
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0],{name:'new-version',payload:{id:'SOP-EH-060',revision:2}});
 assert.equal(x.state.editor.length,1);
});
test('SOP2 integration i18n packs have same nonempty keys in all six languages',()=>{
 const x=setup();
 const packs=x.root.ExportHubSop2I18n.packs;
 assert.deepEqual(Object.keys(packs).sort(),['de','en','es','fr','it','pl']);
 const baseline=Object.keys(packs.de).sort();
 assert.ok(baseline.length>=22);
 for(const lang of Object.keys(packs)){
  assert.deepEqual(Object.keys(packs[lang]).sort(),baseline);
  assert.ok(baseline.every(k=>typeof packs[lang][k]==='string'&&packs[lang][k].trim()));
 }
});
test('SOP2 shell styles are scoped, responsive and preserve original coverage classes',()=>{
 assert.match(styleSrc,/\.sop2-workspace\{/);
 assert.match(styleSrc,/@media\(max-width:740px\)/);
 assert.match(styleSrc,/:focus-visible/);
 assert.doesNotMatch(styleSrc,/(^|\})\s*(?:body|html|:root)\s*\{/);
 assert.doesNotMatch(styleSrc,/\.rc1506-kpi\s*\{/);
});
test('injection is idempotent, includes 9 assets and loads SOP2 after legacy coverage',()=>{
 const original='<html><head><script id="exporthub-rc1506-sop-coverage-runtime" defer src="/assets/sop/rc1506-sop-coverage-runtime.js"></script><script id="exporthub-rc1502-sop-persistence" defer src="/assets/sop/rc1502-sop-persistence.js"></script></head><body></body></html>';
 const once=injectSop2(original,'TESTVERSION.html');
 assert.equal(injectSop2(once,'TESTVERSION.html'),once);
 assert.ok(once.includes('exporthub-sop2-mount'));
 const rc=once.indexOf('id="exporthub-rc1506-sop-coverage-runtime"');
 const persistence=once.indexOf('id="exporthub-rc1502-sop-persistence"');
 const mount=once.indexOf('id="exporthub-sop2-mount"');
 assert.ok(mount>persistence&&persistence>rc);
 const ids=['exporthub-sop2-i18n','exporthub-sop2-client','exporthub-sop2-reader',
  'exporthub-sop2-editor','exporthub-sop2-coverage','exporthub-sop2-mount'];
 const pos=ids.map(x=>once.indexOf('id="'+x+'"'));
 assert.ok(pos.every(x=>x>persistence));
 assert.ok(pos.every((x,i)=>i===0||x>pos[i-1]));
 assert.ok(SOP2_ASSETS.length>=9);
 assert.throws(()=>injectSop2(original.replace('</head>','<script>window.__EXPORTHUB_SOP2_PHASE1__=true;</script></head>'),'test.html'),/UNAUTHORIZED/);
});
test('build helper copies all SOP2 assets and injects every environment without enabling it',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'eh-sop2-build-'));
 try{
  const root=path.join(temp,'root'),out=path.join(temp,'dist');
  fs.mkdirSync(root,{recursive:true});fs.mkdirSync(out,{recursive:true});
  for(const rel of SOP2_ASSETS){
   const target=path.join(root,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,rel);
  }
  const page='<html><head><script id="exporthub-rc1506-sop-coverage-runtime" defer src="/assets/sop/rc1506-sop-coverage-runtime.js"></script><script id="exporthub-rc1502-sop-persistence" defer src="/assets/sop/rc1502-sop-persistence.js"></script></head><body></body></html>';
  for(const file of ['index.html','TESTVERSION.html','demo.html'])fs.writeFileSync(path.join(out,file),page);
  const manifest=integrateSop2(root,out);
  assert.equal(manifest.apiEnabled,false);
  assert.equal(manifest.productionActivation,false);
  for(const rel of SOP2_ASSETS)assert.ok(fs.existsSync(path.join(out,rel)));
  for(const file of manifest.pages){
   const html=fs.readFileSync(path.join(out,file),'utf8');
   assert.ok(html.includes('exporthub-sop2-mount'));
   assert.doesNotMatch(html,/__EXPORTHUB_SOP2_PHASE1__\s*=\s*true/);
  }
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('RC1112 build calls SOP2 only after old coverage and before fingerprinting',()=>{
 const a=buildSrc.indexOf("import {integrateSop2} from '../sop2/integrate.mjs'");
 const b=buildSrc.indexOf('integrateCoverageAdmin(ROOT,OUT);');
 const c=buildSrc.indexOf('integrateSop2(ROOT,OUT);');
 const d=buildSrc.indexOf('fingerprintAssets({root:ROOT,out:OUT});');
 assert.ok(a>0&&c>b&&d>c);
 assert.doesNotMatch(buildSrc,/EXPORTHUB_SOP2_ENABLED\s*=\s*['"]enabled/);
});
test('all exact SOP2 static assets are routed with no-store; API gate and routes remain separate',()=>{
 const paths=SOP2_ASSETS.map(p=>'/'+p);
 for(const path of paths){
  const matches=routes.routes.filter(r=>r.route===path);
  assert.equal(matches.length,1);
  assert.match(matches[0].headers['Cache-Control'],/no-store/);
  assert.equal(matches[0].headers['X-Content-Type-Options'],'nosniff');
 }
 assert.ok(routes.routes.some(r=>r.route==='/api/*'));
 assert.equal(routes.navigationFallback.rewrite,'/index.html');
});
test('new mount code contains no API activation or legacy data import',()=>{
 assert.doesNotMatch(mountSrc,/import-legacy|localStorage|innerHTML/);
 assert.doesNotMatch(mountSrc,/EXPORTHUB_SOP2_ENABLED/);
 assert.match(mountSrc,/__EXPORTHUB_SOP2_PHASE1__===true/);
 assert.match(mountSrc,/return controller\|\|base\.mount\(target,options\)/);
});

test('SOP2 injection requires both RC1506 coverage and RC1502 persistence wrappers',()=>{
 const base='<html><head><script id="exporthub-rc1506-sop-coverage-runtime" defer src="/assets/sop/rc1506-sop-coverage-runtime.js"></script></head><body></body></html>';
 assert.throws(()=>injectSop2(base,'test.html'),/PERSISTENCE_ANCHOR_MISSING/);
 const reversed='<html><head><script id="exporthub-rc1502-sop-persistence" defer src="/assets/sop/rc1502-sop-persistence.js"></script><script id="exporthub-rc1506-sop-coverage-runtime" defer src="/assets/sop/rc1506-sop-coverage-runtime.js"></script></head><body></body></html>';
 assert.throws(()=>injectSop2(reversed,'test.html'),/SCRIPT_ORDER/);
});
