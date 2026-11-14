import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const css=read('assets/rc2035-login-parity.css');
const ambient=read('assets/rc2035-login-ambient.svg');
const scene=read('assets/rc1630-login-route.svg');
const build=read('.github/rc1112/build-three-env.mjs');
const runtime=read('assets/rc1630-login-experience.js');

test('RC2035: production and TESTSERVICE share one scoped size and background',()=>{
 assert.match(css,/#login#login#login\[data-eh360-ui="v2"\]/,'only enhance RC1630 login');
 assert.match(css,/grid-auto-rows:minmax\(var\(--eh2035-panel-height\),auto\)/);
 assert.match(css,/grid-template-columns:minmax\(0,600px\) minmax\(360px,460px\)/);
 assert.match(css,/\.eh360-login-hero,\s*[\s\S]*?\.login-card\s*\{\s*min-height:var\(--eh2035-panel-height\)/);
 assert.match(css,/rc2035-login-ambient\.svg\?v=2035/);
 assert.doesNotMatch(css,/\b(?:production|testservice)\.azurestaticapps\./i);
 assert.doesNotMatch(css,/\bfetch\s*\(/);
 assert.doesNotMatch(css,/display:grid!important[\s\S]*?\.hidden\s*\{/);
});
test('RC2035: existing environment selection, login and accessibility are preserved',()=>{
 assert.match(css,/:has\(\.eh-login-environment button:nth-child\(2\)/);
 assert.match(css,/\#loginBtn/);
 assert.match(css,/@media \(max-width:980px\)/);
 assert.match(css,/@media \(max-width:520px\)/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(css,/:focus-visible/);
 assert.match(runtime,/login\.insertBefore\(hero,card\)/);
 assert.match(runtime,/lang\.addEventListener\('change',translate\)/);
 assert.doesNotMatch(css,/(?:localStorage|sessionStorage|document\.cookie|Authorization|password)\s*=/i);
});
test('RC2035: ambient and route images are local inert SVG artwork',()=>{
 for(const svg of [ambient,scene]){
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/<\/svg>\s*$/);
  assert.doesNotMatch(svg,/<(?:script|foreignObject|image|iframe)\b|xlink:href=|onload\s*=|href\s*=\s*["']https?:/i);
 }
 assert.match(ambient,/Forklift and pallet/);
 assert.match(ambient,/Perspective floor/);
 assert.match(scene,/warehouse with dimensional roof/);
 assert.match(scene,/Truck, layered for depth/);
});
test('RC2035: build includes the CSS and vectors for all three Azure environments',()=>{
 assert.match(build,/const RC2035_LOGIN_STYLE_TAG=/);
 assert.match(build,/injectDeferredRuntimeInHead\(html,RC2035_LOGIN_STYLE_TAG,'exporthub-rc2035-login-parity'\)/);
 assert.match(build,/if\(!html\.includes\('rc2035-login-parity\.css\?v=2035'\)\)/);
 for(const path of ['assets/rc2035-login-parity.css','assets/rc2035-login-ambient.svg','assets/rc1630-login-route.svg']){
   assert.ok(build.includes("'"+path+"'"),path);
 }
 for(const file of ['index.html','TESTVERSION.html','demo.html'])assert.ok(build.includes(file));
 assert.match(build,/html=patchRc1630LoginVisuals\(html,file\)/);
});


test('RC2035: premium motion stays visual-only, respects reduced-motion and retains focus visibility',()=>{
 assert.match(css,/eh2035HeroReveal/);
 assert.match(css,/eh2035CardReveal/);
 assert.match(css,/eh2035AmbientLight/);
 assert.match(css,/eh2035LogoGlow/);
 assert.match(css,/#loginBtn:hover:not\(:disabled\)::after/);
 assert.match(css,/@layer rc971 \{/,'field focus effects must stay in the form style layer');
 assert.match(css,/@media \(prefers-reduced-motion:reduce\) \{[\s\S]*?animation:none!important/);
 assert.match(css,/:not\(\.hidden\) > \.login-card/);
 assert.doesNotMatch(css,/\b(?:fetch\s*\(|localStorage|sessionStorage|document\.cookie|setTimeout\s*\()/);
});
