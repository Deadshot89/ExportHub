'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');

class MemoryBlob{
  constructor(store,name){this.store=store;this.name=name}
  async upload(content,length,options={}){
    if(options.conditions&&options.conditions.ifNoneMatch==='*'&&this.store.has(this.name)){
      const e=new Error('exists');e.statusCode=412;throw e;
    }
    const buf=Buffer.isBuffer(content)?Buffer.from(content):Buffer.from(String(content));
    this.store.set(this.name,{buf,etag:'"'+Date.now()+'"',at:new Date()});
    return{etag:this.store.get(this.name).etag,lastModified:this.store.get(this.name).at}
  }
  async download(){
    const row=this.store.get(this.name);if(!row){const e=new Error('not found');e.statusCode=404;throw e}
    return{etag:row.etag,readableStreamBody:Readable.from(Buffer.from(row.buf))}
  }
  async getProperties(){const row=this.store.get(this.name);if(!row){const e=new Error('not found');e.statusCode=404;throw e}return{etag:row.etag,lastModified:row.at,metadata:{}}}
}
class MemoryContainer{
  constructor(){this.store=new Map()}
  getBlockBlobClient(name){return new MemoryBlob(this.store,name)}
  getBlobClient(name){return new MemoryBlob(this.store,name)}
  async *listBlobsFlat(options={}){
    for(const [name,row] of this.store){
      if(options.prefix&&!name.startsWith(options.prefix))continue;
      yield{name,properties:{lastModified:row.at},metadata:{}}
    }
  }
}

const stateApi=require('../../api/exporthub-state/index.js');
const api=stateApi.__rc1115Test;

test('RC1115: Backup-/Restore-Selbsttest schreibt Backup und liest identischen Teamstand zurück',async()=>{
  assert.ok(api&&typeof api.backupRestoreSelfTest==='function');
  const container=new MemoryContainer();
  const team={
    schemaVersion:3,
    revision:77,
    updatedAt:'2026-09-15T12:00:00.000Z',
    updatedBy:'ISO Tester',
    state:{shipments:[{reference:'ABC123',status:'Erstellt'}],auditLog:[]},
    users:[{id:'U1',user:'admin',name:'Admin',active:true,globalAdmin:true}]
  };
  const c={container,recoveryPrefix:'testservice/recovery-backups/',environment:'testservice'};
  const result=await api.backupRestoreSelfTest(c,{team},{name:'Admin',user:'admin'});
  assert.equal(result.ok,true);
  assert.equal(result.productionStateChanged,false);
  assert.equal(result.sourceRevision,77);
  assert.equal(result.restoredRevision,77);
  assert.equal(result.sourceHash,result.restoredHash);
  assert.match(result.backupBlob,/testservice\/recovery-backups\/iso-backup-restore-selftest-/);
  assert.ok(container.store.has(result.backupBlob));
  assert.ok(container.store.has('testservice/recovery-backups/iso-evidence/last-backup-restore-test.json'));
  const evidence=JSON.parse(container.store.get('testservice/recovery-backups/iso-evidence/last-backup-restore-test.json').buf.toString('utf8'));
  assert.equal(evidence.ok,true);
  assert.equal(evidence.sourceHash,evidence.restoredHash);
});

test('RC1115: Backup-/Restore-Evidence enthält keine Teamdaten oder Passwörter',async()=>{
  const container=new MemoryContainer(),c={container,recoveryPrefix:'recovery-backups/',environment:'production'};
  const team={schemaVersion:3,revision:1,state:{secretBusinessField:'nicht in Evidence'},users:[{id:'U1',passwordCredential:{hash:'secret'}}]};
  await api.backupRestoreSelfTest(c,{team},{name:'Admin'});
  const evidence=container.store.get('recovery-backups/iso-evidence/last-backup-restore-test.json').buf.toString('utf8');
  assert.equal(evidence.includes('secretBusinessField'),false);
  assert.equal(evidence.includes('passwordCredential'),false);
  assert.equal(evidence.includes('"hash":"secret"'),false);
});
