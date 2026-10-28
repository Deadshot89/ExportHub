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
