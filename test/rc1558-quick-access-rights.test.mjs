import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// In the RC542 process block rightLevel takes (user, rightId). applyAccessVisibility called rightLevel(right),
// so every routed button in #content (e.g. dashboard quick access) resolved to 'none' and was hidden, even for admins.
function processBlock(html){
  const end=html.indexOf('function applyAccessVisibility(');
  assert.ok(end>0,'applyAccessVisibility fehlt');
  const start=html.lastIndexOf('<script',end);
  const close=html.indexOf('</script>',end);
  return html.slice(start,close);
}

for(const file of ['index.html','TESTVERSION.html']){
  test(`RC1558 ${file}: Zugriffsprüfung übergibt Benutzer und Recht in der richtigen Reihenfolge`,()=>{
    const block=processBlock(fs.readFileSync(file,'utf8'));
    assert.match(block,/function rightLevel\(u,id\)\{/,'Signatur rightLevel(u,id) im RC542-Block erwartet');
    assert.doesNotMatch(block,/function rightLevel\(id,u\)/,'zweite rightLevel-Signatur im selben Block');
    assert.match(block,/var show=rightLevel\(CU\(\),right\)!=='none'/);
    assert.doesNotMatch(block,/rightLevel\(right\)/);
  });
}
