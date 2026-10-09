'use strict';

const crypto = require('crypto');
const store = require('./pickup-store');
const graphDrive = require('./graph-drive');
const TEAM_POD_LINK_VERSION = 'RC1340';
const POD_PDF_LAYOUT_VERSION = 'RC1461-STRUCTURED-V2';

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
function isCurrentAutomaticPod(file) {
  return !!file && String(file.kind || '').toLowerCase() === 'automatic-pod' && text(file.layoutVersion) === POD_PDF_LAYOUT_VERSION;
}
function fileNameFor(record) {
  const ref = safeFilePart(record && record.reference);
  const seq = Math.max(0, Math.round(Number(record && record.subShipmentSequence) || 0));
  const total = Math.max(0, Math.round(Number(record && record.subShipmentTotal) || 0));
  const suffix = seq && total ? '_Teil_' + seq + '-von-' + total : '';
  return 'POD_' + ref + suffix + '_Abliefernachweis.pdf';
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
async function createPodPdf(record, signatureBuffer, signatureType) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const navy = rgb(.13,.22,.36), muted = rgb(.38,.44,.53), border = rgb(.76,.81,.87), pale = rgb(.96,.98,1), green = rgb(.91,.97,.93);
  const x = 42, width = 511;
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
  draw('LADELISTE / ABLIEFERNACHWEIS',x+126,796,16,bold,navy);
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
  const metaW=(width-18)/4;
  const cellW=(width-12)/3;
  card('Fahrer',value(last.driverName,record.driverName),x,y,metaW,51);
  card('Kennzeichen',value(last.licensePlate,record.licensePlate),x+metaW+6,y,metaW,51);
  card('Verlader',value(last.loaderName,record.loaderName,record.loadedBy),x+2*(metaW+6),y,metaW,51);
  card('Spedition',value(record.carrierName,record.speditionName,record.carrier,record.spedition),x+3*(metaW+6),y,metaW,51);
  y-=57;
  const palletOut=value(last.euroPalletsOut,record.euroPalletsOut,record.palletsOut,0);
  const palletIn=value(last.euroPalletsIn,record.euroPalletsIn,record.palletsIn,0);
  card('Europaletten','Ausgang: '+palletOut+' / Eingang: '+palletIn,x,y,cellW,76);
  card('Fahrerunterschrift','',x+cellW+6,y,cellW,76);
  const customsConfirmed=last.customsDocumentsConfirmed===true||last.customsDocumentsReceived===true||record.customsDocumentsConfirmed===true||record.customsDocumentsReceived===true;
  card('Zolldokumente',customsConfirmed?'Uebergeben / bestaetigt':'Nicht erforderlich',x+2*(cellW+6),y,cellW,76);
  let image=null;
  try { image=/png/i.test(signatureType||'')?await pdf.embedPng(signatureBuffer):await pdf.embedJpg(signatureBuffer); }catch(_){}
  if(image){
    const dims=image.scale(1),maxW=cellW-24,maxH=36;let scale=Math.min(maxW/dims.width,maxH/dims.height);if(scale>1)scale=1;
    page.drawImage(image,{x:x+cellW+18,y:y-62,width:dims.width*scale,height:dims.height*scale});
  }else draw('Unterschrift gespeichert',x+cellW+16,y-48,8);
  draw('Nachweis-ID: '+text(record.accessKey||'').slice(0,20),x,49,7,normal,muted);
  draw('Quelle: ExportHUB QR-Abholung',x+245,49,7,normal,muted);
  return Buffer.from(await pdf.save());
}
async function readAutomaticPodBuffer(accessKey, environment, record) {
  const file = automaticPod(record);
  if (!file || !text(file.blobName || file.storageBlobName)) return null;
  const got = await store.getRecord(accessKey, environment);
  const blob = got.clients.pods.getBlobClient(text(file.blobName || file.storageBlobName));
  const read = await store.readBuffer(blob);
  return { buffer: read.buffer, file, record: got.record, clients: got.clients };
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
async function saveAzurePod(accessKey, environment, record, pdf, requestedName) {
  const got = await store.getRecord(accessKey, environment);
  const name = safeFilePart(requestedName || fileNameFor(record));
  const hash = crypto.createHash('sha256').update(pdf).digest('hex');
  const blobName = store.podPrefix(environment, accessKey) + '/automatic/' + safeFilePart(name);
  const blob = got.clients.pods.getBlockBlobClient(blobName);
  await blob.uploadData(pdf, {
    blobHTTPHeaders: { blobContentType: 'application/pdf', blobCacheControl: 'no-store' },
    metadata: {
      accesshash: String(accessKey),
      reference: String(record.reference || ''),
      kind: 'automatic-pod',
      sha256: hash,
      layoutversion: POD_PDF_LAYOUT_VERSION
    }
  });
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
    layoutVersion: POD_PDF_LAYOUT_VERSION,
    source: 'pickup-confirm-v3'
  };
  const next = await persistBackupState(accessKey, environment, {
    status: 'azure-saved',
    azureSaved: true,
    azureSavedAt: uploadedAt,
    lastAttemptAt: uploadedAt,
    fileName: name,
    hash,
    lastError: ''
  }, file);
  return { file, record: next.record, clients: next.clients };
}
async function queueGraphPodBackup(accessKey, environment, record, pdf, file) {
  if (!graphDrive || typeof graphDrive.uploadPodPdf !== 'function') return { ok: false, skipped: true };
  try {
    const result = await graphDrive.uploadPodPdf({
      environment,
      reference: record.reference,
      accessKey,
      fileName: file.name,
      buffer: pdf
    });
    await persistBackupState(accessKey, environment, {
      status: 'complete',
      graphSaved: true,
      graphSavedAt: store.now(),
      graphLocation: result && (result.webUrl || result.path || result.name) || '',
      lastAttemptAt: store.now(),
      lastError: ''
    });
    return { ok: true, result };
  } catch (error) {
    await persistBackupState(accessKey, environment, {
      status: 'azure-saved',
      graphSaved: false,
      lastAttemptAt: store.now(),
      lastError: text(error && error.message || error).slice(0, 500)
    });
    return { ok: false, error };
  }
}
async function ensureAutomaticPod(accessKey, environment, options) {
  const opt = options || {};
  const got = await store.getRecord(accessKey, environment);
  const record = got.record;
  const existing = automaticPod(record);
  if (existing && isCurrentAutomaticPod(existing) && !opt.force) {
    const existingRead = await readAutomaticPodBuffer(accessKey, environment, record);
    if (existingRead && existingRead.buffer && existingRead.buffer.length) return existingRead;
  }
  let signature = null;
  if (opt.signatureBuffer && opt.signatureBuffer.length) {
    signature = { buffer: Buffer.from(opt.signatureBuffer), contentType: text(opt.signatureType || 'image/png') };
  } else if (typeof store.readPickupSignature === 'function') {
    signature = await store.readPickupSignature(accessKey, environment, record);
  }
  if (!signature || !signature.buffer || !signature.buffer.length) {
    throw new Error('Fahrerunterschrift fuer automatischen POD fehlt');
  }
  const pdf = await createPodPdf(record, signature.buffer, signature.contentType);
  const saved = await saveAzurePod(accessKey, environment, record, pdf, opt.fileName);
  queueGraphPodBackup(accessKey, environment, saved.record, pdf, saved.file).catch(function(){});
  return { buffer: pdf, file: saved.file, record: saved.record, clients: saved.clients };
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
  let file = null;
  if (fileId) file = (Array.isArray(record.podFiles) ? record.podFiles : []).find(item => text(item.id) === text(fileId));
  if (!file) file = automaticPod(record);
  if (!file) {
    const created = await ensureAutomaticPod(accessKey, environment, {});
    return { buffer: created.buffer, file: created.file, record: created.record };
  }
  if (file && !isCurrentAutomaticPod(file) && String(file.kind || '').toLowerCase() === 'automatic-pod') {
    const regenerated = await ensureAutomaticPod(accessKey, environment, { force: true });
    return { buffer: regenerated.buffer, file: regenerated.file, record: regenerated.record };
  }
  const blobName = text(file.blobName || file.storageBlobName);
  if (!blobName) throw new Error('POD-Datei ohne Speicherreferenz');
  const blob = got.clients.pods.getBlobClient(blobName);
  const read = await store.readBuffer(blob);
  return { buffer: read.buffer, file, record };
}

module.exports = {
  automaticPod,
  isCurrentAutomaticPod,
  fileNameFor,
  createPodPdf,
  ensureAutomaticPod,
  createShareLink,
  getPodDownload,
  readAutomaticPodBuffer,
  POD_PDF_LAYOUT_VERSION,
  TEAM_POD_LINK_VERSION
};