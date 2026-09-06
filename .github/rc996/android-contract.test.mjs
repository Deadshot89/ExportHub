import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const exists=(p)=>fs.existsSync(p);
const BASE='android-app/app/src/main/java/de/exporthub/test/';
const ACT=BASE+'EnvironmentActivity.java';
const NOTIFY=BASE+'NotificationHelper.java';
const SCHED=BASE+'ReminderScheduler.java';
const RECEIVER=BASE+'ReminderReceiver.java';
const BOOT=BASE+'BootReceiver.java';

test('Android RC996 besitzt eine gemeinsame EnvironmentActivity mit exakt drei ExportHUB-Zielen',()=>{
  assert.equal(exists(ACT),true,`${ACT} fehlt`);
  const src=read(ACT);
  assert.match(src,/wonderful-forest-0f315e310\.7\.azurestaticapps\.net/);
  assert.match(src,/wonderful-forest-0f315e310-testservice\.centralus\.7\.azurestaticapps\.net/);
  assert.match(src,/TESTVERSION\.html/);
  assert.match(src,/demo\.html/);
  assert.match(src,/Produktion/);
  assert.match(src,/TESTSERVICE/);
  assert.match(src,/Demo/);
  assert.match(src,/chooseEnvironment/);
  assert.match(src,/selectEnvironment/);
});

test('Android WebView behält Ein-Tap-Menüfix, Upload, Download, Print und Zurücknavigation',()=>{
  const src=read(ACT);
  assert.match(src,/ehMenuBtn/);
  assert.match(src,/pointerup/);
  assert.match(src,/touchend/);
  assert.match(src,/onShowFileChooser/);
  assert.match(src,/DownloadManager/);
  assert.match(src,/PrintManager/);
  assert.match(src,/handleBack/);
});

test('Android RC996 besitzt native Benachrichtigungen und feste 09\/12\/15-Uhr-Erinnerungen',()=>{
  for(const p of [NOTIFY,SCHED,RECEIVER,BOOT])assert.equal(exists(p),true,`${p} fehlt`);
  const notify=read(NOTIFY),scheduler=read(SCHED),receiver=read(RECEIVER);
  assert.match(notify,/exporthub_tasks/);
  assert.match(notify,/exporthub_warnings/);
  assert.match(notify,/SharedPreferences/);
  assert.match(scheduler,/9/);
  assert.match(scheduler,/12/);
  assert.match(scheduler,/15/);
  assert.match(scheduler,/setInexactRepeating/);
  assert.match(receiver,/NotificationHelper/);
});

test('Manifest fordert Android-13-Notification-Recht an und startet EnvironmentActivity',()=>{
  const src=read('android-app/app/src/main/AndroidManifest.xml');
  assert.match(src,/android\.permission\.POST_NOTIFICATIONS/);
  assert.match(src,/android\.permission\.RECEIVE_BOOT_COMPLETED/);
  assert.match(src,/\.EnvironmentActivity/);
  assert.match(src,/\.ReminderReceiver/);
  assert.match(src,/\.BootReceiver/);
});

test('Android RC996+ behält Application ID und monotone Versionsnummer',()=>{
  const gradle=read('android-app/app/build.gradle.kts');
  assert.match(gradle,/applicationId\s*=\s*"de\.exporthub\.test"/);
  const code=Number((gradle.match(/versionCode\s*=\s*(\d+)/)||[])[1]||0);
  assert.ok(code>=996,`versionCode ${code} ist kleiner als 996`);
  const name=Number((gradle.match(/versionName\s*=\s*"1\.0-rc(\d+)(?:\.\d+)?"/)||[])[1]||0);
  assert.ok(name>=996,`versionName RC${name||0} ist kleiner als RC996`);
  const info=JSON.parse(read('android-app/app-build-info.json'));
  const infoRc=Number(String(info.releaseCandidate||'').replace(/^RC/i,''))||0;
  assert.ok(infoRc>=996,`Buildinfo RC${infoRc||0} ist kleiner als RC996`);
  assert.ok(info.environments&&info.environments.production,'Produktion fehlt in Buildinfo');
  assert.ok(info.environments&&info.environments.testservice,'TESTSERVICE fehlt in Buildinfo');
  assert.ok(info.environments&&info.environments.demo,'Demo fehlt in Buildinfo');
});
