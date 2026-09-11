const fs=require('fs');
const path='index.html';
let s=fs.readFileSync(path,'utf8');
function replaceOnce(oldText,newText,label){
 const i=s.indexOf(oldText);if(i<0)throw new Error('RC1059 Patchstelle fehlt: '+label);
 if(s.indexOf(oldText,i+oldText.length)>=0)throw new Error('RC1059 Patchstelle nicht eindeutig: '+label);
 s=s.slice(0,i)+newText+s.slice(i+oldText.length);
}

if(!s.includes('assets/rc1059-document-blob.js')){
 const marker='</body>';
 const i=s.lastIndexOf(marker);if(i<0)throw new Error('RC1059 </body> fehlt');
 s=s.slice(0,i)+'<script src="assets/rc1059-document-blob.js?v=RC1059"></script>\n'+s.slice(i);
}

replaceOnce(
"window.rc524DownloadFile=function(btn){if(window.ExportHUBIndex224Pod&&typeof window.ExportHUBIndex224Pod.open==='function')return window.ExportHUBIndex224Pod.open(btn);var sh=findShipment(btn.dataset.id),f=sh&&fileList(sh,btn.dataset.key)[Number(btn.dataset.index)],url=fileUrl(f);if(!f)return false;if(!url){alert('Für diese Datei ist kein Downloadinhalt vorhanden.');return false}var a=document.createElement('a');a.href=url;a.download=fileName(f);a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();return false};",
"window.rc524DownloadFile=function(btn){var sh=findShipment(btn.dataset.id),f=sh&&fileList(sh,btn.dataset.key)[Number(btn.dataset.index)],helper=window.ExportHUBDocumentBlob1059;if(!f)return false;if(helper&&helper.isBlobDocument(f)){helper.open(f,{name:fileName(f),download:true}).catch(function(e){alert('Die Datei konnte nicht geöffnet werden: '+Q(e&&e.message||e))});return false}if(window.ExportHUBIndex224Pod&&typeof window.ExportHUBIndex224Pod.open==='function')return window.ExportHUBIndex224Pod.open(btn);var url=fileUrl(f);if(!url){alert('Für diese Datei ist kein Downloadinhalt vorhanden.');return false}var a=document.createElement('a');a.href=url;a.download=fileName(f);a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();return false};",
'rc524DownloadFile'
);

replaceOnce(
"var kind=L([f.kind,f.source,f.name,f.filename].join(' ')),payload=Q(f.dataUrl||f.data||f.url||f.downloadUrl||f.href||f.contentUrl);return !/scan-confirmation|abholscan|ersatz|placeholder/.test(kind)&&!!payload",
"var kind=L([f.kind,f.source,f.name,f.filename].join(' ')),payload=Q(f.dataUrl||f.data||f.url||f.downloadUrl||f.href||f.contentUrl),blobBacked=!!(f.storage==='blob'&&Q(f.blobName));return !/scan-confirmation|abholscan|ersatz|placeholder/.test(kind)&&!!(payload||blobBacked)",
'overviewPodEvidence blob'
);

replaceOnce(
"function openCompletedAbd(id){var a=arr(state().abdRequests).find(function(x){return q(x.id)===q(id)}),d=a&&latestAbdPdf(a),url=abdDocUrl(d);if(!url){alert('Für diese erledigte ABD-Anfrage ist noch kein PDF hinterlegt.');return false}var win=window.open(url,'_blank','noopener,noreferrer');if(!win)alert('Das ABD-PDF konnte nicht geöffnet werden. Bitte Pop-ups für ExportHUB erlauben.');return false}",
"function openCompletedAbd(id){var a=arr(state().abdRequests).find(function(x){return q(x.id)===q(id)}),d=a&&latestAbdPdf(a),helper=window.ExportHUBDocumentBlob1059;if(d&&helper&&helper.isBlobDocument(d)){helper.open(d,{name:q(d.name||d.fileName||d.filename)||'ABD.pdf'}).catch(function(e){alert('Das ABD-PDF konnte nicht geöffnet werden: '+q(e&&e.message||e))});return false}var url=abdDocUrl(d);if(!url){alert('Für diese erledigte ABD-Anfrage ist noch kein PDF hinterlegt.');return false}var win=window.open(url,'_blank','noopener,noreferrer');if(!win)alert('Das ABD-PDF konnte nicht geöffnet werden. Bitte Pop-ups für ExportHUB erlauben.');return false}",
'openCompletedAbd'
);

