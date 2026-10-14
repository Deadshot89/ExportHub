import fs from 'node:fs';

function read(file){return fs.readFileSync(file,'utf8')}
function write(file,value){fs.writeFileSync(file,value)}
function occurrences(source,needle){return source.split(needle).length-1}
function replaceExact(file,from,to,count=1){
  let source=read(file);
  const found=occurrences(source,from);
  if(found===0&&source.includes(to))return false;
  if(found!==count)throw new Error(`${file}: erwartete ${count} Vorkommen nicht gefunden: ${from} (gefunden ${found})`);
  source=source.split(from).join(to);
  write(file,source);
  return true;
}
function insertAfter(file,anchor,addition){
  let source=read(file);
  if(source.includes(addition.trim()))return false;
  const found=occurrences(source,anchor);
  if(found!==1)throw new Error(`${file}: Insert-Anker muss genau einmal vorkommen: ${anchor} (gefunden ${found})`);
  source=source.replace(anchor,anchor+addition);
  write(file,source);
  return true;
}

const main='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const production='.github/workflows/exporthub-production-release.yml';
const testservice='.github/workflows/exporthub-testservice.yml';
const rc1520='.github/workflows/sopmaster-release-candidate.yml';
const prodTest='test/rc1018-production-deploy.test.mjs';
const packTest='test/pack-notification-production.test.mjs';

replaceExact(main,
  '          node .github/rc1112/build-three-env.mjs\n',
  '          node .github/rc1521/build-three-env.mjs\n');
insertAfter(main,
  '          node .github/rc1505/verify-build-contract.mjs\n',
  '          test -s dist-rc1112/assets/sop/rc1501-sop-tour-runtime.js\n          test -s dist-rc1112/assets/sop/rc1502-sop-editor.js\n          test -s dist-rc1112/assets/sop/rc1503-sop-training.js\n          test -s dist-rc1112/assets/sop/rc1506-sop-coverage-runtime.js\n');

replaceExact(production,
  '          node .github/rc1112/build-three-env.mjs\n          node .github/packmeldungen/build-three-env.mjs\n',
  '          node .github/rc1521/build-three-env.mjs\n');
insertAfter(production,
  '          node .github/rc1505/verify-build-contract.mjs\n',
  '          test -s dist-rc1112/assets/sop/rc1501-sop-tour-runtime.js\n          test -s dist-rc1112/assets/sop/rc1502-sop-editor.js\n          test -s dist-rc1112/assets/sop/rc1503-sop-training.js\n          test -s dist-rc1112/assets/sop/rc1506-sop-coverage-runtime.js\n');

replaceExact(testservice,
  '          node .github/rc1112/build-three-env.mjs\n',
  '          node .github/rc1521/build-three-env.mjs\n');
insertAfter(testservice,
  '          node .github/rc1521/build-three-env.mjs\n',
  '          test -s dist-rc1112/assets/sop/rc1501-sop-tour-runtime.js\n          test -s dist-rc1112/assets/sop/rc1502-sop-editor.js\n          test -s dist-rc1112/assets/sop/rc1503-sop-training.js\n          test -s dist-rc1112/assets/sop/rc1506-sop-coverage-runtime.js\n');

replaceExact(prodTest,
  'assert.match(flow,/node \\.github\\/rc1112\\/build-three-env\\.mjs/);',
  'assert.match(flow,/node \\.github\\/rc1521\\/build-three-env\\.mjs/);',2);
replaceExact(prodTest,
  "test('RC1505: Production verwendet denselben RC1112-Build über manuellen SHA-festen Release',()=>{",
  "test('RC1521: Production verwendet die gemeinsame RC1112-Basis über den finalen SHA-festen Kombinations-Builder',()=>{");

replaceExact(packTest,
  "const production=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');\n",
  "const production=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');\nconst releaseBuilder=fs.readFileSync('.github/rc1521/build-three-env.mjs','utf8');\n");
replaceExact(packTest,
  "  assert.match(production,/\\.github\\/packmeldungen\\/build-three-env\\.mjs/);\n",
  "  assert.match(production,/\\.github\\/rc1521\\/build-three-env\\.mjs/);\n  assert.match(releaseBuilder,/packmeldungen\\/build-three-env\\.mjs/);\n");

insertAfter(rc1520,
  "      - 'test/rc1521-sop-current-main-builder.test.mjs'\n",
  "      - 'test/rc1521-sop-release-wiring.test.mjs'\n");
insertAfter(rc1520,
  '          test/rc1521-sop-current-main-builder.test.mjs\n',
  '          test/rc1521-sop-release-wiring.test.mjs\n');

for(const [file,marker] of [
  [main,'node .github/rc1521/build-three-env.mjs'],
  [production,'node .github/rc1521/build-three-env.mjs'],
  [testservice,'node .github/rc1521/build-three-env.mjs'],
  [rc1520,'test/rc1521-sop-release-wiring.test.mjs']
]){
  if(!read(file).includes(marker))throw new Error(`${file}: RC1521 Verdrahtung fehlt nach Migration`);
}
if(read(production).includes('node .github/packmeldungen/build-three-env.mjs'))throw new Error('Production würde Packmeldungen nach RC1521 erneut bauen');

console.log('RC1521 release wiring migration ready: Main Verification, TESTSERVICE exception and Production Release use the final current-main + Pack + SOPMaster builder.');
