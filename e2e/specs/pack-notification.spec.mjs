import {test} from '@playwright/test';
import {
  packStationTokenFromFixture,
  runPackNotificationLiveFlow
} from '../helpers/pack-notification-live.mjs';

test('QR pack flow saves and resumes draft, then creates notification detail and shipment handoff',async({browser},testInfo)=>{
  test.setTimeout(180_000);
  const token=packStationTokenFromFixture();
  test.skip(process.env.EXPORTHUB_E2E_LIVE!=='1'||process.env.EXPORTHUB_E2E_MUTATION!=='1'||!token,'requires live mutable TESTSERVICE and a pack station token');
  test.skip(testInfo.project.name!=='laptop','runs once on laptop profile');
  await runPackNotificationLiveFlow(browser,testInfo,token);
});
