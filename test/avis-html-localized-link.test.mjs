import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const {LINK_LABELS,renderAvisMailHtml}=require('../api/shared/avis-mail-html');
const endpoint=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const frontend=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const graph=fs.readFileSync('api/shared/graph-mail.js','utf8');
const base='https://wonderful-forest-0f315e310.7.azurestaticapps.net/customer-avis.html?token=some-token';
const languages=['de','en','pl','es','fr','it'];

test('AVIS: six languages display a clickable label, not the technical host in visible text',()=>{
 for(const lang of languages){
  const localized=base+'&lang='+lang;
  const html=renderAvisMailHtml('Reference: 123\n'+localized+'\nThank you.',base,lang);
  assert.match(html,/<a href="https:\/\//);
  assert.ok(html.includes(LINK_LABELS[lang]),'missing '+lang);
  assert.ok(html.includes('lang='+lang),lang);
  assert.ok(!html.replace(/<[^>]+>/g,'').includes('wonderful-forest'),lang);
 }
});

test('AVIS: HTML mail safely escapes shipment content and link query',()=>{
 const source='Shipment <script>alert("x")</script> & Regards\n'+base+'&lang=en';
 const html=renderAvisMailHtml(source,base,'en');
 assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('Click here to arrange pickup'));
});

test('AVIS: HTML mail rejects non-HTTPS URLs and mismatched links',()=>{
 assert.throws(()=>renderAvisMailHtml('x','javascript:alert(1)','de'),/AVIS_HTML_URL_INVALID/);
 assert.throws(()=>renderAvisMailHtml('no link here',base,'de'),/AVIS_HTML_LINK_MISMATCH/);
});

test('AVIS: production backend generates HTML only from safe server content',()=>{
 assert.match(endpoint,/const htmlContent=renderAvisMailHtml\(content,url,lang,closureNoticeHtml\(notices,lang\)\)/);
 assert.match(endpoint,/graphMail\.sendHtmlMail\(\{to,subject:sub,body:htmlContent,sender,cc\}\)/);
 assert.match(graph,/contentType:html\?'HTML':'Text'/);
 assert.match(graph,/function mailSendGranted\(claims\)/);
 assert.match(endpoint,/if\(!customerAvisAllowed\(current\.team,shipment\)\)/);
 assert.match(endpoint,/AVIS_RECIPIENT_EXCLUDED/);
});

test('AVIS: Outlook fallback and six-language user interface remain available',()=>{
 assert.match(frontend,/data-html-send/);
 assert.match(frontend,/data-open/);
 assert.match(frontend,/sendHtmlAvis/);
 assert.match(frontend,/sendReminder:sendReminder/);
 assert.match(frontend,/ExportHUBI18n\.language/);
 for(const lang of languages)assert.ok(frontend.includes(lang+':'),lang);
});

test('AVIS: modified runtime and backend modules parse',()=>{
 for(const file of ['api/shared/avis-mail-html.js','api/shared/graph-mail.js','api/avis-reminder-mail/index.js','assets/rc1166-avis-reminder-overview.js']){
  execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
 }
});
