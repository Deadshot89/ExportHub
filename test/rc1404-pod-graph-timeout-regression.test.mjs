import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const graph = fs.readFileSync('api/shared/graph-drive.js', 'utf8');
const archive = fs.readFileSync('api/shared/pod-archive.js', 'utf8');

test('RC1404: freigegebene POD-Ordner werden über drive root search gesucht', () => {
  assert.match(
    graph,
    /\/drives\/\$\{encodeURIComponent\(defaultDriveId\)\}\/root\/search\(q=/
  );
  assert.doesNotMatch(
    graph,
    /\/drives\/\$\{encodeURIComponent\(defaultDriveId\)\}\/search\(q=/
  );
});

test('RC1404: frisch verifizierte POD-Archive werden nicht erneut remote geprüft', () => {
  assert.match(archive, /const verificationFresh = !reference/);
  assert.match(archive, /Date\.now\(\) - lastVerifiedMs < 24 \* 60 \* 60 \* 1000/);
  assert.match(
    archive,
    /const integrity = verificationFresh[\s\S]*?\? \{ ok: true, verifiedAt: backup\.archiveVerifiedAt, cached: true \}[\s\S]*?: await checkAzureArchive\([^\n]+true\)/
  );
});

test('RC1404: gezielte Referenzprüfung umgeht den 24h-Cache', () => {
  assert.match(archive, /const verificationFresh = !reference/);
  assert.match(archive, /if \(!verificationFresh\) \{[\s\S]*?archiveVerifiedAt: integrity\.verifiedAt/);
});
