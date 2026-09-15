import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const seed=require('../api/shared/rc1014-fixed-pickup-seed.js');
const key=x=>`${x.siteLabel}|${x.weekday}`;

const APPROVED=[
  'Frankreich|1','Italien|1','O’Hare|1','Esysco|1','Gaggenau|1','Barcelona|1','Madrid|1','UK|1',
  'Faurecia|2','Adolf Würth|2','Gorenje Slovenien|2','UK|2',
  'BMP|3','BSH Hausgeräte|3','Contitech|3','UK|3',
  'Adolf Würth|4','Madrid|4','Barcelona|4','Polen|4','UK|4','China|4','Indien|4','Australien|4','Singapur|4','Shenzhen HK|4','Thailand|4',
  'Schweden|5','UK|5'
].sort((a,b)=>a.localeCompare(b,'de'));

test('RC1078: freigegebener Essentra-FIX-Bestand ist exakt und ohne zusätzliche Systemeinträge',()=>{
  assert.equal(seed.SEED_VERSION,10);
  const actual=seed.defaultsForCompany('ESSENTRA').map(key).sort((a,b)=>a.localeCompare(b,'de'));
  assert.deepEqual(actual,APPROVED);
  assert.equal(actual.some(x=>/^NEFF\|/i.test(x)),false);
  assert.equal(seed.defaultsForCompany('ESSENTRA').find(x=>x.siteLabel==='BSH Hausgeräte'&&x.weekday===3).note,'Fixzeit 13:00');
});

test('RC1078: unberührte falsche alte System-FIX-Einträge werden beim Seed-Upgrade entfernt',()=>{
  const stale={
    id:'FIX-RC1024-ESSENTRA-FALSCH-MI',siteLabel:'Falscher Altbestand',weekday:3,note:'',active:true,
    createdBy:'System RC1014',updatedBy:'System RC1014'
  };
  const merged=seed.mergeMissing([stale],'ESSENTRA','2026-09-13T10:00:00.000Z');
  assert.equal(merged.some(x=>x.id===stale.id),false);
  assert.deepEqual(merged.map(key).sort((a,b)=>a.localeCompare(b,'de')),APPROVED);
});

test('RC1078: manuell bearbeitete oder manuell angelegte FIX-Abholungen bleiben erhalten',()=>{
  const touched={
    id:'FIX-RC1024-ESSENTRA-SONDER-MI',siteLabel:'Sonderkunde',weekday:3,note:'manuell bestätigt',active:true,
    createdBy:'System RC1014',updatedBy:'Tobias'
  };
  const manual={
    id:'FIX-manual-1',siteLabel:'Manuell angelegt',weekday:5,note:'',active:true,
    createdBy:'Tobias',updatedBy:'Tobias'
  };
  const merged=seed.mergeMissing([touched,manual],'ESSENTRA','2026-09-13T10:00:00.000Z');
  assert.equal(merged.some(x=>x.id===touched.id),true);
  assert.equal(merged.some(x=>x.id===manual.id),true);
});
