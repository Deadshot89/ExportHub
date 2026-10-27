'use strict';

const crypto = require('crypto');
const store = require('./pickup-store');
const graphDrive = require('./graph-drive');
const TEAM_POD_LINK_VERSION = 'RC1340';
const POD_PDF_LAYOUT_VERSION = 'RC1600-SIGNED-LOADING-LIST-V4';
// RC1577: layout of the signed loading list rendered in the browser (assets/document-print-name.js,
// window.EXPORTHUB_POD_RENDER_LAYOUT). Supplied PODs carry it as renderLayout so the POD quality audit
// can tell PODs rendered after the RC1560/RC1561 signature and bottom-tile fixes from older ones.
const POD_RENDER_LAYOUT = 'RC1595';

function text(value) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}
function safeCode(value) {
  return text(value).replace(/[^A-Za-z0-9_.-]+/g, '').slice(0, 80);
}
function safeFilePart(value) {
  return (text(value) || 'Sendung').replace(/[\\/:*?"<>|#%]/g, '_').replace(/\s+/g, '_').slice(0, 90);
}
function pdfText(value) {
  return text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\xFF]/g, '?');
}
function automaticPod(record) {
  return (Array.isArray(record && record.podFiles) ? record.podFiles : []).find(file => String(file && file.kind || '').toLowerCase() === 'automatic-pod') || null;
}
function renderLayoutOf(value) {
  const layout = text(value).toUpperCase();
  return /^RC\d{3,5}$/.test(layout) ? layout : '';
}
function isCurrentAutomaticPod(file) {
  return !!file && String(file.kind || '').toLowerCase() === 'automatic-pod' && text(file.layoutVersion) === POD_PDF_LAYOUT_VERSION;
}
function fileNameFor(record) {
  const ref = safeFilePart(record && record.reference);
  const seq = Math.max(0, Math.round(Number(record && record.subShipmentSequence) || 0));
  const total = Math.max(0, Math.round(Number(record && record.subShipmentTotal) || 0));
  const suffix = seq && total ? '_Teil_' + seq + '-von-' + total : '';
  return 'POD_' + ref + suffix + '_Ladeliste_unterschrieben.pdf';
}
function wrap(value, max) {
  const words = pdfText(value).split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? current + ' ' + word : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}
function formatDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return text(value) || '-';
  try {
    return date.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'medium' });
  } catch (_) {
    return date.toISOString();
  }
}
function deliveryNoteNames(record) {
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
  // Same sign convention as the interactive loading list: outgoing minus returned EUR pallets.
  const history = typeof store.pickupHistory === 'function' ? store.pickupHistory(record || {}) : (Array.isArray(record && record.pickupHistory) ? record.pickupHistory : []);
  const last = history.length ? history[history.length - 1] || {} : {};
  const snapshot = record && (record.palletAccountSnapshot || record.palletBalanceSnapshot || record.europalletAccount || record.euroPalletAccount) || last.palletAccountSnapshot || last.palletBalanceSnapshot || {};
  const candidates = [
    snapshot.balance, snapshot.currentBalance, snapshot.value,
    record && record.palletAccountBalance, record && record.palletBalance, record && record.euroPalletBalance,
    last.palletAccountBalance, last.palletBalance, last.euroPalletBalance
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || text(candidate) === '') continue;
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      const balance = Math.round(parsed);
      return (balance > 0 ? '+' : '') + balance + ' EP';
    }
  }
  return '-';
}
function palletReturnText(record) {
  const history = typeof store.pickupHistory === 'function' ? store.pickupHistory(record || {}) : (Array.isArray(record && record.pickupHistory) ? record.pickupHistory : []);
  const last = history.length ? history[history.length - 1] || {} : {};
  const raw = last.returnedEuroPallets == null || text(last.returnedEuroPallets) === '' ? record && record.returnedEuroPallets : last.returnedEuroPallets;
  if (raw == null || text(raw) === '') return '';
  const count = Number(raw);
  return Number.isSafeInteger(count) && count > 0 ? count + ' EP' : '';
}

