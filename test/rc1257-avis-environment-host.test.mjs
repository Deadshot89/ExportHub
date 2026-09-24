import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);
const target=path.resolve('api/avis-reminder-mail/index.js');

function loadEndpoint(){
  const auth={
    body:req=>req&&req.body&&typeof req.body==='object'?req.body:{},
    error:(code,message,status=400)=>Object.assign(new Error(message),{code,status}),
    isAdmin:()=>true,
    async validateSession(){return{user:{id:'U1',user:'Tester',name:'Tester',globalAdmin:true}}},
    environmentFromRequest(req){
      const headers=req&&req.headers||{};
      const requested=String(headers['x-exporthub-environment']||'').trim().toLowerCase();
      return requested==='testservice'?'testservice':'production';
    },
    async mutateTeamForRequest(req,mutator){
      const team={state:{shipments:[]}};
      const result=await mutator(team);
      return{team,result};
    },
    addAudit(){}
  };
  const graphMail={async sendTextMail(){return{attempts:1}}};
  const original=Module._load;
  Module._load=function(request,parent,isMain){
    if(request==='../shared/auth-store')return auth;
    if(request==='../shared/graph-mail')return graphMail;
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[require.resolve(target)];
  try{return require(target)}finally{Module._load=original}
}

async function invoke({environment='production',host='internal.azurewebsites.net',avisUrl}){
  const endpoint=loadEndpoint(),context={res:null,log:{error(){}}};
  await endpoint(context,{
    method:'POST',
    headers:{host,'x-exporthub-environment':environment},
    body:{
      shipmentId:'S1',
      reference:'ABC123',
      recipient:'test@example.com',
      target:'customer',
      language:'de',
      avisUrl
    }
  });
  return{status:context.res.status,body:JSON.parse(context.res.body)};
}

test('RC1257: TESTSERVICE akzeptiert korrekten öffentlichen Avis-Link trotz internem Azure-Host',async()=>{
  const result=await invoke({
    environment:'testservice',
    host:'internal-function.azurewebsites.net',
    avisUrl:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/customer-avis.html?token=abc'
  });
  assert.equal(result.status,200);
  assert.equal(result.body.ok,true);
});

test('RC1257: TESTSERVICE lehnt Produktions-Avis-Link weiterhin ab',async()=>{
  const result=await invoke({
    environment:'testservice',
    host:'internal-function.azurewebsites.net',
    avisUrl:'https://wonderful-forest-0f315e310.7.azurestaticapps.net/customer-avis.html?token=abc'
  });
  assert.equal(result.status,400);
  assert.equal(result.body.code,'AVIS_URL_INVALID');
});

test('RC1257: Produktion akzeptiert nur die Produktionsdomain',async()=>{
  const ok=await invoke({
    environment:'production',
    avisUrl:'https://wonderful-forest-0f315e310.7.azurestaticapps.net/customer-avis.html?token=abc'
  });
  assert.equal(ok.status,200);
  const bad=await invoke({
    environment:'production',
    avisUrl:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/customer-avis.html?token=abc'
  });
  assert.equal(bad.status,400);
  assert.equal(bad.body.code,'AVIS_URL_INVALID');
});
