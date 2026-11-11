import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page=fs.readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
const start=page.indexOf('function mailIssueRequiredText(){');
const end=page.indexOf('async function copyDraft(){',start);
assert.ok(start>=0&&end>start,'Urgent Order mail handlers must exist');
const handlers=page.slice(start,end);
const presetStart=page.indexOf('const PROBLEM_PRESETS=[');
const presetEnd=page.indexOf('// Reuse real problem descriptions entered on the website',presetStart);
assert.ok(presetStart>=0&&presetEnd>presetStart,'Selectable problems must exist');
const presetHandlers=page.slice(presetStart,presetEnd);

function harness(){
  const apiCalls=[],messages=[],attrs={};
  const elements=Object.fromEntries([
    'mailIssue','mailIssueError','mailLanguage','mailTo','mailSubject',
    'mailBody','mailOverlay','generateMail','openMailer'
  ].map(id=>[id,{
    value:'',disabled:false,hidden:false,textContent:'',attributes:{},focused:false,
    setAttribute(name,value){this.attributes[name]=String(value)},
    removeAttribute(name){delete this.attributes[name]},
    focus(){this.focused=true}
  }]));
  elements.mailIssueError.hidden=true;
  elements.mailLanguage.value='de';
  elements.mailTo.value='cs@example.org';
  elements.mailOverlay.hidden=false;
  const location={href:''};
  const context={
    modalKind:'problem',modalOrder:'order-1',orders:[{id:'order-1'}],
    draftNeedsRegenerate:false,
    $:id=>{assert.ok(elements[id],'Unknown UI element '+id);return elements[id]},
    window:{location},
    setMessage:(id,message,kind)=>messages.push({id,message,kind}),
    localeV2:(key,fallback)=>fallback,
    render:()=>{context.renderCount++},
    renderCount:0,
    api:async (action,payload)=>{apiCalls.push({action,payload});throw Error('API not set')}
  };
  vm.createContext(context);
  vm.runInContext(presetHandlers,context,{filename:'assets/urgent-orders.html#mail-presets'});
  vm.runInContext(handlers,context,{filename:'assets/urgent-orders.html#mailhandlers'});
  return {context,elements,apiCalls,messages,location};
}

test('Urgent Order invalid note is rejected before a request and shows a field-specific error',async()=>{
  const {context,elements,apiCalls}=harness();
  elements.mailIssue.value='   kurz  ';
  elements.mailSubject.value='Already edited';
  elements.mailBody.value='Existing content must survive.';
  await context.generateDraft();
  assert.equal(apiCalls.length,0);
  assert.equal(elements.mailIssue.attributes['aria-invalid'],'true');
  assert.equal(elements.mailIssueError.hidden,false);
  assert.match(elements.mailIssueError.textContent,/8 Zeichen/);
  assert.equal(elements.mailIssue.focused,true);
  assert.equal(elements.mailSubject.value,'Already edited');
  assert.equal(elements.mailBody.value,'Existing content must survive.');
});

test('Urgent Order server note error preserves draft and subsequent valid request recovers',async()=>{
  const {context,elements,apiCalls}=harness();
  elements.mailIssue.value='Artikel 10 fehlt';
  elements.mailSubject.value='Manually edited subject';
  elements.mailBody.value='Manually edited exact mail text';
  context.api=async(action,payload)=>{
    apiCalls.push({action,payload});
    if(apiCalls.length===1)throw Object.assign(Error('Please describe the issue'),{code:'URGENT_MAIL_NOTE_REQUIRED'});
    return {draft:{to:'cs@example.org',subject:'Generated subject',body:'Generated body'}};
  };
  await context.generateDraft();
  assert.equal(apiCalls[0].action,'prepare-mail');
  assert.equal(apiCalls[0].payload.note,'Artikel 10 fehlt');
  assert.equal(elements.mailIssueError.hidden,false);
  assert.equal(elements.mailSubject.value,'Manually edited subject');
  assert.equal(elements.mailBody.value,'Manually edited exact mail text');
  await context.generateDraft();
  assert.equal(elements.mailIssueError.hidden,true);
  assert.equal(elements.mailSubject.value,'Generated subject');
  assert.equal(elements.mailBody.value,'Generated body');
});

