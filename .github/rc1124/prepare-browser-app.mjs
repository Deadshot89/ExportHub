import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const source=path.join(root,'dist-rc1112');
const out=path.join(root,'.rc1124_browser_app');

fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

for(const file of ['demo.html','pickup.html','customer-avis.html','location.html','pod-notfall.html','migration-recovery.html','production-version.js']){
  const from=path.join(source,file);
  if(fs.existsSync(from))fs.copyFileSync(from,path.join(out,file));
}
fs.copyFileSync(path.join(source,'demo.html'),path.join(out,'index.html'));

const rootAssets=path.join(root,'assets');
const builtAssets=path.join(source,'assets');
const targetAssets=path.join(out,'assets');
fs.mkdirSync(targetAssets,{recursive:true});
if(fs.existsSync(rootAssets))fs.cpSync(rootAssets,targetAssets,{recursive:true,force:true});
if(fs.existsSync(builtAssets))fs.cpSync(builtAssets,targetAssets,{recursive:true,force:true});

for(const required of [
  'assets/rc1027-lieferavis-immediate.js',
  'assets/rc1037-lieferavis-timing-diagnostics.js',
  'assets/rc1049-abd-avis-policy.js',
  'assets/rc1113-stowplan-persist.js',
  'assets/rc1114-shipping-neutral.js'
]){
  if(!fs.existsSync(path.join(out,required)))throw new Error('Browser-Kandidat fehlt '+required);
}
console.log('RC1124 Browser-Kandidat entspricht der Asset-Überlagerung des TESTSERVICE-Deploy-Pakets.');
