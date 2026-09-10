import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const BUILD=path.join(ROOT,'.github/rc1013/build-three-env.mjs');
const FLOW=path.join(ROOT,'assets/rc1015-lieferavis-mail-flow.js');
let built=false;
function build(){
  if(built)return;
  assert.ok(fs.existsSync(BUILD),'Gemeinsamer Drei-Umgebungen-Build fehlt.');
  execFileSync(process.execPath,[BUILD],{cwd:ROOT,stdio:'pipe'});
  built=true;
}
function html(name){build();return fs.readFileSync(path.join(ROOT,'dist-rc1013',name),'utf8');}
function between(source,start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`${start} konnte nicht isoliert werden`);
  return source.slice(a,b);
}

test('RC1015: Lieferavis kann aus einer noch nicht manuell gespeicherten Sendung aktiviert werden',()=>{
  const out=fs.readFileSync(FLOW,'utf8');
  const ref=between(out,'function referenceInput','async function persist');
  assert.match(ref,/sendungsreferenz\|referenznummer/i,'Die sichtbare Referenz aus dem Formular wird nicht übernommen.');
  const persist=between(out,'async function rc1015PersistBeforeAvis','function rc1021NotifyAvisUpdated');
  assert.match(persist,/await persist\(['"]Sendung vor Lieferavis automatisch gespeichert['"]\)/,'Der Lieferavis wartet nicht auf die bestätigte Azure-Speicherung.');
  const toggle=between(out,'async function rc1015Toggle(on)','function stripAvisBlocks');
  assert.match(toggle,/rc1015DraftReference\(\)/,'Die Formular-Referenz wird vor der Server-Aktivierung nicht geprüft.');
  assert.match(toggle,/if\(on\)\{rc1024ClearDraftDisabled\(sh\);await rc1015PersistBeforeAvis\(\)\}/,'Die Sendung wird vor der Server-Aktivierung nicht automatisch gespeichert.');
  assert.ok(toggle.indexOf('rc1015PersistBeforeAvis')<toggle.indexOf('base.toggle(on)'),'Der bestehende Avis-Linkpfad wird vor der dauerhaften Speicherung aufgerufen.');
  const panel=between(out,'function rc1015UpdateLieferavisButton()','function mailModeLabel');
  assert.match(panel,/panel\.setAttribute\(['"]data-active['"],active\?['"]1['"]:['"]0['"]\)/,'Der Entwurfs-Default wird im Lieferavis-Panel nicht sichtbar gespiegelt.');
  assert.match(panel,/btn\.disabled=active\?false:/,'Ein vorab aktiver Lieferavis muss sofort deaktivierbar sein.');
});

test('RC1024: Kunden- und Speditionsmail schützen eigene Vorlagen und verwenden nur einen Lieferavis-Systemblock',()=>{
  const out=fs.readFileSync(FLOW,'utf8');
  const source=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.match(source,/Details zur Sendung:\\?[\s\S]*?\{\{SENDUNGSDETAILS\}\}/,'Die normale Systemvorlage mit Sendungsdetails muss erhalten bleiben.');
  const avis=between(out,'function rc1015AvisMailVariant','function rc1024MailKey');
  assert.match(out,/LIEFERAVIS – ABHOLUNG/,'Eigener deutscher Speditions-Lieferavistext fehlt.');
  assert.match(out,/COLLECTION NOTICE – PICKUP/i,'Eigener englischer Speditions-Lieferavistext fehlt.');
  assert.match(out,/digitales Lieferavis/i,'Der professionelle Lieferavis-Hinweis fehlt.');
  assert.match(out,/Abholdatum/i,'Der Lieferavis erklärt die benötigte Abholangabe nicht.');
  assert.match(out,/Kennzeichen/i,'Der Lieferavis erklärt die im Portal erfassbaren Abholdaten nicht.');
  assert.doesNotMatch(avis,/Rückmeldung innerhalb der nächsten 24 Stunden/i,'Der Lieferavis darf nicht den alten E-Mail-Rückmeldeauftrag übernehmen.');
  const inject=between(out,'function rc1015InjectMailBody','function rc1024SyncVisibleMail');
  assert.match(inject,/if\(!rc1018Enabled\(sh\)\)return source/,'Eine deaktivierte Sendung darf die vorhandene Vorlage nicht verändern.');
  assert.match(inject,/mailSourceCache\.set\(key,source\)/,'Die unveränderte Ausgangsvorlage wird nicht für den Moduswechsel geschützt.');
  assert.match(inject,/return rc1015AvisMailVariant\(source,u,shipmentReference\(sh\),lang,type\)/,'Aktiver Lieferavis verwendet nicht den geschützten Systemblock.');
  assert.match(out,/function mailModeLabel\(type,sh,lang\)/,'Die Mailoberfläche unterscheidet Sendungsdetails und Lieferavis nicht.');
});

for(const file of ['index.html','TESTVERSION.html','demo.html']){
  test(`${file}: lädt denselben RC1015 Lieferavis-Mailfluss`,()=>{
    const out=html(file);
    assert.match(out,/rc1015-lieferavis-mail-flow\.js\?v=1021/);
  });
}

test('RC1015 Lieferavis-Korrektur wird über den gemeinsamen Drei-Umgebungen-Build ausgerollt',()=>{
  const source=fs.readFileSync(BUILD,'utf8');
  assert.match(source,/LIEFERAVIS_SRC=['"]\/assets\/rc1015-lieferavis-mail-flow\.js\?v=1021['"]/);
  assert.match(source,/copy\(['"]assets\/rc1015-lieferavis-mail-flow\.js['"]\)/);
  assert.match(source,/lieferavis:/,'Der gemeinsame Manifest-Eintrag für die Korrektur fehlt.');
});
