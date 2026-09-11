import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const PATCH=path.join(ROOT,'.github/rc1049/fix-mail-abd-gate.mjs');
const pages=['index.html','TESTVERSION.html','demo.html'].filter(page=>fs.existsSync(path.join(ROOT,page)));

function assertMailUnlocked(html,label){
  const start=html.indexOf('function mailAreaHtml(){');
  const end=html.indexOf('function refreshMailAreaFields(',start);
  assert.ok(start>=0&&end>start,label+': Mailbereich fehlt');
  const mailArea=html.slice(start,end);
  assert.doesNotMatch(mailArea,/Mail gesperrt: ABD noch nicht abgeschlossen\./);
  assert.doesNotMatch(mailArea,/if\(!m\.abdOk\)reason\.push\('ABD noch nicht abgeschlossen'\)/);
  assert.doesNotMatch(mailArea,/!m\.abdOk\s*\|\|\s*!m\.to/);
  assert.doesNotMatch(mailArea,/!opened\s*\|\|\s*!m\.abdOk/);
  assert.match(mailArea,/ABD noch nicht vorhanden\. Die Mail kann mit Lieferavis versendet werden\./);
  assert.match(mailArea,/!m\.to\|\|!m\.templateOk/,'Empfänger und Mailvorlage bleiben echte Mail-Sperren');
}

test('RC1049: bereits vorbereiteter Release enthält keine ABD-Mail-Sperre mehr',()=>{
  assertMailUnlocked(fs.readFileSync('index.html','utf8'),'index.html');
});

test('RC1049: fehlendes ABD ist nach Patch im Mailbereich nur Hinweis und keine Sperre',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'exporthub-rc1049-mail-'));
  try{
    for(const page of pages)fs.copyFileSync(path.join(ROOT,page),path.join(tmp,page));
    execFileSync(process.execPath,[PATCH],{cwd:tmp,stdio:'pipe'});
    for(const page of pages)assertMailUnlocked(fs.readFileSync(path.join(tmp,page),'utf8'),page);
  }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
