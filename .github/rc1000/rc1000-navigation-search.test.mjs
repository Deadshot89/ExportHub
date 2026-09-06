import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const FILES=['index.html','TESTVERSION.html'];

function owner(text,start,end){
  const a=text.indexOf(start);
  assert.notEqual(a,-1,`${start} fehlt`);
  const b=text.indexOf(end,a+start.length);
  assert.notEqual(b,-1,`${end} fehlt`);
  return text.slice(a,b);
}

for(const file of FILES){
  test(`${file}: RC1000 Build- und Release-Metadaten sind synchron`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/var BUILD=Object\.freeze\(\{version:'RC1000',cache:'1000',loginReturn:'[^']*v=1000[^']*'\}\);/);
    const release=owner(html,'var RELEASE=Object.freeze({','changes:Object.freeze([');
    assert.match(release,/version:'RC1000'/);
    assert.match(release,/date:'06\.09\.2026'/);
  });

  test(`${file}: globale Suche besitzt separaten unsichtbaren Suchtext`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'(function initIndex321(){','})();');
    assert.match(block,/function searchText\(v\)/,'searchText-Helfer fehlt');
    assert.match(block,/function add\(type,title,sub,view,action,searchValues\)/,'add muss zusätzliche Suchwerte akzeptieren');
    assert.match(block,/hay:low\(\[title,sub,\.\.\.\(searchValues\|\|\[\]\)\]\.map\(searchText\)\.join\(' '\)\)/,'hay muss sichtbare und versteckte Suchwerte zusammenführen');
  });

  test(`${file}: Kundensuche umfasst Adresse, Ort, Standort und Kontakt`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'(function initIndex321(){','})();');
    for(const token of ['c.accountNo','c.address','c.addressLine','c.city','c.zip','c.location','c.locations','c.contact','c.contactEmail','c.email1']) assert.ok(block.includes(token),`${token} fehlt`);
    assert.match(block,/selectedCustomerId=c\.id;\s*go\("customers"\)/);
  });

  test(`${file}: Sendungssuche umfasst Empfänger, Lieferort, Standort und Spedition`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'(function initIndex321(){','})();');
    const required=[
      'sh.customerAddress','sh.customerCity','sh.customerZip','sh.customerCountry',
      'sh.recipient','sh.recipientName','sh.recipientCity','sh.recipientZip','sh.recipientCountry',
      'sh.deliveryAddress','sh.deliveryCity','sh.deliveryZip','sh.deliveryCountry',
      'sh.destination','sh.destinationAddress','sh.destinationCity','sh.destinationZip','sh.destinationCountry',
      'sh.shipTo','sh.shipToName','sh.shipToCity','sh.shipToZip','sh.shipToCountry',
      'sh.location','sh.locationName','sh.site','sh.siteName',
      'sh.carrier','sh.carrierName','sh.forwarder','sh.forwarderName','sh.contact','sh.email'
    ];
    for(const token of required) assert.ok(block.includes(token),`${token} fehlt`);
    assert.match(block,/selectedShipmentId=sh\.id;\s*go\("shipmentoverview"\)/);
  });

  test(`${file}: Aufgabensuche umfasst Status, Priorität und Aufgabentyp`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'(function initIndex321(){','})();');
    for(const token of ['t.status','t.priority','t.type','t.kind']) assert.ok(block.includes(token),`${token} fehlt`);
    assert.match(block,/"tasks",\s*\(\)=>\{\s*go\("tasks"\);?\s*\}/);
  });

  test(`${file}: Suchnavigation verschluckt Fehler nicht lautlos`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'(function initIndex321(){','})();');
    assert.doesNotMatch(block,/catch\(e\)\{\}/);
    assert.match(block,/console\.error\([^)]*search[^)]*,\s*e\)/i);
  });
}

test('RC1000 Environment-Hub sitzt im echten Topbar-Kontext statt über dem Seiteninhalt',()=>{
  const js=fs.readFileSync('assets/exporthub-environment-hub.js','utf8');
  assert.match(js,/querySelector\(['"]\.topbar['"]\)|getElementById\(['"]ehTopbarEnvironment['"]\)/i);
  assert.match(js,/(?:mount|topbar|slot)\.appendChild\(hub\)|(?:mount|topbar|slot)\.append\(hub\)/i);
  assert.match(js,/#eh996-env-hub\{[^}]*position:relative;/s);
  assert.doesNotMatch(js,/#eh996-env-hub\{[^}]*position:fixed;/s);
  assert.match(js,/#eh996-env-panel\{[^}]*position:absolute;/s);
  assert.doesNotMatch(js,/#eh996-env-panel\{[^}]*position:fixed;/s);
  assert.match(js,/#eh996-env-switch\{[^}]*background:#2563eb;/s);
  assert.match(js,/@media\(max-width:640px\)\{#eh996-env-hub\{[^}]*width:100%;/s);
});

test('RC1000 schützt weiterhin den Produktionsmarker RC997',()=>{
  const prod=fs.readFileSync('production-version.js','utf8');
  assert.match(prod,/RC997/);
  assert.doesNotMatch(prod,/RC1000/);
});
