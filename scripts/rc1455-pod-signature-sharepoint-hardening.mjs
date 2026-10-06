import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const write=(rel,value)=>fs.writeFileSync(path.join(ROOT,rel),value,'utf8');
function replaceOnce(source,before,after,label){
  if(source.includes(after))return source;
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(`${label}: erwarteter Anker ${count}x gefunden`);
  return source.replace(before,after);
}

// RC1455: a captured digital signature is business evidence, not a disposable
// public-link artefact. Store it byte-identically in the primary POD container and
// the separate immutable POD archive before confirming signature persistence.
{
  const rel='api/shared/pickup-store.js';
  let source=read(rel);
  if(!source.includes('async function archiveImmutableSignature(')){
    const start=source.indexOf('async function saveDriverSignature(');
    const end=start<0?-1:source.indexOf('\n\nfunction rc1017SafePickupHistory',start);
    if(start<0||end<0)throw new Error('RC1455 pickup signature function boundaries not found');
    const block=`async function verifyImmutableSignatureBlob(blob,parsed,code){const read=await readBuffer(blob),expectedHash=crypto.createHash('sha256').update(parsed.buffer).digest('hex'),actualHash=crypto.createHash('sha256').update(read.buffer).digest('hex');if(read.buffer.length!==parsed.buffer.length||actualHash!==expectedHash)throw err(code,'Die gespeicherte digitale Unterschrift stimmt nicht mit dem erfassten Original überein.',409);return{hash:expectedHash,size:read.buffer.length,verifiedAt:now()}}\nasync function savePrimaryImmutableSignature(c,record,blobName,parsed,kind){const blob=c.pods.getBlockBlobClient(blobName),hash=crypto.createHash('sha256').update(parsed.buffer).digest('hex');try{await blob.uploadData(parsed.buffer,{blobHTTPHeaders:{blobContentType:parsed.type,blobCacheControl:'no-store'},metadata:{accesshash:String(record.accessKey),reference:String(record.reference||''),kind:String(kind||'digital-signature'),sha256:hash},conditions:{ifNoneMatch:'*'}})}catch(e){if(!(e&&(e.statusCode===409||e.statusCode===412)))throw e}return verifyImmutableSignatureBlob(blob,parsed,'SIGNATURE_PRIMARY_INTEGRITY_FAILED')}\nasync function archiveImmutableSignature(c,record,blobName,parsed,kind){const archive=await podArchiveClient(c.environment),blob=archive.podArchive.getBlockBlobClient(blobName),hash=crypto.createHash('sha256').update(parsed.buffer).digest('hex');try{await blob.uploadData(parsed.buffer,{blobHTTPHeaders:{blobContentType:parsed.type,blobCacheControl:'no-store'},metadata:{accesshash:String(record.accessKey),reference:String(record.reference||''),kind:String(kind||'digital-signature')+'-archive',sha256:hash},conditions:{ifNoneMatch:'*'}})}catch(e){if(!(e&&(e.statusCode===409||e.statusCode===412)))throw e}return verifyImmutableSignatureBlob(blob,parsed,'SIGNATURE_ARCHIVE_INTEGRITY_FAILED')}\nasync function saveDriverSignature(c,record,dataUrl,suffix='pickup'){if(!record||!validAccessKey(record.accessKey))throw err('INVALID_ACCESS_KEY','Interner Pickup-Schlüssel fehlt.',500);const parsed=parseSignature(dataUrl),safeSuffix=String(suffix||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40),blobName=podPrefix(c.environment,record.accessKey)+'/driver-signature-'+(safeSuffix||Date.now())+'.'+parsed.extension;await savePrimaryImmutableSignature(c,record,blobName,parsed,'driver-signature');await archiveImmutableSignature(c,record,blobName,parsed,'driver-signature');return{signatureBlobName:blobName,signatureType:parsed.type,signatureSize:parsed.buffer.length,signatureStoredAt:now(),signatureArchiveStored:true}}\nasync function saveCustomsDocumentsSignature(c,record,dataUrl,suffix='pickup'){if(!record||!validAccessKey(record.accessKey))throw err('INVALID_ACCESS_KEY','Interner Pickup-Schlüssel fehlt.',500);const parsed=parseSignature(dataUrl),safeSuffix=String(suffix||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40),blobName=podPrefix(c.environment,record.accessKey)+'/customs-documents-signature-'+(safeSuffix||Date.now())+'.'+parsed.extension;await savePrimaryImmutableSignature(c,record,blobName,parsed,'customs-documents-receipt-signature');await archiveImmutableSignature(c,record,blobName,parsed,'customs-documents-receipt-signature');return{customsDocumentsSignatureBlobName:blobName,customsDocumentsSignatureType:parsed.type,customsDocumentsSignatureSize:parsed.buffer.length,customsDocumentsSignatureStoredAt:now(),customsDocumentsSignatureArchiveStored:true}}`;
    source=source.slice(0,start)+block+source.slice(end);
    write(rel,source);
  }
}

