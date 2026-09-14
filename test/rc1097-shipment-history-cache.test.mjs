import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('RC1097: History-Runtime wird nicht aus einem veralteten Browsercache geladen',()=>{
  const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
  const route=config.routes.find(x=>x.route==='/assets/rc1071-shipment-history.js');
  assert.ok(route,'Route für History-Asset fehlt');
  assert.match(String(route.headers&&route.headers['Cache-Control']||''),/no-store/);
  assert.match(String(route.headers&&route.headers['Cache-Control']||''),/no-cache/);
});
