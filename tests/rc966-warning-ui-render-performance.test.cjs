'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('TESTVERSION.html', 'utf8');

const build = source.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)',loginReturn:'\/TESTVERSION\.html\?v=(\d+)'\}\);/);
assert(build, 'BUILD-Kennung fehlt.');
assert(Number(build[1]) >= 966, 'RC966 oder neuer wird benötigt.');
assert.strictEqual(build[2], build[1], 'BUILD cache muss zur RC-Version passen.');
assert.strictEqual(build[3], build[1], 'BUILD loginReturn muss zur RC-Version passen.');
assert(source.includes('/* exporthub-rc966-warning-ui-diff */'), 'RC966 Warncenter-Diff-Marker fehlt.');

const helperMatch = source.match(/function rc966PatchHtml\(node,html\)\{[^\n]*\}/);
assert(helperMatch, 'rc966PatchHtml fehlt.');
const patchHtml = vm.runInNewContext('(' + helperMatch[0] + ')', Object.create(null));

let writes = 0;
let current = '';
const attrs = Object.create(null);
const node = {
  get innerHTML() { return current; },
  set innerHTML(v) { writes += 1; current = String(v); },
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null; },
  setAttribute(name, value) { attrs[name] = String(value); }
};

assert.strictEqual(patchHtml(node, '<b>1</b>'), true, 'Erster Inhalt muss geschrieben werden.');
assert.strictEqual(writes, 1, 'Erster Inhalt darf genau einen DOM-Write auslösen.');
assert.strictEqual(patchHtml(node, '<b>1</b>'), false, 'Identischer Inhalt muss übersprungen werden.');
assert.strictEqual(writes, 1, 'Identischer Inhalt darf keinen weiteren DOM-Write auslösen.');
assert.strictEqual(patchHtml(node, '<b>2</b>'), true, 'Geänderter Inhalt muss geschrieben werden.');
assert.strictEqual(writes, 2, 'Geänderter Inhalt muss genau einen zusätzlichen DOM-Write auslösen.');

assert(/rc966PatchHtml\(btn,'Warncenter <span class="rc885-warning-count">'\+d\.total\+'<\/span>'\)/.test(source), 'Warncenter-Button nutzt den RC966-Diff-Pfad nicht.');
assert(/rc966PatchHtml\(drawer,\s*'<div class="rc885-drawer">'/s.test(source), 'Warncenter-Drawer nutzt den RC966-Diff-Pfad nicht.');
assert(!source.includes("btn.innerHTML='Warncenter <span class=\"rc885-warning-count\">'+d.total+'</span>';"), 'Alter bedingungsloser Warncenter-Button-DOM-Write ist noch aktiv.');

console.log('RC966 warning UI render performance regression: OK');