// RC1455: the signed POD must reach the configured SharePoint/M365 target. Azure
// primary + immutable archive protect the evidence during a Graph outage, while the
// SharePoint copy remains explicitly pending and is retried by reconcile.
{
  const rel='api/shared/pod-archive.js';
  let source=read(rel);
  source=replaceOnce(source,"      status: record && record.podBackup && record.podBackup.archiveSaved === true ? 'saved' : 'pending',","      status: 'pending-sharepoint',",'RC1455 SharePoint pending status');
  source=replaceOnce(source,"      lastError: record && record.podBackup && record.podBackup.archiveSaved === true ? '' : text(error && (error.code ? error.code + ': ' : '') + (error && error.message || 'Microsoft-365-Sicherung fehlgeschlagen')).slice(0, 500)","      lastError: text(error && (error.code ? error.code + ': ' : '') + (error && error.message || 'SharePoint-POD-Sicherung fehlgeschlagen')).slice(0, 500)",'RC1455 SharePoint pending error');

  const ensureBefore=`  if (!options.copyToDrive || !m365Enabled() || !graphDrive.readiness().configured) {\n    return { ok: true, record, file, pdf, backup: record.podBackup || {}, archiveSaved: true, driveSaved: record.podBackup && record.podBackup.driveSaved === true };\n  }`;
  const ensureAfter=`  if (!options.copyToDrive) {\n    return { ok: true, record, file, pdf, backup: record.podBackup || {}, archiveSaved: true, driveSaved: record.podBackup && record.podBackup.driveSaved === true };\n  }`;
  source=replaceOnce(source,ensureBefore,ensureAfter,'RC1455 ensure SharePoint attempt');

  const retryBefore=`  if (!m365Enabled() || !graphDrive.readiness().configured) {\n    return { ok: true, record, file: existing.file, backup: record.podBackup || {}, archiveSaved: true, driveSaved: record.podBackup && record.podBackup.driveSaved === true };\n  }`;
  source=replaceOnce(source,retryBefore,'','RC1455 retry SharePoint attempt');

  const suppliedStart=source.indexOf('async function saveSuppliedPod(');
  const suppliedEnd=suppliedStart<0?-1:source.indexOf('\nasync function retryArchiveBackup(',suppliedStart);
  if(suppliedStart<0||suppliedEnd<0)throw new Error('RC1455 supplied POD function boundaries not found');
  const supplied=`async function saveSuppliedPod(accessKey, environment, record, pdf, requestedName) {\n  const primary = await saveAzurePod(accessKey, environment, record, pdf, requestedName);\n  const archive = await saveAzureArchive(accessKey, environment, primary.record, pdf, primary.file);\n  const archivedRecord = archive.record || primary.record;\n  const drive = await copyToDrive(accessKey, environment, archivedRecord, pdf, primary.file);\n  return { ok: true, record: drive.record || archivedRecord, file: primary.file, pdf, backup: (drive.record || archivedRecord).podBackup || {}, archiveSaved: true, driveSaved: drive.ok === true, driveError: drive.ok ? null : drive.error };\n}`;
  source=source.slice(0,suppliedStart)+supplied+source.slice(suppliedEnd);

  source=replaceOnce(source,"        const driveBackfillRequired = m365Enabled() && graphDrive.readiness().configured && backup.driveSaved !== true;","        const sharePointRequired = backup.driveSaved !== true;",'RC1455 SharePoint required flag');
  source=replaceOnce(source,"        if (reference) alreadySaved.push({ reference: recordReference || text(record.reference), fileName: text(backup.fileName), attempts: Math.max(0, Number(backup.attempts) || 0) });\n        if (!driveBackfillRequired) continue;","        if (reference && !sharePointRequired) alreadySaved.push({ reference: recordReference || text(record.reference), fileName: text(backup.fileName), attempts: Math.max(0, Number(backup.attempts) || 0) });\n        if (!sharePointRequired) continue;",'RC1455 SharePoint candidate');
  source=replaceOnce(source,"      const driveRequired = m365Enabled() && graphDrive.readiness().configured;","      const driveRequired = true;",'RC1455 SharePoint result required');
  source=replaceOnce(source,"    if (driveBackfillCandidates.length > selectedDriveCandidates.length) {\n      optionalDriveWorkDeferred = true;\n      pageWorkDeferred = true;\n    }","    if (driveBackfillCandidates.length > selectedDriveCandidates.length) {\n      optionalDriveWorkDeferred = true;\n      requiredWorkDeferred = true;\n      pageWorkDeferred = true;\n    }",'RC1455 SharePoint backlog required');

  const targetStart=source.indexOf('  const target = reference ? {');
  const targetEnd=targetStart<0?-1:source.indexOf('\n  } : null;',targetStart);
  if(targetStart<0||targetEnd<0)throw new Error('RC1455 target reconcile block not found');
  const targetBlock=`  const targetSavedNowRefs = new Set(saved.concat(driveSaved).map(item => text(item && item.reference).toUpperCase()).filter(Boolean));\n  const targetAlreadySavedRefs = new Set(alreadySaved.map(item => text(item && item.reference).toUpperCase()).filter(Boolean));\n  const targetPendingCount = pending.length + drivePending.length;\n  const target = reference ? {\n    reference,\n    matchedCount: referenceMatched,\n    podReadyCount: referencePodReady,\n    alreadySavedCount: targetAlreadySavedRefs.size,\n    savedNowCount: targetSavedNowRefs.size,\n    pendingCount: targetPendingCount,\n    errorCount: errors.length,\n    status: referenceMatched === 0 ? 'not-found' :\n      referencePodReady === 0 ? 'pod-not-ready' :\n      errors.length > 0 ? 'error' :\n      targetPendingCount > 0 ? 'pending' :\n      (targetAlreadySavedRefs.size + targetSavedNowRefs.size >= referencePodReady ? (targetSavedNowRefs.size > 0 ? 'saved-now' : 'already-saved') : 'incomplete')\n  } : null;`;
  source=source.slice(0,targetStart)+targetBlock+source.slice(targetEnd+'\n  } : null;'.length);
  source=replaceOnce(source,'    eligible: requiredEligible + teamRelinkCandidates.length,','    eligible: requiredEligible + driveBackfillEligible + teamRelinkCandidates.length,','RC1455 required eligible');
  source=replaceOnce(source,'    selected: requiredSelected + selectedRelinks.length,','    selected: requiredSelected + driveBackfillSelected + selectedRelinks.length,','RC1455 required selected');
  write(rel,source);
}

