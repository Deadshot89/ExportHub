import {defineConfig} from '@playwright/test';

// Read-only visual proof against the exact TESTSERVICE frontend.
// No global setup, test user, session token or real API writes.
export default defineConfig({
 testDir:'./e2e/specs',
 testMatch:'rc1903-testservice-visual-proof.spec.mjs',
 fullyParallel:false,
 workers:1,
 retries:0,
 timeout:60000,
 globalTimeout:6*60*1000,
 expect:{timeout:12000},
 reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
 outputDir:'test-results',
 use:{
  baseURL:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',
  headless:true,
  screenshot:'only-on-failure',
  trace:'retain-on-failure',
  video:'off',
  actionTimeout:10000,
  navigationTimeout:30000
 },
 projects:[
  {name:'laptop',use:{viewport:{width:1366,height:768}}},
  {name:'mobile-small',use:{viewport:{width:360,height:800}}}
 ]
});
