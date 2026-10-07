import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const builderPath=path.join(ROOT,'.github/rc1112/build-three-env.mjs');
let builder=fs.readFileSync(builderPath,'utf8');

const calendarAsset="  'assets/rc1012-abholkalender-runtime.js',\n";
const authAsset="  'assets/rc1289-auth-transport-fallback.js',";
if(!builder.includes(calendarAsset)){
  const count=builder.split(authAsset).length-1;
  if(count!==1)throw new Error(`RC1458 Kalender-Runtime Copy-Anker ${count}x gefunden`);
  builder=builder.replace(authAsset,calendarAsset+authAsset);
}

builder=builder.replaceAll('/assets/rc1289-auth-transport-fallback.js?v=1289','/assets/rc1289-auth-transport-fallback.js?v=1458');
if(!builder.includes('/assets/rc1289-auth-transport-fallback.js?v=1458'))throw new Error('RC1458 Login-Guard Cache-Key fehlt');
if(!builder.includes("'assets/rc1012-abholkalender-runtime.js'"))throw new Error('RC1458 Kalender-Runtime wird nicht aus aktuellem assets/ gebaut');
fs.writeFileSync(builderPath,builder,'utf8');

for(const rel of ['dist-rc1048/index.html','dist-rc1048/TESTVERSION.html','dist-rc1048/demo.html']){
  const file=path.join(ROOT,rel);
  if(!fs.existsSync(file))continue;
  const source=fs.readFileSync(file,'utf8');
  const next=source.replace(/\/assets\/rc1012-abholkalender-runtime\.js\?v=1012(?:&rc=\d+)?/g,'/assets/rc1012-abholkalender-runtime.js?v=1012&rc=1458');
  if(next===source&&!source.includes('/assets/rc1012-abholkalender-runtime.js?v=1012&rc=1458'))throw new Error(`${rel}: RC1458 Kalender Cache-Anker fehlt`);
  fs.writeFileSync(file,next,'utf8');
}

console.log('RC1458 Login-/Kalender-Releasepatch applied');
