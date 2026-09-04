import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const apiDir = path.join(repoRoot, 'api');
const stageDir = path.join(apiDir, '.oryx_contract_stage');

test('api postinstall funktioniert auch aus einem Oryx-Staging-Unterordner', () => {
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  fs.copyFileSync(path.join(apiDir, 'package.json'), path.join(stageDir, 'package.json'));

  try {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npmCommand, ['run', 'postinstall', '--silent'], {
      cwd: stageDir,
      encoding: 'utf8',
      env: process.env,
    });

    assert.equal(
      result.status,
      0,
      `postinstall muss im Oryx-Staging funktionieren.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
});
