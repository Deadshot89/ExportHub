import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(name)=>fs.readFileSync(name,'utf8');
const css=read('assets/rc1630-login-experience.css');
const runtime=read('assets/rc1630-login-experience.js');
const art=read('assets/rc1630-login-route.svg');
const build=read('.github/rc1112/build-three-env.mjs');

test('RC1630: login UI is scoped and never overrides the hidden state',()=>{
  assert.match(css,/#login\[data-eh360-ui="v2"\]\.hidden\{display:none!important\}/);
  assert.match(css,/#login\[data-eh360-ui="v2"\]:not\(\.hidden\)\{display:grid!important\}/);
  assert.match(css,/grid-template-columns:minmax\(0,600px\) minmax\(360px,460px\)/);
  assert.match(css,/position:fixed!important/,'login must stay a full-screen overlay above the app shell');
  assert.match(css,/#login#login\[data-eh360-ui="v2"\]/,'doubled id must outrank legacy body[data-eh-theme] #login rules');
  assert.match(css,/@layer rc971\{/,'form controls must join the RC971 layer to beat its layered !important rules');
  assert.match(css,/#rc1016MobileMenuBtn\{display:none!important\}/);
  assert.match(css,/@media\(max-width:980px\)/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(css,/@media\(max-width:350px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/html\[data-eh-design="neon"\]/);
});
test('RC1630: login remains connected to existing authentication, language and environment controls',()=>{
  assert.match(runtime,/card\.parentNode!==login/);
  assert.match(runtime,/login\.insertBefore\(hero,card\)/);
  assert.match(runtime,/h1\.insertAdjacentElement\('afterend',subline\)/);
  assert.match(runtime,/document\.getElementById\('loginLanguageSelect'\)/);
  assert.match(runtime,/lang\.addEventListener\('change',translate\)/);
  assert.match(runtime,/'.eh360-login-headline':tr\.headline/);
  assert.match(runtime,/'.eh360-login-description':tr\.summary/);
  assert.match(runtime,/node\('p','eh360-login-description'\)/);
  assert.doesNotMatch(runtime,/'.eh360-login-hero p':tr\.summary/);
  assert.match(runtime,/aria-hidden','true'/);
  assert.doesNotMatch(runtime,/\.(?:preventDefault|stopPropagation)\(/);
  assert.doesNotMatch(runtime,/\bfetch\s*\(/);
  assert.doesNotMatch(runtime,/\b(?:localStorage|sessionStorage|cookie)\b/);
  assert.doesNotMatch(runtime,/\b(?:loginBtn|loginPass|loginUser)\b/);
  for(const language of ['de','en','pl','es','fr','it'])assert.match(runtime,new RegExp('\\b'+language+':\\{tag:'));
});
test('RC1630: legacy login cleanup leaves environment button styling to the redesign',()=>{
  const clean=read('assets/rc1074-login-clean.js');
  assert.match(clean,/getAttribute\('data-eh360-ui'\)==='v2'/);
  assert.match(clean,/rs\.removeProperty\(name\)/);
  assert.match(build,/assets\/rc1074-login-clean\.js\?v=1630/);
});
test('RC1630: logistics artwork is local and decorative',()=>{
  assert.match(art,/^<svg\b/);
  assert.match(art,/<\/svg>\s*$/);
  assert.match(runtime,/rc1630-login-route\.svg\?v=1630/);
  assert.match(runtime,/art\.alt=''/);
  assert.doesNotMatch(art,/<script|<foreignObject|xlink:href=|<image\b/i);
});
test('RC1630: all generated Azure environments receive the assets and links',()=>{
  assert.match(build,/function patchRc1630LoginVisuals\(html,file\)/);
  assert.match(build,/html=patchRc1630LoginVisuals\(html,file\)/);
  assert.match(build,/rc1630-login-experience\.css\?v=1630/);
  assert.match(build,/rc1630-login-experience\.js\?v=1631/);
  for(const file of ['rc1630-login-experience.css','rc1630-login-experience.js','rc1630-login-route.svg']){
    assert.ok(build.includes("'assets/"+file+"'"),file+' must be copied into each build');
  }
});
test('RC1630: login enhancement applies while parsing, not after DOMContentLoaded',()=>{
  // A deferred script only runs after the whole multi-MB page is parsed, so the old login stayed visible.
  const tag=/<script id="exporthub-rc1630-login-script"[^>]*>/.exec(build);
  assert.ok(tag,'RC1630 login script tag missing');
  assert.doesNotMatch(tag[0],/\b(defer|async)\b/);
  assert.match(runtime,/function loginParsed\(\)/);
  assert.match(runtime,/new MutationObserver\(function\(\)\{\s*if\(!loginParsed\(\)\)return;/);
});
