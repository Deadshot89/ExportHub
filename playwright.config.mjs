import {defineConfig} from '@playwright/test';

const live=process.env.EXPORTHUB_E2E_LIVE==='1';
const baseURL=process.env.EXPORTHUB_E2E_URL||'http://127.0.0.1:4173/demo.html';
const appDir=process.env.EXPORTHUB_E2E_APP_DIR||'dist-rc1112';

export default defineConfig({
  testDir:'./e2e/specs',
  timeout:45000,
  expect:{timeout:10000},
  retries:0,
  workers:1,
  fullyParallel:false,
  outputDir:'artifacts/rc1124-playwright/results',
  reporter:[
    ['line'],
    ['html',{outputFolder:'artifacts/rc1124-playwright/report',open:'never'}]
  ],
  use:{
    baseURL,
    headless:true,
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'off'
  },
  projects:[
    {name:'mobile-small',use:{viewport:{width:360,height:800}}},
    {name:'mobile-standard',use:{viewport:{width:390,height:844}}},
    {name:'tablet',use:{viewport:{width:768,height:1024}}},
    {name:'laptop',use:{viewport:{width:1366,height:768}}},
    {name:'desktop',use:{viewport:{width:1920,height:1080}}}
  ],
  webServer:live?undefined:{
    command:'python3 -m http.server 4173 --directory '+appDir,
    url:'http://127.0.0.1:4173/demo.html',
    reuseExistingServer:false,
    timeout:30000
  }
});
