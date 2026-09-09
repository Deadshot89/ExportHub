import fs from 'node:fs';

const workflows = [
  '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',
  '.github/workflows/rc1002-main-contract.yml',
  '.github/workflows/exporthub-android-test-app.yml',
  '.github/workflows/exporthub-testservice.yml',
  '.github/workflows/rc1007-release-verify.yml',
  '.github/workflows/rc1012-abholkalender-verify.yml'
];

function patchSetupNodeCache(source, file) {
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('uses: actions/setup-node@v5')) continue;
    let withIndex = -1;
    let nodeVersionIndex = -1;
    let cacheIndex = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 10); j += 1) {
      if (/^\s*-\s+(?:uses|name):/.test(lines[j])) break;
      if (/^\s*with:\s*$/.test(lines[j])) withIndex = j;
      if (/^\s*node-version:\s*/.test(lines[j])) nodeVersionIndex = j;
      if (/^\s*package-manager-cache:\s*/.test(lines[j])) cacheIndex = j;
    }
    if (withIndex < 0 || nodeVersionIndex < 0) {
      throw new Error(`${file}: setup-node@v5 ohne with/node-version`);
    }
    if (cacheIndex < 0) {
      const indent = lines[nodeVersionIndex].match(/^\s*/)[0];
      lines.splice(nodeVersionIndex + 1, 0, `${indent}package-manager-cache: false`);
    }
  }
  return lines.join('\n');
}

for (const file of workflows) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before
    .replaceAll('actions/checkout@v4', 'actions/checkout@v5')
    .replaceAll('actions/setup-node@v4', 'actions/setup-node@v5');

  if (file.endsWith('rc1007-release-verify.yml')) {
    after = after.replace(/node-version:\s*['\"]20(?:\.x)?['\"]/, "node-version: '24'");
  }

  after = patchSetupNodeCache(after, file);

  if (!after.includes('actions/checkout@v5') || !after.includes('actions/setup-node@v5')) {
    throw new Error(`${file}: v5-Actions fehlen nach Patch`);
  }
  if (/actions\/(?:checkout|setup-node)@v4/.test(after)) {
    throw new Error(`${file}: v4-Actions sind nach Patch noch vorhanden`);
  }
  if (!/package-manager-cache:\s*false/.test(after)) {
    throw new Error(`${file}: package-manager-cache false fehlt`);
  }

  if (file.endsWith('azure-static-web-apps-wonderful-forest-0f315e310.yml')) {
    if (!after.includes('deployment_environment: testservice')) {
      throw new Error(`${file}: TESTSERVICE-Zielumgebung wurde verändert`);
    }
  }
  if (file.endsWith('exporthub-testservice.yml')) {
    if (!after.includes('deployment_environment: testservice')) {
      throw new Error(`${file}: TESTSERVICE-Zielumgebung wurde verändert`);
    }
    if (!after.includes('ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION')) {
      throw new Error(`${file}: Abweichungsfreigabe wurde verändert`);
    }
  }

  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log(`aktualisiert: ${file}`);
  } else {
    console.log(`bereits aktuell: ${file}`);
  }
}
