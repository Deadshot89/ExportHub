import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

function block(start,end){
  const a=html.indexOf(start);
  assert.notEqual(a,-1,`Startanker fehlt: ${start}`);
  const b=html.indexOf(end,a+start.length);
  assert.notEqual(b,-1,`Endanker fehlt: ${end}`);
  assert.ok(b>a,`Ungültiger Block ${start} → ${end}`);
  return html.slice(a,b);
}

function hasAll(source,needles){
  for(const needle of needles)assert.ok(source.includes(needle),`Pflichtvertrag fehlt: ${needle}`);
}

test('RC1533 abgeholte Sendung darf nur durch Ersteller oder globalen Admin zur Datenreparatur geöffnet werden',()=>{
  const rights=block('function userKey(u){','function statusAtOrAfterPickup(sh){');
  hasAll(rights,[
    'function isGlobal(u)',
    'function isCreator(sh,u)',
    'function canReset(sh)',
    'return isGlobal(u)||isCreator(sh,u)'
  ]);
});

test('RC1533 Sendung wieder öffnen startet ausschließlich Datenreparatur und keinen QR-Reset',()=>{
  const repair=block('function repairShipment(el){','function resetPickup(el){');
  hasAll(repair,[
    'canReset(sh)',
    'Grund der Datenreparatur',
    '__EXPORTHUB_OPEN_SHIPMENT_REPAIR__',
    'sid(sh)||sref(sh),reason'
  ]);
  assert.equal(repair.includes('reactivateQr('),false,'Datenreparatur darf QR nicht reaktivieren');
  assert.equal(repair.includes('clearPickupFields('),false,'Datenreparatur darf Abholnachweise nicht löschen');
  assert.equal(repair.includes('pickup-init'),false,'Datenreparatur darf keinen Pickup-Init-Reset verwenden');
});

test('RC1533 Reparaturmodus konserviert bestätigte Abhol-, POD- und Signaturnachweise',()=>{
  const evidence=block('function repairEvidence(){','function restoreLockedShipmentBaseline(sh){');
  hasAll(evidence,[
    'function applyRepairEvidence(sh)',
    'function protectRepairEvidenceFields()',
    "key==='actualPickupDate'",
    'pod|unterschrift|signature',
    'QR-Abholung bleibt während der Datenreparatur unverändert.',
    'function markRepairAudit(sh)',
    "action:'Datenreparatur abgeholte Sendung'",
    'function lockEvidencePatch(sh)',
    'status|processStatus|pickup|qrPickup|pickedUp|actualPickup|pod|driverSignature|signature'
  ]);
});

test('RC1533 Reparaturmodus hebt die normale Abgeholt-Sperre nur für die aktive Reparatur auf',()=>{
  const readonly=block('function shipmentReadOnly(sh){','function lockedShipment(){');
  hasAll(readonly,[
    'if(repairActive(sh))return false',
    'abgeholt|pod vorhanden|abgeschlossen|archiviert',
    'pickupQrUsed===true',
    'qrPickupConfirmed===true',
    'podAvailable===true',
    'signatureAvailable===true'
  ]);
});

test('RC1533 Reparatur öffnet den gespeicherten Datensatz mit eingefrorenen Prozessnachweisen',()=>{
  const openRepair=block('function openRepairShipment(value,reason){','window.__EXPORTHUB_OPEN_SHIPMENT_REPAIR__=openRepairShipment;');
  hasAll(openRepair,[
    'richestRepairSource(value)',
    'lockEvidencePatch(source)',
    '__rc844RepairShipmentId',
    '__rc844RepairShipmentRef',
    '__rc844RepairEvidence',
    '__rc844RepairReason',
    'openSavedExact(source)',
    'applyRepairEvidence(shipment())',
    'unlockEditableShipmentForm()',
    'protectRepairEvidenceFields()'
  ]);
});

test('RC1533 Speichern einer Reparatur schreibt Audit, bewahrt Evidenz und sperrt erst nach bestätigtem Azure-Save wieder',()=>{
  const save=block('async function saveAction(){','function selectSaved(){');
  const persistAt=save.indexOf('var ok=await persistenceSave()');
  const clearAt=save.indexOf('clearRepairMode()');
  const relockAt=save.indexOf('lockShipmentForm(lockedAfterRepair,false)');
  assert.notEqual(persistAt,-1,'Azure-Persistenz fehlt im Reparatur-Save');
  assert.notEqual(clearAt,-1,'Reparaturmodus wird nach Save nicht beendet');
  assert.notEqual(relockAt,-1,'Erneute Sperre nach Reparatur fehlt');
  assert.ok(clearAt>persistAt,'Reparaturmodus darf erst nach bestätigtem Azure-Save beendet werden');
  assert.ok(relockAt>clearAt,'Erneute Sperre muss nach Ende des Reparaturmodus erfolgen');
  hasAll(save,[
    'if(repairActive(savingShipment)){markRepairAudit(savingShipment);applyRepairEvidence(savingShipment)}',
    'if(repairActive(savingShipment))applyRepairEvidence(savingShipment)',
    "operationStep(opToken,'Sendung wird dauerhaft in Azure gespeichert …')",
    'if(ok!==true)',
    'var wasRepair=!!(saved&&repairActive(saved))',
    'if(wasRepair)applyRepairEvidence(saved)',
    'Datenreparatur dauerhaft gespeichert · Abholung/POD unverändert',
    'dataRepair:true'
  ]);
});

test('RC1533 Sendungsübersicht bietet Wiederöffnen separat vom QR-Reset an und verdrahtet beide Aktionen',()=>{
  const buttons=block('function ensureResetButton(card,id,sh){','function patchOverview(){');
  hasAll(buttons,[
    "repair.textContent='Sendung wieder öffnen'",
    "repair.dataset.rc628RepairShipment='1'",
    "reset.textContent='QR-Abholung zurücksetzen'",
    "reset.dataset.rc628ResetPickup='1'"
  ]);
  hasAll(html,[
    "closest('[data-rc628-repair-shipment=\"1\"]')",
    'repairShipment(repair)',
    "closest('[data-rc628-reset-pickup=\"1\"]')",
    'resetPickup(reset)'
  ]);
});

test('RC1533 echter QR-Fehlscan bleibt ein ausdrücklich getrennter Reset-Pfad',()=>{
  const reset=block('function resetPickup(el){','function ensureResetButton(card,id,sh){');
  hasAll(reset,[
    'Falschen QR-Scan wirklich zurücksetzen und die Sendung wieder öffnen?',
    'reactivateQr(sh,reason)',
    'clearPickupFields(sh,reason)',
    "persist('Falschen QR-Scan zurückgesetzt')"
  ]);
});
