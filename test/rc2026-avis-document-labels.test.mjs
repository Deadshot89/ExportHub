import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const languages=['de','en','pl','es','fr','it'];
const required=[
 'avisPortal.documentsHeading','avisPortal.documentsIntro',
 'avisPortal.documentsAfterPickup','avisPortal.downloadDocument',
 'avisPortal.downloadPod','avisPortal.choose','avisPortal.uploadIntro',
 'avisPortal.uploadEmpty','avisPortal.uploadSaved','avisPortal.uploadBlocked',
 'avisPortal.uploadPending','avisPortal.uploadSecurity1',
 'avisPortal.uploadSecurity2','avisPortal.uploadSecurity3',
 'avisPortal.uploadSecurity4','avisPortal.uploadNotSaved',
 'avisPortal.uploadStored','avisPortal.uploadChecking',
 'avisPortal.noDocuments','avisPortal.noFurtherDocuments',
 'avisPortal.quantitiesTitle','avisPortal.quantitiesIntro','avisPortal.quantitiesAction',
 'avisPortal.quantitiesLoading','avisPortal.quantitiesMissing','avisPortal.quantitiesError',
 'avisPortal.quantitiesArticle','avisPortal.quantitiesQuantity','avisPortal.quantitiesSource','avisPortal.quantitiesIncomplete',
 'avisPortal.uploadTitle','avisPortal.uploadDocType','avisPortal.uploadSelectPdf','avisPortal.uploadStart',
 'avisPortal.uploadOptCmr','avisPortal.uploadOptDelivery','avisPortal.uploadOptInvoice',
 'avisPortal.uploadOptPacking','avisPortal.uploadOptOther',
 'avisPortal.docDelivery','avisPortal.docInvoice','avisPortal.docPacking',
 'avisPortal.docDocument','avisPortal.docAttachment','avisPortal.docNotAvailable'
];

test('AVIS document and PDF upload text has entries in all six portal languages',()=>{
 for(const language of languages){
  const pack=JSON.parse(fs.readFileSync('assets/i18n/'+language+'.json','utf8'));
  for(const key of required){
   assert.equal(typeof pack[key],'string',language+': '+key+' missing');
   assert.ok(pack[key].trim().length>0,language+': '+key+' blank');
  }
 }
});

test('AVIS select placeholder is translated explicitly (option nodes bypass legacy text translator)',()=>{
 const html=fs.readFileSync('customer-avis.html','utf8');
 assert.match(html,/function avisLabel\(/);
 assert.match(html,/avisLabel\('avisPortal\.choose','Bitte auswählen'\)/);
 assert.match(html,/addEventListener\('exporthub:language-changed'/);
 assert.match(html,/\.upload-actions input\[type=file\]/);
});

test('AVIS invoice recognition does not depend on the old Lieferschein default',()=>{
 const upload=fs.readFileSync('assets/shipment-document-upload.js','utf8');
 const normalizer=fs.readFileSync('assets/document-reference-normalizer.js','utf8');
 assert.match(normalizer,/function detectDocumentKind\(/);
 assert.match(normalizer,/ambiguous-invoice/);
 assert.match(upload,/var actualKind=docKind,uploadName=file\.name/);
 assert.match(upload,/normalizer\.detectDocumentKind\('scan\.pdf',pdfText\)/);
 assert.match(upload,/kind:actualKind,reference:ref/);
});

test('AVIS: quantity check is session-authorized, read-only and accessible after pickup',()=>{
 const api=fs.readFileSync('api/customer-avis/index.js','utf8');
 const html=fs.readFileSync('customer-avis.html','utf8');
 assert.ok(api.indexOf("const session=sessionFromRequest(req,payload)")<api.indexOf("getAction==='delivery-quantities'"));
 assert.match(api,/readAvisDeliveredQuantities\(sh,sessionInfo,state\)/);
 assert.match(html,/function deliveryQuantitiesPanelHtml\(/);
 assert.match(html,/function bindDeliveryQuantities\(/);
 assert.match(html,/api\('\?action=delivery-quantities'\)/);
 assert.match(html,/data-i18n="avisPortal.quantitiesTitle"/);
 assert.match(html,/bindDeliveryQuantities\(\);return}setStatus/);
});

test('AVIS: released invoice category takes priority, deduplication requires verified SHA',()=>{
 const api=fs.readFileSync('api/customer-avis/index.js','utf8');
 const refs=fs.readFileSync('api/shared/customer-avis-reference-docs.js','utf8');
 assert.match(api,/addDocument\(out,seen,'invoiceFiles','Rechnung',f,i,true\)/);
 assert.match(api,/sha256:'\+sha256/);
 assert.match(refs,/crypto\.createHash\('sha256'\)/);
 assert.doesNotMatch(refs,/if\(seen\.has\(key\)\)continue/);
});

test('AVIS: dynamic document labels and every select option use explicit translation keys',()=>{
 const html=fs.readFileSync('customer-avis.html','utf8');
 for(const key of ['uploadTitle','uploadDocType','uploadSelectPdf','uploadStart',
  'uploadOptCmr','uploadOptDelivery','uploadOptInvoice','uploadOptPacking','uploadOptOther',
  'docDelivery','docInvoice','docPacking','documentsHeading','documentsIntro','uploadIntro']){
  assert.ok(html.includes("'avisPortal."+key+"'"),'missing translated rendering: '+key);
 }
 assert.match(html,/addEventListener\('exporthub:language-changed'/);
 assert.match(html,/Array\.from\(select\.options\|\|\[\]\)\.forEach/);
 assert.match(html,/avisCategoryLabel\(q\(d\.category\)\)/);
});
