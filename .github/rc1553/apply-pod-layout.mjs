import fs from 'node:fs';

function replaceExact(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`RC1553 patch miss: ${label}`);
  return source.replace(oldText, newText);
}

const archivePath = 'api/shared/pod-archive.js';
let archive = fs.readFileSync(archivePath, 'utf8');

archive = replaceExact(
  archive,
  "const POD_PDF_LAYOUT_VERSION = 'RC1361-STRUCTURED-V1';",
  "const POD_PDF_LAYOUT_VERSION = 'RC1553-SIGNED-LOADING-LIST-V2';",
  'layout version'
);
archive = replaceExact(
  archive,
  "return 'POD_' + ref + suffix + '_Abliefernachweis.pdf';",
  "return 'POD_' + ref + suffix + '_Ladeliste_unterschrieben.pdf';",
  'signed loading-list filename'
);

const helperMarker = 'async function createPodPdf(record, signatureBuffer, signatureType) {';
const helpers = String.raw`function deliveryNoteNames(record) {
  const out = [];
  const seen = new Set();
  const sources = [
    record && record.deliveryFiles,
    record && record.deliveryNotesFiles,
    record && record.deliveryNoteFiles,
    record && record.deliveryNotes,
    record && record.lieferscheine,
    record && record.packingSlips,
    record && record.packingSlipFiles,
    record && record.deliveryNoteNames,
    record && record.packingSlipNames
  ];
  function add(value) {
    if (value && typeof value === 'object') {
      value = value.fileName || value.name || value.originalName || value.deliveryNoteNumber || value.deliveryNote || value.packingSlip || value.number || value.label || value.id;
    }
    let raw = text(value);
    if (!raw) return;
    const matches = raw.match(/[^,;]*?\.pdf/gi);
    if (matches && matches.length > 1) {
      matches.forEach(add);
      return;
    }
    raw = raw.split(/[\\/]/).pop();
    const key = raw.toUpperCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(raw);
  }
  sources.forEach(source => {
    if (Array.isArray(source)) source.forEach(add);
    else add(source);
  });
  return out;
}
function palletBalanceText(record) {
  const history = typeof store.pickupHistory === 'function' ? store.pickupHistory(record || {}) : (Array.isArray(record && record.pickupHistory) ? record.pickupHistory : []);
  const last = history.length ? history[history.length - 1] || {} : {};
  const snapshot = record && (record.palletAccountSnapshot || record.palletBalanceSnapshot || record.europalletAccount || record.euroPalletAccount) || last.palletAccountSnapshot || last.palletBalanceSnapshot || {};
  const candidates = [
    snapshot.balance,
    snapshot.currentBalance,
    snapshot.value,
    record && record.palletAccountBalance,
    record && record.palletBalance,
    record && record.euroPalletBalance,
    last.palletAccountBalance,
    last.palletBalance,
    last.euroPalletBalance
  ];
  let balance = null;
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || text(candidate) === '') continue;
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) { balance = Math.round(parsed); break; }
  }
  if (!Number.isFinite(balance)) return 'Kontostand nicht erfasst';
  const amount = Math.abs(balance);
  const customer = text(snapshot.name || snapshot.customerName || record && (record.customerName || record.customer || record.recipient)) || 'Kunde';
  if (balance > 0) return 'Zu Gunsten Essentra: ' + amount + ' Europaletten';
  if (balance < 0) return 'Zu Gunsten ' + customer + ': ' + amount + ' Europaletten';
  return 'Ausgeglichen: 0 Europaletten';
}
`;
if (!archive.includes('function deliveryNoteNames(record)')) {
  if (!archive.includes(helperMarker)) throw new Error('RC1553 patch miss: createPodPdf marker');
  archive = archive.replace(helperMarker, helpers + '\n' + helperMarker);
}

