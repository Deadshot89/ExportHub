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
  const ref=between(out,'function rc1015DraftReference','async function persist');
  assert.match(ref,/sendungsreferenz\|referenznummer/i,'Die sichtbare Referenz aus dem Formular wird nicht übernommen.');
  const persist=between(out,'async function rc1015PersistBeforeAvis','async function rc1015Toggle');
  assert.match(persist,/await persist\(['"]Sendung vor Lieferavis automatisch gespeichert['"]\)/,'Der Lieferavis wartet nicht auf die bestätigte Azure-Speicherung.');
  const toggle=between(out,'async function rc1015Toggle(on)','function stripAvisBlocks');
  assert.match(toggle,/rc1015DraftReference\(\)/,'Die Formular-Referenz wird vor der Aktivierung nicht geprüft.');
  assert.match(toggle,/if\(on\)await rc1015PersistBeforeAvis\(\)/,'Die Sendung wird vor der Aktivierung nicht automatisch gespeichert.');
  assert.ok(toggle.indexOf('rc1015PersistBeforeAvis')<toggle.indexOf('base.toggle(on)'),'Der bestehende Avis-Linkpfad wird vor der dauerhaften Speicherung aufgerufen.');
  const panel=between(out,'function rc1015UpdateLieferavisButton()','function mailModeLabel');
  assert.match(panel,/rc1015DraftReference\(\)/,'Der Aktivieren-Button berücksichtigt die noch nicht gespeicherte Formular-Referenz nicht.');
  assert.match(panel,/btn\.disabled=.*rc1015DraftReference/,'Der Aktivieren-Button bleibt fälschlich bis zum manuellen Speichern gesperrt.');
});

test('RC1015: Kundenmail wechselt eindeutig zwischen Sendungsdetails und Lieferavis',()=>{
  const out=fs.readFileSync(FLOW,'utf8');
  const source=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.match(source,/Details zur Sendung:\\?[\s\S]*?\{\{SENDUNGSDETAILS\}\}/,'Die normale Kundenmail mit Sendungsdetails muss erhalten bleiben.');
  const avis=between(out,'function rc1015AvisMailVariant','function rc1015InjectMailBody');
  assert.match(avis,/Lieferavis/,'Eigener deutscher Lieferavis-Text fehlt.');
  assert.match(avis,/Collection notice/i,'Eigener englischer Lieferavis-Text fehlt.');
  assert.match(avis,/geplanten Abholtermin/i,'Der Lieferavis erklärt die gewünschte Rückmeldung nicht.');
  assert.match(avis,/Kennzeichen/i,'Der Lieferavis erklärt die im Portal erfassbaren Abholdaten nicht.');
  assert.doesNotMatch(avis,/Rückmeldung innerhalb der nächsten 24 Stunden/i,'Der Lieferavis darf nicht den alten E-Mail-Rückmeldeauftrag übernehmen.');
  const inject=between(out,'function rc1015InjectMailBody','function rc1015UpdateLieferavisButton');
  assert.match(inject,/target!==['"]customer['"]\|\|!base\.enabled\(sh\)/,'Normale Sendungsdetail-Mail darf nur bei aktivem Kunden-Lieferavis ersetzt werden.');
  assert.match(inject,/return rc1015AvisMailVariant\(clean,u,reference,lang\)/,'Aktiver Lieferavis verwendet nicht den eigenen Mailmodus.');
  assert.match(out,/function mailModeLabel\(type,sh,lang\)/,'Die Mailoberfläche unterscheidet Sendungsdetails und Lieferavis nicht.');
  assert.match(out,/Lieferavis.*Collection notice|Collection notice.*Lieferavis/s,'Die Sprachvarianten des Mailmodus fehlen.');
});

for(const file of ['index.html','TESTVERSION.html','demo.html']){
  test(`${file}: lädt denselben RC1015 Lieferavis-Mailfluss`,()=>{
    const out=html(file);
    assert.match(out,/rc1015-lieferavis-mail-flow\.js\?v=1015/);
  });
}

test('RC1015 Lieferavis-Korrektur wird über den gemeinsamen Drei-Umgebungen-Build ausgerollt',()=>{
  const source=fs.readFileSync(BUILD,'utf8');
  assert.match(source,/LIEFERAVIS_SRC=['"]\/assets\/rc1015-lieferavis-mail-flow\.js\?v=1015['"]/);
  assert.match(source,/copy\(['"]assets\/rc1015-lieferavis-mail-flow\.js['"]\)/);
  assert.match(source,/lieferavis:/,'Der gemeinsame Manifest-Eintrag für die Korrektur fehlt.');
});
