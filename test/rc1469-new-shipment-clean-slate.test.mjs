import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function freshBlock(html){
  const start=html.indexOf('function startFreshShipment(){');
  const end=html.indexOf('function enforceFreshDraft(){',start);
  assert.ok(start>=0&&end>start,'Fresh-Draft-Block fehlt im Build');
  return html.slice(start,end);
}

test('RC1469 P0: Neue Sendung ersetzt einen vorhandenen Draft immer durch einen Clean-Slate-Draft',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const block=freshBlock(fs.readFileSync('dist-rc1112/'+file,'utf8'));
    assert.match(block,/window\.currentCreateShipment=\{id:'R-NEU',customer:'',reference:'',status:'Offen',planned:_rc1413Today\(\),documents:0\};/,file+': neuer Draft wird nicht initialisiert');
    assert.doesNotMatch(block,/if\(!form\|\|!window\.currentCreateShipment\)\{window\.currentCreateShipment=/,file+': alter Draft kann weiterhin wiederverwendet werden');
  }
});

test('RC1469 P0: Clean-Slate-Vertrag schützt die bekannten Datenintegritätsfelder',()=>{
  const contract={
    customer:'ALT Kunde',reference:'ALT-REF',remarks:'Altbemerkung',
    deliveryNotes:['ALT-DNC.pdf'],attachments:['ALT.pdf'],
    dimensions:[{l:120,w:80,h:90}],weight:850,
    abdFiles:['ALT-ABD.pdf'],cmrFiles:['ALT-CMR.pdf'],status:'Abgeholt'
  };
  const fresh={id:'R-NEU',customer:'',reference:'',status:'Offen',planned:'2026-10-09',documents:0};
  assert.notStrictEqual(fresh,contract,'neue Sendung muss eine neue Objekt-Referenz erhalten');
  for(const key of ['remarks','deliveryNotes','attachments','dimensions','weight','abdFiles','cmrFiles']){
    assert.equal(Object.prototype.hasOwnProperty.call(fresh,key),false,key+' darf nicht aus dem alten Draft übernommen werden');
  }
  assert.equal(fresh.customer,'');
  assert.equal(fresh.reference,'');
  assert.equal(fresh.status,'Offen');
});
