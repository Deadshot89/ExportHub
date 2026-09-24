import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);
const policy=require('../api/shared/user-policy.js');
const totp=require('../api/shared/mfa-totp.js');

function loadEndpoint(){
  const team={users:[{
    id:'U-ADMIN',user:'admin.test',login:'admin.test',username:'admin.test',name:'Admin Test',
    globalAdmin:true,role:'Globaler Administrator',permissions:['*'],rights:policy.defaultRights(true),
    active:true,disabled:false,authVersion:1,mustChange:false,
    passwordCredential:{hash:'mock',value:'Correct1'}
  }],state:{auditLog:[]},authBootstrap:{completedAt:'2026-09-01T00:00:00.000Z'}};
  const sessions=[];
  const auth={
    text:v=>String(v==null?'':v).trim(),
    lower:v=>String(v==null?'':v).trim().toLowerCase(),
    now:()=>new Date().toISOString(),
    body:req=>req&&req.body&&typeof req.body==='object'?req.body:{},
    json:(status,body,headers={})=>({status,headers:Object.assign({'Content-Type':'application/json'},headers),body:JSON.stringify(body)}),
    error:(code,message,status=400,extra={})=>Object.assign(new Error(message),{code,status},extra),
    safeEqualText:(a,b)=>String(a||'')===String(b||''),
    usernameOf:u=>String(u&&(u.user||u.login||u.username||u.name)||'').trim().toLowerCase(),
    isAdmin:policy.isAdmin,
    isActive:u=>!!u&&u.active!==false&&u.disabled!==true,
    findUser:(users,name)=>users.find(u=>String(u.user||'').toLowerCase()===String(name||'').toLowerCase()),
    adminCount:users=>users.filter(u=>policy.isAdmin(u)&&u.active!==false).length,
    credentialOf:u=>u&&u.passwordCredential&&u.passwordCredential.hash?u.passwordCredential:null,
    verifyCredential:(password,credential)=>String(password)===String(credential&&credential.value),
    setPassword(){throw new Error('setPassword must not run in this MFA fixture')},
    normalizeRights:policy.normalizeRights,
    generatedPassword:()=> 'Generated1',
    addAudit:(doc,type,actor,details={})=>{doc.state.auditLog.push({type,actor,details})},
    async mutateTeam(mutator){const result=await mutator(team);return{team,result}},
    async createSession(user,deviceId,mustChange,options={}){
      const session={id:'S-'+(sessions.length+1),userId:user.id,deviceId,mustChange,mfaVerifiedAt:options.mfaVerified?new Date().toISOString():null};
      sessions.push(session);return{token:'token-'+sessions.length,session}
    },
    publicUser:(u,adminView)=>policy.publicUser(u,adminView),
    sessionCookie:token=>'eh_session='+token,
    async revokeUserSessions(){return 0},
    async clients(){throw new Error('clients not expected')},
    emptyTeam:()=>({users:[]}),
    applyUserPolicy:v=>v
  };
  const target=path.resolve('api/exporthub-auth/index.js'),original=Module._load;
  Module._load=function(request,parent,isMain){
    if(request==='../shared/auth-store')return auth;
    return original.call(this,request,parent,isMain)
  };
  delete require.cache[require.resolve(target)];
  let endpoint;
  try{endpoint=require(target)}finally{Module._load=original}
  return{endpoint,team,sessions}
}
function ctx(){return{res:null,log:{error(){},warn(){},info(){}}}}
async function call(endpoint,body){
  const context=ctx();
  await endpoint(context,{method:'POST',headers:{},body});
  return{status:context.res.status,body:JSON.parse(context.res.body),headers:context.res.headers||{}}
}

test('RC1252: privilegierter Login erzeugt erst nach gültigem TOTP eine Session',async()=>{
  const previous=process.env.EXPORTHUB_AUTH_SIGNING_SECRET;
  process.env.EXPORTHUB_AUTH_SIGNING_SECRET='rc1252-integration-signing-secret';
  try{
    const h=loadEndpoint();
    const first=await call(h.endpoint,{action:'login',username:'admin.test',password:'Correct1',deviceId:'browser-a'});
    assert.equal(first.status,428);
    assert.equal(first.body.code,'MFA_ENROLL_REQUIRED');
    assert.equal(first.body.mfaRequired,true);
    assert.equal(first.body.mfaMode,'enroll');
    assert.match(first.body.mfaEnrollmentSecret,/^[A-Z2-7]+$/);
    assert.match(first.body.mfaEnrollmentUri,/^otpauth:\/\/totp\//);
    assert.equal(h.sessions.length,0,'Vor MFA darf keine Session entstehen.');

    const counter=Math.floor(Date.now()/30000);
    const code=totp.codeForCounter(first.body.mfaEnrollmentSecret,counter);
    const second=await call(h.endpoint,{
      action:'login',username:'admin.test',password:'Correct1',deviceId:'browser-a',
      mfaChallenge:first.body.mfaChallenge,mfaCode:code
    });
    assert.equal(second.status,200);
    assert.equal(second.body.ok,true);
    assert.equal(h.sessions.length,1);
    assert.ok(h.sessions[0].mfaVerifiedAt,'Session muss MFA-Nachweis tragen.');
    assert.equal(h.team.users[0].mfa.enabled,true);
    assert.equal(h.team.users[0].mfa.lastCounter,counter);

    const challenge=await call(h.endpoint,{action:'login',username:'admin.test',password:'Correct1',deviceId:'browser-a'});
    assert.equal(challenge.status,428);
    assert.equal(challenge.body.code,'MFA_REQUIRED');
    assert.equal(challenge.body.mfaMode,'verify');
    assert.equal(Object.prototype.hasOwnProperty.call(challenge.body,'mfaEnrollmentSecret'),false);

    const replay=await call(h.endpoint,{
      action:'login',username:'admin.test',password:'Correct1',deviceId:'browser-a',
      mfaChallenge:challenge.body.mfaChallenge,mfaCode:code
    });
    assert.equal(replay.status,401);
    assert.equal(replay.body.code,'MFA_CODE_INVALID');
    assert.equal(h.sessions.length,1,'Replay darf keine weitere Session erzeugen.');
  }finally{
    if(previous===undefined)delete process.env.EXPORTHUB_AUTH_SIGNING_SECRET;
    else process.env.EXPORTHUB_AUTH_SIGNING_SECRET=previous;
  }
});
