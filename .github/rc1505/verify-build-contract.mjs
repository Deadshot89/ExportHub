import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(file,'utf8');
const exists=file=>assert.ok(fs.existsSync(file),`RC1505 Buildvertrag: ${file} fehlt`);
const includes=(file,marker)=>assert.ok(read(file).includes(marker),`RC1505 Buildvertrag: ${marker} fehlt in ${file}`);
const excludes=(file,marker)=>assert.ok(!read(file).includes(marker),`RC1505 Buildvertrag: veralteter Marker ${marker} ist noch in ${file}`);

const pages=['dist-rc1112/index.html','dist-rc1112/TESTVERSION.html','dist-rc1112/demo.html'];
for(const file of pages)exists(file);

includes('dist-rc1112/index.html','ExportHUB RC1112 environment=production-candidate');
includes('dist-rc1112/TESTVERSION.html','ExportHUB RC1112 environment=testservice');
includes('dist-rc1112/demo.html','ExportHUB RC1112 environment=demo');
for(const file of pages)includes(file,"version:'RC1112'");
includes('dist-rc1112/production-version.js',"__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1112'");

// Gemeinsame Buildbasis: historische Funktions- und Cache-Verträge bleiben vor jedem Deploy zwingend.
for(const file of pages){
  includes(file,'assets/rc1016-mobile-navigation.js?v=1400');
  includes(file,'assets/rc1014-task-runtime.js?v=1359');
  includes(file,'assets/rc1014-shipment-overview.js?v=1370');
  includes(file,'assets/rc1014-shipment-overview.css?v=1370');
  includes(file,'assets/rc1065-registration-cc.js?v=1093');
  includes(file,'assets/rc1077-customer-labels.js?v=1394');
  includes(file,'assets/rc1079-profile-settings.js?v=1079');
  includes(file,'assets/rc1080-customer-history.js?v=1080');
  includes(file,'assets/rc1081-audit-history.js?v=1177');
  includes(file,'assets/rc1092-customer-mail-contacts.js?v=1399');
  includes(file,'assets/rc1015-lieferavis-mail-flow.js?v=1383');
  includes(file,'assets/abholkalender.js?v=1012');
  includes(file,'assets/rc1012-abholkalender-runtime.js?v=1012');
  includes(file,'assets/rc1018-mail-language-standard.js?v=1018');
  includes(file,'assets/rc1113-stowplan-persist.js?v=1113');
  includes(file,'assets/rc1114-shipping-neutral.js?v=1386');
  includes(file,'assets/rc1017-multi-truck.js?v=1017');
  includes(file,'assets/rc1013-gate41-ui.js?v=1385');
  includes(file,'assets/rc1074-login-clean.js?v=1349');
  includes(file,'assets/rc1305-loading-list-print.js?v=1379');
  includes(file,'assets/rc1315-loading-list-quick-print.js?v=1322');
  includes(file,'assets/rc1283-loading-list-search.js?v=1305');
  includes(file,'assets/rc1027-lieferavis-immediate.js?v=20261005');
  includes(file,'assets/rc1177-release-notes.js?v=');
}

for(const file of ['dist-rc1112/index.html','dist-rc1112/TESTVERSION.html']){
  includes(file,'assets/rc1061-document-migration-admin.js?v=1073');
  includes(file,'assets/rc1067-startup-recovery.js?v=1067');
  includes(file,'assets/rc1075-loader-pin-admin.js?v=1075');
  includes(file,'assets/rc1126-customer-delete.js?v=1387');
  includes(file,'assets/rc1013-diagnostics.js?v=1364');
  includes(file,"view:'history',label:'Historie',right:'history'");
}
excludes('dist-rc1112/demo.html','assets/rc1061-document-migration-admin.js');
excludes('dist-rc1112/demo.html','assets/rc1067-startup-recovery.js');
excludes('dist-rc1112/demo.html','assets/rc1075-loader-pin-admin.js');

includes('dist-rc1112/customer-avis.html','assets/rc1018-public-language.js?v=1231');
includes('dist-rc1112/customer-avis.html','customerPdfUpload');
includes('dist-rc1112/customer-avis.html','document-upload-status');
includes('dist-rc1112/pickup.html','assets/rc1018-public-language.js?v=1018');
includes('dist-rc1112/location.html','assets/rc1018-public-language.js?v=1018');
includes('dist-rc1112/demo.html','assets/rc1016-demo-task-seed.js?v=1016');

