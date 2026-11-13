import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/sop2/sop2-editor.js','utf8');
const css=fs.readFileSync('assets/sop2/sop2-editor.css','utf8');
function fakeDOM(){
  class E{
    constructor(tag,doc){this.tagName=tag.toLowerCase();this.ownerDocument=doc;this.children=[];
      this.parentNode=null;this.className='';this.attrs={};this.listeners={};this._text='';
      this.value='';this.hidden=false;this.disabled=false;this.type='';}
    set textContent(v){this._text=String(v);this.children=[];}
    get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
    appendChild(child){child.parentNode=this;this.children.push(child);return child;}
    removeChild(child){const n=this.children.indexOf(child);if(n>=0)this.children.splice(n,1);child.parentNode=null;return child;}
    replaceChildren(){this._text='';this.children=[];}
    get firstChild(){return this.children[0]||null;}
    remove(){if(this.parentNode)this.parentNode.removeChild(this);}
    setAttribute(k,v){this.attrs[k]=String(v);}
    getAttribute(k){return Object.prototype.hasOwnProperty.call(this.attrs,k)?this.attrs[k]:null;}
    addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}
    dispatch(k){for(const fn of this.listeners[k]||[])fn({target:this});}
    click(){if(!this.disabled&&!this.hidden)this.dispatch('click');}
    input(v){this.value=String(v);this.dispatch('input');}
  }
  const document={createElement(tag){return new E(tag,document);}};
  return{document,host:document.createElement('div')};
}
function all(node){return [node,...node.children.flatMap(all)];}
function nodes(host,c){return all(host).filter(x=>x.className.split(/\s+/).includes(c));}
function first(host,c){const n=nodes(host,c)[0];assert.ok(n,'Missing DOM '+c);return n;}
function user(name='Anna'){return {user:name,active:true,rights:{sop:{level:'edit'}}};}
function reader(){return {user:'Rita',active:true,rights:{sop:{level:'view'}}};}
function content(enPurpose='Verify loading'){
 return {
  de:{purpose:'Laden prüfen',scope:'Warenausgang',responsibilities:['Lager'],
      prerequisites:['Ladeliste'],checks:['Ware prüfen'],deviations:['Melden'],records:['CMR']},
  en:{purpose:enPurpose,scope:'Dispatch',responsibilities:['Warehouse'],
      prerequisites:['Loading list'],checks:['Check goods'],deviations:['Report'],records:['CMR']},
  steps:[{id:'load',de:'Ladeeinheit prüfen',en:'Inspect unit',screenshot:'assets/load.png',tourTarget:'#load-area'}]
 };
}
function doc(status='draft',revision=2,author='anna',lastEditor='anna',enPurpose){
 return {schemaVersion:1,id:'SOP-EH-020',title:'Laden dokumentieren',area:'Export',revision,
  historyIntegrity:{ok:true,brokenAt:0},
  versions:[{version:'1.0',status,author,lastEditor,content:content(enPurpose)}]};
}
function clone(x){return JSON.parse(JSON.stringify(x));}
function setup({sop=doc(),who=user(),server=null,act=null,confirm=null}={}){
 const dom=fakeDOM(),listeners={},calls=[],fetches=[];
 const root={
  document:dom.document,
  addEventListener(name,fn){listeners[name]=fn;},
  removeEventListener(name){delete listeners[name];},
  confirm:confirm||(()=>true)
 };
 const client={
  async act(action,payload){
   calls.push({action,payload:clone(payload)});
   if(act)return act(action,payload,calls);
   const result=clone(sop);
   result.revision=payload.revision+1;
   if(action==='update'){
     result.title=payload.title;
     result.versions[0].content=clone(payload.content);
     result.versions[0].lastEditor=who.user.toLowerCase();
   }
   if(action==='submit')result.versions[0].status='review';
   if(action==='approve')result.versions[0].status='approved';
   if(action==='reject')result.versions[0].status='draft';
   result.historyIntegrity={ok:true,brokenAt:0};
   sop=result;
   return {ok:true,item:result};
  },
  async get(id){fetches.push(id);return clone(server||sop);}
 };
 vm.runInNewContext(source,{window:root,document:dom.document});
 const editor=root.Sop2Editor.mount(dom.host,{doc:clone(sop),version:'1.0',user:who,client});
 return {dom,root,editor,calls,fetches,listeners,client};
}
async function settle(){for(let n=0;n<9;n++)await Promise.resolve();}

