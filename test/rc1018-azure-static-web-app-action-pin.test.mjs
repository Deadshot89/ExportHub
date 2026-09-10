import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const ACTION='Azure/static-web-apps-deploy@4d27395796ac319302594769cfe812bd207490b1';

function occurrences(source,needle){
  return source.split(needle).length-1;
}

test('RC1018 Standarddeploy pinnt die Azure-Action mit deklariertem TESTSERVICE-Umgebungsinput',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.equal(occurrences(flow,ACTION),2,'Produktion und TESTSERVICE müssen dieselbe geprüfte Azure-Action-Revision verwenden.');
  assert.doesNotMatch(flow,/Azure\/static-web-apps-deploy@v1/,'Der alte v1-Tag zeigt auf Action-Metadaten ohne deployment_environment.');
  assert.match(flow,/deployment_environment:\s*testservice/,'Der benannte TESTSERVICE-Zielmechanismus darf nicht entfernt werden.');
});

test('RC1018 manueller TESTSERVICE-Ausnahmeweg verwendet dieselbe gepinnte Azure-Action',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.equal(occurrences(flow,ACTION),1,'Der explizite TESTSERVICE-Deploy muss dieselbe geprüfte Azure-Action-Revision verwenden.');
  assert.doesNotMatch(flow,/Azure\/static-web-apps-deploy@v1/,'Auch der Ausnahmeweg darf nicht auf den veralteten v1-Tag zurückfallen.');
  assert.match(flow,/deployment_environment:\s*testservice/,'Auch der Ausnahmeweg muss die benannte TESTSERVICE-Umgebung beibehalten.');
});
