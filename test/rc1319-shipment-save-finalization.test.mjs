import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

test('RC1319 Diagnose: QR-Zulassung und Statusberechnung',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const qr=html.indexOf('function register(sh,force)');
  assert.ok(qr>=0,'QR register fehlt');
  const eligible=html.lastIndexOf('function eligible',qr);
  const persisted=html.lastIndexOf('function persisted',qr);
  const statusApi=html.indexOf('recalculateShipmentStatus');
  const saveStatus=html.indexOf("if(!q(saved.status))saved.status='Entwurf';");
  assert.ok(eligible>=0&&persisted>=0&&saveStatus>=0,'Diagnoseanker fehlen');
  assert.fail([
    'ELIGIBLE='+html.slice(eligible,eligible+2600),
    'PERSISTED='+html.slice(persisted,persisted+2600),
    'STATUSAPI='+html.slice(Math.max(0,statusApi-2800),statusApi+6200),
    'SAVESTATUS='+html.slice(Math.max(0,saveStatus-1000),saveStatus+2600)
  ].join('\n---RC1319---\n'));
});
