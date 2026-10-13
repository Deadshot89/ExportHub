import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readMainFlow,readProductionFlow} from './helpers/rc1505-release-contract.mjs';

const read=(path)=>fs.readFileSync(path,'utf8');
const ACTION='Azure/static-web-apps-deploy@4d27395796ac319302594769cfe812bd207490b1';

function occurrences(source,needle){
  return source.split(needle).length-1;
}

test('RC1018 Main- und Production-Workflow pinnen dieselbe Azure-Action; TESTSERVICE bleibt benannt',()=>{
  const main=readMainFlow(),production=readProductionFlow();
  assert.equal(occurrences(main,ACTION),1,'Main Verification muss genau einen gepinnten TESTSERVICE-Upload enthalten.');
  assert.equal(occurrences(production,ACTION),1,'Production Release muss genau einen gepinnten Production-Upload enthalten.');
  assert.doesNotMatch(main,/Azure\/static-web-apps-deploy@v1/,'Der alte v1-Tag zeigt auf Action-Metadaten ohne deployment_environment.');
  assert.doesNotMatch(production,/Azure\/static-web-apps-deploy@v1/,'Production darf ebenfalls nicht auf den veralteten v1-Tag zurückfallen.');
  assert.match(main,/deployment_environment:\s*testservice/,'Der benannte TESTSERVICE-Zielmechanismus darf nicht entfernt werden.');
  assert.doesNotMatch(main,/AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310/,'Production-Secret darf nicht im Main-Workflow vorkommen.');
});

test('RC1018 manueller TESTSERVICE-Ausnahmeweg verwendet dieselbe gepinnte Azure-Action',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.equal(occurrences(flow,ACTION),1,'Der explizite TESTSERVICE-Deploy muss dieselbe geprüfte Azure-Action-Revision verwenden.');
  assert.doesNotMatch(flow,/Azure\/static-web-apps-deploy@v1/,'Auch der Ausnahmeweg darf nicht auf den veralteten v1-Tag zurückfallen.');
  assert.match(flow,/deployment_environment:\s*testservice/,'Auch der Ausnahmeweg muss die benannte TESTSERVICE-Umgebung beibehalten.');
});
