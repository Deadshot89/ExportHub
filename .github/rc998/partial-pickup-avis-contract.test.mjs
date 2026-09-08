import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// RC1003: dieser Vertrag prueft die bedienbare Teilabholung gegen den echten QR-Dialog.
const root=process.cwd();
const html=fs.readFileSync('TESTVERSION.html','utf8');
const productionHtml=fs.readFileSync('index.html','utf8');
const avisHtml=fs.readFileSync('customer-avis.html','utf8');
const avisApi=fs.readFileSync('api/customer-avis/index.js','utf8');
const pickupHtml=fs.readFileSync('pickup.html','utf8');
const pickupConfirm=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');
const pickupStatus=fs.readFileSync('api/pickup-status/index.js','utf8');
const pickupStore=fs.readFileSync('api/shared/pickup-store.js','utf8');

test('Lieferavis verwendet ausschließlich die ExportHUB-Sendungsreferenz',()=>{
  assert.doesNotMatch(avisHtml,/name="shipmentNumber"/);
  assert.match(avisHtml,/Sendungsreferenz/);
  assert.doesNotMatch(avisApi,/appointment:\{[^}]*shipmentNumber:/);
  assert.doesNotMatch(avisApi,/SHIPMENT_NUMBER_REQUIRED/);
  assert.match(avisApi,/customerAvisShipmentNumber:reference/);
  assert.match(avisApi,/const v=validateAppointment\(payload\),stamp=now\(\),reference=sref\(target\)/);
});

test('Kundenmail ersetzt bei aktivem Lieferavis die Sendungsdetails',()=>{
  for(const [name,source] of [['Produktion',productionHtml],['TESTVERSION',html]]){
    const start=source.indexOf('function injectMailBody(sh,target,body,langOverride)');
    const end=source.indexOf('function click(e)',start);
    const fn=source.slice(start,end);
    assert.ok(start>0&&end>start,`${name}: injectMailBody fehlt`);
    assert.match(fn,/if\(target!==['"]customer['"]\|\|!enabled\(sh\)\)return clean;clean=stripShipmentDetails\(clean\)/,`${name}: Sendungsdetails müssen nur bei aktivem Kunden-AVIS entfernt werden`);
    assert.match(fn,/Lieferavis-Link bleibt bis drei Arbeitstage nach der tatsächlichen Abholung gültig|Der Link wird drei Arbeitstage nach der tatsächlichen Abholung automatisch deaktiviert/,`${name}: AVIS-Hinweis fehlt`);
    assert.match(fn,/Samstage und Sonntage gelten dabei nicht als Arbeitstage|Samstag und Sonntag zählen nicht mit/,`${name}: Wochenend-Hinweis fehlt`);
  }
});

test('Outlook erhält auch bei langen Vorlagen den vollständigen Mailtext',()=>{
  const start=html.indexOf('function launchMail(data)');
  const end=html.indexOf('function setOpenedOnCopies',start);
  const fn=html.slice(start,end);
  assert.ok(start>0&&end>start,'launchMail fehlt');
  assert.doesNotMatch(fn,/full\.length<=1800/);
  assert.doesNotMatch(fn,/mailtoUrl\(data,false\)/);
  assert.match(fn,/mailtoUrl\(data,true\)/);
});

test('QR-Abholung unterstützt Teilabholung und Restmenge',()=>{
  assert.match(pickupHtml,/Teilabholung/);
  assert.match(pickupHtml,/Vollständige Abholung/);
  assert.match(pickupHtml,/remainingPickupCollis/);
  assert.match(pickupHtml,/collectedPickupCollis/);
  assert.match(pickupHtml,/data-mode=["']partial["']/);
  assert.match(pickupHtml,/data-mode=["']complete["']/);
  assert.match(pickupHtml,/pickupMode:mode/);
  assert.match(pickupHtml,/remainingBefore/);
  assert.match(pickupConfirm,/pickupHistory/);
  assert.match(pickupConfirm,/remainingAfter/);
  assert.match(pickupConfirm,/complete/);
  assert.match(pickupStatus,/allowUsed:false/);
  assert.match(pickupStore,/pickupRemainingColliCount/);
  assert.match(pickupStore,/pickupCollectedColliCount/);
});

test('Teilabholung verbraucht QR erst bei vollständiger Abholung und Abholtag bleibt offen',()=>{
  assert.match(pickupConfirm,/if\(complete\)await access\.consume/);
  assert.match(pickupConfirm,/if\(!complete(?:&&[^)]*)?\).*access\.clearFailures/);
  assert.match(pickupStore,/if\(complete\).*abholtag/s);
  assert.match(pickupStore,/Teilweise abgeholt/);
});

test('Jede Teilabholung speichert einen getrennten Signaturnachweis',()=>{
  assert.match(pickupStore,/saveDriverSignature\(c,record,dataUrl,suffix/);
  assert.match(pickupStore,/driver-signature-/);
  assert.match(pickupConfirm,/signatureBlobName:signatureMeta\.signatureBlobName/);
  assert.match(pickupConfirm,/sequence:/);
});


test('Lieferavis-Link trägt seine Umgebung und die öffentliche Seite übernimmt sie',()=>{
  assert.match(avisApi,/customer-avis\.html\?token=.*environment/);
  assert.match(avisApi,/encodeURIComponent\(env\)/);
  assert.match(avisHtml,/searchParams\.get\(['"]environment['"]\)/);
  assert.match(avisHtml,/environment=testservice|dataEnvironment/);
});
