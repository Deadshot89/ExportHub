import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const readerJs=fs.readFileSync('assets/sop2/sop2-reader.js','utf8');
const clientJs=fs.readFileSync('assets/sop2/sop2-client.js','utf8');
const css=fs.readFileSync('assets/sop2/sop2-reader.css','utf8');

function fakeDom(){
  const created=[];
  class Element {
    constructor(tagName,document){
      this.tagName=tagName.toLowerCase();this.ownerDocument=document;this.children=[];
      this.parentNode=null;this.attrs={};this.handlers={};this.className='';this.type='';this._text='';
      created.push(this);
    }
    get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
    set textContent(value){this._text=String(value);this.children=[];}
    get firstChild(){return this.children[0]||null;}
    setAttribute(name,value){this.attrs[name]=String(value);}
    getAttribute(name){return this.attrs[name]||null;}
    appendChild(child){this.children.push(child);child.parentNode=this;return child;}
    removeChild(child){const i=this.children.indexOf(child);if(i>=0)this.children.splice(i,1);child.parentNode=null;return child;}
    replaceChildren(...children){this._text='';this.children=[];children.forEach(c=>this.appendChild(c));}
    addEventListener(name,handler){this.handlers[name]=handler;}
    click(){if(this.handlers.click)this.handlers.click();}
  }
  const document={createElement(tag){return new Element(tag,document);}};
  return {document,created,host:document.createElement('div')};
}
function loadReader(){
  const dom=fakeDom(),window={document:dom.document};
  vm.runInNewContext(readerJs,{window,document:dom.document});
  return {dom,reader:window.Sop2Reader};
}
function doc(){
  return {id:'SOP-EH-020',title:'Loading procedures',area:'Export',
    historyIntegrity:{ok:true,brokenAt:0},versions:[
      {version:'1.0',status:'approved',author:'anna',
        content:{de:{purpose:'Laden',scope:'Versand',responsibilities:['Lager'],prerequisites:['Paletten'],
          checks:['Artikel prüfen'],deviations:['Melden'],records:['Liste']},
        en:{purpose:'Loading',scope:'Dispatch',responsibilities:['Warehouse'],prerequisites:['Pallets'],
          checks:['Check goods'],deviations:['Report'],records:['Checklist']},
        steps:[{id:'load',de:'Waren prüfen',en:'Check items',screenshot:'sop/load.png',tourTarget:'#goods'}]}}
    ]};
}
function all(root){return [root,...root.children.flatMap(all)];}
function classNodes(host,c){return all(host).filter(n=>String(n.className||'').split(' ').includes(c));}
function tagNodes(host,t){return all(host).filter(n=>n.tagName===t);}
function loadClient(fakeFetch,session){
 const win={fetch:fakeFetch,sessionStorage:{getItem(){return session===undefined?null:JSON.stringify(session);}}};
 vm.runInNewContext(clientJs,{window:win});
 return win.Sop2Client;
}
function reply(body,status=200,headers='application/json; charset=utf-8'){
 return {ok:status>=200&&status<300,status,redirected:false,
   headers:{get(name){return name.toLowerCase()==='content-type'?headers:'';}},
   async json(){return body;}};
}

