import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {createDraft,updateDraft,submit,newVersion}=require('../api/shared/sop-service.js');
const {verifyChain,appendEvent}=require('../api/shared/hash-chain.js');
const NOW='2026-11-13T12:00:00.000Z';
const user=(name='Anna')=>({user:name,role:'Benutzer',rights:{sop:{level:'edit'}}});
const reader=(name='Egon')=>({user:name,role:'Benutzer',rights:{sop:{level:'view'}}});
const fields={id:'SOP-EH-020',title:'Shipment check',area:'Export',functionId:'shipping'};
const content=()=>({de:{purpose:'Zweck',scope:'Export',responsibilities:['Versand'],checks:['Test'],records:['Prüfliste']},en:{purpose:'Purpose',scope:'Export',responsibilities:['Despatch'],checks:['Check'],records:['Checklist']},steps:[{id:'step-1',de:'Laden',en:'Load'}]});
const draft=(c=content())=>createDraft(null,{...fields,content:c},user(),NOW);
const submitted=()=>submit(draft(),{revision:1,version:'1.0'},user(),NOW);
const approved=()=>{const d=submitted();d.versions[0].status='approved';d.versions[0].approvedBy='lena';d.versions[0].approvedAt=NOW;d.revision++;const {events,...state}=d;const stateSha256=createHash('sha256').update(JSON.stringify(state)).digest('hex');d.events.push(appendEvent(d.events,{action:'APPROVED',actor:'lena',at:NOW,data:{version:'1.0',stateSha256}}));return d;};
function err(code,status){return e=>e.code===code&&e.status===status;}

