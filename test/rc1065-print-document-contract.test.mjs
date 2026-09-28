import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const files=['index.html','TESTVERSION.html','demo.html'];

before(()=>{
  execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'});
});

function functionBlock(html,name,nextLimit=22000){
  let start=html.indexOf('function '+name+'(');
  if(start<0)start=html.indexOf('async function '+name+'(');
  assert.ok(start>=0,name+' fehlt im finalen RC1048-Build');
  const candidates=[html.indexOf('\nfunction ',start+20),html.indexOf('\nasync function ',start+20)].filter(x=>x>start);
  const end=candidates.length?Math.min(...candidates):Math.min(html.length,start+nextLimit);
  return html.slice(start,Math.min(end,start+nextLimit));
}

test('RC1065 Druckvertrag: Produktion TESTSERVICE und Demo enthalten denselben kanonischen Dokumentpfad',()=>{
  for(const file of files){
    const html=read('dist-rc1048/'+file);
    assert.match(html,/function\s+loadHtml\s*\(/,file+': Ladelisten-Dokumentrenderer fehlt');
    assert.match(html,/function\s+createPdf\s*\(/,file+': PDF-Erzeugung fehlt');
    assert.match(html,/function\s+decorateDocument\s*\(/,file+': Dokument-Dekoration fehlt');
    assert.match(html,/CMR/i,file+': CMR-Pfad fehlt');
    assert.match(html,/Ladeliste/i,file+': Ladelisten-Pfad fehlt');
  }
});

test('RC1065 Druckvertrag: Warenbeschreibung sowie Colli Gewicht und LDM invalidieren den Dokumentcache',()=>{
  const html=read('dist-rc1048/index.html');
  const block=functionBlock(html,'documentCacheKey',7000);
  assert.match(block,/goodsDescription/,'Warenbeschreibung fehlt im Dokumentcache');
  assert.match(block,/String\(r\.length\)/,'Colli-Zeilenanzahl fehlt im Dokumentcache');
  assert.match(block,/totals\(sh\)\.count/,'physische Colli fehlen im Dokumentcache');
  assert.match(block,/totals\(sh\)\.weight/,'Gewicht fehlt im Dokumentcache');
  assert.match(block,/totals\(sh\)\.ldm/,'Lademeter fehlen im Dokumentcache');
});

test('RC1065 Druckvertrag: normale PDF-Ausgabe entfernt Pickup-QR, Teilsendungs-Ladeliste behält nur ihren freigegebenen QR',()=>{
  const html=read('dist-rc1048/index.html');
  assert.match(html,/stripQrForPdf\s*\(/,'QR-Entfernung für PDF fehlt');
  assert.match(html,/rc1017KeepQrInPdf[^\n]{0,220}stripQrForPdf/s,'Teilsendungs-Ausnahme für freigegebenen QR fehlt');
  assert.match(html,/rc1017SubShipmentDocument=true/,'Teilsendungs-Dokumentkontext fehlt');
  assert.match(html,/createPdf\s*\(\s*['"]load1['"]\s*,\s*sh\s*\)/,'Teilsendungs-Ladeliste nutzt nicht den kanonischen PDF-Pfad');
});

test('RC1065 Druckvertrag: Teilsendungsdokumente mischen keine Rows verschiedener LKW',()=>{
  const html=read('dist-rc1048/index.html');
  const rows=functionBlock(html,'rc1017RowsForSubShipment',6000);
  const doc=functionBlock(html,'rc1017SubShipmentDocumentShipment',12000);
  assert.match(rows,/subShipmentId/);
  assert.match(doc,/temp\.rows=copy\(metrics\.rows\)/);
  assert.match(doc,/temp\.totalColli=metrics\.colli/);
  assert.match(doc,/temp\.totalWeight=metrics\.weight/);
  assert.match(doc,/Hauptreferenz/);
  assert.match(doc,/subShipmentLabel/);
});

test('RC1065 Druckvertrag: Druckfehler werden sichtbar behandelt statt still zu hängen',()=>{
  const html=read('dist-rc1048/index.html');
  const download=functionBlock(html,'downloadDocument',16000);
  assert.match(download,/catch\s*\(/,'Downloadpfad besitzt keinen sichtbaren Fehlerabschluss');
  assert.match(download,/alert\s*\(|console\.error\s*\(/,'Downloadfehler werden nicht sichtbar bzw. diagnostizierbar behandelt');
  assert.match(html,/Ladeliste konnte nicht erstellt werden|Dokument[^\n]{0,120}konnte nicht/i,'sichtbare Dokument-/Ladelistenfehlermeldung fehlt');
});
