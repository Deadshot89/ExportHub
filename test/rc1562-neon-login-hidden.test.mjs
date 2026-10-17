import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/rc1304-theme-switcher.css','utf8');

test('RC1562: Neon zeigt die Anmeldemaske nur, solange sie nicht ausgeblendet ist',()=>{
  // html[data-eh-design="neon"] #login (1,1,1) outranks #login.hidden (1,1,0); display must only apply to :not(.hidden)
  assert.match(css,/html\[data-eh-design="neon"\] #login:not\(\.hidden\)\{\s*display:grid!important;\s*\}/);
  const unguarded=css.match(/html\[data-eh-design="[a-z]+"\] #login\{[^}]*display:[^}]*\}/g)||[];
  assert.deepEqual(unguarded,[],'kein Design darf #login ohne :not(.hidden) einblenden');
});
