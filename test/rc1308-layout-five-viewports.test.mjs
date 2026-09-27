import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/rc1306-layout-browser.yml','utf8');
const config=fs.readFileSync('playwright.config.mjs','utf8');

test('RC1308: Layout-Gate nennt alle fünf Ziel-Viewports explizit',()=>{
  for(const project of ['mobile-small','mobile-standard','tablet','laptop','desktop']){
    assert.ok(workflow.includes('--project='+project),project+' fehlt im RC1306 Browser-Gate');
  }
});

test('RC1308: Playwright-Konfiguration enthält die fünf verbindlichen Größen',()=>{
  assert.match(config,/name:'mobile-small'[\s\S]*width:360,height:800/);
  assert.match(config,/name:'mobile-standard'[\s\S]*width:390,height:844/);
  assert.match(config,/name:'tablet'[\s\S]*width:768,height:1024/);
  assert.match(config,/name:'laptop'[\s\S]*width:1366,height:768/);
  assert.match(config,/name:'desktop'[\s\S]*width:1920,height:1080/);
});
