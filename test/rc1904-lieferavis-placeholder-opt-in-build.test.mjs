import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {injectAvisPlaceholderOptIn} from '../.github/packmeldungen/build-three-env.mjs';

const preview='if(draftBody!==null)body=draftBody;';
const send="if(f.to)f.to.value=rec.to.join('; ');";

test('RC opt-in: finaler Build ersetzt Lieferavis-Platzhalter im Betreff für die Vorschau und Outlook',()=>{
  const input='<html><script>'+preview+'\n'+send+'</script></html>';
  const result=injectAvisPlaceholderOptIn(input,'index.html');
  assert.match(result,/renderSubject\(subject,lang\)/);
  assert.match(result,/renderSubject\(subject,q\(/);
  assert.match(result,/Lieferavis-Link ist nicht verfügbar oder für diesen Empfänger gesperrt/);
  assert.match(result,/if\(\/\\\{\\\{\\s\*LIEFERAVIS/);
  assert.equal(injectAvisPlaceholderOptIn(result),result,'Mehrfach-Build darf die Patch-Anweisung nicht duplizieren');
});
test('RC opt-in: geänderter Mail-Composer stoppt den Build statt still den Schutz zu verlieren',()=>{
  assert.throws(()=>injectAvisPlaceholderOptIn('<html>unbekannter Mail-Composer</html>'),/genau einmal vorhanden/);
});
test('RC opt-in: alle drei Umgebungen werden über den gemeinsamen Pack-Build verändert',()=>{
  const source=fs.readFileSync('.github/packmeldungen/build-three-env.mjs','utf8');
  assert.match(source,/for\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)/);
  assert.match(source,/injectAvisPlaceholderOptIn\(injectPackRuntime/);
  assert.match(source,/fingerprintAssets\(\{root,out\}\)/,'Hashing muss den geänderten Endstand prüfen');
});
