// RC1821: Preserve both the stored signed original and a separate manual POD
// in the generated three-environment HTML. Do not re-render signatures.
const OLD_SOURCE="function sourceList(sh){if(!sh||!hasSignature(sh))return[];var manual=manualPodSource(sh);if(manual)return[manual];return[{url:'',name:'POD_'+safe(ref(sh))+'_Ladeliste_mit_Unterschrift.pdf',type:'application/pdf',kind:'official-signed-loadlist'}]}";
const NEW_SOURCE=String.raw`function signedPodExpected(sh){
 if(!sh)return false;
 var api=window.ExportHUBPickupPOD;
 try{if(api&&typeof api.hasSignature==='function'&&api.hasSignature(sh))return true}catch(_){}
 var inline=q([sh.driverSignature,sh.pickupDriverSignature,sh.signatureDataUrl,sh.pickupSignature].find(Boolean));
 var url=q([sh.driverSignatureUrl,sh.pickupDriverSignatureUrl,sh.pickupSignatureUrl,sh.signatureUrl].find(Boolean));
 var verified=sh.remotePickupStatusLocked===true&&sh.podServerVerified===true&&!!q(sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickedUpAt||sh.podServerVerifiedAt);
 var stored=arr(sh.podFiles).some(function(f){return realFile(f)&&/automatic-pod|signed-loadlist|official-signed|digital-pod|qr-pod/i.test([f&&f.source,f&&f.docKind,f&&f.kind,f&&f.id].join(' '))});
 return /^data:image\//i.test(inline)||inline.length>200||!!url||verified||stored
}
function sourceList(sh){
 if(!sh||!hasSignature(sh))return[];
 var manual=manualPodSource(sh),sources=[];
 if(!manual||signedPodExpected(sh))sources.push({url:'',name:'POD_'+safe(ref(sh))+'_Ladeliste_mit_Unterschrift.pdf',type:'application/pdf',kind:'official-signed-loadlist'});
 if(manual)sources.push(manual);
 return sources
}`;
const SIGNED_ORIGINAL_LOADER=String.raw`async function savedSignedPod(sh){
 var official=window.ExportHUBRC1602OfficialPOD;
 if(!official)throw new Error('Original-POD-Abruf ist nicht verfügbar. Die Sicherung wurde nicht als erfolgreich markiert.');
 var blob=null;
 if(typeof official.storedSignedBlob==='function')blob=await official.storedSignedBlob(sh,{signedOnly:true});
 if(!blob&&typeof official.canonicalPdf==='function')blob=await official.canonicalPdf(sh);
 if(!blob||blob.size<1000)throw new Error('Keine gespeicherte vollständige unterschriebene Ladeliste abrufbar.');
 var bytes=new Uint8Array(await blob.arrayBuffer());
 if(fileFormat(bytes)!=='pdf')throw new Error('Gespeicherter Original-POD ist kein gültiges PDF.');
 return{bytes:bytes,ext:'pdf',name:'POD_'+ref(sh)+'_Ladeliste_mit_Unterschrift.pdf'}
}`;
const MANIFEST_START=' var manualCount=x.jobs.filter(';
const MANIFEST_END="\n entries.push({name:'POD_Sicherung_Protokoll.txt'";
const NEW_MANIFEST=String.raw` var expectedCount=x.jobs.length,missingCount=expectedCount-entries.length,complete=missingCount===0&&fail.length===0;
 var manifest=['ExportHUB POD-Sicherung','Version: '+VERSION,'Zeitraum: '+period,'Erstellt: '+new Date().toLocaleString('de-DE'),
  'Erwartete POD-Dateien: '+expectedCount,'Gesicherte POD-Dateien: '+entries.length,
  'Davon manuell hochgeladen: '+manualSuccess,'Davon digital unterschriebene Ladelisten: '+signedSuccess,
  'Fehlende POD-Dateien: '+missingCount,'Fehler: '+fail.length,
  'Vollständigkeit: '+(complete?'VOLLSTÄNDIG':'UNVOLLSTÄNDIG'),
  '','Manuelle Uploads: POD_<Referenz>.pdf','Digitale PODs: vollständige Ladeliste mit Fahrerunterschrift',
  complete?'Alle vorgesehenen POD-Dateien wurden im PDF-Format gesichert.':'Nicht gesichert'+String.fromCharCode(10)+fail.join(String.fromCharCode(10))].join(String.fromCharCode(10));`;
function replaceExactlyOnce(source,needle,replacement,label){
 const first=source.indexOf(needle);
 if(first<0||source.indexOf(needle,first+needle.length)>=0)throw new Error('RC1821: '+label+' fehlt oder mehrfach vorhanden');
 return source.slice(0,first)+replacement+source.slice(first+needle.length);
}
export function patchPodDualBackup(html){
 if(html.includes('function signedPodExpected(sh)'))return html;
 let out=replaceExactlyOnce(html,OLD_SOURCE,NEW_SOURCE,'sourceList');
 out=replaceExactlyOnce(out,"btn.disabled=true;bar.style.width='0%';var entries=[],fail=[];","btn.disabled=true;bar.style.width='0%';var entries=[],fail=[],manualSuccess=0,signedSuccess=0;",'Download-Zähler');
 out=replaceExactlyOnce(out,"entries.push({name:src.name,data:loaded.bytes})","entries.push({name:src.name,data:loaded.bytes});manualSuccess++",'manueller PDF-Erfolg');
 if(out.includes('var generated=await localSignedPod(sh),base=')){
  if(!out.includes('async function savedSignedPod(sh)')){
    out=replaceExactlyOnce(out,'async function localSignedPod(sh){',SIGNED_ORIGINAL_LOADER+'\nasync function localSignedPod(sh){','sicherer Original-POD-Loader');
  }
  out=replaceExactlyOnce(out,'var generated=await localSignedPod(sh),base=','var original=await savedSignedPod(sh),base=','TESTSERVICE-Original-Loader');
  out=replaceExactlyOnce(out,"data:generated.bytes})","data:original.bytes})",'TESTSERVICE-Original-Daten');
 }
 out=replaceExactlyOnce(out,"entries.push({name:safe(podDate(sh)+'_'+base)+'.pdf',data:original.bytes})","entries.push({name:safe(podDate(sh)+'_'+base)+'.pdf',data:original.bytes});signedSuccess++",'signierter PDF-Erfolg');
 const start=out.indexOf(MANIFEST_START),end=out.indexOf(MANIFEST_END,start);
 if(start<0||end<start||out.indexOf(MANIFEST_START,start+1)>=0)throw new Error('RC1821: Manifest-Anker fehlt oder ist mehrfach vorhanden');
 out=out.slice(0,start)+NEW_MANIFEST+out.slice(end);
 out=replaceExactlyOnce(out,"status.className=fail.length?'rc422-pod-status bad':'rc422-pod-status ok';status.textContent=(entries.length-1)+' POD-Datei'+(entries.length-1===1?'':'en')+' wurden gemeinsam im ZIP gesichert.'+(fail.length?' Nicht gesichert: '+fail.length+'. Details stehen im Protokoll.':'');btn.disabled=false;return true",
 "status.className=complete?'rc422-pod-status ok':'rc422-pod-status bad';status.textContent=(entries.length-1)+' von '+expectedCount+' POD-Dateien im ZIP gesichert.'+(complete?'':' UNVOLLSTÄNDIG: '+missingCount+' Datei(en) fehlen. Details im Protokoll.');btn.disabled=false;return complete",
 'Download-Ergebnis');
 return out;
}
