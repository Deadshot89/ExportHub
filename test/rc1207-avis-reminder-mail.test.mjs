import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const api=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const graph=fs.readFileSync('api/shared/graph-mail.js','utf8');
const runtime=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1207: Mail-Backend und Graph-Client sind syntaktisch gültig',()=>{
 execFileSync(process.execPath,['--check','api/avis-reminder-mail/index.js'],{stdio:'pipe'});
 execFileSync(process.execPath,['--check','api/shared/graph-mail.js'],{stdio:'pipe'});
});

test('RC1207: API verlangt ExportHUB-Sitzung und Bearbeitungsrecht',()=>{
 assert.match(api,/auth\.validateSession\(req\)/);
 assert.match(api,/rights&&user\.rights\.shipmentoverview|user&&user\.rights&&user\.rights\.shipmentoverview/);
 assert.match(api,/MAIL_SEND_FORBIDDEN/);
});

test('RC1207: Server erzeugt sicheren Avis-Text selbst',()=>{
 assert.match(api,/customer-avis\\\.html/);
 assert.match(api,/AVIS_URL_INVALID/);
 assert.match(api,/function subject\(/);
 assert.match(api,/function body\(/);
 assert.doesNotMatch(api,/p\.subject/);
 assert.doesNotMatch(api,/p\.body/);
});

test('RC1207: Graph sendMail nutzt Application-Token und Sent Items',()=>{
 assert.match(graph,/grant_type:'client_credentials'/);
 assert.match(graph,/https:\/\/graph\.microsoft\.com\/\.default/);
 assert.match(graph,/\/sendMail'/);
 assert.match(graph,/saveToSentItems:true/);
 assert.match(graph,/EXPORTHUB_MAIL_SENDER/);
});

test('RC1207: erfolgreicher Versand schreibt Sendungshistorie und Audit',()=>{
 assert.match(api,/type:'mail-sent'/);
 assert.match(api,/label:'Avis-Erinnerung versendet'/);
 assert.match(api,/mailType:'avis-reminder'/);
 assert.match(api,/AVIS_REMINDER_SENT/);
 assert.match(api,/shipmentHistory/);
 assert.match(api,/mailHistory/);
});

test('RC1207: Frontend zeigt Erfolg und Build liefert API aus',()=>{
 assert.match(runtime,/Erinnerungsmail erfolgreich an/);
 assert.match(runtime,/exporthub:history-updated/);
 assert.match(build,/avis-reminder-mail\/index\.js/);
 assert.match(build,/avis-reminder-mail\/function\.json/);
 assert.match(build,/shared\/graph-mail\.js/);
});