const createStart = archive.indexOf(helperMarker);
const createEnd = archive.indexOf('async function readAutomaticPodBuffer(', createStart);
if (createStart < 0 || createEnd <= createStart) throw new Error('RC1553 patch miss: createPodPdf block');
const newCreate = String.raw`async function createPodPdf(record, signatureBuffer, signatureType) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const navy = rgb(.13,.22,.36), muted = rgb(.38,.44,.53), border = rgb(.76,.81,.87), pale = rgb(.96,.98,1), green = rgb(.91,.97,.93);
  const x = 42, width = 511;
  const SIGNATURE_CARD_HEIGHT = 58;
  const SIGNATURE_MAX_HEIGHT = 34;
  const history = typeof store.pickupHistory === 'function' ? store.pickupHistory(record) : (Array.isArray(record.pickupHistory) ? record.pickupHistory : []);
  const last = history.length ? history[history.length - 1] : {};
  const value = (...parts) => parts.find(v => v !== undefined && v !== null && text(v)) || '-';
  const draw = (s, px, py, size=9, font=normal, color=navy) => page.drawText(pdfText(s).slice(0,250), {x:px,y:py,size,font,color});
  function card(label, content, cx, top, w, h=57) {
    page.drawRectangle({x:cx,y:top-h,width:w,height:h,borderColor:border,borderWidth:.7,color:rgb(1,1,1)});
    draw(label.toUpperCase(),cx+10,top-15,7,bold,muted);
    const lines=wrap(content,Math.max(18,Math.floor((w-20)/4.8))).slice(0,3);
    lines.forEach((s,i)=>draw(s,cx+10,top-30-i*11,9,i===0?bold:normal));
  }
  draw('ExportHUB360',x,796,16,bold,navy);
  draw('LADELISTE',x+126,796,16,bold,navy);
  card('Sendungsreferenz',value(record.reference),x+355,781,156,55);
  page.drawLine({start:{x,y:719},end:{x:x+width,y:719},thickness:1.4,color:navy});
  card('Absender',value(record.senderName,record.sender,'Essentra Components Ltd'),x,706,247,65);
  card('Empfaenger / Kunde',value(record.recipient,record.customer),x+259,706,252,65);
  card('Transport / Anmeldung',value(record.carrierName,record.speditionName,record.carrier,record.spedition),x,629,247,56);
  card('Lieferadresse',value(record.address),x+259,629,252,56);
  const rows=Array.isArray(record.rows)?record.rows:[];
  let y=557;
  page.drawRectangle({x,y:y-25,width,height:25,color:pale,borderColor:border,borderWidth:.7});
  draw('POS.',x+8,y-16,8,bold);draw('VERPACKUNG',x+48,y-16,8,bold);draw('ANZAHL',x+230,y-16,8,bold);draw('GEWICHT KG',x+335,y-16,8,bold);
  y-=25;
  for(const [i,row] of rows.slice(0,6).entries()){
    const r=row||{};page.drawRectangle({x,y:y-21,width,height:21,borderColor:border,borderWidth:.45});
    draw(String(i+1),x+8,y-14,8);draw(value(r.type,r.packaging,r.verpackung,r.packageType,r.packagingType),x+48,y-14,8);
    draw(String(value(r.count,r.quantity,r.qty)),x+230,y-14,8);draw(String(value(r.weight,r.kg)),x+335,y-14,8);y-=21;
  }
  if(rows.length>6){draw('Weitere '+(rows.length-6)+' Packstueckpositionen im ExportHUB-Datensatz',x+8,y-12,8);y-=19;}
  y-=13;
  card('Colli gesamt',String(typeof store.expectedCollis==='function'?store.expectedCollis(record):value(record.expectedColliCount,record.colliCount)),x,y,247,49);
  card('Colli abgeholt',String(typeof store.pickupCollectedColliCount==='function'?store.pickupCollectedColliCount(record):value(record.pickupCollectedColliCount,record.collectedPickupCollis)),x+259,y,252,49);
  y-=64;
  const top=y;
  page.drawRectangle({x,y:top-24,width,height:24,color:green,borderColor:border,borderWidth:.7});
  draw('SENDUNG ABGEHOLT',x+10,top-16,10,bold);
  draw(formatDate(value(record.confirmedAt,last.confirmedAt)),x+320,top-16,8,bold);
  y=top-30;
  const cellW=(width-12)/3;
  card('Fahrer',value(last.driverName,record.driverName),x,y,cellW,51);
  card('Kennzeichen',value(last.licensePlate,record.licensePlate),x+cellW+6,y,cellW,51);
  card('Verlader',value(last.loaderName,record.loaderName,record.loadedBy),x+2*(cellW+6),y,cellW,51);
  y-=57;
  const signatureX=x+cellW+6;
  card('Spedition',value(record.carrierName,record.speditionName,record.carrier,record.spedition),x,y,cellW,SIGNATURE_CARD_HEIGHT);
  card('Fahrerunterschrift','',signatureX,y,cellW,SIGNATURE_CARD_HEIGHT);
  card('Europaletten-Kontostand',palletBalanceText(record),x+2*(cellW+6),y,cellW,SIGNATURE_CARD_HEIGHT);
  let image=null;
  try { image=/png/i.test(signatureType||'')?await pdf.embedPng(signatureBuffer):await pdf.embedJpg(signatureBuffer); }catch(_){}
  if(image){
    const dims=image.scale(1),maxW=cellW-20,scale=Math.min(maxW/dims.width,SIGNATURE_MAX_HEIGHT/dims.height);
    page.drawImage(image,{x:signatureX+10,y:y-SIGNATURE_CARD_HEIGHT+5,width:dims.width*scale,height:dims.height*scale});
  }else draw('Unterschrift gespeichert',signatureX+10,y-45,8);

  const deliveryNotes = deliveryNoteNames(record);
  const deliveryTop = y - SIGNATURE_CARD_HEIGHT - 10;
  if (deliveryNotes.length) {
    draw('LIEFERSCHEINE / DELIVERY NOTES',x,deliveryTop,7,bold,muted);
    const bottom = 66;
    const available = Math.max(26, deliveryTop - bottom - 13);
    const targetRows = Math.max(1, Math.floor(available / 6));
    const columnCount = Math.min(6, Math.max(1, Math.ceil(deliveryNotes.length / targetRows)));
    const rowsPerColumn = Math.max(1, Math.ceil(deliveryNotes.length / columnCount));
    const lineHeight = Math.max(4.6, Math.min(7.5, available / rowsPerColumn));
    const fontSize = Math.max(4.1, Math.min(6.7, lineHeight - .5));
    const colW = width / columnCount;
    deliveryNotes.forEach((name,index)=>{
      const col = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const maxChars = Math.max(12, Math.floor((colW - 7) / Math.max(2.5, fontSize * .53)));
      draw(pdfText(name).slice(0,maxChars),x+col*colW,deliveryTop-13-row*lineHeight,fontSize,normal,navy);
    });
  }
  draw('Nachweis-ID: '+text(record.accessKey||'').slice(0,20),x,49,7,normal,muted);
  draw('Quelle: ExportHUB QR-Abholung',x+245,49,7,normal,muted);
  return Buffer.from(await pdf.save());
}
`;
archive = archive.slice(0, createStart) + newCreate + archive.slice(createEnd);

