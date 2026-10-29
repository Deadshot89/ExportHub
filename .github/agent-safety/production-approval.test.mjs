import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const files = ["exporthub-production-release.yml","emergency-production-mfa-off.yml","rc1458-production-oidc-recovery.yml"];
for (const file of files) {
  test(file + ' requires a manual owner-approved exact commit', () => {
    const source = readFileSync('.github/workflows/' + file, 'utf8');
    const jobs = source.slice(source.indexOf('\njobs:'));
    const gate = jobs.slice(0, jobs.indexOf('\n    runs-on:'));
    for (const required of ["github.event_name == 'workflow_dispatch'", "github.ref == 'refs/heads/main'", "github.actor == 'Deadshot89'", "github.triggering_actor == 'Deadshot89'", "inputs.confirm_production == 'PRODUCTION FREIGEBEN'"]) {
      assert.ok(gate.includes(required), file + ': missing job gate ' + required);
    }
    assert.match(gate, /inputs\.(release_sha|release_commit) == github\.sha/);
    assert.ok(!source.includes('"${{ inputs.confirm_production }}"'), 'Never interpolate confirmation text into shell code');
  });
}
