import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html','utf8');

function buildVersion(){
  const m=html.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)'/);
  return m ? {version:Number(m[1]),cache:Number(m[2])} : {version:0,cache:0};
}

function rc971Css(){
  const m=html.match(/<style id="rc971-global-form-field-standard">([\s\S]*?)<\/style>/i);
  return m ? m[1] : '';
}

test('RC971: globaler Form-&-Field-Standard ist kanonisch und lesbar',()=>{
  const build=buildVersion();
  assert.ok(build.version>=971,'BUILD muss RC971 oder höher sein');
  assert.ok(build.cache>=971,'Cache muss RC971 oder höher sein');

  const css=rc971Css();
  assert.ok(css,'RC971 Stylesheet fehlt');
  assert.match(css,/@layer\s+rc971/i,'RC971 muss als kanonische Cascade-Layer definiert sein');
  assert.match(css,/--rc971-control-h\s*:\s*42px/i,'Desktop-Feldhöhe muss 42px sein');
  assert.match(css,/--rc971-control-font\s*:\s*14px/i,'Desktop-Eingabetext muss 14px sein');
  assert.match(css,/--rc971-label-font\s*:\s*12px/i,'Feldlabels müssen 12px sein');
  assert.match(css,/--rc971-button-font\s*:\s*13px/i,'Form-Buttons müssen 13px sein');

  assert.match(css,/input:not\(\[type="checkbox"\]\)/i,'Normale Inputs müssen global erfasst werden');
  assert.match(css,/select/i,'Selects müssen global erfasst werden');
  assert.match(css,/textarea/i,'Textareas müssen global erfasst werden');
  assert.match(css,/input\[type="file"\]/i,'Uploadfelder müssen separat formatiert werden');
  assert.match(css,/input\[type="checkbox"\]/i,'Checkboxen müssen separat behandelt werden');
  assert.match(css,/input\[type="radio"\]/i,'Radios müssen separat behandelt werden');
  assert.match(css,/input\[type="number"\]/i,'Zahlenfelder müssen wegen Spinner/Innenabstand separat behandelt werden');
  assert.match(css,/::placeholder/i,'Placeholder-Typografie muss definiert sein');

  assert.match(css,/#rc363BlockColli[\s\S]*?\[data-rc363-field\]/i,'Colli-Felder brauchen expliziten RC971-Schutz');
  assert.match(css,/#rc363BlockColli[\s\S]*?\.rc344-summary/i,'Colli-Summary braucht expliziten RC971-Schutz');
  assert.match(css,/#rc363BlockDocuments[\s\S]*?textarea/i,'Dokument-Textarea muss explizit korrigiert werden');
  assert.match(css,/#rc363BlockAbdDecision[\s\S]*?button/i,'ABD-Auswahlbuttons müssen explizit korrigiert werden');
  assert.match(css,/#rc543MailArea/i,'Mailfelder müssen im globalen Standard berücksichtigt sein');
  assert.match(css,/#index218Planner/i,'Planner-Felder müssen im globalen Standard berücksichtigt sein');
  assert.match(css,/#rc380StowPlan/i,'Stauplan-Steuerfelder müssen berücksichtigt sein');

  assert.match(css,/@media\s*\(max-width:\s*720px\)[\s\S]*?--rc971-control-font\s*:\s*16px/i,'Mobile Eingabefelder müssen 16px erhalten');
  assert.match(css,/@media\s*\(max-width:\s*720px\)[\s\S]*?--rc971-control-h\s*:\s*42px/i,'Mobile Feldhöhe darf nicht wieder schrumpfen');
});

test('RC971: Druck-/CMR-/Signaturbereiche bleiben vom Formularstandard ausgenommen',()=>{
  const css=rc971Css();
  assert.match(css,/:not\(#loadListDoc \*\)/i,'Ladelisten-Druckbereich muss ausgenommen sein');
  assert.match(css,/:not\(\.rc390-paper \*\)/i,'Dokument-/CMR-Papier muss ausgenommen sein');
  assert.match(css,/:not\(\.index209-signature-dialog \*\)/i,'Signaturdialog muss ausgenommen sein');
});
