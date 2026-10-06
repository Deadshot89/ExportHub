import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const rel='.github/rc1112/build-three-env.mjs';
const file=path.join(ROOT,rel);
let source=fs.readFileSync(file,'utf8');

// RC1454: RC1131 originally inserted a real newline into the generated demo runtime.
// After later RC352 changes the unique anchor can live inside generated JavaScript text,
// where that newline breaks the surrounding literal. Keep the two guards separated by
// a normal statement space instead. This is valid both as direct code and as generated
// code text and preserves the exact RC1131 demo-isolation behavior.
const before='  html=html.replace(runtimeAnchor," if(window.__EXPORTHUB_DEMO_MODE__===true)return;\\n if(!window.__EXPORTHUB_TEST_PORTAL__)return;");';
const after='  html=html.replace(runtimeAnchor," if(window.__EXPORTHUB_DEMO_MODE__===true)return; if(!window.__EXPORTHUB_TEST_PORTAL__)return;");';

if(!source.includes(after)){
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(`RC1454 Demo-Inline-Syntax: erwarteter RC1131-Anker ${count}x gefunden`);
  source=source.replace(before,after);
  fs.writeFileSync(file,source,'utf8');
}

const verified=fs.readFileSync(file,'utf8');
if(!verified.includes(after))throw new Error('RC1454 Demo-Inline-Syntax-Hotfix wurde nicht angewendet');
if(verified.includes(before))throw new Error('RC1454 unsicherer RC1131-Newline-Anker ist noch vorhanden');
console.log('RC1454 release-gate hotfix applied: RC1131 demo inline syntax hardened');