// RC1602 P0: older signed pickup snapshots did not freeze delivery-note names.
// Resolve only the matching existing shipment, read-only, before printing a POD.
// This never changes the stored original signature, pickup record or team state.
async function resolvePodDeliveryNotes(record,clients,environment){
  if(deliveryNoteNames(record).length)return record;
  if(!clients||!clients.team||typeof clients.team.getBlockBlobClient!=='function')return record;
  let loaded;
  try{
    const blob=clients.team.getBlockBlobClient(store.teamBlobName(environment));
    loaded=await store.readJson(blob,null);
  }catch(error){
    throw store.err('POD_DELIVERY_NOTES_READ_FAILED','Lieferscheine können nicht sicher geprüft werden. POD wurde nicht neu erzeugt.',503);
  }
  const doc=loaded&&loaded.value||{};
  const state=doc.state&&typeof doc.state==='object'?doc.state:doc;
  const sid=text(record&&record.shipmentId),ref=text(record&&record.reference).toUpperCase(),sub=text(record&&record.subShipmentId);
  if(!sid&&!ref)return record;
  const candidates=[...(Array.isArray(state.shipments)?state.shipments:[]),...(Array.isArray(state.savedShipments)?state.savedShipments:[])];
  let best=[];
  for(const source of candidates){
    if(!source||typeof source!=='object')continue;
    const sourceId=text(source.id||source.shipmentId),sourceRef=text(source.ref||source.reference||source.shipmentRef).toUpperCase();
    const sourceSub=text(source.subShipmentId);
    if(!(sid&&sourceId===sid)&&!(ref&&sourceRef===ref))continue;
    if(sub&&sourceSub&&sourceSub!==sub)continue;
    const activeFiles=files=>Array.isArray(files)?files.filter(file=>!/deleted|gelöscht|geloscht|replaced|ersetzt|storniert/i.test(text(file&&file.status))):files;
    const snapshot={
      deliveryFiles:activeFiles(source.deliveryFiles),
      deliveryNotesFiles:activeFiles(source.deliveryNotesFiles),
      deliveryNoteFiles:activeFiles(source.deliveryNoteFiles),
      deliveryNotes:activeFiles(source.deliveryNotes),
      lieferscheine:activeFiles(source.lieferscheine),
      packingSlips:activeFiles(source.packingSlips),
      packingSlipFiles:activeFiles(source.packingSlipFiles),
      deliveryNoteNames:source.deliveryNoteNames,
      packingSlipNames:source.packingSlipNames
    };
    const names=deliveryNoteNames(snapshot);
    if(names.length>best.length)best=names;
  }
  return best.length?Object.assign({},record,{deliveryNotes:best}):record;
}
async function createPodPdf(record, signatureBuffer, signatureType) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
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
  const overflowRows=[];
  for(const [i,row] of rows.slice(0,6).entries()){
    const r=row||{};page.drawRectangle({x,y:y-21,width,height:21,borderColor:border,borderWidth:.45});
    const packaging=value(r.type,r.packaging,r.verpackung,r.packageType,r.packagingType);
    const needsDetail=normal.widthOfTextAtSize(pdfText(packaging),8)>171;
    if(needsDetail)overflowRows.push({index:i,row:r});
    draw(String(i+1),x+8,y-14,8);
    draw(needsDetail?'Details siehe Anlage':packaging,x+48,y-14,8);
    draw(String(value(r.count,r.quantity,r.qty)),x+230,y-14,8);
    draw(String(value(r.weight,r.kg)),x+335,y-14,8);y-=21;
  }
  rows.forEach((row,index)=>{if(index>=6)overflowRows.push({index,row});});
  if(overflowRows.length){draw('Weitere / ausfuehrliche Positionen auf Anlage: '+overflowRows.length,x+8,y-12,8);y-=19;}
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
  // RC1594: match the compact two-row pallet tile in the browser/print loading list.
  // Never treat this shipment's palletOut as the customer's account balance.
  const palletX=x+2*(cellW+6);
  page.drawRectangle({x:palletX,y:y-SIGNATURE_CARD_HEIGHT,width:cellW,height:SIGNATURE_CARD_HEIGHT,borderColor:border,borderWidth:.7,color:rgb(1,1,1)});
  draw('PALETTENKONTO / EUR PALLETS',palletX+8,y-13,6.3,bold,muted);
  draw('Aktueller Stand / Balance',palletX+8,y-29,6.2,normal,muted);
  draw(palletBalanceText(record),palletX+cellW-48,y-29,8,bold,navy);
  draw('Eingang / Return',palletX+8,y-45,6.2,normal,muted);
  const palletReturn=palletReturnText(record);
  if(palletReturn)draw(palletReturn,palletX+cellW-48,y-45,8,bold,navy);
  else page.drawLine({start:{x:palletX+cellW-48,y:y-47},end:{x:palletX+cellW-10,y:y-47},thickness:.8,color:navy});
  let image=null;
  // RC1600: image bytes, not potentially stale MIME metadata, identify the driver's original ink.
  const signatureBytes=Buffer.from(signatureBuffer||[]);
  const png=signatureBytes.length>=8&&signatureBytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=signatureBytes.length>=3&&signatureBytes[0]===255&&signatureBytes[1]===216&&signatureBytes[2]===255;
  // RC1609: pdf-lib's JPEG parser uses the underlying ArrayBuffer. Short
  // Node.js Buffers can share a pooled slab at a nonzero byteOffset. Supply
  // exact original bytes in a standalone zero-offset Uint8Array instead.
  const exactImageBytes=Uint8Array.from(signatureBytes);
  try {
    image=png?await pdf.embedPng(exactImageBytes):jpeg?await pdf.embedJpg(exactImageBytes):
      (/png/i.test(signatureType||'')?await pdf.embedPng(exactImageBytes):await pdf.embedJpg(exactImageBytes));
  }catch(_){}
  if(!image)throw store.err('POD_SIGNATURE_IMAGE_INVALID','Die gespeicherte Fahrerunterschrift kann nicht als Bild gelesen werden. Kein Ersatz-POD erzeugt.',409);
  const dims=image.scale(1),maxW=cellW-20,scale=Math.min(maxW/dims.width,SIGNATURE_MAX_HEIGHT/dims.height);
  page.drawImage(image,{x:signatureX+10,y:y-SIGNATURE_CARD_HEIGHT+5,width:dims.width*scale,height:dims.height*scale});

  // RC1600: never compress dozens of delivery-note lines below A4 safety margins.
  // The driver signature and pallet card always stay together on page one.
  const deliveryNotes=deliveryNoteNames(record);
  const deliveryTop=y-SIGNATURE_CARD_HEIGHT-10;
  const overflowNotes=[];
  if(deliveryNotes.length){
    draw('LIEFERSCHEINE / DELIVERY NOTES',x,deliveryTop,7,bold,muted);
    const colW=width/2,firstY=deliveryTop-15,lineHeight=11.5,minY=75;
    const rowsPerCol=Math.max(0,Math.floor((firstY-minY)/lineHeight)+1);
    let appendixStarted=false;
    deliveryNotes.forEach((name,index)=>{
      // Never render a name that exceeds its column: keep it intact in the annex.
      if(appendixStarted || index>=rowsPerCol*2 || normal.widthOfTextAtSize(pdfText(name),7.2)>colW-14){
        appendixStarted=true;overflowNotes.push(name);return;
      }
      const col=Math.floor(index/rowsPerCol),row=index%rowsPerCol;
      draw(name,x+col*colW+4,firstY-row*lineHeight,7.2);
    });
    if(overflowNotes.length)draw('Weitere '+overflowNotes.length+' Lieferscheine auf Anlage',x+2,61,7,normal,muted);
  }
  draw('Nachweis-ID: '+text(record.accessKey||'').slice(0,20),x,49,7,normal,muted);
  draw('Quelle: ExportHUB QR-Abholung',x+245,49,7,normal,muted);

  // In the annex, all remaining entries are printed at readable A4 sizes.
  // No signed original is altered and the signature is never split across pages.
  function fitLines(content,maxWidth,fontSize){
    let rest=pdfText(content)||'-';const lines=[];
    while(rest.length){
      let n=rest.length;
      while(n>1 && normal.widthOfTextAtSize(rest.slice(0,n),fontSize)>maxWidth)n--;
      if(n<rest.length){
        const blank=rest.slice(0,n).lastIndexOf(' ');
        if(blank>n*.55)n=blank+1;
      }
      lines.push(rest.slice(0,n).trimEnd());
      rest=rest.slice(n).trimStart();
    }
    return lines;
  }
  function addAnnexPage(title){
    page=pdf.addPage([595.28,841.89]);
    draw('ExportHUB360',x,795,15,bold);
    draw('LADELISTE - ANLAGE',x+132,795,14,bold);
    draw('Sendungsreferenz: '+value(record.reference),x,768,9,bold);
    page.drawLine({start:{x,y:753},end:{x:x+width,y:753},thickness:1,color:navy});
    draw(title,x,730,10,bold);
    draw('Anlage zum unterschriebenen POD',x,49,7,normal,muted);
    return 708;
  }
  if(overflowRows.length){
    let rowY=addAnnexPage('VERPACKUNG / PACKAGING (FORTSETZUNG)');
    for(const item of overflowRows){
      const r=item.row||{};
      const typeLines=fitLines(value(r.type,r.packaging,r.verpackung,r.packageType,r.packagingType),238,8);
      const countLines=fitLines(String(value(r.count,r.quantity,r.qty)),65,8);
      const weightLines=fitLines(String(value(r.weight,r.kg)),66,8);
      const height=Math.max(27,11*Math.max(typeLines.length,countLines.length,weightLines.length)+8);
      if(rowY-height<77)rowY=addAnnexPage('VERPACKUNG / PACKAGING (FORTSETZUNG)');
      page.drawRectangle({x,y:rowY-height,width,height,borderColor:border,borderWidth:.5});
      draw(String(item.index+1),x+8,rowY-14,8);
      typeLines.forEach((line,i)=>draw(line,x+50,rowY-14-i*11,8));
      countLines.forEach((line,i)=>draw(line,x+304,rowY-14-i*11,8));
      weightLines.forEach((line,i)=>draw(line,x+419,rowY-14-i*11,8));
      rowY-=height;
    }
  }
  if(overflowNotes.length){
    let noteY=addAnnexPage('LIEFERSCHEINE / DELIVERY NOTES (FORTSETZUNG)');
    overflowNotes.forEach((name)=>{
      const lines=fitLines(name,width-16,8.5),height=10.5*lines.length+7;
      if(noteY-height<78)noteY=addAnnexPage('LIEFERSCHEINE / DELIVERY NOTES (FORTSETZUNG)');
      lines.forEach((line,i)=>draw(line,x+6,noteY-11-i*10.5,8.5));
      noteY-=height;
    });
  }
  return Buffer.from(await pdf.save());
}
async function readAutomaticPodBuffer(accessKey, environment, record) {
  const file = automaticPod(record);
  if (!file || !text(file.blobName || file.storageBlobName)) return null;
  const got = await store.getRecord(accessKey, environment);
  // Primary 404 may be recovered only from an archive containing the exact
  // hash/size of this immutable POD. Never generate a replacement PDF here.
  const buffer = await readExactPodBuffer(got, environment, file);
  return { buffer, file, record: got.record, clients: got.clients };
}
async function persistBackupState(accessKey, environment, patch, podFile) {
  return store.mutateRecord(accessKey, environment, function(record) {
    const files = Array.isArray(record.podFiles) ? record.podFiles.slice() : [];
    if (podFile) {
      const filtered = files.filter(file => String(file && file.kind || '').toLowerCase() !== 'automatic-pod');
      filtered.push(podFile);
      record.podFiles = filtered;
      record.podUpdatedAt = podFile.uploadedAt || store.now();
      record.automaticPodBlobName = podFile.blobName;
      record.automaticPodHash = podFile.hash;
    }
    record.podBackup = Object.assign({}, record.podBackup || {}, patch || {});
    record.updatedAt = store.now();
    return record;
  });
}
async function saveAzurePod(accessKey, environment, record, pdf, requestedName, options) {
  const renderLayout = renderLayoutOf(options && options.renderLayout);
  // RC1602: a browser-supplied PDF is not proof of the canonical server A4 layout.
  // Never mark screenshots/uploaded captures as the current automatic PDF renderer.
  const layoutVersion = options && options.clientSupplied === true
    ? 'RC1602-CLIENT-SUPPLIED-UNVERIFIED'
    : POD_PDF_LAYOUT_VERSION;
  const got = await store.getRecord(accessKey, environment);
  const name = safeFilePart(requestedName || fileNameFor(record));
  const hash = crypto.createHash('sha256').update(pdf).digest('hex');
  // RC1600: do not overwrite the original signed POD when generating a corrected layout.
  const blobName = store.podPrefix(environment, accessKey) + '/automatic/' + hash + '-' + safeFilePart(name);
  const blob = got.clients.pods.getBlockBlobClient(blobName);
  try {
    await blob.uploadData(pdf, {
      blobHTTPHeaders: { blobContentType: 'application/pdf', blobCacheControl: 'no-store' },
      metadata: {
        accesshash: String(accessKey),
        reference: String(record.reference || ''),
        kind: 'automatic-pod',
        sha256: hash,
        layoutversion: layoutVersion,
        ...(renderLayout ? { renderlayout: renderLayout } : {})
      },
      conditions: { ifNoneMatch: '*' }
    });
  } catch(error) {
    if(!error || (error.statusCode!==409 && error.statusCode!==412))throw error;
  }
  const stored=await store.readBuffer(blob);
  if(crypto.createHash('sha256').update(stored.buffer).digest('hex')!==hash){
    throw store.err('POD_BLOB_INTEGRITY_FAILED','Automatischer POD stimmt nicht mit der gesicherten PDF-Version ueberein.',409);
  }
  const uploadedAt = store.now();
  const file = {
    id: 'automatic-pod-' + hash.slice(0, 16),
    kind: 'automatic-pod',
    name,
    type: 'application/pdf',
    size: pdf.length,
    uploadedAt,
    blobName,
    storageBlobName: blobName,
    storage: 'azure',
    hash,
    layoutVersion,
    source: options && options.clientSupplied === true ? 'pickup-client-supplied' : 'pickup-confirm-v3'
  };
  if (renderLayout) file.renderLayout = renderLayout;
  const next = await persistBackupState(accessKey, environment, {
    status: 'azure-saved',
    azureSaved: true,
    azureSavedAt: uploadedAt,
    // A new original invalidates backup confirmations for the old hash.
    archiveSaved: false,
    driveSaved: false,
    driveSavedAt: '',
    driveItemId: '',
    driveVerifiedAt: '',
    driveVerifiedHash: '',
    webUrl: '',
    driveLastError: '',
    driveProviderCode: '',
    lastAttemptAt: uploadedAt,
    fileName: name,
    hash,
    lastError: ''
  }, file);
  return { record: next, file, hash, pdf };
}
async function verifyAzureArchiveBlob(blob, expectedHash, expectedSize, fullRead) {
  const props = await blob.getProperties();
  const storedHash = text(props && props.metadata && props.metadata.sha256).toLowerCase();
  const storedSize = Number(props && props.contentLength || 0);
  const wantedHash = text(expectedHash).toLowerCase();
  const wantedSize = Number(expectedSize || 0);
  if (!wantedHash || !wantedSize || storedHash !== wantedHash || storedSize !== wantedSize) {
    throw store.err('POD_ARCHIVE_INTEGRITY_FAILED', 'Die POD-Archivkopie stimmt nicht mit dem gesicherten Original überein.', 409);
  }
  if (fullRead) {
    const read = await store.readBuffer(blob);
    const actualHash = crypto.createHash('sha256').update(read.buffer).digest('hex');
    if (read.buffer.length !== wantedSize || actualHash !== wantedHash) {
      throw store.err('POD_ARCHIVE_INTEGRITY_FAILED', 'Die POD-Archivkopie hat die Integritätsprüfung nicht bestanden.', 409);
    }
  }
  return { ok: true, verifiedAt: store.now(), hash: wantedHash, size: wantedSize };
}
async function checkAzureArchive(clients, record, accessKey, fullRead) {
  const backup = record && record.podBackup && typeof record.podBackup === 'object' ? record.podBackup : {};
  const file = automaticPod(record);
  const blobName = text(backup.archiveBlobName);
  const expectedHash = text(backup.hash || file && file.hash).toLowerCase();
  const expectedSize = Math.max(0, Number(file && file.size || 0));
  if (!blobName || !expectedHash || !expectedSize) {
    return { ok: false, repairable: true, code: 'POD_ARCHIVE_STATE_INCOMPLETE', message: 'Archivstatus ist unvollständig und wird neu aufgebaut.' };
  }
  const archiveClients = await store.podArchiveClient(clients && clients.environment || record && record.environment || 'production');
  const blob = archiveClients.podArchive.getBlobClient(blobName);
  try {
    const verified = await verifyAzureArchiveBlob(blob, expectedHash, expectedSize, fullRead === true);
    return Object.assign({ blobName }, verified);
  } catch (error) {
    if (error && error.statusCode === 404) {
      return { ok: false, repairable: true, code: 'POD_ARCHIVE_NOT_FOUND', message: 'Die bestätigte POD-Archivkopie fehlt und wird neu erstellt.' };
    }
    return { ok: false, repairable: false, code: text(error && error.code) || 'POD_ARCHIVE_VERIFY_FAILED', message: text(error && error.message) || 'POD-Archivkopie konnte nicht verifiziert werden.' };
  }
}
async function saveAzureArchive(accessKey, environment, record, pdf, file) {
  const archiveClients = await store.podArchiveClient(environment);
  const name = file && file.name || fileNameFor(record);
  const hash = file && file.hash || crypto.createHash('sha256').update(pdf).digest('hex');
  const blobName = 'rc1220/' + store.normalizeEnvironment(environment) + '/' + accessKey + '/' + hash + '-' + safeFilePart(name);
  const blob = archiveClients.podArchive.getBlockBlobClient(blobName);
  try {
    await blob.uploadData(pdf, {
      blobHTTPHeaders: { blobContentType: 'application/pdf', blobCacheControl: 'no-store' },
      metadata: {
        accesshash: String(accessKey),
        reference: String(record.reference || ''),
        kind: 'automatic-pod-archive',
        sha256: hash
      },
      conditions: { ifNoneMatch: '*' }
    });
  } catch (error) {
    if (!(error && (error.statusCode === 409 || error.statusCode === 412))) throw error;
  }
  const verified = await verifyAzureArchiveBlob(blob, hash, pdf.length, true);
  const archiveSavedAt = store.now();
  const next = await persistBackupState(accessKey, environment, {
    status: 'saved',
    azureSaved: true,
    archiveSaved: true,
    archiveSavedAt,
    archiveVerifiedAt: verified.verifiedAt,
    archiveType: 'azure-container',
    archiveBlobName: blobName,
    archiveContainer: store.POD_BACKUP_CONTAINER,
    lastAttemptAt: archiveSavedAt,
    fileName: name,
    hash,
    lastError: ''
  });
  return { record: next, blobName, container: store.POD_BACKUP_CONTAINER, hash };
}
// Historic records may carry driveSaved=true without a persisted Graph item ID.
// Such status was never backed by a durable Graph receipt and needs backfill.
function confirmedDriveBackup(backup) {
  // RC1686: old Graph 2xx receipts included a file ID but did NOT prove that
  // the bytes stored in SharePoint were the immutable signed PDF. Require the
  // RC1685 independent Graph readback hash for a confirmed cloud backup.
  const expectedHash = text(backup && backup.hash).toLowerCase();
  const verifiedHash = text(backup && backup.driveVerifiedHash).toLowerCase();
  return !!(backup && backup.driveSaved === true && text(backup.driveItemId) &&
    /^[a-f0-9]{64}$/.test(expectedHash) && verifiedHash === expectedHash &&
    !!text(backup.driveVerifiedAt));
}
function m365Enabled() {
  // RC1386: Sobald das explizite Microsoft-POD-Ziel vollständig konfiguriert ist,
  // muss die Drive-Kopie automatisch aktiv sein. Der historische Enable-Schalter
  // darf vorhandene PODs nicht mehr von der verpflichtenden Nachsicherung ausschließen.
  return graphDrive.readiness().configured;
}
async function copyToDrive(accessKey, environment, record, pdf, file) {
  const attemptAt = store.now();
  try {
    const result = await graphDrive.uploadPdf(pdf, file && file.name || fileNameFor(record));
    // RC1685: metadata is not a proof of the stored PDF bytes. Before marking
    // SharePoint saved, GET the exact Graph item and compare SHA-256 of original.
    const verified = await graphDrive.verifyPdf(pdf, result);
    const expectedHash = crypto.createHash('sha256').update(pdf).digest('hex');
    if (!verified || verified.verified !== true ||
        verified.hash !== expectedHash || verified.size !== pdf.length) {
      throw Object.assign(
        new Error('Die zurückgelesene Microsoft-365-POD-PDF wurde nicht vollständig bestätigt.'),
        { code: 'GRAPH_POD_READBACK_UNVERIFIED' }
      );
    }
    // Final state mutation must independently reject unverified Graph receipts.
    // Never persist driveSaved=true without a durable remote file identifier.
    const itemId = text(result && result.id);
    if (!itemId) {
      throw Object.assign(
        new Error('Microsoft Graph hat keinen eindeutigen POD-Dateieintrag bestätigt.'),
        { code: 'GRAPH_UPLOAD_RECEIPT_INVALID' }
      );
    }
    const next = await persistBackupState(accessKey, environment, {
      status: 'saved',
      azureSaved: true,
      archiveSaved: record && record.podBackup && record.podBackup.archiveSaved === true,
      driveSaved: true,
      driveSavedAt: store.now(),
      lastAttemptAt: attemptAt,
      attempts: Math.max(0, Number(record && record.podBackup && record.podBackup.attempts) || 0) + 1,
      driveItemId: itemId,
      driveVerifiedAt: verified.verifiedAt,
      driveVerifiedHash: verified.hash,
      webUrl: result.webUrl || '',
      fileName: result.name || (file && file.name) || fileNameFor(record),
      driveProviderCode: '',
      lastError: ''
    });
    return { ok: true, record: next, drive: result };
  } catch (error) {
    const next = await persistBackupState(accessKey, environment, {
      status: record && record.podBackup && record.podBackup.archiveSaved === true ? 'saved' : 'pending',
      azureSaved: true,
      archiveSaved: record && record.podBackup && record.podBackup.archiveSaved === true,
      driveSaved: false,
      driveSavedAt: '',
      driveItemId: '',
      driveVerifiedAt: '',
      driveVerifiedHash: '',
      webUrl: '',
      lastAttemptAt: attemptAt,
      attempts: Math.max(0, Number(record && record.podBackup && record.podBackup.attempts) || 0) + 1,
      driveProviderCode: safeCode(error && error.graphCode),
      driveLastError: text(error && (error.code ? error.code + ': ' : '') + (error && error.message || 'Microsoft-365-Sicherung fehlgeschlagen')).slice(0, 500),
      lastError: record && record.podBackup && record.podBackup.archiveSaved === true ? '' : text(error && (error.code ? error.code + ': ' : '') + (error && error.message || 'Microsoft-365-Sicherung fehlgeschlagen')).slice(0, 500)
    });
    return { ok: false, record: next, error };
  }
}
async function ensureAutomaticPod(accessKey, environment, options) {
  options = Object.assign({ copyToDrive: true }, options || {});
  accessKey = text(accessKey).toLowerCase();
  environment = store.normalizeEnvironment(environment);
  let got = await store.getRecord(accessKey, environment);
  let record = got.record || {};
  const complete = (typeof store.pickupComplete === 'function' && store.pickupComplete(record)) || record.status === 'confirmed' || !!record.confirmedAt;
  if (!complete || !record.confirmedAt) throw store.err('PICKUP_NOT_CONFIRMED', 'Die Abholung ist noch nicht vollstaendig bestaetigt.', 409);
  if (!record.signatureBlobName) throw store.err('SIGNATURE_NOT_FOUND', 'Fahrerunterschrift fuer den POD fehlt.', 409);

  const opt = options;
  const existing = automaticPod(record);
  let pdf = null;
  let file = existing;
  if (existing && isCurrentAutomaticPod(existing) && !opt.force) {
    try {
      const existingRead = await readAutomaticPodBuffer(accessKey, environment, record);
      if (existingRead && existingRead.buffer && existingRead.buffer.length) pdf = existingRead.buffer;
    } catch (_) {
      pdf = null;
    }
  } else if (existing && !isCurrentAutomaticPod(existing)) {
    file = null;
  }
  if (!pdf) {
    const signatureBlob = got.clients.pods.getBlobClient(record.signatureBlobName);
    const signature = await store.readBuffer(signatureBlob);
    const renderRecord=await resolvePodDeliveryNotes(record,got.clients,environment);
    pdf = await createPodPdf(renderRecord, signature.buffer, record.signatureType || signature.contentType);
    const saved = await saveAzurePod(accessKey, environment, record, pdf);
    record = saved.record;
    file = saved.file;
  }
  if (!file) file = automaticPod(record);
  const archive = await saveAzureArchive(accessKey, environment, record, pdf, file);
  record = archive.record || record;
  if (!options.copyToDrive || !m365Enabled() || !graphDrive.readiness().configured) {
    return { ok: true, record, file, pdf, backup: record.podBackup || {}, archiveSaved: true, driveSaved: confirmedDriveBackup(record.podBackup) };
  }

  const drive = await copyToDrive(accessKey, environment, record, pdf, file);
  return {
    ok: true,
    record: drive.record || record,
    file,
    pdf,
    backup: (drive.record || record).podBackup || {},
    archiveSaved: true,
    driveSaved: drive.ok === true,
    driveError: drive.ok ? null : drive.error
  };
}
async function createShareLink(accessKey, environment) {
  await ensureAutomaticPod(accessKey, environment, {});
  const live = await store.getRecord(accessKey, environment);
  const file = automaticPod(live.record);
  if (!file || !isCurrentAutomaticPod(file)) throw new Error('Aktueller automatischer POD ist nicht gespeichert');
  return {
    file,
    url: store.podDownloadUrl(accessKey, environment, file.id),
    expiresAt: store.podLinkExpiry(live.record),
    version: TEAM_POD_LINK_VERSION
  };
}
async function getPodDownload(accessKey, environment, fileId) {
  const got = await store.getRecord(accessKey, environment);
  const record = got.record;
  const requestedId = text(fileId);
  // RC1606: a named immutable POD is an exact identifier, never a request to
  // silently substitute the current automatic document or regenerate its bytes.
  // Only the explicit canonical endpoint (file=automatic -> null) may regenerate.
  const files = Array.isArray(record.podFiles) ? record.podFiles : [];
  let file = requestedId
    ? files.find(item => text(item && item.id) === requestedId || text(item && item.remoteId) === requestedId)
    : automaticPod(record);
  if (requestedId && !file) {
    throw store.err('POD_FILE_NOT_FOUND', 'Die angeforderte POD-Dateiversion wurde nicht gefunden.', 404);
  }
  if (!file) {
    const created = await ensureAutomaticPod(accessKey, environment, {});
    return { buffer: created.pdf || created.buffer, file: created.file, record: created.record };
  }
  if (!requestedId && !isCurrentAutomaticPod(file) && String(file.kind || '').toLowerCase() === 'automatic-pod') {
    const regenerated = await ensureAutomaticPod(accessKey, environment, { force: true });
    return { buffer: regenerated.pdf || regenerated.buffer, file: regenerated.file, record: regenerated.record };
  }
  const buffer = await readExactPodBuffer(got, environment, file);
  return { buffer, file, record };
}

