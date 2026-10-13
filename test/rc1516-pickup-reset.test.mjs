import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const init=fs.readFileSync('api/pickup-init/index.js','utf8');

test('RC1516 P0: pickup-init verarbeitet resetPickup fuer bestaetigte Fehlscans',()=>{
  assert.match(init,/resetPickup/,'Server muss das bereits vom Client gesendete resetPickup-Signal auswerten');
  assert.match(init,/pickupResetHistory/,'Fehlscan muss als Auditspur erhalten bleiben');
  assert.match(init,/pickupHistory\s*=\s*\[\]/,'aktive Abholhistorie muss geleert werden');
  assert.match(init,/pickupCollectedColliCount\s*=\s*0/,'aktive Abholmenge muss zurueckgesetzt werden');
  assert.match(init,/pickupRemainingColliCount\s*=\s*expected/,'volle Sollmenge muss wieder offen sein');
  assert.match(init,/\.status\s*=\s*'open'/,'QR-Serverstatus muss wieder open sein');
  assert.match(init,/\.complete\s*=\s*false/,'Abholung darf nicht mehr als abgeschlossen gelten');
  assert.match(init,/\.confirmedAt\s*=\s*null/,'Bestaetigungszeit muss aktiv entfernt werden');
  assert.match(init,/signatureBlobName\s*=\s*''/,'falsche Fahrerunterschrift darf nicht aktiv bleiben');
  assert.match(init,/podFiles\s*=\s*\[\]/,'POD des Fehlscans darf nicht aktiv bleiben');
  assert.match(init,/uploadKeyHash\s*=\s*''/,'POD-Uploadschluessel des Fehlscans muss invalidiert werden');
  assert.match(init,/sealNumber\s*=\s*''/,'falsche Siegelnummer muss entfernt werden');
  assert.match(init,/containerPhotos\s*=\s*\[\]/,'Containerfotos des Fehlscans duerfen nicht aktiv bleiben');
  assert.match(init,/carrierName\s*=\s*''/,'falsch erfasste Spedition muss vor dem Metadaten-Refresh entfernt werden');
  assert.match(init,/customsDocumentsSignatureBlobName\s*=\s*''/,'historische Zollunterschrift eines Fehlscans muss entfernt werden');
  assert.match(init,/automaticPodBlobName\s*=\s*''/,'alter automatischer POD-Verweis darf nicht aktiv bleiben');
});
