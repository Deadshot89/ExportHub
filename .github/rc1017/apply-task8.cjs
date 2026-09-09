'use strict';
const fs=require('fs');

function patchFile(path,patch){
  let src=fs.readFileSync(path,'utf8');
  const before=src;
  src=patch(src);
  if(src!==before){fs.writeFileSync(path,src);console.log(path+': RC1017 Task8 patched');}
  else console.log(path+': RC1017 Task8 already applied');
}
function replaceOne(src,from,to,label){
  if(src.includes(to))return src;
  const count=src.split(from).length-1;
  if(count!==1)throw new Error((label||'anchor')+' expected once, found '+count);
  return src.replace(from,to);
}

patchFile('.github/rc1016/build-three-env.mjs',src=>{
  return replaceOne(src,
    "retainedFixes:{lieferavis:'assets/rc1015-lieferavis-mail-flow.js',calendar:'assets/abholkalender.js',diagnostics:'assets/rc1013-diagnostics.js',gate41:'assets/rc1013-gate41-ui.js'},",
    "retainedFixes:{lieferavis:'assets/rc1015-lieferavis-mail-flow.js',calendar:'assets/abholkalender.js',diagnostics:'assets/rc1013-diagnostics.js',gate41:'assets/rc1013-gate41-ui.js',multiTruck:'assets/rc1017-multi-truck.js'},",
    'RC1016 manifest retainedFixes');
});

patchFile('.github/workflows/rc1002-main-contract.yml',src=>{
  src=replaceOne(src,
    "      - '.github/rc1013/**'\n",
    "      - '.github/rc1013/**'\n      - '.github/rc1017/**'\n",
    'main contract rc1017 path');
  src=replaceOne(src,
    "      - name: Gesamte Node-Regression\n        run: npm test\n",
    "      - name: RC1017 Mehr-LKW Releasevertrag\n        run: node --test test/rc1017-three-env-release.test.mjs\n      - name: Gesamte Node-Regression\n        run: npm test\n",
    'main contract rc1017 test');
  src=replaceOne(src,
    "          grep -q 'assets/rc1013-gate41-ui.js?v=1013' dist-rc1013/index.html\n",
    "          grep -q 'assets/rc1013-gate41-ui.js?v=1013' dist-rc1013/index.html\n          grep -q 'assets/rc1017-multi-truck.js?v=1017' dist-rc1013/index.html\n          grep -q 'assets/rc1017-multi-truck.js?v=1017' dist-rc1013/TESTVERSION.html\n          grep -q 'assets/rc1017-multi-truck.js?v=1017' dist-rc1013/demo.html\n          test -s dist-rc1013/assets/rc1017-multi-truck.js\n",
    'main contract rc1017 build checks');
  return src;
});

