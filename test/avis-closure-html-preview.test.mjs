import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const renderer=require('../api/shared/avis-mail-html.js');
const source=fs.readFileSync(new URL('../api/avis-reminder-mail/index.js',import.meta.url),'utf8');
const closure={
 enabled:true,startDate:'2026-12-21',endDate:'2027-01-01',
 lastPickupDate:'2026-12-18',lastPickupTime:'15:00',
 reopenDate:'2027-01-04',leadDays:14
};
const originalDate=Date;
class InAdvanceDate extends Date {
 constructor(...args){super(...(args.length?args:['2026-12-14T12:00:00Z']))}
 static now(){return originalDate.parse('2026-12-14T12:00:00Z')}
}

function setup({authorized=true}={}){
 const shipment={id:'S1',reference:'ABC123',customerName:'Hitachi',customerAvisToken:'abc'};
 const team={state:{shipments:[shipment],customers:[],settings:{closureNotices:[structuredClone(closure)]}}};
 const calls={sends:0,writes:0,audits:0};
 const auth={
  body:req=>req.body,
  environmentFromRequest:()=> 'production',
  isAdmin:()=>authorized,
  async validateSession(){return{user:{name:'Preview Tester',rights:{}},team}},
  error:(code,message,status)=>Object.assign(new Error(message),{code,status}),
  mutateTeamForRequest(){calls.writes++;throw new Error('preview must not write team state')},
  addAudit(){calls.audits++}
 };
 const graphMail={async sendHtmlMail(){calls.sends++;throw new Error('preview must not send mail')}};
 const sandbox={module:{exports:{}},require(name){
   if(name==='crypto')return crypto;
   if(name==='../shared/auth-store')return auth;
   if(name==='../shared/graph-mail')return graphMail;
   if(name==='../shared/avis-mail-html')return renderer;
   throw new Error('Unexpected dependency '+name);
  },URL,Date:InAdvanceDate,process:{env:{}},console};
 vm.runInNewContext(source,sandbox,{filename:'api/avis-reminder-mail/index.js'});
 const preview=(override={})=>{
   const context={};
   const body={
    action:'preview',shipmentId:'S1',reference:'ABC123',
    recipient:'contact@example.invalid',target:'customer',language:'en',
    mode:'initial',avisUrl:'https://www.exporthub360.de/avis/abc',
    ...override
   };
   return Promise.resolve(sandbox.module.exports(context,{method:'POST',body})).then(()=>({
    status:context.res.status,body:JSON.parse(context.res.body),headers:context.res.headers
   }));
 };
 return{preview,team,shipment,calls};
}

test('Issue #1328: authenticated preview renders exact branded HTML without Graph, write or history',async()=>{
 const {preview,team,shipment,calls}=setup();
 const result=await preview();
 assert.equal(result.status,200,JSON.stringify(result.body));
 assert.equal(result.body.ok,true);
 assert.equal(result.body.preview,true);
 assert.equal(result.body.mode,'initial');
 assert.match(result.body.html,/<html lang="en">/);
 assert.match(result.body.html,/Important notice/);
 assert.match(result.body.html,/Last collection/);
 assert.match(result.body.html,/15:00/);
 assert.match(result.body.html,/Click here to arrange pickup/);
 assert.match(result.body.html,/href="https:\/\/www\.exporthub360\.de\/avis\/abc\?lang=en"/);
 assert.equal(result.body.subject,'Shipment notice ABC123');
 assert.equal(result.headers['Cache-Control'],'no-store');
 assert.deepEqual(calls,{sends:0,writes:0,audits:0});
 assert.equal(shipment.shipmentHistory,undefined);
 assert.equal(shipment.mailHistory,undefined);
 assert.equal(team.state.settings.closureNotices.length,1);
});

test('Issue #1328: preview respects selected target/language and preserves sender+CC',async()=>{
 const {preview,calls}=setup();
 const result=await preview({language:'fr',target:'carrier'});
 assert.equal(result.status,200);
 assert.match(result.body.html,/Information importante/);
 assert.match(result.body.html,/Cliquez ici pour organiser l’enlèvement/);
 assert.equal(result.body.sender,'DespatchNettetal@essentra.com');
 assert.equal(result.body.subject,'Avis d’enlèvement ABC123');
 assert.deepEqual(Array.from(result.body.cc),[]);
 assert.deepEqual(calls,{sends:0,writes:0,audits:0});
});

test('Issue #1328: unauthorized preview and invalid action are fail-closed',async()=>{
 const denied=setup({authorized:false});
 const response=await denied.preview();
 assert.equal(response.status,403);
 assert.equal(response.body.code,'MAIL_SEND_FORBIDDEN');
 assert.deepEqual(denied.calls,{sends:0,writes:0,audits:0});

 const allowed=setup();
 const invalid=await allowed.preview({action:'resend'});
 assert.equal(invalid.status,400);
 assert.equal(invalid.body.code,'MAIL_ACTION_INVALID');
 const untrusted=await allowed.preview({avisUrl:'https://evil.example/avis/abc'});
 assert.equal(untrusted.status,400);
 assert.equal(untrusted.body.code,'AVIS_URL_INVALID');
 assert.deepEqual(allowed.calls,{sends:0,writes:0,audits:0});
});

test('Issue #1328: inactive/invalid closure does not appear in HTML preview',async()=>{
 const {preview,team}=setup();
 team.state.settings.closureNotices[0].enabled=false;
 const result=await preview();
 assert.equal(result.status,200);
 assert.doesNotMatch(result.body.html,/Important notice/);
});
