import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'assets/training-center/screenshots');
const SHOTS=Object.freeze([
  ['shipment-open.png','navigation'],
  ['shipment-new.png','new'],
  ['shipment-customer.png','customer'],
  ['shipment-location.png','location'],
  ['shipment-reference.png','reference'],
  ['shipment-details.png','details'],
  ['shipment-colli.png','colli'],
  ['shipment-weight.png','weight'],
  ['shipment-documents.png','documents'],
  ['shipment-delivery-notes.png','delivery-notes'],
  ['shipment-review.png','review'],
  ['shipment-abd.png','abd'],
  ['shipment-customs.png','customs'],
  ['shipment-save.png','save'],
  ['shipment-status.png','status'],
  ['shipment-pickup-qr.png','pickup'],
  ['shipment-completion.png','completion']
]);

const html=`<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Training Center Demo</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f4f7fb;color:#172033}.app{display:grid;grid-template-columns:230px 1fr;min-height:900px}.side{background:#15233b;color:#fff;padding:24px 16px}.brand{font-weight:800;font-size:20px;margin-bottom:28px}.nav{display:grid;gap:8px}.nav div{padding:11px 12px;border-radius:10px;background:rgba(255,255,255,.07)}.nav .active{background:#fff;color:#172033}.main{padding:28px}.banner{display:flex;justify-content:space-between;gap:20px;align-items:center;background:#fff4cc;border:1px solid #e8c94d;border-radius:14px;padding:14px 18px;margin-bottom:20px}.banner strong{font-size:13px}.banner span{font-size:12px;color:#5d4a00}.head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px}.head h1{margin:0;font-size:28px}.head p{margin:6px 0 0;color:#64748b}.badge{padding:8px 12px;border-radius:999px;background:#e8f2ff;color:#0d5db8;font-weight:700;font-size:12px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{background:#fff;border:1px solid #dbe4ef;border-radius:14px;padding:16px;min-height:104px;box-shadow:0 5px 18px rgba(15,23,42,.05)}.card h2{font-size:14px;margin:0 0 10px}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{border:1px solid #cbd5e1;border-radius:9px;padding:10px;background:#fbfdff;font-size:13px}.muted{color:#64748b;font-size:12px}.ok{color:#16794b;font-weight:700}.warn{color:#a05b00;font-weight:700}.button{display:inline-block;border-radius:9px;padding:10px 14px;background:#1f67d2;color:white;font-size:13px;font-weight:700}.secondary{background:#e9eff8;color:#172033}.shot-active{outline:4px solid #2563eb;outline-offset:3px;box-shadow:0 0 0 8px rgba(37,99,235,.12)}.footer{margin-top:16px;color:#64748b;font-size:11px}.ref{font-family:monospace;font-weight:700}
</style></head><body><div class="app">
<aside class="side"><div class="brand">ExportHUB360</div><div class="nav"><div>Übersicht</div><div class="active" data-shot="navigation">Sendungen</div><div>SOP & Training Center</div><div>Kunden</div><div>Aufgaben</div></div></aside>
<main class="main"><div class="banner"><strong>TRAININGSMODUS – KEINE PRODUKTIVDATEN</strong><span>Alle angezeigten Geschäftsdaten sind DEMO-Daten.</span></div>
<div class="head"><div><h1>Neue Sendung</h1><p>Trainingsbeispiel · Demo Kunde GmbH</p></div><span class="badge">DEMO-SHIP-001</span></div>
<section class="grid">
<div class="card" data-shot="new"><h2>Neue Sendung beginnen</h2><span class="button">Neue Sendung</span></div>
<div class="card" data-shot="customer"><h2>Kunde</h2><div class="field">DEMO-CUST-001 · Demo Kunde GmbH</div></div>
<div class="card" data-shot="location"><h2>Empfänger / Standort</h2><div class="field">DEMO-LOC-001 · Demo Empfänger · Berlin</div></div>
<div class="card" data-shot="reference"><h2>Referenz</h2><div class="field ref">DEMO01 · automatisch erzeugt · read-only</div></div>
<div class="card" data-shot="details"><h2>Sendungsdaten</h2><div class="row"><div class="field">Demo Expresssendung</div><div class="field">Ziel: Schweiz</div></div></div>
<div class="card" data-shot="colli"><h2>Colli</h2><div class="row"><div class="field">1 Paket</div><div class="field">Demo-Colli 001</div></div></div>
<div class="card" data-shot="weight"><h2>Gewicht</h2><div class="field">12,5 kg Gesamtgewicht</div></div>
<div class="card" data-shot="documents"><h2>Dokumente</h2><div class="muted">DEMO-LS-001.pdf · vorhanden</div><div class="warn">DEMO-INVOICE-001.pdf · fehlt absichtlich</div></div>
<div class="card" data-shot="delivery-notes"><h2>Lieferscheine</h2><div class="field">DEMO-LS-001 · geprüft</div></div>
<div class="card" data-shot="review"><h2>Gesamtprüfung</h2><div class="warn">1 Trainingshinweis erkannt</div></div>
<div class="card" data-shot="abd"><h2>ABD-Pflicht</h2><div class="field">Nicht-EU · Warenwert 1.250 EUR</div><div class="warn">ABD erforderlich</div></div>
<div class="card" data-shot="customs"><h2>Zollinformationen</h2><div class="row"><div class="field">HS 39269097</div><div class="field">Ursprung DE</div></div></div>
<div class="card" data-shot="save"><h2>Sendung speichern</h2><span class="button">Demo-Sendung speichern</span><p class="muted">Nur Memory-State</p></div>
<div class="card" data-shot="status"><h2>Status</h2><div class="ok">Erstellt · Trainingsstatus</div></div>
<div class="card" data-shot="pickup"><h2>QR / Abholung</h2><div class="field">Demo-QR · keine reale Freigabe</div></div>
<div class="card" data-shot="completion"><h2>Abschlusskontrolle</h2><div class="ok">13/13 Trainingsschritte abgeschlossen</div></div>
</section><div class="footer">Sichere Trainingsgrafik · ausschließlich DEMO-Daten · keine Verbindung zu Produktivsystemen</div></main>
</div></body></html>`;

fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await page.setContent(html,{waitUntil:'domcontentloaded'});
  for(const [file,key] of SHOTS){
    await page.locator('[data-shot]').evaluateAll(nodes=>nodes.forEach(node=>node.classList.remove('shot-active')));
    const target=page.locator(`[data-shot="${key}"]`).first();
    if(await target.count()!==1)throw new Error(`Screenshot-Ziel fehlt: ${key}`);
    await target.evaluate(node=>node.classList.add('shot-active'));
    await target.scrollIntoViewIfNeeded();
    const targetPath=path.join(OUT,file);
    await page.screenshot({path:targetPath,fullPage:false});
    const size=fs.statSync(targetPath).size;
    if(size<10000)throw new Error(`${file}: Screenshot ist unplausibel klein (${size} Byte)`);
  }
}finally{
  await browser.close();
}

console.log(`Training-Center Screenshots erstellt: ${SHOTS.length} Dateien in assets/training-center/screenshots`);
