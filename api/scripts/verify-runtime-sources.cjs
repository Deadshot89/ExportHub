'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const apiRoot = path.resolve(__dirname, '..');
const runtimeSources = [
  'shared/public-access-store.js',
  'shared/pickup-store.js',
  'shared/loader-pin-store.js',
  'shared/graph-drive.js',
  'shared/pod-archive.js',
  'shared/auth-store.js',
  'shared/fast-auth-store.js',
  'pickup-init/index.js',
  'pickup-status/index.js',
  'pickup-confirm-v2/index.js',
  'pickup-pod/index.js',
  'pod-backup/index.js',
  'customer-avis/index.js',
  'exporthub-auth/index.js',
  'exporthub-auth-probe/index.js',
  'exporthub-state/index.js',
  'diagnostic-autofix/index.js',
  'loader-pins-admin/index.js',
  'reference-files/index.js',
];

for (const relativePath of runtimeSources) {
  const sourcePath = path.join(apiRoot, relativePath);
  const result = spawnSync(process.execPath, ['--check', sourcePath], {
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`API runtime source check bestanden (${runtimeSources.length} Dateien).`);
