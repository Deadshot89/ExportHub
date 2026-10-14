import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('pickup.html','utf8');

function pos(marker){
  const index=page.indexOf(marker);
  assert.ok(index>=0,'Marker fehlt: '+marker);
  return index;
}

test('RC1527: Schrittleiste bildet Sendung, Collis, Container, Fahrer und Bestätigung ab',()=>{
  assert.match(page,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  const sendung=pos('1 · Sendung');
  const collis=pos('2 · Collis');
  const container=pos('3 · Container');
  const fahrer=pos('4 · Fahrer');
  const bestaetigung=pos('5 · Bestätigung');
  assert.ok(sendung<collis&&collis<container&&container<fahrer&&fahrer<bestaetigung);
  assert.match(page,/id="stepContainer"/);
  assert.match(page,/id="stepDriver"/);
  assert.match(page,/id="stepConfirm"/);
});

test('RC1527: Containerdaten werden erst nach erfolgreicher Colli-Prüfung freigeschaltet',()=>{
  assert.match(page,/<section id="containerSection" class="section" hidden>/);
  assert.match(page,/function setDriverStepUnlocked\(on\)[\s\S]*?container\.hidden=!on[\s\S]*?driver\.hidden=!on/);
  assert.match(page,/setPickupFlowStage\(on\?'container':'colli'\)/);
});

test('RC1527: sichtbare Reihenfolge ist Collis, Siegel, drei Bilder, Fahrer, Zollbestätigung, Unterschrift, PIN',()=>{
  const collis=pos('id="colliSection"');
  const container=pos('id="containerSection"');
  const seal=pos('id="sealNumber"');
  const photo1=pos('id="containerPhotoLoaded"');
  const photo2=pos('id="containerPhotoNumber"');
  const photo3=pos('id="containerPhotoSealed"');
  const driver=pos('id="driverStep"');
  const customs=pos('id="customsDocumentsField"');
  const signature=pos('id="signatureOpen"');
  const pin=pos('id="pin"');
  assert.ok(collis<container&&container<seal&&seal<photo1&&photo1<photo2&&photo2<photo3&&photo3<driver&&driver<customs&&customs<signature&&signature<pin);
});

test('RC1527: Submit validiert ABD-Übergabe vor Fahrerunterschrift und PIN',()=>{
  const submit=page.indexOf("form.addEventListener('submit'");
  assert.ok(submit>=0);
  const block=page.slice(submit);
  const customs=block.indexOf('if(customsDocumentsRequired&&!customsConfirmed)');
  const signature=block.indexOf("if(!/^data:image\\/jpeg;base64,/i.test(sig))");
  const pin=block.indexOf("if(!/^\\d{4}$/.test(pin))");
  assert.ok(customs>=0&&signature>=0&&pin>=0);
  assert.ok(customs<signature&&signature<pin,'Validierung muss Zollbestätigung → Unterschrift → PIN folgen');
});
