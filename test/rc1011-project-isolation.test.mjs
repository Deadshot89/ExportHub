import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const userPolicy=fs.readFileSync('api/shared/user-policy.js','utf8');

test('RC1011 verändert das ExportHUB-Rollenmodell nicht durch fremde Projektregeln',()=>{
  assert.doesNotMatch(userPolicy,/\bisCompanyAdmin\b/,'RC1011 darf keine fremde Firmen-Admin-Erkennung einführen');
  assert.doesNotMatch(userPolicy,/Sicherheitsverantwortlich/i,'RC1011 darf keine Sicherheitsverantwortlich-Regel einführen');
  assert.doesNotMatch(userPolicy,/(?:^|[^A-Za-z0-9])HSE(?:[^A-Za-z0-9]|$)/i,'RC1011 darf keine HSE-Rollenregel einführen');
});
