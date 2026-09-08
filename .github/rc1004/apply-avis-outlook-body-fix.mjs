import fs from 'node:fs';

const files = ['index.html','TESTVERSION.html'];
const replacement = 'function launchMail(data){return mailAnchor(mailtoUrl(data,true))}\n';

for (const file of files) {
  const before = fs.readFileSync(file,'utf8');
  const marker = 'function launchMail(data)';
  const start = before.indexOf(marker);
  const second = before.indexOf(marker,start + marker.length);
  const end = before.indexOf('function persist(reason)',start);

  if (start < 0 || end <= start) throw new Error(`${file}: launchMail/persist Block nicht gefunden`);
  if (second >= 0) throw new Error(`${file}: launchMail ist nicht eindeutig`);

  const oldBlock = before.slice(start,end);
  const hasLongTextFallback = /full\.length\s*<=\s*1800/.test(oldBlock) || /mailtoUrl\(data,false\)/.test(oldBlock);
  if (!hasLongTextFallback) {
    if (/mailtoUrl\(data,true\)/.test(oldBlock)) {
      console.log(`${file}: Outlook-Langtext bereits korrigiert`);
      continue;
    }
    throw new Error(`${file}: weder alter Fallback noch vollständige Outlook-Übergabe gefunden; keine Blindänderung`);
  }
  if (!/full\.length\s*<=\s*1800/.test(oldBlock)) throw new Error(`${file}: 1800-Zeichen-Fallback unvollständig`);
  if (!/mailtoUrl\(data,false\)/.test(oldBlock)) throw new Error(`${file}: erwarteter Kurz-Mail-Fallback fehlt`);

  const after = before.slice(0,start) + replacement + before.slice(end);
  fs.writeFileSync(file,after);
  console.log(`${file}: Outlook-Avis übergibt den vollständigen Mailtext`);
}

for (const file of files) {
  const before = fs.readFileSync(file,'utf8');
  const marker = 'function injectMailBody(sh,target,body,langOverride)';
  const start = before.indexOf(marker);
  const end = before.indexOf('function click(e)',start);
  if (start < 0 || end <= start) throw new Error(`${file}: injectMailBody/click Block nicht gefunden`);

  const block = before.slice(start,end);
  const desired = "if(target!=='customer'||!enabled(sh))return clean;clean=stripShipmentDetails(clean);";
  if (block.includes(desired)) {
    console.log(`${file}: aktives Kunden-AVIS ersetzt Sendungsdetails bereits`);
    continue;
  }

  const old = "if(target!=='customer'||!enabled(sh))return clean;var u=link(sh),reference=ref(sh);";
  if (!block.includes(old)) throw new Error(`${file}: erwarteter AVIS-Mailblock fehlt; keine Blindänderung`);
  const patchedBlock = block.replace(old, desired + 'var u=link(sh),reference=ref(sh);');
  const after = before.slice(0,start) + patchedBlock + before.slice(end);
  fs.writeFileSync(file,after);
  console.log(`${file}: aktives Kunden-AVIS ersetzt jetzt die Sendungsdetails`);
}
