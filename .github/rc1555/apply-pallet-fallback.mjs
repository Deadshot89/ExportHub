import fs from 'node:fs';

const file='assets/document-print-name.js';
let source=fs.readFileSync(file,'utf8');
const before="account=normalizePalletAccount(account);if(!account)return null;account=Object.assign({},account,{key:q(account.key)||party.key,type:q(account.type)||party.type,name:q(account.name)||party.name});";
const after="account=normalizePalletAccount(account);if(!account)return snapshot;account=Object.assign({},account,{key:q(account.key)||party.key,type:q(account.type)||party.type,name:q(account.name)||party.name});";
if(source.includes(after)){
  console.log('RC1555 pallet snapshot fallback already applied');
  process.exit(0);
}
if(!source.includes(before))throw new Error('RC1555 patch target not found');
source=source.replace(before,after);
fs.writeFileSync(file,source);
console.log('RC1555 pallet snapshot fallback applied');