patchFile('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',src=>{
  src=replaceOne(src,
    "      - '.github/rc1016/**'\n",
    "      - '.github/rc1016/**'\n      - '.github/rc1017/**'\n",
    'deploy rc1017 helper path');
  src=replaceOne(src,
    "      - 'test/rc1016-*.test.mjs'\n",
    "      - 'test/rc1017-*.test.mjs'\n      - 'test/rc1016-*.test.mjs'\n",
    'deploy rc1017 test path');
  src=replaceOne(src,
    "          grep -q \"__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1016'\" production-version.js\n",
    "          grep -q \"__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1016'\" production-version.js\n          node --test test/rc1017-three-env-release.test.mjs\n",
    'deploy rc1017 release test');
  src=replaceOne(src,
    "          grep -q 'assets/rc1016-demo-task-seed.js?v=1016' dist-rc1016/demo.html\n",
    "          grep -q 'assets/rc1016-demo-task-seed.js?v=1016' dist-rc1016/demo.html\n          grep -q 'assets/rc1017-multi-truck.js?v=1017' dist-rc1016/index.html\n          grep -q 'assets/rc1017-multi-truck.js?v=1017' dist-rc1016/TESTVERSION.html\n          grep -q 'assets/rc1017-multi-truck.js?v=1017' dist-rc1016/demo.html\n          test -s dist-rc1016/assets/rc1017-multi-truck.js\n",
    'deploy rc1017 build checks');
  src=replaceOne(src,
    "          test -s .rc1016_production_app/assets/rc1016-mobile-navigation.js\n          test -s .rc1016_testservice_app/assets/rc1016-mobile-navigation.js\n",
    "          test -s .rc1016_production_app/assets/rc1016-mobile-navigation.js\n          test -s .rc1016_testservice_app/assets/rc1016-mobile-navigation.js\n          test -s .rc1016_production_app/assets/rc1017-multi-truck.js\n          test -s .rc1016_testservice_app/assets/rc1017-multi-truck.js\n",
    'deploy rc1017 package checks');
  src=replaceOne(src,
    "          p=$(mktemp); t=$(mktemp); d=$(mktemp); ph=$(mktemp); th=$(mktemp); pm=$(mktemp); tm=$(mktemp); ps=$(mktemp); ts=$(mktemp); pk=$(mktemp); tk=$(mktemp); pd=$(mktemp); td=$(mktemp); pg=$(mktemp); tg=$(mktemp)\n          trap 'rm -f \"$p\" \"$t\" \"$d\" \"$ph\" \"$th\" \"$pm\" \"$tm\" \"$ps\" \"$ts\" \"$pk\" \"$tk\" \"$pd\" \"$td\" \"$pg\" \"$tg\"' EXIT\n",
    "          p=$(mktemp); t=$(mktemp); d=$(mktemp); ph=$(mktemp); th=$(mktemp); pm=$(mktemp); tm=$(mktemp); ps=$(mktemp); ts=$(mktemp); pk=$(mktemp); tk=$(mktemp); pd=$(mktemp); td=$(mktemp); pg=$(mktemp); tg=$(mktemp); pr=$(mktemp); tr=$(mktemp)\n          trap 'rm -f \"$p\" \"$t\" \"$d\" \"$ph\" \"$th\" \"$pm\" \"$tm\" \"$ps\" \"$ts\" \"$pk\" \"$tk\" \"$pd\" \"$td\" \"$pg\" \"$tg\" \"$pr\" \"$tr\"' EXIT\n",
    'deploy rc1017 live temp files');
  src=replaceOne(src,
    "            tgc=$(curl -sS -o \"$tg\" -w '%{http_code}' --max-time 20 \"$testservice/assets/rc1013-gate41-ui.js?rc1016=$GITHUB_SHA-$attempt\" || true)\n",
    "            tgc=$(curl -sS -o \"$tg\" -w '%{http_code}' --max-time 20 \"$testservice/assets/rc1013-gate41-ui.js?rc1016=$GITHUB_SHA-$attempt\" || true)\n            prc=$(curl -sS -o \"$pr\" -w '%{http_code}' --max-time 20 \"$prod/assets/rc1017-multi-truck.js?rc1017=$GITHUB_SHA-$attempt\" || true)\n            trc=$(curl -sS -o \"$tr\" -w '%{http_code}' --max-time 20 \"$testservice/assets/rc1017-multi-truck.js?rc1017=$GITHUB_SHA-$attempt\" || true)\n",
    'deploy rc1017 live curls');
  src=replaceOne(src,
    "            if [[ \"$pc\" == '200' && \"$tc\" == '200' && \"$dc\" == '200' && \"$phc\" == '200' && \"$thc\" == '200' && \"$pmc\" == '200' && \"$tmc\" == '200' && \"$psc\" == '200' && \"$tsc\" == '200' && \"$pkc\" == '200' && \"$tkc\" == '200' && \"$pdc\" == '200' && \"$tdc\" == '200' && \"$pgc\" == '200' && \"$tgc\" == '200' ]] \\\n",
    "            if [[ \"$pc\" == '200' && \"$tc\" == '200' && \"$dc\" == '200' && \"$phc\" == '200' && \"$thc\" == '200' && \"$pmc\" == '200' && \"$tmc\" == '200' && \"$psc\" == '200' && \"$tsc\" == '200' && \"$pkc\" == '200' && \"$tkc\" == '200' && \"$pdc\" == '200' && \"$tdc\" == '200' && \"$pgc\" == '200' && \"$tgc\" == '200' && \"$prc\" == '200' && \"$trc\" == '200' ]] \\\n",
    'deploy rc1017 live status condition');
  src=replaceOne(src,
    "              && grep -q 'assets/rc1015-lieferavis-mail-flow.js?v=1015' \"$p\" \\\n",
    "              && grep -q 'assets/rc1015-lieferavis-mail-flow.js?v=1015' \"$p\" \\\n              && grep -q 'assets/rc1017-multi-truck.js?v=1017' \"$p\" \\\n              && grep -q 'assets/rc1017-multi-truck.js?v=1017' \"$t\" \\\n              && grep -q 'assets/rc1017-multi-truck.js?v=1017' \"$d\" \\\n",
    'deploy rc1017 live html checks');
  src=replaceOne(src,
    "              && grep -q 'Gate41-Preis berechnet' \"$pg\" \\\n              && grep -q 'Gate41-Preis berechnet' \"$tg\"; then\n",
    "              && grep -q 'Gate41-Preis berechnet' \"$pg\" \\\n              && grep -q 'Gate41-Preis berechnet' \"$tg\" \\\n              && grep -q 'ExportHubMultiTruck' \"$pr\" \\\n              && grep -q 'ExportHubMultiTruck' \"$tr\"; then\n",
    'deploy rc1017 live asset content');
  return src;
});

patchFile('.github/workflows/exporthub-testservice.yml',src=>{
  src=replaceOne(src,
    "          node --test .github/rc998/partial-pickup-avis-contract.test.mjs .github/rc1000/rc1000-production-pickup.test.mjs\n          npm test\n",
    "          node --test .github/rc998/partial-pickup-avis-contract.test.mjs .github/rc1000/rc1000-production-pickup.test.mjs\n          node --test test/rc1017-three-env-release.test.mjs\n          npm test\n",
    'testservice rc1017 release test');
  src=replaceOne(src,
    "          grep -q 'assets/rc1013-gate41-ui.js?v=1013' dist-rc1013/TESTVERSION.html\n",
    "          grep -q 'assets/rc1013-gate41-ui.js?v=1013' dist-rc1013/TESTVERSION.html\n          grep -q 'assets/rc1017-multi-truck.js?v=1017' dist-rc1013/TESTVERSION.html\n          grep -q 'assets/rc1017-multi-truck.js?v=1017' dist-rc1013/demo.html\n          test -s dist-rc1013/assets/rc1017-multi-truck.js\n",
    'testservice rc1017 build checks');
  src=replaceOne(src,
    "          cp dist-rc1013/assets/rc1013-gate41-ui.js .rc1013_testservice_app/assets/rc1013-gate41-ui.js\n",
    "          cp dist-rc1013/assets/rc1013-gate41-ui.js .rc1013_testservice_app/assets/rc1013-gate41-ui.js\n          test -s .rc1013_testservice_app/assets/rc1017-multi-truck.js\n",
    'testservice rc1017 package check');
  return src;
});
