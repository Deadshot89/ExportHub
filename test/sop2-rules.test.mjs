import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {STATUS,userKey,canRead,canEdit,canApprove,canTransition,validateContent}=require('../api/shared/sop-rules.js');
const editor = (name='Anna.M') => ({user:name,role:'Benutzer',active:true,rights:{sop:{level:'edit'}}});
const reader = (name='Hans') => ({user:name,role:'Benutzer',active:true,rights:{sop:{level:'view'}}});
const version = {author:'Anna.M',lastEditor:'Mira.H'};
function validContent() {
  return {
    de:{purpose:'Ablauf sicherstellen',scope:'Warenausgang',responsibilities:['Versand'],prerequisites:[],checks:['Referenz kontrollieren'],deviations:[],records:['Kontrollliste']},
    en:{purpose:'Ensure the procedure',scope:'Shipping',responsibilities:['Despatch'],prerequisites:[],checks:['Check reference'],deviations:[],records:['Checklist']},
    steps:[{id:'step-1',de:'Sendung anlegen',en:'Create shipment'}]
  };
}
test('STATUS is immutable and lists the four permitted lifecycle states',()=>{
  assert.deepEqual({...STATUS},{DRAFT:'draft',REVIEW:'review',APPROVED:'approved',ARCHIVED:'archived'});
  assert.equal(Object.isFrozen(STATUS),true);
});
test('author cannot approve own version: case, whitespace, session alias',()=>{
  assert.equal(canApprove(editor('anna.m'),version),false);
  assert.equal(canApprove(editor('  ANNA.M  '),version),false);
  assert.equal(canApprove({...editor('ANNA.M'),login:'alternate-login',name:'Different Display Name'},version),false);
});
test('last editor cannot approve their version',()=>{
  assert.equal(canApprove(editor('mira.h'),version),false);
});
test('a second person with SOP editing permissions may approve without being admin',()=>{
  assert.equal(canApprove(editor('Sven'),version),true);
  assert.equal(canApprove(reader('Sven'),version),false);
  assert.equal(canEdit(editor('Sven')),true);
  assert.equal(canEdit(reader('Sven')),false);
});
test('admin has SOP rights but cannot approve their own authored or last-edited version',()=>{
  const admin={...editor('Sven'),role:'Administrator',rights:{}};
  assert.equal(canEdit(admin),true);
  assert.equal(canApprove(admin,version),true);
  assert.equal(canApprove({...admin,user:'ANNA.M'},version),false);
  assert.equal(canApprove({...admin,user:'MIRA.H'},version),false);
});
test('anonymous, disabled, readers, and forged incomplete identities fail closed',()=>{
  assert.equal(canRead({user:'Sven',rights:{}}),true);
  assert.equal(canRead(reader()),true);
  assert.equal(canRead({role:'Administrator'}),false);
  assert.equal(canRead({...reader(),active:false}),false);
  assert.equal(canEdit({...editor(),active:false}),false);
  assert.equal(canApprove(editor(),{author:'Anna.M'}),false);
  assert.equal(canApprove(editor(),{lastEditor:'Mira.H'}),false);
  assert.equal(canApprove({role:'Administrator'},version),false);
  assert.equal(canApprove({...editor('Sven'),name:'Mira.H'},version),false);
  assert.equal(canApprove({...editor('Sven'),id:'Anna.M'},version),false);
});
test('SOP rights support access/level and edit flags, deny read-only',()=>{
  for(const right of [{edit:true},{admin:true},{functionAdmin:true},{access:'EDIT'},{level:'Admin'}])
    assert.equal(canEdit({...reader(),rights:{sop:right}}),true);
  for(const right of [{read:true},{visible:true},{access:'view'},{level:'none'},{}])
    assert.equal(canEdit({...reader(),rights:{sop:right}}),false);
});
test('case-insensitive userKey follows the established ExportHUB user/login/name identity shape',()=>{
  assert.equal(userKey({user:' Anna.M ',login:'other'}),'anna.m');
  assert.equal(userKey({username:'Mira.H'}),'mira.h');
  assert.equal(userKey(' ANNA.M '),'anna.m');
  assert.equal(userKey({}), '');
});
test('only draft-review, review-draft, review-approved, approved-archived are valid',()=>{
  const allowed=[['draft','review'],['review','draft'],['review','approved'],['approved','archived']];
  for(const from of Object.values(STATUS)) for(const to of Object.values(STATUS))
    assert.equal(canTransition(from,to),allowed.some(pair=>pair[0]===from&&pair[1]===to),from+'->'+to);
  assert.equal(canTransition('draft','approved'),false);
  assert.equal(canTransition('archived','draft'),false);
});
test('missing English mandatory fields show EMPTY_PART in en',()=>{
  const content=validContent();content.en.purpose='';content.en.checks=[];
  const out=validateContent(content);
  assert.equal(out.ok,false);
  assert.ok(out.errors.some(e=>e.code==='EMPTY_PART'&&e.part==='purpose'&&e.lang==='en'));
  assert.ok(out.errors.some(e=>e.code==='EMPTY_PART'&&e.part==='checks'&&e.lang==='en'));
});
test('missing or unsafe English step is rejected, with position',()=>{
  const content=validContent(); delete content.steps[0].en;
  assert.ok(validateContent(content).errors.some(e=>e.code==='STEP_LANG_MISSING'&&e.lang==='en'&&e.index===0));
  content.steps[0].en='<script>alert(1)</script>';
  assert.equal(validateContent(content).ok,false);
});
test('HTML/script injection and malformed localized checklists are not accepted',()=>{
  const content=validContent(); content.de.scope='<img src=x onerror=alert(1)>';
  assert.equal(validateContent(content).ok,false);
  const again=validContent();again.en.records=['javascript:alert(1)'];
  assert.ok(validateContent(again).errors.some(e=>e.code==='INVALID_TEXT'&&e.part==='records'&&e.lang==='en'));
});
test('duplicate steps and empty steps are invalid',()=>{
  const content=validContent();content.steps.push({...content.steps[0]});
  assert.ok(validateContent(content).errors.some(e=>e.code==='STEP_ID_INVALID'&&e.index===1));
  content.steps=[];
  assert.ok(validateContent(content).errors.some(e=>e.code==='STEPS_INVALID'));
});
test('full bilingual content is valid',()=>{
  assert.deepEqual(validateContent(validContent()),{ok:true,errors:[]});
});
