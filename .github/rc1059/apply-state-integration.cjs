const fs=require('fs');
const path='api/exporthub-state/index.js';
let s=fs.readFileSync(path,'utf8');
function replaceOnce(oldText,newText,label){
  const i=s.indexOf(oldText);
  if(i<0)throw new Error('RC1059 Patchstelle fehlt: '+label);
  if(s.indexOf(oldText,i+oldText.length)>=0)throw new Error('RC1059 Patchstelle nicht eindeutig: '+label);
  s=s.slice(0,i)+newText+s.slice(i+oldText.length);
}
replaceOnce(
"const { mergeState, sanitizeState, pruneTombstones, clone, isLocalOnlyKey } = require('../shared/merge');",
"const { mergeState, sanitizeState, pruneTombstones, clone, isLocalOnlyKey } = require('../shared/merge');\nconst { externalizeDocumentCollections, DOCUMENT_CONTAINER } = require('../shared/document-blob-store');",
'require'
);
replaceOnce(
"return {container,environment,teamBlobName,diagnosticsBlobName,recoveryPrefix:recoveryPrefixForEnvironment(environment),allowGenericRecoveryDiscovery:environment!=='testservice',team:container.getBlockBlobClient(teamBlobName),diagnostics:container.getBlockBlobClient(diagnosticsBlobName),productionTeam:container.getBlockBlobClient(TEAM_BLOB_BASE),auth:container.getBlockBlobClient(AUTH_BLOB)};",
"return {container,documentContainer:service.getContainerClient(DOCUMENT_CONTAINER),environment,teamBlobName,diagnosticsBlobName,recoveryPrefix:recoveryPrefixForEnvironment(environment),allowGenericRecoveryDiscovery:environment!=='testservice',team:container.getBlockBlobClient(teamBlobName),diagnostics:container.getBlockBlobClient(diagnosticsBlobName),productionTeam:container.getBlockBlobClient(TEAM_BLOB_BASE),auth:container.getBlockBlobClient(AUTH_BLOB)};",
'clients document container'
);
replaceOnce(
"const saveStarted=Date.now(),saved=await saveMerged(blob,normalizeIncoming(payload),current.user,current.team,current.teamEtag,current.session),saveMs=Date.now()-saveStarted;rememberWarmTeam(c,saved,saved&&saved.__storageEtag||current.teamEtag);saved.dataEnvironment=c.environment;",
"const normalized=normalizeIncoming(payload),documentExternalizeStarted=Date.now(),externalized=await externalizeDocumentCollections(normalized.state,{environment:c.environment,container:c.documentContainer});normalized.state=externalized.state;\n   const saveStarted=Date.now(),saved=await saveMerged(blob,normalized,current.user,current.team,current.teamEtag,current.session),saveMs=Date.now()-saveStarted;rememberWarmTeam(c,saved,saved&&saved.__storageEtag||current.teamEtag);saved.dataEnvironment=c.environment;saved.documentExternalizeStats=externalized.stats;saved.documentExternalizeMs=Date.now()-documentExternalizeStarted;",
'save externalization'
);
fs.writeFileSync(path,s);
console.log('RC1059 State-Save-Dokumentauslagerung angewendet.');
