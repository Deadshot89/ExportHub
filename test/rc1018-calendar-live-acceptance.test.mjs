import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath = '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const flow = fs.readFileSync(workflowPath,'utf8');

test('RC1018 Buildvertrag prüft Abholkalender und Runtime in allen drei Umgebungen', () => {
  for (const file of ['index.html','TESTVERSION.html','demo.html']) {
    assert.match(flow,new RegExp(`assets/abholkalender\\.js\\?v=1012[^\\n]*dist-rc1018/${file.replace('.','\\.')}`));
    assert.match(flow,new RegExp(`assets/rc1012-abholkalender-runtime\\.js\\?v=1012[^\\n]*dist-rc1018/${file.replace('.','\\.')}`));
  }
  assert.match(flow,/test -s dist-rc1018\/assets\/abholkalender\.js/);
  assert.match(flow,/test -s dist-rc1018\/assets\/rc1012-abholkalender-runtime\.js/);
});

test('RC1018 Liveprüfung lädt die Kalenderassets aus Produktion und TESTSERVICE', () => {
  assert.match(flow,/\$prod\/assets\/abholkalender\.js\?rc1018=/);
  assert.match(flow,/\$testservice\/assets\/abholkalender\.js\?rc1018=/);
  assert.match(flow,/\$prod\/assets\/rc1012-abholkalender-runtime\.js\?rc1018=/);
  assert.match(flow,/\$testservice\/assets\/rc1012-abholkalender-runtime\.js\?rc1018=/);
  assert.match(flow,/calendarScalarText/);
  assert.match(flow,/companyId/);
});
