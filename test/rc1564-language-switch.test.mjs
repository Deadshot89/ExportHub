import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const profile=fs.readFileSync('assets/rc1079-profile-settings.js','utf8');
const rc1018=fs.readFileSync('assets/rc1018-mail-language-standard.js','utf8');

for(const file of ['index.html','TESTVERSION.html']){
  test(`RC1564 ${file}: altes RC455 leitet an die Sechs-Sprachen-Runtime weiter und übersetzt nicht dagegen`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.ok(html.includes("function lang(){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.language==='function')return window.ExportHUBI18n.language()}catch(e){}"),'lang() fragt RC1267');
    assert.ok(html.includes("function setLang(v){if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.setLanguage==='function'){runtimeLang=v;try{window.ExportHUBI18n.setLanguage(v)}catch(e){}return}"),'setLang() delegiert an RC1267');
    assert.ok(html.includes("function apply(root){if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.setLanguage==='function'){try{bind()}catch(e){}return}"),'apply() übersetzt nicht gegen RC1267');
  });
}

test('RC1564 Profil übernimmt die gewählte Sprache sofort lokal und erzwingt ohne gespeicherte Sprache kein Deutsch',()=>{
  assert.match(profile,/if\(language!==previous\)\{u\.language=language;syncUser\(Object\.assign\(\{\},u,\{name:name,language:language\}\)\)\}saveProfile\(name,language\)/);
  assert.match(profile,/syncUser\(Object\.assign\(\{\},data\.user,\{language:data\.user\.language\|\|language\}\)\)/);
  assert.match(profile,/var u=user\(\);if\(!u\|\|!q\(u\.language\|\|u\.uiLanguage\|\|u\.locale\)\)return false;/);
});

test('RC1564 RC1018 nimmt ohne Profilsprache die Runtime-Sprache, nicht den Startwert des Auswahlfelds',()=>{
  const at=rc1018.indexOf("var fromRuntime=normalizedLanguage(window.ExportHUBI18n.language())");
  const select=rc1018.indexOf("fromSelect=normalizedLanguage(nativeSelect&&nativeSelect.value)");
  assert.ok(at>0&&select>at,'Runtime-Sprache muss vor dem Auswahlfeld stehen');
});

test('RC1564 interne Oberfläche startet ohne gewählte Sprache auf Deutsch, öffentliche Seiten folgen dem Browser',()=>{
  const src=fs.readFileSync('assets/rc1267-i18n.js','utf8').replace(/\r\n/g,'\n');
  const start=src.indexOf('function requested(){');
  const body=src.slice(start,src.indexOf('\n}\n',start)+2);
  const run=(hasLogin)=>new Function('w','normalize','profileLanguage','cookieGet','STORAGE_KEY',body+'\nreturn requested();')(
    {location:{href:'https://example.test/'},localStorage:{getItem:()=>null},navigator:{language:'en-US'},document:{getElementById:id=>id==='login'&&hasLogin?{}:null}},
    v=>{const m=String(v||'').toLowerCase().match(/^(de|en|pl|es|fr|it)/);return m?m[1]:''},()=>'',()=>'','k');
  assert.equal(run(true),'de');
  assert.equal(run(false),'en');
});
