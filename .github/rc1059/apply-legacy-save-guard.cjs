const fs=require('fs');
const path='api/exporthub-state/index.js';
let s=fs.readFileSync(path,'utf8');
const old="externalized=await externalizeDocumentCollections(normalized.state,{environment:c.environment,container:c.documentContainer});";
const neu="externalized=await externalizeDocumentCollections(normalized.state,{environment:c.environment,container:c.documentContainer,currentState:current.team&&current.team.state});";
if(!s.includes(neu)){
 const i=s.indexOf(old);if(i<0)throw new Error('RC1059 Legacy-Save-Patchstelle fehlt');
 if(s.indexOf(old,i+old.length)>=0)throw new Error('RC1059 Legacy-Save-Patchstelle nicht eindeutig');
 s=s.slice(0,i)+neu+s.slice(i+old.length);
}
fs.writeFileSync(path,s);
console.log('RC1059 Legacy-Save-Schutz angewendet.');