test('create sets draft 1.0, author from session, hash chain and immutable input',()=>{
 const input={...fields,content:content(),author:'Mallory',approvedBy:'Mallory',status:'approved'};
 const out=createDraft(null,input,user(),NOW);
 assert.equal(out.versions[0].version,'1.0');assert.equal(out.versions[0].status,'draft');
 assert.equal(out.versions[0].author,'anna');assert.equal(out.versions[0].lastEditor,'anna');
 assert.equal(out.versions[0].approvedBy,undefined);assert.equal(out.events[0].action,'CREATED');
 assert.equal(out.revision,1);assert.equal(verifyChain(out.events).ok,true);
 input.content.de.purpose='hacked';assert.equal(out.versions[0].content.de.purpose,'Zweck');
});
test('create with missing content is saved as draft only',()=>{
 const d=createDraft(null,fields,user(),NOW);
 assert.equal(d.versions[0].status,'draft');assert.deepEqual(d.versions[0].content,{de:{},en:{},steps:[]});
 assert.throws(()=>submit(d,{revision:1,version:'1.0'},user(),NOW),err('CONTENT_INCOMPLETE',422));
});
test('cannot create existing doc or non-SOP id',()=>{
 assert.throws(()=>createDraft(draft(),fields,user(),NOW),err('SOP_EXISTS',409));
 assert.throws(()=>createDraft(null,{...fields,id:'../x'},user(),NOW),err('INVALID_SOP_ID',400));
});
test('cannot create or update with view-only, disabled or missing users',()=>{
 assert.throws(()=>createDraft(null,fields,reader(),NOW),err('SOP_EDIT_FORBIDDEN',403));
 assert.throws(()=>createDraft(null,fields,{...user(),disabled:true},NOW),err('SOP_EDIT_FORBIDDEN',403));
 assert.throws(()=>createDraft(null,fields,{},NOW),err('SOP_EDIT_FORBIDDEN',403));
});
test('update draft persists title/content, changes lastEditor and preserves author',()=>{
 const original=draft();const next=updateDraft(original,{revision:1,version:'1.0',title:'New title',content:content()},user('Lena'),NOW);
 assert.equal(next.revision,2);assert.equal(next.title,'New title');assert.equal(next.versions[0].lastEditor,'lena');
 assert.equal(next.versions[0].author,'anna');assert.equal(original.title,'Shipment check');
 assert.equal(original.versions[0].lastEditor,'anna');assert.equal(next.events[1].action,'UPDATED');
 assert.equal(next.events[1].data.version,'1.0');assert.equal(verifyChain(next.events).ok,true);
});
test('update stale revision fails 409 and never mutates source',()=>{
 const original=draft();assert.throws(()=>updateDraft(original,{revision:0,version:'1.0',title:'Stale'},user(),NOW),err('REVISION_CONFLICT',409));
 assert.equal(original.revision,1);
});
test('update unknown version and missing changes are rejected',()=>{
 const d=draft();assert.throws(()=>updateDraft(d,{revision:1,version:'9.9',title:'Wrong'},user(),NOW),err('VERSION_NOT_FOUND',404));
 assert.throws(()=>updateDraft(d,{revision:1,version:'1.0'},user(),NOW),err('NO_CHANGES',400));
});
test('submit fails on blank English with structured errors and keeps source draft',()=>{
 const c=content();c.en.purpose='';const d=draft(c);
 assert.throws(()=>submit(d,{revision:1,version:'1.0'},user(),NOW),e=>e.code==='CONTENT_INCOMPLETE'&&e.status===422&&e.errors.some(x=>x.lang==='en'&&x.part==='purpose'));
 assert.equal(d.versions[0].status,'draft');assert.equal(d.events.length,1);
});
test('submit complete DE/EN content sets review and session author',()=>{
 const d=draft();const next=submit(d,{revision:1,version:'1.0',submittedBy:'Mallory'},user(),NOW);
 assert.equal(next.versions[0].status,'review');assert.equal(next.versions[0].submittedBy,'anna');
 assert.equal(next.events[1].action,'SUBMITTED');assert.equal(next.revision,2);assert.equal(d.versions[0].status,'draft');
});
test('only the author may submit, not an unrelated editor or reader',()=>{
 const d=draft();assert.throws(()=>submit(d,{revision:1,version:'1.0'},user('Lena'),NOW),err('ONLY_AUTHOR_MAY_SUBMIT',403));
 assert.throws(()=>submit(d,{revision:1,version:'1.0'},reader(),NOW),err('SOP_EDIT_FORBIDDEN',403));
});
test('submitted document is immutable through updateDraft and submit',()=>{
 const d=submitted();assert.throws(()=>updateDraft(d,{revision:2,version:'1.0',title:'Hacked'},user(),NOW),err('NOT_DRAFT',409));
 assert.throws(()=>submit(d,{revision:2,version:'1.0'},user(),NOW),err('NOT_DRAFT',409));
});
test('stored source content is not sanitized or translated by the service',()=>{
 const c=content();c.de.scope='  Export  ';c.en.scope='  Shipping  ';const d=draft(c);
 assert.equal(d.versions[0].content.de.scope,'  Export  ');assert.equal(d.versions[0].content.en.scope,'  Shipping  ');
});
test('newVersion copies exactly one approved version and leaves it approved',()=>{
 const d=approved();const next=newVersion(d,{revision:3},user('Lena'),NOW);
 assert.equal(next.revision,4);assert.equal(next.versions.length,2);assert.equal(next.versions[0].status,'approved');
 assert.equal(next.versions[1].version,'1.1');assert.equal(next.versions[1].author,'lena');
 assert.equal(next.versions[1].status,'draft');assert.deepEqual(next.versions[1].content,d.versions[0].content);
 next.versions[1].content.de.purpose='Different';assert.equal(d.versions[0].content.de.purpose,'Zweck');
 assert.equal(verifyChain(next.events).ok,true);
});
test('newVersion requires exactly one approved version, no active draft or review',()=>{
 assert.throws(()=>newVersion(draft(),{revision:1},user(),NOW),err('APPROVED_VERSION_REQUIRED',409));
 assert.throws(()=>newVersion(submitted(),{revision:2},user(),NOW),err('APPROVED_VERSION_REQUIRED',409));
 const n=newVersion(approved(),{revision:3},user('Lena'),NOW);
 assert.throws(()=>newVersion(n,{revision:4},user('Lena'),NOW),err('ACTIVE_DRAFT_EXISTS',409));
});
test('newVersion refuses a stale revision',()=>{
 assert.throws(()=>newVersion(approved(),{revision:1},user(),NOW),err('REVISION_CONFLICT',409));
});
test('bad timestamps are rejected before producing events',()=>{
 assert.throws(()=>createDraft(null,fields,user(),'2026-02-30T12:00:00.000Z'),err('INVALID_TIMESTAMP',400));
});
test('tampered chain blocks update, submit and newVersion',()=>{
 const d=draft();d.events[0].actor='Mallory';
 assert.throws(()=>updateDraft(d,{revision:1,version:'1.0',title:'Change'},user(),NOW),err('HISTORY_BROKEN',409));
 assert.throws(()=>submit(d,{revision:1,version:'1.0'},user(),NOW),err('HISTORY_BROKEN',409));
 const app=approved();app.events[0].actor='Mallory';
 assert.throws(()=>newVersion(app,{revision:3},user(),NOW),err('HISTORY_BROKEN',409));
});
test('arbitrary caller metadata does not create approved version',()=>{
 const d=createDraft(null,{...fields,version:'99.0',status:'approved',approvedBy:'Egon',submittedBy:'Egon',revision:999},user(),NOW);
 assert.equal(d.versions.length,1);assert.equal(d.versions[0].status,'draft');assert.equal(d.versions[0].version,'1.0');
 assert.equal(d.revision,1);
});

