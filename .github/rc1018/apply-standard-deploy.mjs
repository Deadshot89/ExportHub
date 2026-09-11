import fs from 'node:fs';
import path from 'node:path';

const file=path.join(process.cwd(),'.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
let flow=fs.readFileSync(file,'utf8');
flow=flow.replaceAll('assets/rc1015-lieferavis-mail-flow.js?v=1015','assets/rc1015-lieferavis-mail-flow.js?v=1021');

const integratedRequired=[
  'name: ExportHUB RC1018 Drei-Umgebungen Deploy',
  '.github/rc1017/**','test/rc1017-*.test.mjs','test/rc1017-three-env-release.test.mjs','assets/rc1017-multi-truck.js',
  '.github/rc1018/**','test/rc1018-*.test.mjs','test/rc1018-mail-language-standard.test.mjs','test/rc1018-production-deploy.test.mjs',
  'node .github/rc1018/build-three-env.mjs','dist-rc1018/index.html','dist-rc1018/TESTVERSION.html','dist-rc1018/demo.html',
  'assets/rc1015-lieferavis-mail-flow.js?v=1021','assets/rc1018-mail-language-standard.js?v=1018','assets/rc1018-public-language.js',
  'Live RC1018 Produktion TESTSERVICE und Demo prüfen','Live RC1018 Mail und Sprache prüfen'
];
if(flow.includes('name: ExportHUB RC1018 Drei-Umgebungen Deploy')){
  for(const required of integratedRequired){
    if(!flow.includes(required))throw new Error(`RC1018 Deploy-Integration unvollständig: ${required}`);
  }
  fs.writeFileSync(file,flow);
  console.log('RC1018 Standarddeploy ist bereits vollständig integriert.');
  process.exit(0);
}

function replaceOnce(before,after,label){
  if(!flow.includes(before))throw new Error(`RC1018 Deploy-Integration: ${label} nicht gefunden`);
  flow=flow.replace(before,after);
}
function addAfter(anchor,addition,label){
  if(flow.includes(addition.trim()))return;
  if(!flow.includes(anchor))throw new Error(`RC1018 Deploy-Integration: ${label} Anker fehlt`);
  flow=flow.replace(anchor,anchor+addition);
}

replaceOnce('name: ExportHUB RC1016 Drei-Umgebungen Deploy','name: ExportHUB RC1018 Drei-Umgebungen Deploy','Workflowname');
addAfter("      - '.github/rc1017/**'\n","      - '.github/rc1018/**'\n",'RC1018 Pfad');
addAfter("      - 'test/rc1017-*.test.mjs'\n","      - 'test/rc1018-*.test.mjs'\n",'RC1018 Tests');
replaceOnce('group: exporthub-rc1016-three-env-${{ github.ref }}','group: exporthub-rc1018-three-env-${{ github.ref }}','Concurrency');
replaceOnce('      - name: RC1016 Freigabevertrag prüfen','      - name: RC1018 Freigabevertrag prüfen','Freigabeschritt');
replaceOnce("          grep -q \"__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1016'\" production-version.js\n          node --test test/rc1017-three-env-release.test.mjs",
"          grep -q \"__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1018'\" production-version.js\n          node .github/rc1018/apply-public-language.mjs\n          node .github/rc1018/fix-mail-wording.mjs\n          node --test --test-concurrency=1 test/rc1018-mail-language-standard.test.mjs test/rc1018-production-deploy.test.mjs\n          node --test test/rc1017-three-env-release.test.mjs",'RC1018 Freigabevertrag');
replaceOnce('      - name: RC1016 Produktion TESTSERVICE und Demo gemeinsam bauen','      - name: RC1018 Produktion TESTSERVICE und Demo gemeinsam bauen','Build-Schritt');
replaceOnce('          node .github/rc1016/build-three-env.mjs','          node .github/rc1018/build-three-env.mjs','Builder');
flow=flow.replaceAll('dist-rc1016/','dist-rc1018/');
replaceOnce("          grep -q 'ExportHUB RC1016 environment=production-candidate' dist-rc1018/index.html","          grep -q 'ExportHUB RC1018 environment=production-candidate' dist-rc1018/index.html",'Produktionsmarker');
replaceOnce("          grep -q 'ExportHUB RC1016 environment=testservice' dist-rc1018/TESTVERSION.html","          grep -q 'ExportHUB RC1018 environment=testservice' dist-rc1018/TESTVERSION.html",'Testmarker');
replaceOnce("          grep -q 'ExportHUB RC1016 environment=demo' dist-rc1018/demo.html","          grep -q 'ExportHUB RC1018 environment=demo' dist-rc1018/demo.html",'Demomarker');
flow=flow.replaceAll("version:'RC1016'","version:'RC1018'");
flow=flow.replaceAll("__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1016'","__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1018'");
addAfter("          grep -q 'assets/rc1015-lieferavis-mail-flow.js?v=1021' dist-rc1018/index.html\n",
"          for file in index.html TESTVERSION.html demo.html; do\n            grep -q 'assets/rc1018-mail-language-standard.js?v=1018' \"dist-rc1018/$file\"\n          done\n          grep -q 'assets/rc1018-public-language.js?v=1018' dist-rc1018/customer-avis.html\n          grep -q 'assets/rc1018-public-language.js?v=1018' dist-rc1018/pickup.html\n          grep -q 'assets/rc1018-public-language.js?v=1018' dist-rc1018/location.html\n          test -s dist-rc1018/assets/rc1018-mail-language-standard.js\n          test -s dist-rc1018/assets/rc1018-public-language.js\n",'RC1018 Buildprüfungen');
replaceOnce('      - name: Gemeinsame RC1016 Deploy-Pakete vorbereiten','      - name: Gemeinsame RC1018 Deploy-Pakete vorbereiten','Paketschritt');
flow=flow.replaceAll('.rc1016_production_app','.rc1018_production_app');
flow=flow.replaceAll('.rc1016_testservice_app','.rc1018_testservice_app');
replaceOnce('            cp pickup.html customer-avis.html location.html pod-notfall.html "$dir/"','            cp dist-rc1018/pickup.html dist-rc1018/customer-avis.html dist-rc1018/location.html dist-rc1018/pod-notfall.html "$dir/"','Öffentliche Seiten im Paket');
addAfter('          test -s .rc1018_testservice_app/assets/rc1017-multi-truck.js\n',
"          test -s .rc1018_production_app/assets/rc1018-mail-language-standard.js\n          test -s .rc1018_testservice_app/assets/rc1018-mail-language-standard.js\n          test -s .rc1018_production_app/assets/rc1018-public-language.js\n          test -s .rc1018_testservice_app/assets/rc1018-public-language.js\n",'RC1018 Paketprüfungen');
replaceOnce('      - name: Live RC1016 Produktion TESTSERVICE und Demo prüfen','      - name: Live RC1018 Produktion TESTSERVICE und Demo prüfen','Live-Schritt');
flow=flow.replaceAll('?rc1016=$GITHUB_SHA-$attempt','?rc1018=$GITHUB_SHA-$attempt');
flow=flow.replaceAll('ExportHUB RC1016 environment=production-candidate','ExportHUB RC1018 environment=production-candidate');
flow=flow.replaceAll('ExportHUB RC1016 environment=testservice','ExportHUB RC1018 environment=testservice');
flow=flow.replaceAll('ExportHUB RC1016 environment=demo','ExportHUB RC1018 environment=demo');
flow=flow.replaceAll("echo 'RC1016 Produktion, TESTSERVICE und Demo live auf demselben geprüften Stand bestätigt.'","echo 'RC1018 Produktion, TESTSERVICE und Demo live auf demselben geprüften Stand bestätigt.'");
flow=flow.replaceAll("echo 'RC1016 Drei-Umgebungen-Liveprüfung nicht bestätigt.'","echo 'RC1018 Drei-Umgebungen-Liveprüfung nicht bestätigt.'");

if(!flow.includes('Live RC1018 Mail und Sprache prüfen')){
  flow += `\n      - name: Live RC1018 Mail und Sprache prüfen\n        shell: bash\n        run: |\n          set -euo pipefail\n          prod='https://wonderful-forest-0f315e310.7.azurestaticapps.net'\n          testservice='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'\n          for attempt in {1..24}; do\n            ok=1\n            for url in \\\n              \"$prod/assets/rc1018-mail-language-standard.js?rc1018=$GITHUB_SHA-$attempt\" \\\n              \"$testservice/assets/rc1018-mail-language-standard.js?rc1018=$GITHUB_SHA-$attempt\" \\\n              \"$prod/assets/rc1018-public-language.js?rc1018=$GITHUB_SHA-$attempt\" \\\n              \"$testservice/assets/rc1018-public-language.js?rc1018=$GITHUB_SHA-$attempt\"; do\n              body=$(mktemp)\n              code=$(curl -sS -L -o \"$body\" -w '%{http_code}' --max-time 20 \"$url\" || true)\n              [[ \"$code\" == '200' ]] || ok=0\n              if [[ \"$url\" == *mail-language-standard* ]]; then grep -q '__EXPORTHUB_RC1018_MAIL_LANGUAGE_STANDARD__' \"$body\" || ok=0; else grep -q '__EXPORTHUB_RC1018_PUBLIC_LANGUAGE__' \"$body\" || ok=0; fi\n              rm -f \"$body\"\n            done\n            for url in \\\n              \"$prod/?rc1018=$GITHUB_SHA-$attempt\" \\\n              \"$testservice/TESTVERSION.html?rc1018=$GITHUB_SHA-$attempt\" \\\n              \"$testservice/demo.html?rc1018=$GITHUB_SHA-$attempt\"; do\n              body=$(mktemp)\n              code=$(curl -sS -L -o \"$body\" -w '%{http_code}' --max-time 20 \"$url\" || true)\n              [[ \"$code\" == '200' ]] && grep -q 'assets/rc1018-mail-language-standard.js?v=1018' \"$body\" || ok=0\n              rm -f \"$body\"\n            done\n            for base in \"$prod\" \"$testservice\"; do\n              body=$(mktemp)\n              code=$(curl -sS -L -o \"$body\" -w '%{http_code}' --max-time 20 \"$base/customer-avis.html?lang=en&rc1018=$GITHUB_SHA-$attempt\" || true)\n              [[ \"$code\" == '200' ]] && grep -q 'assets/rc1018-public-language.js?v=1018' \"$body\" || ok=0\n              rm -f \"$body\"\n            done\n            if [[ \"$ok\" == '1' ]]; then echo 'RC1018 Mail- und Sprachruntime live bestätigt.'; exit 0; fi\n            sleep 10\n          done\n          echo 'RC1018 Mail- und Sprachruntime live nicht bestätigt.'\n          exit 1\n`;
}

for(const required of [
  '.github/rc1017/**','test/rc1017-*.test.mjs','test/rc1017-three-env-release.test.mjs','assets/rc1017-multi-truck.js',
  'assets/rc1016-mobile-navigation.js?v=1016','assets/rc1014-task-runtime.js?v=1016','assets/rc1014-shipment-overview.js?v=1016',
  'test/rc1015-lieferavis-mail-flow.test.mjs','assets/rc1015-lieferavis-mail-flow.js?v=1021','assets/rc1013-diagnostics.js','assets/rc1013-gate41-ui.js',
  'test/rc1018-mail-language-standard.test.mjs','test/rc1018-production-deploy.test.mjs','assets/rc1018-mail-language-standard.js?v=1018','assets/rc1018-public-language.js'
]){
  if(!flow.includes(required))throw new Error(`RC1018 Deploy-Integration verlor Bestand: ${required}`);
}

fs.writeFileSync(file,flow);
console.log('RC1018 Standarddeploy aus aktuellem RC1017-Bestand integriert.');