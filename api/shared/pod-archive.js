'use strict';

const crypto = require('crypto');
const store = require('./pickup-store');
const graphDrive = require('./graph-drive');
const TEAM_POD_LINK_VERSION = 'RC1340';
const POD_PDF_LAYOUT_VERSION = 'RC1361-STRUCTURED-V1';

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
  const cellW=(width-12)/3;
  card('Fahrer',value(last.driverName,record.driverName),x,y,cellW,51);
  card('Kennzeichen',value(last.licensePlate,record.licensePlate),x+cellW+6,y,cellW,51);
  card('Verlader',value(last.loaderName,record.loaderName,record.loadedBy),x+2*(cellW+6),y,cellW,51);
  y-=57;
  card('Spedition',value(record.carrierName,record.speditionName,record.carrier,record.spedition),x,y,cellW,76);
  card('Fahrerunterschrift','',x+cellW+6,y,cellW,76);
  const palletOut=value(last.euroPalletsOut,record.euroPalletsOut,record.palletsOut,0);
  const palletIn=value(last.euroPalletsIn,record.euroPalletsIn,record.palletsIn,0);
  card('Europaletten','Ausgang: '+palletOut+' / Eingang: '+palletIn,x+2*(cellW+6),y,cellW,76);
  let image=null;
  try { image=/png/i.test(signatureType||'')?await pdf.embedPng(signatureBuffer):await pdf.embedJpg(signatureBuffer); }catch(_){}
  if(image){
    const dims=image.scale(1),maxW=cellW-20,maxH=43,scale=Math.min(maxW/dims.width,maxH/dims.height);
    page.drawImage(image,{x:x+cellW+16,y:y-68,width:dims.width*scale,height:dims.height*scale});
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
    const next = await persistBackupState(accessKey, environment, {
      status: 'saved',
      azureSaved: true,
      archiveSaved: record && record.podBackup && record.podBackup.archiveSaved === true,
      driveSaved: true,
      driveSavedAt: store.now(),
      lastAttemptAt: attemptAt,
      attempts: Math.max(0, Number(record && record.podBackup && record.podBackup.attempts) || 0) + 1,
      driveItemId: result.id || '',
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
    pdf = await createPodPdf(record, signature.buffer, record.signatureType || signature.contentType);
    const saved = await saveAzurePod(accessKey, environment, record, pdf);
    record = saved.record;
    file = saved.file;
  }
  if (!file) file = automaticPod(record);
  const archive = await saveAzureArchive(accessKey, environment, record, pdf, file);
  record = archive.record || record;
  if (!options.copyToDrive || !m365Enabled() || !graphDrive.readiness().configured) {
    return { ok: true, record, file, pdf, backup: record.podBackup || {}, archiveSaved: true, driveSaved: record.podBackup && record.podBackup.driveSaved === true };
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
  let file = null;
  if (fileId) file = (Array.isArray(record.podFiles) ? record.podFiles : []).find(item => text(item.id) === text(fileId));
  if (!file) file = automaticPod(record);
  if (!file) {
    const created = await ensureAutomaticPod(accessKey, environment, {});
    return { buffer: created.pdf || created.buffer, file: created.file, record: created.record };
  }
  if (file && !isCurrentAutomaticPod(file) && String(file.kind || '').toLowerCase() === 'automatic-pod') {
    const regenerated = await ensureAutomaticPod(accessKey, environment, { force: true });
    return { buffer: regenerated.pdf || regenerated.buffer, file: regenerated.file, record: regenerated.record };
  }
  const blobName = text(file.blobName || file.storageBlobName);
  if (!blobName) throw new Error('POD-Datei ohne Speicherreferenz');
  const blob = got.clients.pods.getBlobClient(blobName);
  const read = await store.readBuffer(blob);
  return { buffer: read.buffer, file, record };
}
async function saveSuppliedPod(accessKey, environment, record, pdf, requestedName) {
  const primary = await saveAzurePod(accessKey, environment, record, pdf, requestedName);
  const archive = await saveAzureArchive(accessKey, environment, primary.record, pdf, primary.file);
  return { ok: true, record: archive.record || primary.record, file: primary.file, pdf, backup: (archive.record || primary.record).podBackup || {}, archiveSaved: true };
}
async function retryArchiveBackup(accessKey, environment) {
  const got = await store.getRecord(accessKey, environment);
  let record = got.record || {};
  const existing = await readAutomaticPodBuffer(accessKey, environment, record);
  if (!existing) return ensureAutomaticPod(accessKey, environment, { copyToDrive: true });
  const archive = await saveAzureArchive(accessKey, environment, record, existing.buffer, existing.file);
  record = archive.record || record;
  if (!m365Enabled() || !graphDrive.readiness().configured) {
    return { ok: true, record, file: existing.file, backup: record.podBackup || {}, archiveSaved: true, driveSaved: record.podBackup && record.podBackup.driveSaved === true };
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
        const driveBackfillRequired = m365Enabled() && graphDrive.readiness().configured && backup.driveSaved !== true;
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
      const driveWasSaved = backup.driveSaved === true || result && result.driveSaved === true;
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
  isCurrentAutomaticPod,
  fileNameFor,
  createPodPdf,
  ensureAutomaticPod,
  createShareLink,
  getPodDownload,
  POD_PDF_LAYOUT_VERSION,
  retryArchiveBackup,
  retryDriveBackup,
  saveAzureArchive,
  verifyAzureArchiveBlob,
  checkAzureArchive,
  saveSuppliedPod,
  reconcilePendingBackups
};