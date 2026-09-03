import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('TESTVERSION.html','utf8');

function buildVersion(){
  const m=html.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)'/);
  return m ? {version:Number(m[1]),cache:Number(m[2])} : {version:0,cache:0};
}

function classicScripts(source){
  const out=[];
  const rx=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while((m=rx.exec(source))){
    const attrs=m[1]||'';
    if(/\bsrc\s*=/.test(attrs))continue;
    const tm=attrs.match(/\btype\s*=\s*['"]([^'"]+)['"]/i);
    const type=tm ? tm[1].trim().toLowerCase() : '';
    if(type && !['text/javascript','application/javascript','text/ecmascript','application/ecmascript'].includes(type))continue;
    out.push({attrs,code:m[2],index:m.index});
  }
  return out;
}

function outsideScriptText(source){
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
    .replace(/<!--([\s\S]*?)-->/g,' ');
}

test('RC975: globaler Render-Integritätscheck ist aktiv',()=>{
  const build=buildVersion();
  assert.ok(build.version>=975,'BUILD muss RC975 oder höher sein');
  assert.ok(build.cache>=975,'Cache muss RC975 oder höher sein');
});

test('RC975: jeder klassische Inline-Scriptblock ist syntaktisch vollständig',()=>{
  const scripts=classicScripts(html);
  assert.ok(scripts.length>5,'Es wurden unerwartet wenige klassische Scriptblöcke gefunden');
  const failures=[];
  scripts.forEach((s,i)=>{
    try{new vm.Script(s.code,{filename:`TESTVERSION.inline-${i+1}.js`})}
    catch(e){failures.push(`#${i+1} @${s.index}: ${e.message}`)}
  });
  assert.deepEqual(failures,[],`Beschädigte Inline-Scripts gefunden:\n${failures.join('\n')}`);
});

test('RC975: zentrale Funktionen liegen weiterhin innerhalb eines Scriptblocks',()=>{
  const joined=classicScripts(html).map(s=>s.code).join('\n');
  [
    'function printStow',
    'function normalizeActionButtons',
    'function activateQr',
    'function canonicalMail',
    'function canonicalColliCard'
  ].forEach(name=>assert.ok(joined.includes(name),`${name} liegt nicht mehr in einem ausführbaren Scriptblock`));
});

test('RC975: außerhalb von Scripts wird kein ExportHUB-JavaScript als Seitentext geleakt',()=>{
  const text=outsideScriptText(html);
  const forbidden=[
    /function\s+normalizeActionButtons\s*\(/,
    /function\s+activateQr\s*\(/,
    /function\s+canonicalMail\s*\(/,
    /function\s+canonicalColliCard\s*\(/,
    /var\s+w\s*=\s*window\.open\s*\(\s*['"]about:blank['"]/
  ];
  forbidden.forEach(rx=>assert.doesNotMatch(text,rx,`JavaScript-Leak außerhalb eines Scriptblocks erkannt: ${rx}`));
});

test('RC975: der Leck-Detektor erkennt den RC973-Fehlertyp in einer Kontrollprobe',()=>{
  const broken='<html><body><script>function demo(){var html="x";</script> function leaked(){return 1}</body></html>';
  const scripts=classicScripts(broken);
  assert.throws(()=>new vm.Script(scripts[0].code),SyntaxError,'Kontrollprobe muss einen vorzeitig beendeten Scriptblock erkennen');
  assert.match(outsideScriptText(broken),/function\s+leaked\s*\(/,'Kontrollprobe muss geleakten JavaScript-Seitentext erkennen');
});
