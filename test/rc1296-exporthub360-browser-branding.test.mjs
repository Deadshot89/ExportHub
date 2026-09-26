import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const favicon=fs.readFileSync('assets/exporthub360-favicon.svg','utf8');

test('RC1296: Produktions-Tab heißt ausschließlich ExportHUB360',()=>{
  assert.match(builder,/const RC1296_BROWSER_TITLE='ExportHUB360'/);
  assert.match(builder,/if\(file!=='index\.html'\)return html/);
  assert.match(builder,/<title>'\+RC1296_BROWSER_TITLE\+'<\/title>/);
});

test('RC1296: Produktions-Tab bindet das ExportHUB360-Favicon ein',()=>{
  assert.match(builder,/id="exporthub360-favicon"/);
  assert.match(builder,/\/assets\/exporthub360-favicon\.svg\?v=1296/);
  assert.match(builder,/'assets\/exporthub360-favicon\.svg'/);
  assert.match(favicon,/<svg\b/);
  assert.match(favicon,/>EH<\/text>/);
  assert.match(favicon,/>360<\/text>/);
});
