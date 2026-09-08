import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appFiles=['index.html','TESTVERSION.html'];

for(const file of appFiles){
  test(`${file}: Lieferavis ersetzt die Sendungsdetails an derselben Vorlagenposition`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const start=html.indexOf('function injectMailBody(sh,target,body,langOverride)');
    const end=html.indexOf('function click(e)',start);
    assert.ok(start>0&&end>start,`${file}: injectMailBody fehlt`);
    const fn=html.slice(start,end);
    assert.match(fn,/replaceShipmentDetailsWithAvis\(clean,block,lang\)/);
    assert.match(fn,/LIEFERAVIS/);
    assert.match(fn,/COLLECTION NOTICE/);
    assert.match(fn,/fünf Kalendertage nach der tatsächlichen Abholung/);
    assert.match(fn,/five calendar days after the actual collection/);
    assert.doesNotMatch(fn,/KUNDEN-AVIS\s*[–-]\s*LIVE-ZUGANG/i);
    assert.doesNotMatch(fn,/CUSTOMER COLLECTION NOTICE\s*[–-]\s*LIVE AVIS/i);
  });

  test(`${file}: Standard-Kundenmail ist in Deutsch und Englisch professionell formuliert`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/Ihre Bestellung ist vollständig für die Abholung vorbereitet und steht in unserem Versandlager zur Verfügung\./);
    assert.match(html,/Bitte teilen Sie uns innerhalb der nächsten 24 Stunden mit, an welchem Datum die Abholung geplant ist/);
    assert.match(html,/Vielen Dank für Ihre Unterstützung\. Wir freuen uns auf Ihre Rückmeldung\./);
    assert.match(html,/Your order is fully prepared for collection and is available at our shipping warehouse\./);
    assert.match(html,/Please let us know within the next 24 hours on which date the collection is planned/);
    assert.match(html,/Thank you for your support\. We look forward to hearing from you\./);
  });

  test(`${file}: alle Kundenmail-Flows nutzen dieselbe Lieferavis-Injektion`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/injectMailBody\(sh,type,body,lang\)/);
    assert.match(html,/injectMailBody\(sh,'customer',body,lang\)/);
  });

  test(`${file}: Lieferavis bleibt bis fünf Kalendertage nach tatsächlicher Abholung aktiv`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/function autoExpiresOn\(sh\)/);
    assert.match(html,/addCalendarDays\(picked,5\)/);
    assert.match(html,/5 Kalendertage nach tatsächlicher Abholung/);
    assert.doesNotMatch(html,/3 Arbeitstage nach tatsächlicher Abholung/);
    assert.doesNotMatch(html,/3 business days after actual collection/);
  });
}

test('Kunden-Avis ist mehrfach nutzbar und wird beim Öffnen nicht verbraucht',()=>{
  const api=fs.readFileSync('api/customer-avis/index.js','utf8');
  const authStart=api.indexOf("if(req.method==='POST'&&action==='authorize')");
  const authEnd=api.indexOf('const session=sessionFromRequest',authStart);
  assert.ok(authStart>0&&authEnd>authStart,'Authorize-Block fehlt');
  const authBlock=api.slice(authStart,authEnd);
  assert.match(authBlock,/allowUsed:true/);
  assert.match(authBlock,/ignoreExpiry:true/);
  assert.doesNotMatch(authBlock,/access\.consume\(/);
  assert.match(authBlock,/rawLinkConsumed=false/);
  assert.match(api,/oneTime:false/);
  assert.match(api,/multiUse:true/);
  assert.doesNotMatch(api,/singleUse:true/);
});

test('Avis-Ablauf richtet sich nach vollständiger Abholung plus fünf Kalendertage',()=>{
  const api=fs.readFileSync('api/customer-avis/index.js','utf8');
  assert.match(api,/function avisClosesAt\(sh\)/);
  assert.match(api,/5\s*\*\s*86400000/);
  assert.match(api,/AVIS_EXPIRED/);
  assert.match(api,/ignoreExpiry:true/);
  const access=fs.readFileSync('api/shared/public-access-store.js','utf8');
  assert.match(access,/ignoreExpiry/);
  assert.match(access,/noExpiry/);
  assert.match(access,/resolveSession\(session,expectedKind,options=/);
});

test('Folgeabholung verlangt erneute aktive Bestätigung der aktuell offenen Differenz',()=>{
  const html=fs.readFileSync('pickup.html','utf8');
  assert.match(html,/restConfirmedValue/);
  assert.match(html,/restConfirmedMode/);
  assert.match(html,/restConfirmedOpen/);
  assert.match(html,/Restmenge aus vorheriger Teilabholung/);
  assert.match(html,/Bitte bestätigen Sie die aktuell offene Restmenge erneut über „Eingabe prüfen“/);
  assert.match(html,/restConfirmedValue\s*!==\s*entered/);
  assert.match(html,/restConfirmedMode\s*!==\s*mode/);
  assert.match(html,/restConfirmedOpen\s*!==\s*remainingBefore/);
  assert.match(html,/restConfirmedValue\s*=\s*0/);
  assert.match(html,/Bei der nächsten Abholung muss die dann offene Restmenge erneut bestätigt werden/);
});

test('Server akzeptiert vollständige Folgeabholung nur mit exakt offener Restmenge',()=>{
  const api=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');
  assert.match(api,/mode===['"]complete['"]&&entered!==remainingBefore/);
  assert.match(api,/Für eine vollständige Abholung muss die gesamte Restmenge bestätigt werden/);
});

test('RC995-Schutzvertrag erwartet keinen Einmal-Avis mehr',()=>{
  const flow=fs.readFileSync('.github/rc995/rc995-flow.test.cjs','utf8');
  assert.doesNotMatch(flow,/Kunden-Avis: Einmal-Link/);
  assert.match(flow,/Kunden-Avis: Mehrfach-Link/);
});
