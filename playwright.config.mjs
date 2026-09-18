import {defineConfig} from '@playwright/test';

const LIVE=process.env.EXPORTHUB_E2E_LIVE==='1';
const baseURL=process.env.EXPORTHUB_E2E_BASE_URL||'http://127.0.0.1:4173';

export default defineConfig({
  testDir:'./e2e/specs',
  fullyParallel:false,
  workers:1,
  retries:0,
  timeout:45_000,
  expect:{timeout:10_000},
  reporter:[
    ['list'],
    ['html',{outputFolder:'playwright-report',open:'never'}]
  ],
  outputDir:'test-results',
  use:{
    baseURL,
    headless:true,
    trace:LIVE?'off':'retain-on-failure',
    screenshot:'only-on-failure',
    video:'off',
    actionTimeout:10_000,
    navigationTimeout:30_000
  },
  webServer:LIVE?undefined:{
    command:'python3 -m http.server 4173 --directory dist-rc1112',
    url:'http://127.0.0.1:4173/demo.html',
    reuseExistingServer:true,
    timeout:30_000
  },
  projects:[
    {name:'mobile-small',use:{viewport:{width:360,height:800}}},
    {name:'mobile-standard',use:{viewport:{width:390,height:844}}},
    {name:'tablet',use:{viewport:{width:768,height:1024}}},
    {name:'laptop',use:{viewport:{width:1366,height:768}}},
    {name:'desktop',use:{viewport:{width:1920,height:1080}}}
  ]
});
