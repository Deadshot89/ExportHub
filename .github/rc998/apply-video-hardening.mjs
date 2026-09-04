import fs from 'node:fs';

const FILES = ['index.html', 'TESTVERSION.html'];
const RELEASE_DATE = '04.09.2026';

function assertCount(text, needle, expected, label) {
  const count = text.split(needle).length - 1;
  if (count !== expected) {
    throw new Error(`${label}: erwartet ${expected}, gefunden ${count}`);
  }
}

function replaceOnce(text, oldValue, newValue, label) {
  assertCount(text, oldValue, 1, label);
  return text.replace(oldValue, newValue);
}

function owner(text, start, end, label) {
  const a = text.indexOf(start);
  if (a < 0) throw new Error(`${label}: Startmarker fehlt`);
  const b = text.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`${label}: Endmarker fehlt`);
  return { a, b, block: text.slice(a, b) };
}

function patchOwner(text, start, end, transform, label) {
  const { a, b, block } = owner(text, start, end, label);
  const patched = transform(block);
  if (patched === block) throw new Error(`${label}: keine Änderung erzeugt`);
  return text.slice(0, a) + patched + text.slice(b);
}

for (const file of FILES) {
  let html = fs.readFileSync(file, 'utf8');

  // 1) Kanonische Build-Metadaten synchronisieren, Origin unverändert lassen.
  const buildMatch = html.match(/var BUILD=Object\.freeze\(\{version:'RC\d+',cache:'\d+',loginReturn:'([^']+)'\}\);/);
  if (!buildMatch) throw new Error(`${file}: BUILD-Metadaten nicht eindeutig gefunden`);
  const currentBuild = buildMatch[0];
  const currentLogin = buildMatch[1];
  const nextLogin = currentLogin.replace(/([?&])v=\d+/, '$1v=998');
  if (nextLogin === currentLogin && !/[?&]v=998(?:&|$)/.test(currentLogin)) {
    throw new Error(`${file}: BUILD loginReturn enthält keinen Versionsparameter`);
  }
  html = replaceOnce(
    html,
    currentBuild,
    `var BUILD=Object.freeze({version:'RC998',cache:'998',loginReturn:'${nextLogin}'});`,
    `${file}: BUILD`
  );

  // 2) Aktive Release-Metadaten synchronisieren, restliche Historie unangetastet lassen.
  html = patchOwner(
    html,
    'var RELEASE=Object.freeze({',
    'changes:Object.freeze([',
    (block) => {
      const versionMatches = [...block.matchAll(/version:'RC\d+'/g)];
      const dateMatches = [...block.matchAll(/date:'[^']*'/g)];
      if (versionMatches.length !== 1) throw new Error(`${file}: RELEASE version nicht eindeutig`);
      if (dateMatches.length !== 1) throw new Error(`${file}: RELEASE date nicht eindeutig`);
      return block
        .replace(versionMatches[0][0], "version:'RC998'")
        .replace(dateMatches[0][0], `date:'${RELEASE_DATE}'`);
    },
    `${file}: RELEASE`
  );

  // 3) Testservice-Start: einen Retry behalten, aber harte Wartefenster begrenzen.
  html = patchOwner(
    html,
    'async function loadStateAfterLogin(){',
    'async function finishAuthenticatedLogin(){',
    (block) => {
      let next = block;
      next = replaceOnce(next, 'loadState({timeoutMs:14000,maxAttempts:1})', 'loadState({timeoutMs:6000,maxAttempts:1})', `${file}: erster Start-Read`);
      next = replaceOnce(next, 'native.setTimeout(resolve,1200)', 'native.setTimeout(resolve,450)', `${file}: Retry-Wartezeit`);
      next = replaceOnce(next, 'loadState({timeoutMs:24000,maxAttempts:1})', 'loadState({timeoutMs:9000,maxAttempts:1})', `${file}: zweiter Start-Read`);
      return next;
    },
    `${file}: loadStateAfterLogin`
  );

  // 4) Sendung erstellen nicht mehr als alten DOM wiederverwenden.
  html = patchOwner(
    html,
    'function fastCacheable(view){',
    'function fastShipmentKey(){',
    (block) => replaceOnce(
      block,
      "return view==='shipment'||view==='shipmentoverview'||view==='cmr'",
      "return view==='shipmentoverview'||view==='cmr'",
      `${file}: fastCacheable`
    ),
    `${file}: fastCacheable owner`
  );

  fs.writeFileSync(file, html);
  console.log(`${file}: RC998 Video-Hardening angewendet`);
}

const prodMarker = fs.readFileSync('production-version.js', 'utf8');
if (!/RC997/.test(prodMarker) || /RC998/.test(prodMarker)) {
  throw new Error('Produktionsmarker wurde unerwartet verändert oder ist nicht RC997');
}
console.log('production-version.js: weiterhin RC997');
