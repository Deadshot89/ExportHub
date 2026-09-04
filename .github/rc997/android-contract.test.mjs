import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const BASE='android-app/app/src/main/java/de/exporthub/test/';
const ACT=BASE+'EnvironmentActivity.java';

test('Android RC997 behält gemeinsame Drei-Umgebungen-Hülle und Ein-Tap-Menü',()=>{
  const src=read(ACT);
  assert.match(src,/wonderful-forest-0f315e310\.7\.azurestaticapps\.net/);
  assert.match(src,/wonderful-forest-0f315e310-testservice\.centralus\.7\.azurestaticapps\.net/);
  assert.match(src,/TESTVERSION\.html/);
  assert.match(src,/demo\.html/);
  assert.match(src,/ehMenuBtn/);
  assert.match(src,/pointerup/);
  assert.match(src,/touchend/);
  assert.match(src,/onShowFileChooser/);
  assert.match(src,/DownloadManager/);
  assert.match(src,/PrintManager/);
  assert.match(src,/handleBack/);
});

test('Android RC997 behält Benachrichtigungen und 09-12-15 Erinnerungen',()=>{
  const notify=read(BASE+'NotificationHelper.java');
  const scheduler=read(BASE+'ReminderScheduler.java');
  assert.match(notify,/exporthub_tasks/);
  assert.match(notify,/exporthub_warnings/);
  assert.match(scheduler,/9/);
  assert.match(scheduler,/12/);
  assert.match(scheduler,/15/);
});

test('Android App-Version ist RC997 und bestehende Application ID bleibt upgradefähig',()=>{
  const gradle=read('android-app/app/build.gradle.kts');
  assert.match(gradle,/applicationId\s*=\s*"de\.exporthub\.test"/);
  assert.match(gradle,/versionCode\s*=\s*997/);
  assert.match(gradle,/versionName\s*=\s*"1\.0-rc997"/);
  const info=read('android-app/APP_BUILD_INFO.txt');
  assert.match(info,/App-Version:\s*1\.0-rc997/);
  assert.match(info,/Release-Kandidat:\s*RC997/);
  assert.match(info,/Produktion/);
  assert.match(info,/TESTSERVICE/);
  assert.match(info,/Demo/);
});
