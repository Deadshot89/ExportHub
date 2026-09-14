import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);

function loadCommonJs(relative,mocks){
  const absolute=path.resolve(relative),original=Module._load;
  Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];return original.call(this,request,parent,isMain)};
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}

function fixture(){
  const reads={auth:0,team:0};
  const blobs={auth:{name:'auth'},team:{name:'team'}};
  const team={users:[{id:'U1',user:'tester',name:'Tester',active:true,authVersion:0,rights:{shipment:{edit:true}}}]};
  const authDoc={sessions:[]};
  const auth={
    bearer(){return'token'},
    async clients(){return blobs},
    async readJson(blob){
      reads[blob.name]++;
      await new Promise(resolve=>setTimeout(resolve,20));
      return blob===blobs.auth?{value:authDoc,etag:'auth-etag'}:{value:team,etag:'team-etag'};
    },
    emptyAuth(){return{sessions:[]}},
    emptyTeam(){return{users:[]}},
    resolveSession(){return{source:'blob',session:{id:'S1',userId:'U1',username:'tester',expiresAt:'2099-01-01T00:00:00.000Z',authVersion:0,mustChange:false}}},
    applyUserPolicy(value){return value},
    usernameOf(user){return String(user&&user.user||'').toLowerCase()},
    lower(value){return String(value||'').toLowerCase()},
    text(value){return String(value==null?'':value).trim()},
    isActive(user){return !!user&&user.active!==false},
    error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}
  };
  const fast=loadCommonJs('api/shared/fast-auth-store.js',{'../shared/auth-store':auth});
  return{fast,reads};
}

test('RC1102: parallele Sitzungsprüfungen teilen laufende Auth- und Team-Reads',async()=>{
  const h=fixture();
  const req={headers:{}};
  const [a,b]=await Promise.all([h.fast.validateSession(req),h.fast.validateSession(req)]);
  assert.equal(a.user.id,'U1');
  assert.equal(b.user.id,'U1');
  assert.equal(h.reads.auth,1,'Parallele Prüfungen dürfen den Auth-Blob nur einmal gleichzeitig lesen.');
  assert.equal(h.reads.team,1,'Parallele Prüfungen dürfen den großen Team-State nur einmal gleichzeitig lesen.');
});

test('RC1102: abgeschlossene Reads werden nicht als veralteter Dauer-Cache weiterverwendet',async()=>{
  const h=fixture();
  const req={headers:{}};
  await Promise.all([h.fast.validateSession(req),h.fast.validateSession(req)]);
  await h.fast.validateSession(req);
  assert.equal(h.reads.auth,2,'Nach Abschluss muss eine spätere Prüfung den Auth-Stand frisch lesen.');
  assert.equal(h.reads.team,2,'Nach Abschluss muss eine spätere Prüfung die aktuellen Benutzerrechte frisch lesen.');
});
