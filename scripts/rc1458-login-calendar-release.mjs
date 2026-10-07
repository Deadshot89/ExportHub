import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const builderPath=path.join(ROOT,'.github/rc1112/build-three-env.mjs');
let builder=fs.readFileSync(builderPath,'utf8');

const calendarAsset="  'assets/rc1012-abholkalender-runtime.js',\n";
const loginGuardAsset="  'assets/rc1458-login-colli-guard.js',\n";
const authAsset="  'assets/rc1289-auth-transport-fallback.js',";

for(const [asset,label] of [[calendarAsset,'Kalender-Runtime'],[loginGuardAsset,'Login-Guard']]){
  if(builder.includes(asset))continue;
  const count=builder.split(authAsset).length-1;
  if(count!==1)throw new Error(`RC1458 ${label} Copy-Anker ${count}x gefunden`);
  builder=builder.replace(authAsset,asset+authAsset);
}

const authInjection="  html=injectImmediateRuntimeAfterHead(html,tag,'exporthub-rc1289-auth-transport-fallback');";
if(!builder.includes('exporthub-rc1458-login-colli-guard')){
  const count=builder.split(authInjection).length-1;
  if(count!==1)throw new Error(`RC1458 Login-Guard Inject-Anker ${count}x gefunden`);
  const loginInjection=authInjection+"\n  const rc1458LoginTag='<script id=\"exporthub-rc1458-login-colli-guard\" src=\"/assets/rc1458-login-colli-guard.js?v=1458\"></script>';\n  html=injectImmediateRuntimeAfterHead(html,rc1458LoginTag,'exporthub-rc1458-login-colli-guard');";
  builder=builder.replace(authInjection,loginInjection);
}

if(!builder.includes('/assets/rc1289-auth-transport-fallback.js?v=1289'))throw new Error('RC1458 darf den RC1289 Cache-/Versionsvertrag nicht ändern');
if(!builder.includes('/assets/rc1458-login-colli-guard.js?v=1458'))throw new Error('RC1458 Login-Guard Cache-Key fehlt');
if(!builder.includes("'assets/rc1458-login-colli-guard.js'"))throw new Error('RC1458 Login-Guard wird nicht aus aktuellem assets/ gebaut');
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