replaceOnce(
"function activeDocs(sh){var out=[];['deliveryFiles','deliveryNotes','lieferscheine','podFiles','abdFiles','documents','files','attachments'].forEach(function(k){A(sh[k]).forEach(function(f){if(L(f.status)==='deleted'||L(f.status)==='replaced')return;var url=Q(f.data||f.dataUrl||f.url);if(/^data:application\\/pdf;base64,/i.test(url))out.push({name:Q(f.name||f.filename||k+'.pdf').replace(/\\.(jpg|jpeg|png)$/i,'.pdf'),data:dataUrlBytes(url)});else if(/^data:/i.test(url)&&/image\\//i.test(url))out.push({name:Q(f.name||f.filename||k+'.pdf').replace(/\\.[^.]+$/,'.pdf'),data:dataUrlBytes(url)})})});var manifest=new TextEncoder().encode(['ExportHUB '+VERSION,'Kunde: '+customerName(customerForShipment(sh),sh),'Referenz: '+shipmentRef(sh),'Erstellt: '+new Date().toLocaleString('de-DE'),'Aktive hochgeladene Dokumente: '+out.length,'Hinweis: Deckblatt, Ladelisten und CMR werden weiterhin direkt in ExportHUB als aktuelle PDF erzeugt.'].join('\\r\\n'));out.push({name:'Dokumentenliste.txt',data:manifest});return out} window.rc542DownloadShipmentZip=function(id){var sh=findShipment(id);if(!sh)return false;var files=activeDocs(sh),blob=zipBlob(files),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(customerName(customerForShipment(sh),sh)+'_'+shipmentRef(sh)+'_Dokumente.zip').replace(/[^A-Za-z0-9._-]+/g,'_');document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},2000);return false};",
"async function activeDocs(sh){var out=[],helper=window.ExportHUBDocumentBlob1059,keys=['deliveryFiles','deliveryNotes','deliveryNotesFiles','lieferscheine','podFiles','abdFiles','documents','generatedDocuments','files','attachments','invoiceFiles','mailAttachments'];for(var ki=0;ki<keys.length;ki++){var k=keys[ki],list=A(sh[k]);for(var fi=0;fi<list.length;fi++){var f=list[fi];if(L(f.status)==='deleted'||L(f.status)==='replaced')continue;var url=Q(f.data||f.dataUrl||f.url),name=Q(f.name||f.filename||f.fileName||k+'.pdf');if(/^data:application\\/pdf;base64,/i.test(url))out.push({name:name.replace(/\\.(jpg|jpeg|png)$/i,'.pdf'),data:dataUrlBytes(url)});else if(/^data:/i.test(url)&&/image\\//i.test(url))out.push({name:name.replace(/\\.[^.]+$/,'.pdf'),data:dataUrlBytes(url)});else if(helper&&helper.isBlobDocument(f))out.push({name:name,data:await helper.fetchBytes(f)})}}var manifest=new TextEncoder().encode(['ExportHUB '+VERSION,'Kunde: '+customerName(customerForShipment(sh),sh),'Referenz: '+shipmentRef(sh),'Erstellt: '+new Date().toLocaleString('de-DE'),'Aktive hochgeladene Dokumente: '+out.length,'Hinweis: Deckblatt, Ladelisten und CMR werden weiterhin direkt in ExportHUB als aktuelle PDF erzeugt.'].join('\\r\\n'));out.push({name:'Dokumentenliste.txt',data:manifest});return out} window.rc542DownloadShipmentZip=async function(id){var sh=findShipment(id);if(!sh)return false;try{var files=await activeDocs(sh),blob=zipBlob(files),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(customerName(customerForShipment(sh),sh)+'_'+shipmentRef(sh)+'_Dokumente.zip').replace(/[^A-Za-z0-9._-]+/g,'_');document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},2000)}catch(e){alert('Die Dokumente konnten nicht als ZIP geladen werden: '+Q(e&&e.message||e))}return false};",
'activeDocs zip'
);

replaceOnce(
"function openFile(el){var x=resolveFile(el),f=x.file;if(!f){alert('Die Datei wurde nicht gefunden.');return false}if(x.key==='podFiles')",
"function openFile(el){var x=resolveFile(el),f=x.file;if(!f){alert('Die Datei wurde nicht gefunden.');return false}var rc1059Helper=window.ExportHUBDocumentBlob1059;if(rc1059Helper&&rc1059Helper.isBlobDocument(f)){rc1059Helper.open(f,{name:q(f.name||f.filename||f.fileName)||'Dokument'}).catch(function(e){alert('Die Datei konnte nicht geöffnet werden: '+q(e&&e.message||e))});return false}if(x.key==='podFiles')",
'rc628 openFile'
);

fs.writeFileSync(path,s);
console.log('RC1059 Browser-Dual-Read angewendet.');
