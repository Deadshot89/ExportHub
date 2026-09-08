import fs from 'node:fs';

const files = ['index.html', 'TESTVERSION.html'];

function replaceExactlyOnce(text, from, to, label, file) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`${file}: ${label} nicht gefunden.`);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(`${file}: ${label} mehrfach gefunden.`);
  return text.slice(0, first) + to + text.slice(first + from.length);
}

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;

  after = replaceExactlyOnce(
    after,
    "var c=costState(),section=kind==='gate'?'gate':'ups',d=activeShipmentRoute(),autoCountry=q(d.country||countryFromAddress(d.address));",
    "var c=costState(),section=kind==='gate'?'gate':'ups',d=activeShipmentRoute(),autoCountry=q(d.country||countryFromAddress(d.address)),gateCountry=autoCountry||'Deutschland';",
    'newCostRequest-Ländervorgabe',
    file
  );

  after = replaceExactlyOnce(
    after,
    "country:autoCountry,scope:autoCountry?(countryCode(autoCountry)==='DE'?'national':'international'):'',",
    "country:gateCountry,scope:countryCode(gateCountry)==='DE'?'national':'international',",
    'Gate41-Land/Scope in neuer Preisanfrage',
    file
  );

  after = replaceExactlyOnce(
    after,
    'if(load.rows.length&&!g.manualLoad){',
    'if((load.rows.length||load.pallets>0)&&!g.manualLoad){',
    'Gate41-Palettenfallback ohne Colli-Zeilen',
    file
  );

  if (after === before) throw new Error(`${file}: keine Änderung erzeugt.`);
  if (!after.includes("gateCountry=autoCountry||'Deutschland'")) throw new Error(`${file}: Deutschland-Fallback fehlt nach Patch.`);
  if (!after.includes("if((load.rows.length||load.pallets>0)&&!g.manualLoad){")) throw new Error(`${file}: Palettenfallback fehlt nach Patch.`);

  fs.writeFileSync(file, after);
  console.log(`${file}: Gate41 Nullpreisfälle korrigiert`);
}
