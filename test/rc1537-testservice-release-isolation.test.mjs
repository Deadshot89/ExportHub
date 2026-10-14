import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guardPath='.github/workflows/rc1537-testservice-main-supersession.yml';

test('RC1537: neuer deploy-relevanter main beendet ältere mutable TESTSERVICE-Main-Verifications',()=>{
  assert.ok(fs.existsSync(guardPath),'RC1537 Main-Supersession-Workflow fehlt');
  const guard=fs.readFileSync(guardPath,'utf8');
  assert.match(guard,/push:\s*\n\s*branches:\s*\[main\]/,'Supersession muss bei deploy-relevanten main-Pushes laufen');
  assert.match(guard,/paths:\s*\n[\s\S]*?'api\/\*\*'/,'Supersession muss API-Änderungen als deploy-relevant behandeln');
  assert.match(guard,/paths:\s*\n[\s\S]*?'\.github\/workflows\/\*\*'/,'Supersession muss Release-Workflow-Änderungen als deploy-relevant behandeln');
  assert.match(guard,/paths:\s*\n[\s\S]*?'assets\/\*\*'/,'Supersession muss Runtime-Asset-Änderungen als deploy-relevant behandeln');
  assert.match(guard,/actions:\s*write/,'Supersession braucht ausschließlich für Run-Cancel Actions-Schreibrecht');
  assert.match(guard,/\/branches\/main/,'Guard muss zuerst prüfen, ob sein SHA noch aktueller main ist');
  assert.match(guard,/azure-static-web-apps-wonderful-forest-0f315e310\.yml/,'Guard muss ausschließlich die ExportHUB Main Verification betrachten');
  assert.match(guard,/run\.head_sha!==currentSha/,'aktueller Main-SHA darf niemals selbst beendet werden');
  assert.match(guard,/run\.status==='queued'\|\|run\.status==='in_progress'/,'nur noch laufende oder wartende Alt-Runs dürfen beendet werden');
  assert.match(guard,/actions\/runs\/\$\{run\.id\}\/cancel/,'ältere Main-Verifications müssen über den GitHub-Cancel-Endpunkt beendet werden');
});