test('language selection follows German/English with fallback for other UI languages',()=>{
 const {reader}=loadReader();
 for(const val of ['de','de-DE','de_AT','DE'])assert.equal(reader.pickLanguage(val),'de');
 for(const val of ['en','en-GB','pl','es','it','fr','',null,undefined])assert.equal(reader.pickLanguage(val),'en');
});
test('reader creates no active HTML or img even when stored content contains tags and handlers',()=>{
 const {reader,dom}=loadReader();const model=doc();
 const injection='<img src=x onerror="alert(1)"><script>alert(2)</script>';
 model.title=injection;model.versions[0].content.de.purpose=injection;
 model.versions[0].content.de.checks=[injection];
 model.versions[0].content.steps[0].de=injection;
 model.versions[0].content.steps[0].screenshot='javascript:alert(1)';
 reader.render(dom.host,{doc:model,lang:'de'});
 assert.ok(dom.host.textContent.includes(injection));
 assert.equal(tagNodes(dom.host,'img').length,0);
 assert.equal(tagNodes(dom.host,'script').length,0);
 assert.equal(tagNodes(dom.host,'iframe').length,0);
 assert.equal(all(dom.host).some(n=>n.attrs.onerror||n.attrs.src||n.attrs.href),false);
});
test('reader shows German and English content with accessible language buttons',()=>{
 const {reader,dom}=loadReader();reader.render(dom.host,{doc:doc(),lang:'de'});
 assert.ok(dom.host.textContent.includes('Waren prüfen'));
 assert.ok(dom.host.textContent.includes('Gültige freigegebene Version'));
 assert.equal(classNodes(dom.host,'sop2-reader-language-button').length,2);
 const buttons=classNodes(dom.host,'sop2-reader-language-button');
 assert.equal(buttons[0].getAttribute('aria-pressed'),'true');
 buttons[1].click();
 assert.ok(dom.host.textContent.includes('Check items'));
 assert.ok(dom.host.textContent.includes('Current approved version'));
 assert.equal(classNodes(dom.host,'sop2-reader-language-button')[1].getAttribute('aria-pressed'),'true');
});
test('default non-DE language displays English without pretending a translation exists',()=>{
 const {reader,dom}=loadReader();reader.render(dom.host,{doc:doc(),lang:'pl-PL'});
 assert.ok(dom.host.textContent.includes('Loading'));
 assert.equal(dom.host.textContent.includes('Waren prüfen'),false);
 assert.equal(classNodes(dom.host,'sop2-reader')[0].getAttribute('lang'),'en');
});
test('only the one active approved version receives the valid label',()=>{
 const {reader,dom}=loadReader();const model=doc();
 model.versions.unshift({...structuredClone(model.versions[0]),version:'0.1',status:'archived'});
 reader.render(dom.host,{doc:model,version:'0.1',lang:'de'});
 assert.ok(dom.host.textContent.includes('Historische Version'));
 assert.equal(dom.host.textContent.includes('Gültige freigegebene Version'),false);
 reader.render(dom.host,{doc:model,version:'1.0',lang:'de'});
 assert.ok(dom.host.textContent.includes('Gültige freigegebene Version'));
 model.versions[1].status='review';
 reader.render(dom.host,{doc:model,version:'1.0',lang:'de'});
 assert.ok(dom.host.textContent.includes('Nicht freigegeben'));
});
test('tampered or unverified document is never called valid, even with approved status',()=>{
 const {reader,dom}=loadReader();const model=doc();model.historyIntegrity={ok:false,brokenAt:2};
 reader.render(dom.host,{doc:model,lang:'de'});
 assert.ok(dom.host.textContent.includes('Integritätsprüfung fehlgeschlagen'));
 assert.equal(dom.host.textContent.includes('Gültige freigegebene Version'),false);
 assert.equal(classNodes(dom.host,'sop2-reader-integrity-warning').length,1);
 assert.equal(classNodes(dom.host,'sop2-reader-integrity-warning')[0].getAttribute('role'),'alert');
 delete model.historyIntegrity;
 reader.render(dom.host,{doc:model,lang:'en'});
 assert.ok(dom.host.textContent.includes('Document integrity not confirmed'));
 assert.equal(dom.host.textContent.includes('Current approved version'),false);
});
test('reader does not modify source objects and handles missing content gracefully',()=>{
 const {reader,dom}=loadReader();const model=doc(),before=JSON.stringify(model);
 reader.render(dom.host,{doc:model,lang:'de'});
 assert.equal(JSON.stringify(model),before);
 reader.render(dom.host,{doc:{id:'SOP-EH-001',versions:[]},lang:'de'});
 assert.ok(dom.host.textContent.includes('Keine SOP ausgewählt'));
 reader.render(dom.host,{doc:doc(),version:'9.9',lang:'de'});
 assert.ok(dom.host.textContent.includes('Keine SOP ausgewählt'));
});
test('reader requires a real DOM host and uses semantic structured sections',()=>{
 const {reader,dom}=loadReader();
 assert.throws(()=>reader.render(null,{doc:doc()}),/SOP2_READER_HOST_REQUIRED/);
 reader.render(dom.host,{doc:doc(),lang:'en'});
 assert.equal(tagNodes(dom.host,'article').length,1);
 assert.equal(tagNodes(dom.host,'header').length,1);
 assert.equal(tagNodes(dom.host,'section').length,8);
 assert.equal(tagNodes(dom.host,'ol').length,1);
 assert.equal(tagNodes(dom.host,'li').length>=5,true);
});
test('reader CSS is scoped, responsive and includes visible focus/dark mode',()=>{
 assert.match(css,/\.sop2-reader\s*\{/);
 assert.match(css,/@media \(max-width:700px\)/);
 assert.match(css,/@media \(prefers-color-scheme:dark\)/);
 assert.match(css,/:focus-visible/);
 assert.doesNotMatch(css,/(^|\})\s*(html|body|\*|:root)\s*\{/);
});
test('SOP client never performs requests on import',()=>{
 let requests=0;const client=loadClient(async()=>{requests++;return reply({ok:true,items:[]});});
 assert.equal(typeof client.list,'function');
 assert.equal(typeof client.get,'function');
 assert.equal(typeof client.act,'function');
 assert.equal(requests,0);
});
test('client submits no-cache same-origin request with canonical session token and proper action',async()=>{
 const requests=[];
 const client=loadClient(async(url,opts)=>{requests.push({url,opts});return reply({ok:true,items:[{id:'SOP-EH-020'}]});},{token:'signed-test-session'});
 const items=await client.list();
 assert.equal(items.length,1);
 assert.equal(requests.length,1);
 const {url,opts}=requests[0];
 assert.equal(url,'/api/sop-documents');
 assert.equal(opts.method,'POST');
 assert.equal(opts.credentials,'same-origin');
 assert.equal(opts.cache,'no-store');
 assert.equal(opts.redirect,'manual');
 assert.equal(opts.headers['X-ExportHUB-Token'],'signed-test-session');
 assert.equal(opts.headers.Authorization,'Bearer signed-test-session');
 assert.equal(JSON.parse(opts.body).action,'list');
});
test('client get validates identifier before sending request',async()=>{
 let requests=0;const client=loadClient(async()=>{requests++;return reply({ok:true,item:{id:'SOP-EH-020'}});});
 await assert.rejects(client.get('../foo'),e=>e.code==='INVALID_SOP_ID'&&e.status===400);
 assert.equal(requests,0);
 assert.equal((await client.get('SOP-EH-020')).id,'SOP-EH-020');
 assert.equal(requests,1);
});
test('client cannot overwrite the real action through malicious payload',async()=>{
 let recorded;const client=loadClient(async(_,opts)=>{recorded=JSON.parse(opts.body);return reply({ok:true});});
 await client.act('submit',{id:'SOP-EH-001',action:'approve',approvedBy:'spoof'});
 assert.equal(recorded.action,'submit');
 assert.equal(recorded.id,'SOP-EH-001');
});
test('client propagates API error codes, revision conflict and structured errors',async()=>{
 const client=loadClient(async()=>reply({ok:false,code:'CONTENT_INCOMPLETE',errors:[{lang:'en',part:'purpose'}]},422));
 await assert.rejects(client.act('submit',{id:'SOP-EH-020'}),e=>e.code==='CONTENT_INCOMPLETE'&&e.status===422&&e.errors[0].lang==='en');
});
test('client never accepts redirects, HTML responses or disabled API as success',async()=>{
 const redir=loadClient(async()=>({...reply({ok:true}),redirected:true}));
 await assert.rejects(redir.list(),e=>e.code==='UNEXPECTED_REDIRECT');
 const html=loadClient(async()=>reply({ok:true},200,'text/html'));
 await assert.rejects(html.list(),e=>e.code==='INVALID_API_RESPONSE');
 const disabled=loadClient(async()=>reply({ok:false,code:'SOP2_DISABLED'},404));
 await assert.rejects(disabled.list(),e=>e.code==='SOP2_DISABLED'&&e.status===404);
});
test('client does not leak network error messages or accept malformed success',async()=>{
 const broken=loadClient(async()=>{throw Error('secret bearer credential');});
 await assert.rejects(broken.list(),e=>e.code==='NETWORK_UNAVAILABLE'&&!e.message.includes('credential'));
 const bad=loadClient(async()=>reply({ok:true,items:'not an array'}));
 await assert.rejects(bad.list(),e=>e.code==='INVALID_API_RESPONSE');
});