// RC1455: never tell the loader that the POD is fully backed up before SharePoint
// has acknowledged its copy. Azure/immutable archive still gives a truthful fallback.
{
  const rel='pickup.html';
  let source=read(rel);
  const old1="var podText=data&&data.podAzureSaved?(data.podArchiveSaved?'POD wurde sicher in ExportHUB und zusätzlich im geschützten Archiv gespeichert.':'POD wurde sicher in ExportHUB gespeichert. Die zusätzliche Archivkopie ist noch offen.'):'Abholung und Fahrerunterschrift sind gespeichert.';";
  const new1="var podText=data&&data.podAzureSaved?(data.podArchiveSaved?(data.podDriveSaved?'POD wurde sicher in ExportHUB, im geschützten Archiv und auf SharePoint gespeichert.':'POD und digitale Unterschrift sind in ExportHUB und im geschützten Archiv gesichert. Die SharePoint-Sicherung ist noch offen und wird automatisch nachgeholt.'):'POD wurde sicher in ExportHUB gespeichert. Die zusätzliche Archivkopie und SharePoint-Sicherung sind noch offen.'):'Abholung und Fahrerunterschrift sind gespeichert.';";
  source=replaceOnce(source,old1,new1,'RC1455 recovery success message');
  const old2="var podText=data&&data.podAzureSaved?(data.podArchiveSaved?'POD wurde sicher in ExportHUB und zusätzlich im geschützten Archiv gespeichert.':'POD wurde sicher in ExportHUB gespeichert. Die zusätzliche Archivkopie ist noch offen.'):'Abholung und Fahrerunterschrift wurden gespeichert. Der Archivstatus konnte nicht bestätigt werden.';";
  const new2="var podText=data&&data.podAzureSaved?(data.podArchiveSaved?(data.podDriveSaved?'POD wurde sicher in ExportHUB, im geschützten Archiv und auf SharePoint gespeichert.':'POD und digitale Unterschrift sind in ExportHUB und im geschützten Archiv gesichert. Die SharePoint-Sicherung ist noch offen und wird automatisch nachgeholt.'):'POD wurde sicher in ExportHUB gespeichert. Die zusätzliche Archivkopie und SharePoint-Sicherung sind noch offen.'):'Abholung und Fahrerunterschrift wurden gespeichert. Der Archivstatus konnte nicht bestätigt werden.';";
  source=replaceOnce(source,old2,new2,'RC1455 complete success message');
  write(rel,source);
}

