// RC1716 P1: Patch the canonical inline POD backup controller in generated
// PRODUCTION/TESTSERVICE/DEMO bundles. Never create a second controller.
function replaceOnce(source, before, after, label) {
  const at = source.indexOf(before);
  if (at < 0 || source.indexOf(before, at + before.length) >= 0) {
    throw new Error('RC1716 missing/ambiguous source: ' + label);
  }
  return source.slice(0, at) + after + source.slice(at + before.length);
}

export function patchRc1716PodBatchHtml(html, environment = 'unknown') {
  const marker = '<script id="rc455-pod-backup-controller">';
  const start = html.indexOf(marker);
  const end = start < 0 ? -1 : html.indexOf('</script>', start + marker.length);
  if (start < 0 || end <= start || html.indexOf(marker, start + marker.length) >= 0) {
    throw new Error(environment + ': RC1716 POD backup controller missing/ambiguous');
  }
  let script = html.slice(start, end);

  script = replaceOnce(
    script,
    "function sourceList(sh){if(!sh||!hasSignature(sh))return[];var manual=manualPodSource(sh);if(manual)return[manual];return[{url:'',name:'POD_'+safe(ref(sh))+'_Ladeliste_mit_Unterschrift.pdf',type:'application/pdf',kind:'official-signed-loadlist'}]}",
    "function digitalOriginalAvailable(sh){if(!sh)return false;var files=arr(sh.podFiles);return sh.podServerVerified===true||sh.remotePickupStatusLocked===true&&!!q(sh.podServerVerifiedAt||sh.pickupConfirmedAt)||!!q(sh.driverSignature||sh.pickupDriverSignature||sh.signatureDataUrl||sh.pickupSignature||sh.signatureBlobName)||files.some(function(f){var kind=low(f&&f.kind),source=low(f&&f.source);return kind==='automatic-pod'||source==='pickup-confirm-v3'||source==='pickup-client-supplied'})}\nfunction sourceList(sh){if(!sh||!hasSignature(sh))return[];var manual=manualPodSource(sh),digital=digitalOriginalAvailable(sh),official={url:'',name:'POD_'+safe(ref(sh))+'_Ladeliste_mit_Unterschrift.pdf',type:'application/pdf',kind:'official-signed-loadlist'};if(manual&&!digital)return[manual];return manual?[official,manual]:[official]}",
    'retain digital original and additional manual POD'
  );

  // RC1720: the old selector returned only the newest manually uploaded POD.
  // Include every distinct manual PDF as an additional archive entry while
  // never treating an automatic signed POD as a manual attachment.
  script = replaceOnce(
    script,
    "function sourceList(sh){if(!sh||!hasSignature(sh))return[];var manual=manualPodSource(sh),digital=digitalOriginalAvailable(sh),official={url:'',name:'POD_'+safe(ref(sh))+'_Ladeliste_mit_Unterschrift.pdf',type:'application/pdf',kind:'official-signed-loadlist'};if(manual&&!digital)return[manual];return manual?[official,manual]:[official]}",
    "function manualPodSources(sh){var first=manualPodSource(sh);if(!first)return[];var out=[first],seen={},files=arr(sh&&sh.podFiles);seen[q(first.url)+'|'+q(first.fileId)]=true;files.filter(function(f){if(!realFile(f)||/deleted|gelöscht|replaced|ersetzt|storniert/i.test(low(f&&f.status)))return false;var marker=low([f&&f.source,f&&f.docKind,f&&f.kind,f&&f.id].join(' '));return f&&f.manualUpload===true||/manual-upload|user-upload/.test(marker)}).sort(function(a,b){return String(b&&[b.uploadedAt,b.createdAt,b.modifiedAt].find(Boolean)||'').localeCompare(String(a&&[a.uploadedAt,a.createdAt,a.modifiedAt].find(Boolean)||'')}).forEach(function(f){var url=fileUrl(f),id=q(f.id),key=q(url)+'|'+id;if(!url||url===first.url||id&&id===first.fileId||seen[key])return;seen[key]=true;out.push({url:url,name:'POD_'+safe(ref(sh))+'_Anhang_'+(out.length+1)+'.pdf',type:'application/pdf',kind:'manual-uploaded-pod',fileId:id,originalName:q(f.originalName||f.name||f.filename||f.fileName)})});return out}\\nfunction sourceList(sh){if(!sh||!hasSignature(sh))return[];var manuals=manualPodSources(sh),digital=digitalOriginalAvailable(sh),official={url:'',name:'POD_'+safe(ref(sh))+'_Ladeliste_mit_Unterschrift.pdf',type:'application/pdf',kind:'official-signed-loadlist'};return digital?[official].concat(manuals):manuals.length?manuals:[official]}",
    'all distinct manually uploaded PODs with unique archive filenames'
  );


  // RC1717: The old auto-sync sent a manually uploaded POD through the
  // automatic signed-POD endpoint, replacing the canonical original.
  // Manual files remain independent ZIP evidence; never rewrite signed PODs.
  const manualBegin = script.indexOf('async function syncManualCloudUploads(force){');
  const manualEnd = script.indexOf('\nasync function syncServer(force){', manualBegin);
  if (manualBegin < 0 || manualEnd <= manualBegin) {
    throw new Error(environment + ': RC1717 manual POD backup boundary missing');
  }
  script = script.slice(0, manualBegin) +
    "async function syncManualCloudUploads(force){/* RC1717: keep uploaded POD separate from signed original */return 0}\n" +
    script.slice(manualEnd + 1);

  // The emergency counter must be based on actual Azure + Graph proof,
  // not on a legacy optimistic 'saved' label stored in the browser state.
  script = replaceOnce(
    script,
    "var signed=filtered('',''),cloud=signed.filter(function(sh){return low(sh&&sh.podCloudBackupStatus)==='saved'&&!!q(sh&&sh.podCloudBackupFileName)}).length",
    "var signed=filtered('',''),cloud=signed.filter(function(sh){var b=sh&&sh.podBackup||{},hash=low(b.hash),verified=low(b.driveVerifiedHash);return b.archiveSaved===true&&b.driveSaved===true&&!!q(b.driveItemId)&&/^[a-f0-9]{64}$/.test(hash)&&hash===verified&&!!q(b.driveVerifiedAt)}).length",
    'never show optimistic SharePoint success in emergency modal'
  );

  script = replaceOnce(
    script,
    "btn.disabled=true;bar.style.width='0%';var entries=[],fail=[];",
    "btn.disabled=true;bar.style.width='0%';var entries=[],fail=[],manualSaved=0,signedSaved=0;",
    'track actual saved files'
  );
  script = replaceOnce(
    script,
    "entries.push({name:src.name,data:loaded.bytes})}else{var original=await savedSignedPod(sh),base='POD_'+safe(ref(sh))+'_Ladeliste_mit_Unterschrift';entries.push({name:safe(podDate(sh)+'_'+base)+'.pdf',data:original.bytes})}",
    "entries.push({name:src.name,data:loaded.bytes});manualSaved++}else{var original=await savedSignedPod(sh),base='POD_'+safe(ref(sh))+'_Ladeliste_mit_Unterschrift';entries.push({name:safe(podDate(sh)+'_'+base)+'.pdf',data:original.bytes});signedSaved++}",
    'count only files actually written to ZIP'
  );
  script = replaceOnce(
    script,
    "var manualCount=x.jobs.filter(function(j){return j.src&&j.src.kind==='manual-uploaded-pod'}).length,signedCount=x.jobs.length-manualCount,manifest=",
    "var manualCount=manualSaved,signedCount=signedSaved,manifest=",
    'accurate manifest counters'
  );
  script = replaceOnce(
    script,
    "btn.disabled=false;return true\n}",
    "btn.disabled=false;return fail.length===0\n}",
    'do not return complete when one PDF fails'
  );
  return html.slice(0, start) + script + html.slice(end);
}
