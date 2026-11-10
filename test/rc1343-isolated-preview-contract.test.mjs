import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const file=x=>fs.readFileSync(x,'utf8');

test('RC1343 deployment is confined to isolated Azure preview, never main or production',()=>{
 const s=file('.github/workflows/rc1343-isolated-testservice.yml');
 assert.match(s,/deployment_environment: rc1343ts/);
 assert.match(s,/production_branch: main/);
 assert.match(s,/app_location: \.rc1343_preview_app/);
 assert.match(s,/api_location: \.rc1343_preview_api/);
 assert.match(s,/github\.ref == 'refs\/heads\/fix\/rc1903-remove-legacy-fields-all-internal-20261110'/);
 assert.doesNotMatch(s,/deployment_environment: (?:production|testservice)\s*$/m);
});

test('RC1343 guest-only package fails closed without separate TESTSERVICE storage and preview key',()=>{
 const b=file('scripts/rc1343-preview-package.mjs');
 assert.match(b,/crypto\.randomBytes\(32\)/);
 assert.match(b,/RC1343_ISOLATED_STORAGE_REQUIRED/);
 assert.match(b,/!cfg\.enabled\|\|!cfg\.connectionString/);
 assert.match(b,/RC1343_PREVIEW_DENIED/);
 assert.match(b,/RC1343_TEST_ONLY/);
 assert.match(b,/RC1343_NO_CUSTOMER_MASTER/);
 assert.match(b,/testservice\/rc1343\//);
 assert.match(b,/const previewAction=txt\(payload\.action,32\)/);
 assert.doesNotMatch(b,/fs\.cpSync\('api',/);
});

test('RC1343 real smoke requires exact verified deployment and byte-for-byte photo/PDF',()=>{
 const s=file('scripts/rc1343-preview-live.mjs');
 assert.match(s,/ashy-grass-065b7b803-rc1343ts\.westeurope\.6\.azurestaticapps\.net/);
 assert.match(s,/health\.deployment\?\.buildId,sha/);
 assert.match(s,/isolation\.status,404/);
 assert.match(s,/assert\.deepEqual\(read\.bytes,bytes/);
 assert.match(s,/master\.status,403/);
 assert.match(s,/cross\.status,403/);
 assert.match(s,/locked\.status,403/);
});