// Release manifest must reflect the actual business-critical backup contract.
{
  const rel='.github/rc1112/build-three-env.mjs';
  let source=read(rel);
  source=source.replace("podReliability:'RC1220 Azure primary + immutable Azure archive; M365 optional'","podReliability:'RC1455 Azure primary + immutable signature/archive; SharePoint required'");
  source=source.replace("podGraphReadiness:'RC1220 Graph optional; Azure archive is release-critical secondary backup'","podGraphReadiness:'RC1455 SharePoint required; Azure archive protects evidence until retry succeeds'");
  write(rel,source);
}

const store=read('api/shared/pickup-store.js');
const archive=read('api/shared/pod-archive.js');
const pickup=read('pickup.html');
const build=read('.github/rc1112/build-three-env.mjs');
if(!store.includes('archiveImmutableSignature')||!store.includes('SIGNATURE_ARCHIVE_INTEGRITY_FAILED'))throw new Error('RC1455 immutable signature archive missing');
if(!archive.includes("status: 'pending-sharepoint'")||!archive.includes('const sharePointRequired = backup.driveSaved !== true'))throw new Error('RC1455 SharePoint required backup state missing');
if(!pickup.includes('data.podDriveSaved'))throw new Error('RC1455 SharePoint UI status missing');
if(!build.includes('SharePoint required'))throw new Error('RC1455 release manifest missing');
console.log('RC1455 signature archive and SharePoint-required POD hardening applied');