test('Urgent Order saves exact edited email before mailto, without falsely marking it sent',async()=>{
  const {context,elements,apiCalls,location}=harness();
  elements.mailSubject.value='SO3002 Sonderänderung';
  elements.mailBody.value='Sehr geehrte Damen und Herren,\r\n  exakt diese Leerzeichen  \r\nMit freundlichen Grüßen';
  let confirm;
  context.api=async(action,payload)=>{
    apiCalls.push({action,payload});
    return await new Promise(resolve=>{confirm=resolve});
  };
  const saving=context.mailto();
  assert.equal(apiCalls.length,1);
  assert.equal(apiCalls[0].action,'record-mail-handoff');
  assert.equal(apiCalls[0].payload.subject,elements.mailSubject.value);
  assert.equal(apiCalls[0].payload.body,elements.mailBody.value);
  assert.equal(location.href,'','Mail program must not open until the server confirms persistence');
  assert.equal(elements.openMailer.disabled,true);
  confirm({order:{id:'order-1',mailHistory:[{status:'open_requested'}]}});
  await saving;
  assert.ok(location.href.startsWith('mailto:cs%40example.org?subject='));
  const url=new URL(location.href);
  assert.equal(url.searchParams.get('subject'),elements.mailSubject.value);
  assert.equal(url.searchParams.get('body'),elements.mailBody.value);
  assert.equal(context.orders[0].mailHistory[0].status,'open_requested');
  assert.equal(elements.openMailer.disabled,false);
});

test('Urgent Order failed persistence does not open Outlook or delete edited text',async()=>{
  const {context,elements,location}=harness();
  const subject='Unique user subject',body='Unique user body\nwith a second line';
  elements.mailSubject.value=subject;
  elements.mailBody.value=body;
  context.api=async()=>{throw Object.assign(Error('No storage'),{code:'URGENT_WRITE_UNVERIFIED'})};
  await context.mailto();
  assert.equal(location.href,'');
  assert.equal(elements.mailSubject.value,subject);
  assert.equal(elements.mailBody.value,body);
  assert.equal(elements.openMailer.disabled,false);
});

test('selected problem reasons and free text are sent together, but stale drafts never launch Outlook',async()=>{
 const {context,elements,apiCalls,location,messages}=harness();
 elements.mailIssue.value='Ergänzung im Freitext';
 vm.runInContext("selectedProblems.add('stock');selectedProblems.add('damage')",context);
 context.api=async(action,payload)=>{
  apiCalls.push({action,payload});
  if(action==='prepare-mail')return {draft:{to:'cs@example.org',subject:'Neuer Entwurf',body:'Neue Mail'}};
  return {order:{id:'order-1'}};
 };
 await context.generateDraft();
 assert.equal(apiCalls.length,1);
 assert.equal(apiCalls[0].action,'prepare-mail');
 assert.match(apiCalls[0].payload.note,/Nicht genügend Bestand verfügbar/);
 assert.match(apiCalls[0].payload.note,/Ware beschädigt oder unvollständig/);
 assert.match(apiCalls[0].payload.note,/Ergänzung im Freitext/);
 vm.runInContext("selectedProblems.add('hold'); draftNeedsRegenerate=true",context);
 await context.mailto();
 assert.equal(apiCalls.length,1,'changing a selected reason must prevent mail handoff');
 assert.equal(location.href,'');
 assert.ok(messages.some(m=>m.kind==='error'));
 await context.generateDraft();
 await context.mailto();
 assert.deepEqual(apiCalls.map(x=>x.action),['prepare-mail','prepare-mail','record-mail-handoff']);
 assert.match(location.href,/^mailto:/);
});

test('a selected problem alone meets the minimum note requirement',async()=>{
 const {context,elements,apiCalls}=harness();
 context.api=async(action,payload)=>{
  apiCalls.push({action,payload});
  return {draft:{to:'cs@example.org',subject:'Problem',body:'Mail'}};
 };
 vm.runInContext("selectedProblems.add('stock')",context);
 await context.generateDraft();
 assert.equal(apiCalls.length,1);
 assert.equal(elements.mailIssueError.hidden,true);
 assert.equal(apiCalls[0].payload.note,'Nicht genügend Bestand verfügbar');
});