test('mount renders a safe paired, editable German and English form',()=>{
 const x=setup();
 assert.equal(nodes(x.dom.host,'sop2-editor-language-column').length,2);
 assert.equal(nodes(x.dom.host,'sop2-editor-section-label').length,14);
 assert.equal(nodes(x.dom.host,'sop2-editor-step-lang').length,2);
 assert.equal(x.editor.snapshot().content.de.purpose,'Laden prüfen');
 assert.equal(x.editor.snapshot().content.en.purpose,'Verify loading');
 assert.equal(x.editor.isDirty(),false);
 assert.equal(x.calls.length,0);
});
test('adding a step always creates one bilingual pair with a stable unique id',()=>{
 const x=setup();
 first(x.dom.host,'sop2-editor-add').click();
 const steps=x.editor.snapshot().content.steps;
 assert.equal(steps.length,2);assert.equal(steps[1].de,'');assert.equal(steps[1].en,'');
 assert.ok(/^step-\d+$/.test(steps[1].id));
 assert.equal(nodes(x.dom.host,'sop2-editor-step-lang').length,4);
 assert.equal(x.editor.isDirty(),true);
 assert.equal(x.calls.length,0);
});
test('removing a step drops both language entries, preserving remaining step metadata',()=>{
 const x=setup();first(x.dom.host,'sop2-editor-add').click();
 const remove=nodes(x.dom.host,'sop2-editor-remove-step')[0];remove.click();
 assert.equal(x.editor.snapshot().content.steps.length,1);
 assert.equal(x.editor.snapshot().content.steps[0].de,'');
 assert.equal(nodes(x.dom.host,'sop2-editor-step-lang').length,2);
});
test('adding and editing a step persists DE and EN in one update with current revision',async()=>{
 const x=setup();
 first(x.dom.host,'sop2-editor-add').click();
 let lang=nodes(x.dom.host,'sop2-editor-step-lang');
 const newRow=lang.slice(-2);
 const newInputs=newRow.map(n=>n.children.find(x=>x.tagName==='textarea'));
 newInputs[0].input('Ware scannen');
 newInputs[1].input('Scan goods');
 assert.equal(x.editor.isDirty(),true);
 assert.equal((await x.editor.save()),true);
 assert.equal(x.calls.length,1);
 assert.equal(x.calls[0].action,'update');
 assert.equal(x.calls[0].payload.revision,2);
 assert.equal(x.calls[0].payload.version,'1.0');
 assert.equal(x.calls[0].payload.content.steps.length,2);
 assert.equal(x.calls[0].payload.content.steps[1].de,'Ware scannen');
 assert.equal(x.calls[0].payload.content.steps[1].en,'Scan goods');
 assert.equal(x.editor.getDocument().revision,3);
 assert.equal(x.editor.isDirty(),false);
});
test('author and administrator cannot bypass four-eyes approval of their own SOP',()=>{
 const own=setup({sop:doc('review')});
 assert.equal(nodes(own.dom.host,'sop2-editor-approve')[0].hidden,true);
 assert.equal(typeof own.editor.approve,'function');
 const admin={user:'ANNA',role:'Administrator',active:true,rights:{}};
 const x=setup({sop:doc('review'),who:admin});
 assert.equal(nodes(x.dom.host,'sop2-editor-approve')[0].hidden,true);
 assert.equal(x.root.Sop2Editor.canApprove(admin,doc('review').versions[0]),false);
});
test('independent SOP editor may approve submitted review, but ordinary reader cannot',async()=>{
 const reviewer=setup({sop:doc('review'),who:user('Lena')});
 const ok=first(reviewer.dom.host,'sop2-editor-approve');
 assert.equal(ok.hidden,false);assert.equal(ok.disabled,false);
 assert.equal(await reviewer.editor.approve(),true);
 assert.equal(reviewer.calls[0].action,'approve');
 assert.equal(reviewer.calls[0].payload.revision,2);
 assert.equal(reviewer.editor.getDocument().versions[0].status,'approved');
 const read=setup({sop:doc('review'),who:reader()});
 assert.equal(first(read.dom.host,'sop2-editor-approve').hidden,true);
 assert.equal(read.calls.length,0);
});
test('only the author sees submit, and unsaved data must be saved first',async()=>{
 const x=setup();
 assert.equal(first(x.dom.host,'sop2-editor-submit').hidden,false);
 first(x.dom.host,'sop2-editor-title').input('Neue Überschrift');
 assert.equal(first(x.dom.host,'sop2-editor-submit').disabled,true);
 assert.equal(await x.editor.submit(),false);
 assert.equal(x.calls.length,0);
 assert.ok(x.dom.host.textContent.includes('Bitte zuerst speichern'));
 const other=setup({who:user('Lena')});
 assert.equal(first(other.dom.host,'sop2-editor-submit').hidden,true);
 assert.equal(await other.editor.submit(),false);
});
test('submit with incomplete English displays server 422 errors without losing the form',async()=>{
 const invalid=doc('draft',2,'anna','anna','');
 const x=setup({sop:invalid,act:async()=>{
   throw Object.assign(new Error('CONTENT_INCOMPLETE'),{status:422,code:'CONTENT_INCOMPLETE',errors:[{lang:'en',part:'purpose',code:'EMPTY_PART'}]});
 }});
 assert.equal(await x.editor.submit(),false);
 assert.equal(x.calls[0].action,'submit');
 assert.ok(x.dom.host.textContent.includes('Englisch · Zweck'));
 assert.equal(x.editor.snapshot().content.en.purpose,'');
 assert.equal(x.editor.getDocument().revision,2);
});
test('rejection requires reason of at least 8 characters and never submits a blank reason',async()=>{
 const x=setup({sop:doc('review'),who:user('Lena')});
 assert.equal(await x.editor.reject('bad'),false);
 assert.equal(x.calls.length,0);
 assert.ok(x.dom.host.textContent.includes('mindestens 8 Zeichen'));
 assert.equal(await x.editor.reject('Schritt unvollständig'),true);
 assert.equal(x.calls[0].action,'reject');
 assert.equal(x.calls[0].payload.reason,'Schritt unvollständig');
});
test('409 conflict fetches current server doc but preserves unsaved editor entries and does not auto-overwrite',async()=>{
 const fresh=doc('draft',7,'anna','anna');
 const x=setup({server:fresh,act:async()=>{
   throw Object.assign(new Error('Conflict'),{status:409,code:'REVISION_CONFLICT'});
 }});
 const input=first(x.dom.host,'sop2-editor-title');
 input.input('Mein nicht gespeicherter Titel');
 assert.equal(await x.editor.save(),false);
 assert.equal(x.editor.hasConflict(),true);
 assert.deepEqual(x.fetches,['SOP-EH-020']);
 assert.equal(first(x.dom.host,'sop2-editor-title').value,'Mein nicht gespeicherter Titel');
 assert.equal(x.editor.getDocument().revision,2);
 assert.equal(x.calls.length,1);
 assert.equal(first(x.dom.host,'sop2-editor-save').disabled,true);
 assert.ok(x.dom.host.textContent.includes('Serverrevision: 7'));
});
test('conflict can be resolved by explicitly discarding local changes',async()=>{
 const fresh=doc('draft',7,'anna','anna');fresh.title='Neuer Stand';
 const x=setup({server:fresh,act:async()=>{
   throw Object.assign(new Error('Conflict'),{status:409,code:'REVISION_CONFLICT'});
 }});
 first(x.dom.host,'sop2-editor-title').input('Mein alter Titel');
 assert.equal(await x.editor.save(),false);
 assert.equal(x.editor.hasConflict(),true);
 assert.equal(x.editor.resolveServer(),true);
 assert.equal(x.editor.hasConflict(),false);
 assert.equal(first(x.dom.host,'sop2-editor-title').value,'Neuer Stand');
 assert.equal(x.editor.getDocument().revision,7);
 assert.equal(x.editor.isDirty(),false);
});
test('overwriting a newer version is only possible after separate explicit confirmation',async()=>{
 let accepts=false;const fresh=doc('draft',7,'anna','anna');
 const x=setup({server:fresh,confirm:()=>accepts,act:async()=>{
   throw Object.assign(new Error('Conflict'),{status:409,code:'REVISION_CONFLICT'});
 }});
 first(x.dom.host,'sop2-editor-title').input('Meine Version');
 await x.editor.save();
 const keep=first(x.dom.host,'sop2-editor-local');
 assert.equal(keep.hidden,false);
 keep.click();
 assert.equal(x.editor.hasConflict(),true);
 accepts=true;keep.click();
 assert.equal(x.editor.hasConflict(),false);
 assert.equal(x.editor.getDocument().revision,7);
 assert.equal(x.editor.snapshot().title,'Meine Version');
 assert.equal(x.editor.isDirty(),true);
});
test('when a different user submitted the SOP during conflict, forced overwrite stays disabled',async()=>{
 const current=doc('review',7,'anna','anna');
 const x=setup({server:current,act:async()=>{
   throw Object.assign(new Error('Conflict'),{status:409,code:'REVISION_CONFLICT'});
 }});
 first(x.dom.host,'sop2-editor-title').input('Meine Version');
 await x.editor.save();
 assert.equal(x.editor.hasConflict(),true);
 assert.equal(first(x.dom.host,'sop2-editor-local').disabled,true);
 assert.equal(first(x.dom.host,'sop2-editor-save').disabled,true);
});
test('dirty drafts block close without affirmative user confirmation; beforeunload guard is active',()=>{
 let accepted=false;const x=setup({confirm:()=>accepted});
 const entry=first(x.dom.host,'sop2-editor-title');
 entry.input('Geänderter Titel');
 assert.equal(x.editor.isDirty(),true);
 assert.equal(x.editor.canLeave(),false);
 let prevented=false,returnValue=null;
 x.listeners.beforeunload({preventDefault(){prevented=true;},set returnValue(value){returnValue=value;}});
 assert.equal(prevented,true);assert.equal(returnValue,'');
 assert.equal(x.editor.unmount(),false);
 accepted=true;
 assert.equal(x.editor.unmount(),true);
 assert.equal(x.listeners.beforeunload,undefined);
 assert.equal(x.dom.host.children.length,0);
});
test('integrity failure and read-only account make all editing operations unavailable',async()=>{
 const broken=doc();broken.historyIntegrity={ok:false,brokenAt:2};
 const x=setup({sop:broken});
 assert.ok(x.dom.host.textContent.includes('Dokumentintegrität nicht bestätigt'));
 assert.equal(first(x.dom.host,'sop2-editor-title').disabled,true);
 assert.equal(first(x.dom.host,'sop2-editor-save').hidden,true);
 assert.equal(await x.editor.save(),false);
 const read=setup({who:reader()});
 assert.equal(first(read.dom.host,'sop2-editor-title').disabled,true);
 assert.equal(await read.editor.submit(),false);
 assert.equal(read.calls.length,0);
});
test('no HTML execution paths: hostile content is always rendered as text',()=>{
 const malicious='<img src=x onerror=alert(1)><script>alert(1)</script>';
 const d=doc();d.title=malicious;d.versions[0].content.de.scope=malicious;
 const x=setup({sop:d});
 assert.equal(first(x.dom.host,'sop2-editor-title').value,malicious);
 assert.equal(all(x.dom.host).some(n=>n.tagName==='img'||n.tagName==='script'),false);
 assert.equal(all(x.dom.host).some(n=>n.attrs.onmouseover||n.attrs.onclick),false);
});
test('CSS is scope-limited, responsive, light/dark and keyboard accessible',()=>{
 assert.match(css,/\.sop2-editor\s*\{/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(prefers-color-scheme:dark\)/);
 assert.match(css,/:focus-visible/);
 assert.doesNotMatch(css,/(^|\})\s*(?:html|body|:root)\s*\{/);
});
