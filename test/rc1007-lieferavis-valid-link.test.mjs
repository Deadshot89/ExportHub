import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=['index.html','TESTVERSION.html'];

for(const file of files){
  test(`${file}: Lieferavis verwendet ausschließlich den serverseitig registrierten Zugriff`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const moduleStart=html.indexOf('if(window.__EXPORTHUB_CUSTOMER_AVIS_706__)return;');
    const moduleEnd=html.indexOf('window.ExportHUBCustomerAvis705=api;',moduleStart);
    assert.ok(moduleStart>0&&moduleEnd>moduleStart,`${file}: Kunden-Avis-Modul fehlt`);
    const avis=html.slice(moduleStart,moduleEnd);

    assert.match(avis,/SECURITY_VERSION=995/,`${file}: alter Avis-Sicherheitsstand ist noch aktiv`);
    assert.doesNotMatch(avis,/SECURITY_VERSION=2(?:\D|$)/,`${file}: SECURITY_VERSION 2 darf nicht mehr ausgeliefert werden`);
    assert.match(avis,/function rc995AvisHeaders\(/,`${file}: sichere interne Avis-Header fehlen`);
    assert.match(avis,/async function rc995AvisAction\(/,`${file}: serverseitige Avis-Aktion fehlt`);
    assert.match(avis,/fetch\('\/api\/customer-avis'/,`${file}: Avis muss über die Server-API ausgestellt werden`);
    assert.doesNotMatch(avis,/var newToken=makeToken\(\)/,`${file}: Browser darf keinen eigenständigen Avis-Token mehr erzeugen`);

    const linkStart=avis.indexOf('function link(sh)');
    const linkEnd=avis.indexOf('function patchCopies',linkStart);
    assert.ok(linkStart>0&&linkEnd>linkStart,`${file}: link(sh) fehlt`);
    const linkFn=avis.slice(linkStart,linkEnd);
    assert.match(linkFn,/customerAvisPublicUrl|avisPublicUrl/,`${file}: Link muss die vom Server ausgegebene URL verwenden`);
    assert.match(linkFn,/customer-avis\.html/,`${file}: kanonische öffentliche Avis-Seite fehlt`);
    assert.match(linkFn,/environment=/,`${file}: Umgebung muss Bestandteil des Links sein`);

    const toggleStart=avis.indexOf('async function toggle(on)');
    const toggleEnd=avis.indexOf('async function autoDisableIfDue()',toggleStart);
    assert.ok(toggleStart>0&&toggleEnd>toggleStart,`${file}: Avis-toggle fehlt`);
    const toggleFn=avis.slice(toggleStart,toggleEnd);
    assert.match(toggleFn,/rc995AvisAction\(on\?'issue':'disable',sh\)/,`${file}: Aktivieren/Deaktivieren muss über die Server-API laufen`);
    assert.match(toggleFn,/customerAvisToken:q\(data\.token\)/,`${file}: registrierter Server-Token wird nicht übernommen`);
    assert.match(toggleFn,/customerAvisPublicUrl:q\(data\.url\)/,`${file}: API-URL wird nach dem Ausstellen nicht übernommen`);
  });
}

test('öffentliche Avis-URL wird niemals in den gemeinsamen Sendungszustand persistiert',()=>{
  const merge=fs.readFileSync('api/shared/merge.js','utf8');
  assert.match(merge,/customerAvisPublicUrl/);
  assert.match(merge,/avisPublicUrl/);
  assert.match(merge,/PUBLIC_ACCESS_SECRET_KEYS/);
});