// RC1608: never swap an immutable signed POD for another version. If the primary
// copy is missing, the archive may be used only when its recorded SHA-256 is
// identical to this exact file. This is a read-only recovery, not regeneration.
function assertExactPodBuffer(buffer, file) {
  const expectedHash = text(file && file.hash).toLowerCase();
  const expectedSize = Number(file && file.size || 0);
  if (/^[a-f0-9]{64}$/.test(expectedHash) &&
      crypto.createHash('sha256').update(buffer).digest('hex') !== expectedHash) {
    throw store.err('POD_BLOB_INTEGRITY_FAILED', 'Die gespeicherte POD-Datei stimmt nicht mit dem signierten Original überein.', 409);
  }
  if (Number.isSafeInteger(expectedSize) && expectedSize > 0 && buffer.length !== expectedSize) {
    throw store.err('POD_BLOB_INTEGRITY_FAILED', 'Die gespeicherte POD-Dateigröße stimmt nicht mit dem Original überein.', 409);
  }
  return buffer;
}
async function readExactPodBuffer(got, environment, file) {
  const blobName = text(file && (file.blobName || file.storageBlobName));
  if (!blobName) throw store.err('POD_FILE_NOT_STORED', 'Die angeforderte POD-Dateiversion ist nicht gespeichert.', 404);
  try {
    const primary = await store.readBuffer(got.clients.pods.getBlobClient(blobName));
    return assertExactPodBuffer(primary.buffer, file);
  } catch (error) {
    if (!error || error.statusCode !== 404) throw error;
    const backup = got.record && got.record.podBackup || {};
    const hash = text(file.hash).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash) ||
        backup.archiveSaved !== true ||
        text(backup.hash).toLowerCase() !== hash ||
        !text(backup.archiveBlobName)) throw error;
    const clients = await store.podArchiveClient(environment);
    const archived = await store.readBuffer(clients.podArchive.getBlobClient(text(backup.archiveBlobName)));
    return assertExactPodBuffer(archived.buffer, file);
  }
}
async function saveSuppliedPod(accessKey, environment, record, pdf, requestedName, options) {
  const primary = await saveAzurePod(accessKey, environment, record, pdf, requestedName, Object.assign({}, options, { clientSupplied: true }));
  const archive = await saveAzureArchive(accessKey, environment, primary.record, pdf, primary.file);
  const archivedRecord = archive.record || primary.record;
  if (!m365Enabled()) {
    return { ok: true, record: archivedRecord, file: primary.file, pdf, backup: archivedRecord.podBackup || {}, archiveSaved: true, driveSaved: false };
  }
  // Copy the exact browser-supplied, immutable PDF, not a later server render.
  const drive = await copyToDrive(accessKey, environment, archivedRecord, pdf, primary.file);
  const finalRecord = drive.record || archivedRecord;
  return { ok: true, record: finalRecord, file: primary.file, pdf, backup: finalRecord.podBackup || {}, archiveSaved: true, driveSaved: drive.ok === true, driveError: drive.ok ? null : drive.error };
}
async function retryArchiveBackup(accessKey, environment) {
  const got = await store.getRecord(accessKey, environment);
  let record = got.record || {};
  const currentFile = automaticPod(record);
  if (currentFile && !isCurrentAutomaticPod(currentFile) && text(currentFile.source) !== 'pickup-client-supplied') return ensureAutomaticPod(accessKey, environment, { force: true, copyToDrive: true });
  const existing = await readAutomaticPodBuffer(accessKey, environment, record);
  if (!existing) return ensureAutomaticPod(accessKey, environment, { copyToDrive: true });
  const archive = await saveAzureArchive(accessKey, environment, record, existing.buffer, existing.file);
  record = archive.record || record;
  if (!m365Enabled() || !graphDrive.readiness().configured) {
    return { ok: true, record, file: existing.file, backup: record.podBackup || {}, archiveSaved: true, driveSaved: confirmedDriveBackup(record.podBackup) };
  }
  const drive = await copyToDrive(accessKey, environment, record, existing.buffer, existing.file);
  return { ok: true, record: drive.record || record, file: existing.file, backup: (drive.record || record).podBackup || {}, archiveSaved: true, driveSaved: drive.ok === true, driveError: drive.ok ? null : drive.error };
}
async function retryDriveBackup(accessKey, environment) {
  return retryArchiveBackup(accessKey, environment);
}
async function reconcilePendingBackups(environment, options) {
  options = Object.assign({ limit: 10, minAgeMs: 5 * 60 * 1000 }, options || {});
  environment = store.normalizeEnvironment(environment);
  const limit = Math.min(25, Math.max(1, Math.round(Number(options.limit) || 10)));
  const minAgeMs = Math.max(0, Number(options.minAgeMs) || 0);
  const reference = text(options.reference).toUpperCase();
  const clients = await store.clients(environment);
  const prefix = 'rc995/' + environment + '/records/';
  const continuationToken = text(options.continuationToken);
  const scanPageSize = Math.min(100, Math.max(10, Math.round(Number(options.scanPageSize) || 40)));
  let nextContinuationToken = '';
  let scanComplete = true;
  const candidates = [];
  const teamRelinkCandidates = [];
  const alreadySaved = [];
  const integrityErrors = [];
  let scanned = 0;
  let skippedRecent = 0;
  let driveBackfillSkippedRecent = 0;
  let referenceMatched = 0;
  let referencePodReady = 0;
  let verifiedCount = 0;
  let repairedStateCount = 0;
  let integrityChecks = 0;
  let pageWorkDeferred = false;
  let requiredWorkDeferred = false;
  let optionalDriveWorkDeferred = false;
  const remoteWorkBudget = reference ? Math.max(2, limit) : 2;

  const pages = clients.records.listBlobsFlat({ prefix }).byPage({
    continuationToken: continuationToken || undefined,
    maxPageSize: scanPageSize
  });
  for await (const page of pages) {
    nextContinuationToken = text(page && page.continuationToken);
    scanComplete = !nextContinuationToken;
    const blobItems = page && page.segment && Array.isArray(page.segment.blobItems) ? page.segment.blobItems : [];
    for (const item of blobItems) {
    scanned += 1;
    const name = text(item && item.name);
    const match = name.match(/\/([a-f0-9]{64})\.json$/i);
    if (!match) continue;
    let record;
    try {
      const read = await store.readJson(clients.records.getBlobClient(name), null);
      record = read && read.value;
    } catch (_) {
      continue;
    }
    if (!record) continue;
    const recordReference = text(record.reference).toUpperCase();
    if (reference && recordReference !== reference) continue;
    if (reference) referenceMatched += 1;
    const complete = (typeof store.pickupComplete === 'function' && store.pickupComplete(record)) || record.status === 'confirmed' || !!record.confirmedAt;
    if (!complete || !record.confirmedAt || !record.signatureBlobName) continue;
    if (reference) referencePodReady += 1;
    let backup = record.podBackup && typeof record.podBackup === 'object' ? record.podBackup : {};
    let forceRepair = false;
    let driveOnly = false;
    if (backup.archiveSaved === true) {
      const lastVerifiedMs = Date.parse(backup.archiveVerifiedAt || '');
      const verificationFresh = !reference &&
        Number.isFinite(lastVerifiedMs) &&
        Date.now() - lastVerifiedMs < 24 * 60 * 60 * 1000;
      // RC1404: Bereits innerhalb der letzten 24h vollständig verifizierte
      // Archivkopien nicht bei jedem Reconcile erneut remote abfragen. Das
      // verhindert den Azure-Functions-Timeout bei großen Production-Beständen,
      // ohne die tägliche vollständige Integritätsprüfung zu schwächen.
      if (!verificationFresh && integrityChecks >= remoteWorkBudget) {
        pageWorkDeferred = true;
        requiredWorkDeferred = true;
        continue;
      }
      if (!verificationFresh) integrityChecks += 1;
      const integrity = verificationFresh
        ? { ok: true, verifiedAt: backup.archiveVerifiedAt, cached: true }
        : await checkAzureArchive(clients, record, match[1].toLowerCase(), true);
      if (integrity.ok) {
        verifiedCount += 1;
        if (!verificationFresh) {
          record = await persistBackupState(match[1].toLowerCase(), environment, { archiveVerifiedAt: integrity.verifiedAt, lastError: '' });
          backup = record.podBackup || backup;
        }
        if (text(record.teamPodLinkVersion) !== TEAM_POD_LINK_VERSION) {
          teamRelinkCandidates.push({
            accessKey: match[1].toLowerCase(),
            reference: recordReference || text(record.reference),
            confirmedAtMs: Date.parse(record.confirmedAt || '') || 0,
            record
          });
        }
        const driveBackfillRequired = m365Enabled() && graphDrive.readiness().configured && !confirmedDriveBackup(backup);
        if (reference) alreadySaved.push({ reference: recordReference || text(record.reference), fileName: text(backup.fileName), attempts: Math.max(0, Number(backup.attempts) || 0) });
        if (!driveBackfillRequired) continue;
        driveOnly = true;
      }
      if (!integrity.ok) {
        if (!integrity.repairable) {
          integrityErrors.push({ reference: recordReference || text(record.reference), code: integrity.code, error: integrity.message });
          continue;
        }
        record = await persistBackupState(match[1].toLowerCase(), environment, {
          status: 'pending',
          archiveSaved: false,
          lastError: integrity.code + ': ' + integrity.message
        });
        backup = record.podBackup || backup;
        forceRepair = true;
        repairedStateCount += 1;
      }
    }
    const lastAttemptMs = Date.parse(backup.lastAttemptAt || '');
    if (!forceRepair && !reference && minAgeMs > 0 && Number.isFinite(lastAttemptMs) && Date.now() - lastAttemptMs < minAgeMs) {
      if (driveOnly) driveBackfillSkippedRecent += 1;
      else skippedRecent += 1;
      continue;
    }
    candidates.push({
      accessKey: match[1].toLowerCase(),
      reference: recordReference || text(record.reference),
      lastAttemptMs: Number.isFinite(lastAttemptMs) ? lastAttemptMs : 0,
      confirmedAtMs: Date.parse(record.confirmedAt || '') || 0,
      driveOnly
    });
    }
    break;
  }

  teamRelinkCandidates.sort((a, b) => a.confirmedAtMs - b.confirmedAtMs || a.reference.localeCompare(b.reference));
  candidates.sort((a, b) => Number(!!a.driveOnly) - Number(!!b.driveOnly) || a.lastAttemptMs - b.lastAttemptMs || a.confirmedAtMs - b.confirmedAtMs || a.reference.localeCompare(b.reference));
  let remainingRemoteBudget = Math.max(0, remoteWorkBudget - integrityChecks);
  // Required Azure/archive work always has first claim on the remaining budget.
  // RC1410: one shared remote-work budget covers integrity reads, Azure archive
  // repairs, team relinks and optional Graph backfill together.
  const requiredCandidates = candidates.filter(candidate => !candidate.driveOnly);
  const driveBackfillCandidates = candidates.filter(candidate => candidate.driveOnly);
  const requiredBackupBudget = reference ? limit : remainingRemoteBudget;
  const selectedRequiredCandidates = requiredCandidates.slice(0, requiredBackupBudget);
  remainingRemoteBudget = Math.max(0, remainingRemoteBudget - selectedRequiredCandidates.length);
  const relinkBudget = reference ? limit : Math.min(1, remainingRemoteBudget);
  const selectedRelinks = teamRelinkCandidates.slice(0, relinkBudget);
  remainingRemoteBudget = Math.max(0, remainingRemoteBudget - selectedRelinks.length);
  const driveBackfillBudget = reference ? Math.min(limit, remainingRemoteBudget) : Math.min(1, remainingRemoteBudget);
  const selectedDriveCandidates = driveBackfillCandidates.slice(0, driveBackfillBudget);
  const selectedCandidates = selectedRequiredCandidates.concat(selectedDriveCandidates);
  const requiredEligible = requiredCandidates.length;
  const driveBackfillEligible = driveBackfillCandidates.length;
  const requiredSelected = selectedRequiredCandidates.length;
  const driveBackfillSelected = selectedDriveCandidates.length;
  if (!reference) {
    if (
      requiredWorkDeferred ||
      teamRelinkCandidates.length > selectedRelinks.length ||
      requiredCandidates.length > selectedRequiredCandidates.length
    ) {
      requiredWorkDeferred = true;
      pageWorkDeferred = true;
    }
    if (driveBackfillCandidates.length > selectedDriveCandidates.length) {
      optionalDriveWorkDeferred = true;
      pageWorkDeferred = true;
    }
  }
  const saved = [];
  const pending = [];
  const driveSaved = [];
  const drivePending = [];
  const errors = integrityErrors.slice();
  let teamRelinkedCount = 0;
  let teamRelinkSkippedCount = 0;

  // RC1340: Older browser state could replace the durable automatic POD with a
  // short-lived /api/pickup-pod?token=... URL. Re-link archived PODs once from
  // the authoritative pickup record so already affected signed loading lists recover.
  for (const candidate of selectedRelinks) {
    try {
      await store.updateTeam(candidate.record, [], '');
      await store.mutateRecord(candidate.accessKey, environment, function(record) {
        record.teamPodLinkVersion = TEAM_POD_LINK_VERSION;
        record.teamPodLinkedAt = store.now();
        return record;
      });
      teamRelinkedCount += 1;
    } catch (error) {
      const code = text(error && error.code) || 'TEAM_POD_RELINK_FAILED';
      // RC1348: TESTSERVICE may retain completed pickup records after the
      // corresponding disposable team-state shipment has been cleaned up.
      // The durable POD archive is already verified above; there is no live
      // team-state target to repair. Mark only this TESTSERVICE orphan as
      // terminally checked so the maintenance queue can drain. Production
      // remains fail-closed for the same condition.
      if (environment === 'testservice' && code === 'TEAM_SHIPMENT_NOT_FOUND') {
        try {
          await store.mutateRecord(candidate.accessKey, environment, function(record) {
            record.teamPodLinkVersion = TEAM_POD_LINK_VERSION;
            record.teamPodLinkCheckedAt = store.now();
            record.teamPodLinkStatus = 'skipped-team-shipment-not-found';
            record.teamPodLinkSkipReason = code;
            return record;
          });
          teamRelinkSkippedCount += 1;
          continue;
        } catch (markError) {
          errors.push({
            reference: candidate.reference,
            code: text(markError && markError.code) || 'TEAM_POD_RELINK_SKIP_MARK_FAILED',
            error: text(markError && markError.message).slice(0, 300)
          });
          continue;
        }
      }
      errors.push({ reference: candidate.reference, code, error: text(error && error.message).slice(0, 300) });
    }
  }

  for (const candidate of selectedCandidates) {
    try {
      const result = await retryArchiveBackup(candidate.accessKey, environment);
      const record = result && result.record || {};
      try { await store.updateTeam(record, [], ''); } catch (_) {}
      const backup = record.podBackup || result && result.backup || {};
      const driveRequired = m365Enabled() && graphDrive.readiness().configured;
      const driveWasSaved = confirmedDriveBackup(backup) || (result && result.driveSaved === true && !!text(backup.driveItemId));
      const driveError = result && result.driveError;
      if (backup.archiveSaved === true) {
        if (!candidate.driveOnly) saved.push({ reference: candidate.reference, fileName: text(backup.fileName), attempts: Math.max(0, Number(backup.attempts) || 0) });
        if (driveRequired) {
          if (driveWasSaved) driveSaved.push({ reference: candidate.reference, fileName: text(backup.fileName) });
          else drivePending.push({
            reference: candidate.reference,
            providerCode: safeCode(backup.driveProviderCode || (driveError && driveError.graphCode)),
            error: text(backup.driveLastError || ((text(driveError && driveError.code) ? text(driveError && driveError.code) + ': ' : '') + text(driveError && driveError.message || 'Microsoft-365-Zusatzkopie ist noch offen.'))).slice(0, 300)
          });
        }
      } else {
        pending.push({ reference: candidate.reference, error: text(backup.lastError || driveError && driveError.message).slice(0, 300) });
      }
    } catch (error) {
      errors.push({ reference: candidate.reference, code: text(error && error.code), error: text(error && error.message).slice(0, 300) });
    }
  }

  if (!reference && requiredWorkDeferred) {
    nextContinuationToken = continuationToken;
    scanComplete = false;
  }

  const target = reference ? {
    reference,
    matchedCount: referenceMatched,
    podReadyCount: referencePodReady,
    alreadySavedCount: alreadySaved.length,
    savedNowCount: saved.length,
    pendingCount: pending.length,
    errorCount: errors.length,
    status: referenceMatched === 0 ? 'not-found' :
      referencePodReady === 0 ? 'pod-not-ready' :
      errors.length > 0 ? 'error' :
      pending.length > 0 ? 'pending' :
      (alreadySaved.length + saved.length >= referencePodReady ? (saved.length > 0 ? 'saved-now' : 'already-saved') : 'incomplete')
  } : null;
  return {
    ok: errors.length === 0,
    environment,
    scanned,
    scanPageSize,
    continuationToken: continuationToken || null,
    nextContinuationToken: nextContinuationToken || null,
    scanComplete,
    eligible: requiredEligible + teamRelinkCandidates.length,
    selected: requiredSelected + selectedRelinks.length,
    skippedRecent,
    driveBackfillEligible,
    driveBackfillSelected,
    driveBackfillSkippedRecent,
    teamRelinkEligible: teamRelinkCandidates.length,
    teamRelinkedCount,
    teamRelinkSkippedCount,
    teamRelinkPendingCount: Math.max(0, teamRelinkCandidates.length - teamRelinkedCount - teamRelinkSkippedCount),
    savedCount: saved.length,
    alreadySavedCount: alreadySaved.length,
    pendingCount: pending.length,
    driveSavedCount: driveSaved.length,
    drivePendingCount: drivePending.length,
    errorCount: errors.length,
    verifiedCount,
    repairedStateCount,
    integrityChecks,
    remoteWorkBudget,
    pageWorkDeferred,
    requiredWorkDeferred,
    optionalDriveWorkDeferred,
    target,
    saved,
    alreadySaved,
    pending,
    driveSaved,
    drivePending,
    errors
  };
}

module.exports = {
  automaticPod,
  confirmedDriveBackup,
  isCurrentAutomaticPod,
  fileNameFor,
  createPodPdf,
  resolvePodDeliveryNotes,
  ensureAutomaticPod,
  createShareLink,
  getPodDownload,
  POD_PDF_LAYOUT_VERSION,
  POD_RENDER_LAYOUT,
  renderLayoutOf,
  retryArchiveBackup,
  retryDriveBackup,
  saveAzureArchive,
  verifyAzureArchiveBlob,
  checkAzureArchive,
  saveSuppliedPod,
  reconcilePendingBackups
};
