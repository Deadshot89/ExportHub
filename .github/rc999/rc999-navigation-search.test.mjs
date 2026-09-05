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
  test(`${file}: RC999 Build- und Release-Metadaten sind synchron`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/var BUILD=Object\.freeze\(\{version:'RC999',cache:'999',loginReturn:'[^']*v=999[^']*'\}\);/);
    const release=owner(html,'var RELEASE=Object.freeze({','changes:Object.freeze([');
    assert.match(release,/version:'RC999'/);
    assert.match(release,/date:'05\.09\.2026'/);
  });

  test(`${file}: RC998 Start-Härtung bleibt vollständig erhalten`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'async function loadStateAfterLogin(){','async function finishAuthenticatedLogin(){');
    assert.match(block,/loadState\(\{timeoutMs:6000,maxAttempts:1\}\)/);
    assert.match(block,/native\.setTimeout\(resolve,450\)/);
    assert.match(block,/loadState\(\{timeoutMs:9000,maxAttempts:1\}\)/);
    assert.doesNotMatch(block,/timeoutMs:14000|timeoutMs:24000/);
  });

  test(`${file}: Sendung erstellen bleibt aus dem alten DOM-Cache ausgeschlossen`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'function fastCacheable(view){','function fastShipmentKey(){');
    assert.doesNotMatch(block,/view==='shipment'/);
    assert.match(block,/view==='shipmentoverview'/);
    assert.match(block,/view==='cmr'/);
  });

  test(`${file}: globale Suche besitzt einen separaten unsichtbaren Suchtext`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'(function initIndex321(){','})();');
    assert.match(block,/function searchText\(v\)/,'searchText-Helfer fehlt');
    assert.match(block,/function add\(type,title,sub,view,action,searchValues\)/,'add muss zusätzliche Suchwerte akzeptieren');
    assert.match(block,/hay:low\(\[title,sub,\.\.\.\(searchValues\|\|\[\]\)\]/,'hay muss title/sub und versteckte Suchwerte zusammenführen');
  });

  test(`${file}: Kundensuche umfasst Adresse, Ort, Standort und Kontakt`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'(function initIndex321(){','})();');
    for(const token of ['c.accountNo','c.address','c.addressLine','c.city','c.zip','c.location','c.locations','c.contact','c.contactEmail','c.email1']){
      assert.ok(block.includes(token),`Kundensuche muss ${token} indexieren`);
    }
    assert.match(block,/selectedCustomerId=c\.id;\s*go\("customers"\)/,'Kundentreffer muss weiterhin per c.id öffnen');
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
    for(const token of required) assert.ok(block.includes(token),`Sendungssuche muss ${token} indexieren`);
    assert.match(block,/selectedShipmentId=sh\.id;\s*go\("shipmentoverview"\)/,'Sendungstreffer muss weiterhin per sh.id öffnen');
  });

  test(`${file}: Aufgabensuche umfasst Status, Priorität und Aufgabentyp`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'(function initIndex321(){','})();');
    for(const token of ['t.status','t.priority','t.type','t.kind']){
      assert.ok(block.includes(token),`Aufgabensuche muss ${token} indexieren`);
    }
    assert.match(block,/"tasks",\s*\(\)=>\{\s*go\("tasks"\);?\s*\}/,'Aufgabentreffer muss weiter in Aufgaben öffnen');
  });

  test(`${file}: Suchnavigation verschluckt Fehler nicht lautlos`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'(function initIndex321(){','})();');
    assert.doesNotMatch(block,/catch\(e\)\{\}/,'Leerer catch in der Suchnavigation ist unzulässig');
    assert.match(block,/console\.error\([^)]*search[^)]*,\s*e\)/i,'Navigationsfehler müssen diagnostizierbar sein');
  });
}