const retryOld = "  const existing = await readAutomaticPodBuffer(accessKey, environment, record);\n  if (!existing) return ensureAutomaticPod(accessKey, environment, { copyToDrive: true });";
const retryNew = "  const currentFile = automaticPod(record);\n  if (currentFile && !isCurrentAutomaticPod(currentFile)) return ensureAutomaticPod(accessKey, environment, { force: true, copyToDrive: true });\n  const existing = await readAutomaticPodBuffer(accessKey, environment, record);\n  if (!existing) return ensureAutomaticPod(accessKey, environment, { copyToDrive: true });";
archive = replaceExact(archive, retryOld, retryNew, 'stale archive regeneration');
fs.writeFileSync(archivePath, archive);

const pickupPath = 'api/pickup-pod/index.js';
let pickup = fs.readFileSync(pickupPath, 'utf8');
pickup = replaceExact(
  pickup,
  "const apiI18n=require('../shared/i18n');",
  "const apiI18n=require('../shared/i18n');\nconst podArchive=require('../shared/pod-archive');",
  'pickup POD archive dependency'
);
const directOld = "if(!f)throw store.err('POD_FILE_NOT_FOUND',apiI18n.t(req,'api.pod.fileNotFound'),404);blobName=text(f.blobName||f.storageBlobName||f.path||f.storagePath);";
const directNew = "if(!f)throw store.err('POD_FILE_NOT_FOUND',apiI18n.t(req,'api.pod.fileNotFound'),404);if(String(f&&f.kind||'').toLowerCase()==='automatic-pod'){const pod=await podArchive.getPodDownload(accessKey,resolved.environment,fileId);context.res={status:200,headers:{'Content-Type':'application/pdf','Content-Length':String(pod.buffer.length),'Cache-Control':'private, no-store, no-cache, must-revalidate','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'},isRaw:true,body:pod.buffer};return}blobName=text(f.blobName||f.storageBlobName||f.path||f.storagePath);";
pickup = replaceExact(pickup, directOld, directNew, 'version-aware public POD download');
fs.writeFileSync(pickupPath, pickup);

console.log('RC1553 POD patch applied');