test('direct changes to title, status and content without a new audit event are rejected',()=>{
 const d=draft();d.title='changed';assert.throws(()=>updateDraft(d,{revision:1,version:'1.0',title:'x'},user(),NOW),err('HISTORY_BROKEN',409));
 const e=submitted();e.versions[0].status='approved';assert.throws(()=>newVersion(e,{revision:2},user(),NOW),err('HISTORY_BROKEN',409));
 const f=draft();f.versions[0].content.de.purpose='tampered';assert.throws(()=>submit(f,{revision:1,version:'1.0'},user(),NOW),err('HISTORY_BROKEN',409));
});

test('author and last editor cannot approve own version or use an administrator override',()=>{
  const d=submitted();
  assert.throws(()=>require('../api/shared/sop-service.js').approve(d,{revision:2,version:'1.0'},user('Anna'),NOW),err('FOUR_EYES',403));
  const admin={user:'ANNA',role:'Administrator',rights:{}};
  assert.throws(()=>require('../api/shared/sop-service.js').approve(d,{revision:2,version:'1.0'},admin,NOW),err('FOUR_EYES',403));
  const fromLastEditor=updateDraft(draft(),{revision:1,version:'1.0',title:'Reviewable'},user('Lena'),NOW);
  const submittedByAuthor=submit(fromLastEditor,{revision:2,version:'1.0'},user('Anna'),NOW);
  assert.throws(()=>require('../api/shared/sop-service.js').approve(submittedByAuthor,{revision:3,version:'1.0'},user('Lena'),NOW),err('FOUR_EYES',403));
});
test('different SOP editor approves with identity and date from trusted session, not request body',()=>{
  const {approve}=require('../api/shared/sop-service.js');
  const source=submitted();
  const result=approve(source,{revision:2,version:'1.0',approvedBy:'Mallory',approvedAt:'2099-01-01T00:00:00.000Z'},user('Lena'),NOW);
  assert.equal(result.versions[0].approvedBy,'lena');
  assert.equal(result.versions[0].approvedAt,NOW);
  assert.equal(result.versions[0].status,'approved');
  assert.equal(source.versions[0].status,'review');
  assert.equal(result.events.at(-1).action,'APPROVED');
  assert.equal(verifyChain(result.events).ok,true);
});
test('cannot approve an unsubmitted draft and cannot approve with read-only right',()=>{
  const {approve}=require('../api/shared/sop-service.js');
  assert.throws(()=>approve(draft(),{revision:1,version:'1.0'},user('Lena'),NOW),err('NOT_IN_REVIEW',409));
  assert.throws(()=>approve(submitted(),{revision:2,version:'1.0'},reader(),NOW),err('SOP_EDIT_FORBIDDEN',403));
});
test('rejection requires a meaningful reason and independent editor; audit reason preserved',()=>{
  const {reject}=require('../api/shared/sop-service.js');const source=submitted();
  assert.throws(()=>reject(source,{revision:2,version:'1.0',reason:'no'},user('Lena'),NOW),err('REASON_REQUIRED',422));
  assert.throws(()=>reject(source,{revision:2,version:'1.0',reason:'Please correct translation'},user('Anna'),NOW),err('FOUR_EYES',403));
  const next=reject(source,{revision:2,version:'1.0',reason:'Please correct translation'},user('Lena'),NOW);
  assert.equal(next.versions[0].status,'draft');
  assert.equal(next.versions[0].author,'anna');
  assert.equal(next.events.at(-1).data.reason,'Please correct translation');
  assert.equal(source.versions[0].status,'review');
});
test('approving next version archives old approved version while retaining exactly one active',()=>{
  const {approve}=require('../api/shared/sop-service.js');
  const first=approve(submitted(),{revision:2,version:'1.0'},user('Lena'),NOW);
  const followup=newVersion(first,{revision:3},user('Mira'),NOW);
  const ready=submit(followup,{revision:4,version:'1.1'},user('Mira'),NOW);
  const next=approve(ready,{revision:5,version:'1.1'},user('Sven'),NOW);
  assert.deepEqual(next.versions.map(v=>v.status),['archived','approved']);
  assert.equal(next.versions[0].approvedBy,'lena');
  assert.equal(next.versions[0].archivedBy,'sven');
  assert.equal(next.versions[1].approvedBy,'sven');
  assert.equal(next.versions.filter(v=>v.status==='approved').length,1);
  assert.equal(next.revision,6);
  assert.equal(verifyChain(next.events).ok,true);
});
test('approved version can only be archived by independent SOP editor',()=>{
  const {approve,archive}=require('../api/shared/sop-service.js');
  const current=approve(submitted(),{revision:2,version:'1.0'},user('Lena'),NOW);
  assert.throws(()=>archive(current,{revision:3},user('Anna'),NOW),err('FOUR_EYES',403));
  assert.throws(()=>archive(current,{revision:3},reader(),NOW),err('SOP_EDIT_FORBIDDEN',403));
  const done=archive(current,{revision:3,archivedBy:'Mallory'},user('Sven'),NOW);
  assert.equal(done.versions[0].archivedBy,'sven');
  assert.equal(done.versions[0].status,'archived');
  assert.equal(done.events.at(-1).action,'ARCHIVED');
  assert.throws(()=>archive(done,{revision:4},user('Sven'),NOW),err('APPROVED_VERSION_REQUIRED',409));
});
test('stale or damaged review state cannot be approved or rejected',()=>{
  const {approve,reject}=require('../api/shared/sop-service.js');
  const s=submitted();
  assert.throws(()=>approve(s,{revision:1,version:'1.0'},user('Lena'),NOW),err('REVISION_CONFLICT',409));
  const tampered=submitted();tampered.versions[0].status='approved';
  assert.throws(()=>approve(tampered,{revision:2,version:'1.0'},user('Lena'),NOW),err('HISTORY_BROKEN',409));
  assert.throws(()=>reject(tampered,{revision:2,version:'1.0',reason:'Need more checks'},user('Lena'),NOW),err('HISTORY_BROKEN',409));
});
