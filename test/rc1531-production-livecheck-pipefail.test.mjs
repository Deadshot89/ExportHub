import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/exporthub-production-release.yml', 'utf8');

test('RC1531: Production-Basis-Livecheck vermeidet pipefail-sensitive grep-q Pipelines', () => {
  const start = workflow.indexOf('RC1505 Production Release Basis-Liveprüfung');
  const end = workflow.indexOf('RC1505 Historische Production-Live-Verträge prüfen', start);
  assert.ok(start >= 0 && end > start, 'RC1505 Production-Basisprüfung muss isolierbar sein');
  const block = workflow.slice(start, end);

  assert.doesNotMatch(block, /printf\s+'%s'\s+"\$(?:version|home|pack)"\s*\|\s*grep\s+-q/);
  assert.match(block, /\[\[\s*"\$version"\s*==\s*\*"__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1112'"\*\s*\]\]/);
  assert.match(block, /\[\[\s*"\$home"\s*==\s*\*ExportHUB\*\s*\]\]/);
  assert.match(block, /\[\[\s*"\$pack"\s*==\s*\*Packmeldung\*\s*\]\]/);
});
