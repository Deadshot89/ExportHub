import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('customer-avis.html','utf8');

test('RC1150: Lieferavis zeigt bei Empfänger / Lieferadresse ausschließlich die Adresse',()=>{
  const marker='<span>Empfänger / Lieferadresse</span>';
  const start=html.indexOf(marker);
  assert.notEqual(start,-1,'Lieferadressfeld fehlt auf customer-avis.html');
  const end=html.indexOf('</div>',start);\n  assert.notEqual(end,-1,'Lieferadressfeld ist nicht vollständig gerendert');\n  const block=html.slice(start,end+6);

  assert.match(
    block,
    /<b>'\+esc\(data\.recipientAddress\|\|'–'\)\+'<\/b>/,
    'Die Lieferadresse muss direkt als einziger hervorgehobener Wert angezeigt werden.'
  );
  assert.doesNotMatch(
    block,
    /recipientName|customerName/,
    'Standort-/Empfängername darf im Lieferadressfeld nicht mehr ausgegeben werden.'
  );
  assert.doesNotMatch(
    block,
    /<p>'\+esc\(data\.recipientAddress/,
    'Die Adresse darf nicht mehr als zweite Zeile unter einem Standortnamen gerendert werden.'
  );
});
