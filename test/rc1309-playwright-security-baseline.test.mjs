import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=[
  '.github/workflows/rc1306-layout-browser.yml',
  '.github/workflows/rc1190-print-browser-pr.yml',
  '.github/workflows/rc1193-visible-version-pr.yml',
  '.github/workflows/rc1189-mobile-navigation-pr-browser.yml',
  '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',
  '.github/workflows/rc1016-development.yml'
];

test('RC1309: aktive Browser-Workflows verwenden Playwright 1.63.0',()=>{
  for(const file of files){
    const source=fs.readFileSync(file,'utf8');
    assert.ok(source.includes('playwright')||source.includes('@playwright/test'),file+' enthält keinen Playwright-Pin');
    assert.doesNotMatch(source,/playwright(?:\/test)?@1\.55\.0/);
    assert.match(source,/playwright(?:\/test)?@1\.63\.0/);
  }
});
