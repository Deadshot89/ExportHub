import fs from 'node:fs';

const files = ['index.html', 'TESTVERSION.html'];
const before = "function packagingList(){var s=state(),sources=[arr(s.colliTypes)],out=[],seen={};try{if(window.SEED)sources.push(arr(window.SEED.colliTypes))}catch(_){}sources.push(PACK);";
const after = "function packagingList(){var s=state(),fixed=PACK.filter(function(x){return /^E[0-6]$/i.test(q(x.name))}),sources=[fixed,arr(s.colliTypes)],out=[],seen={};try{if(window.SEED)sources.push(arr(window.SEED.colliTypes))}catch(_){}sources.push(PACK);";

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${file}: erwartete packagingList-Fundstelle genau 1x, gefunden ${occurrences}x`);
  }
  const updated = source.replace(before, after);
  if (updated === source) throw new Error(`${file}: keine Änderung erzeugt`);
  fs.writeFileSync(file, updated);
  console.log(`${file}: E0-E6-Stammdaten werden nun vor gespeicherten Colli-Typen ausgewertet.`);
}