for(const file of [
  'dist-rc1112/assets/rc1016-mobile-navigation.js',
  'dist-rc1112/assets/rc1017-multi-truck.js',
  'dist-rc1112/assets/rc1018-mail-language-standard.js',
  'dist-rc1112/assets/rc1018-public-language.js',
  'dist-rc1112/assets/rc1065-registration-cc.js',
  'dist-rc1112/assets/rc1061-document-migration-admin.js',
  'dist-rc1112/assets/rc1067-startup-recovery.js',
  'dist-rc1112/assets/rc1069-performance.js',
  'dist-rc1112/assets/rc1075-loader-pin-admin.js',
  'dist-rc1112/assets/rc1077-customer-labels.js',
  'dist-rc1112/assets/rc1079-profile-settings.js',
  'dist-rc1112/assets/rc1080-customer-history.js',
  'dist-rc1112/assets/rc1081-audit-history.js',
  'dist-rc1112/assets/rc1092-customer-mail-contacts.js',
  'dist-rc1112/assets/rc1096-packaging-groups.js',
  'dist-rc1112/assets/rc1126-customer-delete.js',
  'dist-rc1112/assets/rc1133-avis-upload-notifications.js',
  'dist-rc1112/assets/rc1015-lieferavis-mail-flow.js',
  'dist-rc1112/assets/rc1027-lieferavis-immediate.js',
  'dist-rc1112/assets/rc1013-diagnostics.js',
  'dist-rc1112/assets/rc1013-gate41-ui.js',
  'dist-rc1112/assets/rc1071-shipment-history.js',
  'dist-rc1112/assets/abholkalender.js',
  'dist-rc1112/assets/rc1012-abholkalender-runtime.js',
  'dist-rc1112/assets/rc1113-stowplan-persist.js',
  'dist-rc1112/assets/rc1114-shipping-neutral.js',
  'dist-rc1112/assets/rc1305-loading-list-print.js',
  'dist-rc1112/assets/rc1315-loading-list-quick-print.js',
  'dist-rc1112/assets/rc1283-loading-list-search.js',
  'dist-rc1112/assets/rc1177-release-notes.js',
  'dist-rc1112/migration-recovery.html',
  'dist-rc1112/assets/sop/screenshots/rc1016-tasks.png',
  'dist-rc1112/assets/sop/screenshots/rc1016-shipmentoverview.png',
  'dist-rc1112/assets/sop/screenshots/rc1016-pickupcalendar.png'
])exists(file);

// RC1295 i18n-Release-Gate: Schlüssel statt lokalisierter deutscher Runtime-Literale prüfen.
includes('dist-rc1112/assets/rc1126-customer-delete.js','customerDelete.finalDelete');
includes('dist-rc1112/assets/rc1013-diagnostics.js','diagnostics.fixWithChatgpt');
includes('dist-rc1112/assets/rc1013-diagnostics.js','diagnostics.title');
includes('dist-rc1112/assets/rc1113-stowplan-persist.js','stowplan.instructionTitle');
includes('dist-rc1112/assets/rc1133-avis-upload-notifications.js','avisUploads.noticeTitle');
includes('dist-rc1112/assets/rc1133-avis-upload-notifications.js','avisUploads.openPrint');
includes('dist-rc1112/assets/rc1061-document-migration-admin.js','migration.runAll');
includes('dist-rc1112/assets/rc1013-gate41-ui.js','gate41.calculated');
includes('dist-rc1112/assets/rc1071-shipment-history.js','shipmentHistory.action.abdMailSent');
includes('dist-rc1112/assets/rc1071-shipment-history.js','shipmentHistory.action.workStarted');
includes('dist-rc1112/assets/rc1071-shipment-history.js','shipmentHistory.action.registrationStarted');
includes('dist-rc1112/assets/rc1080-customer-history.js','history.customer.customer-created');
includes('dist-rc1112/assets/rc1080-customer-history.js','history.customer.customer-updated');
includes('dist-rc1112/assets/rc1081-audit-history.js','history.title');
includes('dist-rc1112/assets/rc1092-customer-mail-contacts.js','customerContacts.savePerson');
includes('dist-rc1112/assets/rc1092-customer-mail-contacts.js','customerContacts.addToMail');
includes('dist-rc1112/assets/rc1096-packaging-groups.js','packaging.packages');
includes('dist-rc1112/assets/rc1096-packaging-groups.js','packaging.pallets');
includes('dist-rc1112/assets/rc1096-packaging-groups.js','packaging.other');
includes('api/shared/i18n/de.json','"api.avis.mailPassed"');

includes('dist-rc1112/assets/rc1092-customer-mail-contacts.js','__EXPORTHUB_RC1092_CUSTOMER_MAIL_CONTACTS__');
includes('dist-rc1112/assets/rc1126-customer-delete.js','customerDelete.finalDelete');
includes('dist-rc1112/assets/rc1081-audit-history.js','__EXPORTHUB_RC1081_AUDIT_HISTORY__');
includes('dist-rc1112/assets/rc1113-stowplan-persist.js','__EXPORTHUB_RC1113_STOWPLAN_PERSIST__');
includes('dist-rc1112/assets/rc1114-shipping-neutral.js','__EXPORTHUB_RC1114_SHIPPING_NEUTRAL__');
includes('dist-rc1112/migration-recovery.html','Dokumentspeicher wird optimiert');

console.log('RC1505: gemeinsame RC1112-Buildbasis inklusive historischer Release-Verträge verifiziert.');