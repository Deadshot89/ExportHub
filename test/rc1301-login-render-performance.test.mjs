import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1301: Login beobachtet nur noch den eigenen DOM-Bereich statt das komplette Dokument',()=>{
  assert.match(runtime,/function installLoginObserver\(\)/);
  assert.match(runtime,/observe\(login,\{subtree:true,childList:true,attributes:true,attributeFilter:\['class','hidden','aria-pressed'\]\}\)/);
  assert.doesNotMatch(runtime,/LOGIN_OBSERVER__\.observe\(d\.documentElement/);
  assert.doesNotMatch(runtime,/attributeFilter:\['class','hidden','style'\]/);
});

test('RC1301: Login-Mutationen starten keine ABD-Hintergrund-Persistenz mehr',()=>{
  assert.match(runtime,/function rc1109Schedule\(\)\{if\(loginVisible\(\)\)return false/,'Auch Render/Viewchange-Events dürfen am sichtbaren Login keine ABD-Arbeit starten');
  const start=runtime.indexOf('function install(){');
  const end=runtime.indexOf("\nif(d.readyState",start);
  assert.ok(start>=0&&end>start,'install fehlt');
  const block=runtime.slice(start,end);
  assert.doesNotMatch(block,/rc1109Schedule\(/);
  assert.match(block,/installLoginObserver\(\)/);
  assert.match(block,/installStableEnvironmentSwitch\(\)/);
});

test('RC1301: Umgebungswechsel verwendet stabile URL ohne Zeitstempel-Cache-Busting',()=>{
  assert.match(runtime,/function stableEnvironmentUrl\(target\)/);
  assert.match(runtime,/u\.search=''/);
  assert.match(runtime,/u\.searchParams\.set\('entry','login'\)/);
  assert.doesNotMatch(runtime,/Date\.now\(\).*entry=login/);
  assert.match(runtime,/w\.addEventListener\('click',stableEnvironmentClick,true\)/);
});

test('RC1301: Login-Runtime wird mit neuem Cache-Key in Build und Live-Gate ausgeliefert',()=>{
  assert.match(build,/rc1074-login-clean\.js\?v=1311/);
  assert.match(workflow,/rc1074-login-clean\.js\?v=1311/);
});
