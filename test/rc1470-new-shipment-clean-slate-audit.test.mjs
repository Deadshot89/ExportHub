import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function build(){
  execFileSync(process.execPath,['scripts/rc1462-pretest.mjs'],{stdio:'pipe'});
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
}

function freshBlock(html){
  const start=html.indexOf('function startFreshShipment(){');
  const end=html.indexOf('function enforceFreshDraft(){',start);
  assert.ok(start>=0&&end>start,'Fresh-Draft-Block fehlt');
  return html.slice(start,end);
}

const requiredEmptyFields=[
  'customerId','customerNo','customerName','customerSearch',
  'carrier','carrierName','comments','notes','goodsDescription','incoterm',
  'licensePlate','loader'
];
const requiredEmptyArrays=[
  'documents','files','docs','deliveryFiles','deliveryNotesFiles','lieferscheine',
  'podFiles','abdFiles','cmrFiles','invoiceFiles','mailAttachments','attachments'
];
const requiredZeroFields=['totalWeight','totalColli','totalLdm','goodsValue'];

test('RC1470 P0: Neue Sendung startet in allen drei Builds ohne volatile Alt-Daten',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const block=freshBlock(fs.readFileSync('dist-rc1112/'+file,'utf8'));
    assert.match(block,/createReference\(\)/,file+': neue Referenz fehlt');
    for(const field of requiredEmptyFields){
      assert.match(block,new RegExp('(?:^|[,;{])\\s*'+field+"\\s*:\\s*''"),file+': '+field+' wird nicht explizit geleert');
    }
    for(const field of requiredEmptyArrays){
      assert.match(block,new RegExp('(?:^|[,;{])\\s*'+field+'\\s*:\\s*\\[\\]'),file+': '+field+' wird nicht explizit geleert');
    }
    for(const field of requiredZeroFields){
      assert.match(block,new RegExp('(?:^|[,;{])\\s*'+field+'\\s*:\\s*0(?:[,;}])'),file+': '+field+' wird nicht auf 0 gesetzt');
    }
    assert.match(block,/status\s*:\s*'Entwurf'/,file+': Status startet nicht als Entwurf');
    assert.match(block,/draft\s*:\s*true/,file+': Draft-Flag fehlt');
    assert.doesNotMatch(block,/localStorage|sessionStorage|indexedDB/i,file+': Fresh-Start darf keine alten lokalen Draft-Caches einlesen');
  }
});
