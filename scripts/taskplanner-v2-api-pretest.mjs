import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function patchExporthubStateSource(source){
  let out=String(source||'');
  if(out.includes("mode==='task-migration-backup'"))return out;
  const policyAnchor="const { isAdmin, isPrivilegedUser } = require('../shared/user-policy');";
  const samplePolicyAnchor="const { isAdmin } = require('../shared/user-policy');";
  const importAnchor=out.includes(policyAnchor)?policyAnchor:(out.includes(samplePolicyAnchor)?samplePolicyAnchor:'');
  if(!importAnchor)throw new Error('TaskPlanner V2: user-policy import anchor missing');
  out=out.replace(importAnchor,importAnchor+"\nconst { createVerifiedSnapshot } = require('../shared/state-backup-lifecycle');");
  const sessionAnchor="const current=await validateSession(req,payload,c),blob=c.team;";
  if(!out.includes(sessionAnchor))throw new Error('TaskPlanner V2: authenticated state anchor missing');
  const block=`${sessionAnchor}\n  if(mode==='task-migration-backup'){\n   if(req.method!=='POST')throw error('METHOD_NOT_ALLOWED','Task-Migrationsbackup ist nur per POST erlaubt.',405);\n   if(!isAdmin(current.user))throw error('ADMIN_REQUIRED','Nur Administratoren dürfen ein Task-Migrationsbackup erstellen.',403);\n   const snapshot=await createVerifiedSnapshot(c.container,{environment:c.environment,tier:'daily',at:new Date(),current:current.team});\n   context.res=json(200,{ok:true,taskMigrationBackup:true,environment:c.environment,revision:Number(current.team&&current.team.revision||0),backupBlob:snapshot.backupBlob,backupVerified:snapshot.backupVerified===true,backupReadBackVerified:snapshot.backupReadBackVerified===true,sha256:snapshot.sha256,bytes:snapshot.bytes,serverVersion:API_VERSION});return\n  }`;
  out=out.replace(sessionAnchor,block);
  return out;
}

export function patchRepository(root=process.cwd()){
  const target=path.join(root,'api/exporthub-state/index.js');
  if(!fs.existsSync(target))throw new Error('TaskPlanner V2: exporthub-state API missing');
  const before=fs.readFileSync(target,'utf8');
  const after=patchExporthubStateSource(before);
  if(after!==before)fs.writeFileSync(target,after);
  return {changed:after!==before,target};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=patchRepository();
  console.log(`TaskPlanner V2 API wiring ${result.changed?'applied':'already present'}`);
}
