import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspace=fs.readFileSync('assets/rc1940-documents-workspace.js','utf8');
const scanner=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
const invoice=fs.readFileSync('assets/rc1549-abd-proforma.js','utf8');
const delivery=fs.readFileSync('assets/rc1790-delivery-note.js','utf8');
const server=fs.readFileSync('api/abd-analysis/index.js','utf8');
const menu=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');

test('RC1941: separate document workspace exposes authenticated file picker and scan results',()=>{
 assert.match(workspace,/data-rc1940-files accept="[^"]*\.pdf[^"]*\.xlsx[^"]*\.csv/);
 assert.match(workspace,/data-rc1940-analyze/);
 assert.match(workspace,/data-rc1940-upload-results/);
 assert.match(workspace,/role="status" aria-live="polite"/);
 assert.match(workspace,/scanBusy/);
 assert.match(workspace,/chosenFiles\.length>5/);
 assert.match(workspace,/12\*1024\*1024/);
 assert.match(workspace,/scanner\.analyzeFile\(file\)/);
 assert.match(workspace,/editor\.importAnalysis\(result\.analysis\)/);
 assert.match(workspace,/scanPending=true/);
 assert.match(menu,/['"]documents['"]/);
});
test('RC1941: existing storage quarantine and Defender scan are reused without bypass',()=>{
 assert.match(scanner,/analyzeFile:analyzeFile/);
 assert.match(scanner,/pendingUploads=new WeakMap\(\)/);
 assert.match(scanner,/ABD_SCAN_PENDING/);
 assert.match(scanner,/action:'upload'/);
 assert.match(scanner,/action:'status'/);
 assert.match(server,/auth\.validateSession\(req,\{requireExportHubToken:true\}\)/);
 assert.match(server,/scan\.status!=='clean'/);
 assert.match(server,/await blob\.deleteIfExists\(\)/);
});
test('RC1941: scanned line items import into both editable document editors',()=>{
 assert.match(invoice,/function importAnalysis\(source\)/);
 assert.match(invoice,/importAnalysis:importAnalysis/);
 assert.match(invoice,/rows=positions\.map/);
 assert.match(invoice,/fillHeader\(\);renderRows\(\);invalidate\(\)/);
 assert.match(delivery,/function importAnalysis\(source\)/);
 assert.match(delivery,/importAnalysis:importAnalysis/);
 assert.match(delivery,/items=next/);
 assert.match(delivery,/renderRows\(\);applyMode\(\)/);
 assert.match(delivery,/positions\.length>250/);
 assert.match(workspace,/deliveryDocuments/);
 for(const locale of ['de','en','pl','es','fr','it'])assert.match(workspace,new RegExp('\\b'+locale+':\\{title:'));
});
test('RC1941: uploaded content is shown with textContent, never interpolated into HTML',()=>{
 assert.match(workspace,/title\.textContent=item\.fileName/);
 assert.match(workspace,/summary\.textContent=/);
 assert.match(workspace,/head\.textContent=/);
 assert.doesNotMatch(workspace,/innerHTML\s*=\s*[^;]*file\.name/);
 assert.doesNotMatch(workspace,/innerHTML\s*=\s*[^;]*analysis\./);
});
