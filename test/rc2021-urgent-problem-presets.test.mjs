import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('assets/urgent-orders.html');
const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
const i18n = Object.fromEntries(['de','en','pl','es','fr','it'].map(lang => [
 lang, JSON.parse(read('assets/i18n/' + lang + '.json'))
]));

function presetContext(lang, freeText = '') {
 const nodes = new Map();
 const createNode = tag => ({
  tag, children: [], handlers: {}, textContent: '', checked: false,
  append(...children) { this.children.push(...children); },
  replaceChildren() { this.children = []; },
  addEventListener(event, fn) { this.handlers[event] = fn; }
 });
 const $ = id => {
  if (!nodes.has(id)) nodes.set(id, createNode('div'));
  return nodes.get(id);
 };
 $('mailIssue').value = freeText;
 const localeV2 = (key, fallback) => i18n[lang]['urgentOrderV2.' + key] || fallback;
 const ctx = vm.createContext({$, localeV2, document: {createElement: createNode},
  draftNeedsRegenerate: false, clearMailIssueError() {}, setMessage() {}});
 const from = script.indexOf('const PROBLEM_PRESETS=[');
 const to = script.indexOf('// Reuse real problem descriptions entered on the website', from);
 assert.ok(from > 0 && to > from, 'preset logic must be present');
 vm.runInContext(script.slice(from, to), ctx);
 return {ctx, $, select: code => vm.runInContext('selectedProblems.add(' + JSON.stringify(code) + ')', ctx),
  note: () => vm.runInContext('selectedProblemNote()', ctx),
  render: () => vm.runInContext('renderIssueTemplates()', ctx)};
}

test('all seven selectable problems are translated in every supported language', () => {
 const keys = ['issueTemplatesTitle','issueTemplatesHint','issueStock','issuePick','issueHold',
  'issueMismatch','issueDocuments','issueDamage','issueDelay','issueRegenerate','issueTooLong'];
 for (const [lang, data] of Object.entries(i18n)) {
  for (const key of keys) assert.ok(data['urgentOrderV2.' + key]?.trim(), lang + ' missing ' + key);
 }
 for (const lang of ['de','en']) {
  const p = presetContext(lang);
  p.render();
  assert.equal(p.$('issueTemplateChoices').children.length, 7);
  assert.equal(p.$('issueTemplatesTitle').textContent, i18n[lang]['urgentOrderV2.issueTemplatesTitle']);
  assert.equal(new Set(p.$('issueTemplateChoices').children.map(c=>c.children[0].value)).size, 7);
 }
});

test('multiple reasons and existing free-text form one escaped, non-destructive mail note', () => {
 const p = presetContext('de', 'Freitext für den Bearbeiter');
 p.select('stock'); p.select('damage');
 assert.equal(p.note(), [
  i18n.de['urgentOrderV2.issueStock'],
  i18n.de['urgentOrderV2.issueDamage'],
  'Freitext für den Bearbeiter'
 ].join('\n'));
 assert.equal(p.$('mailIssue').value, 'Freitext für den Bearbeiter');
 const english = presetContext('en');
 english.render();
 const first = english.$('issueTemplateChoices').children[0].children[0];
 first.checked = true; first.handlers.change();
 assert.equal(english.note(), i18n.en['urgentOrderV2.issueStock']);
 assert.equal(english.ctx.draftNeedsRegenerate, true);
});

test('the actual selected note is validated and transmitted to the draft API', () => {
 assert.match(script, /const preparedNote=modalKind==='problem'\?selectedProblemNote\(\):''/);
 assert.match(script, /preparedNote\.length<8/);
 assert.match(script, /preparedNote\.length>2000/);
 assert.match(script, /note:preparedNote,noteLanguage:websiteLanguage/);
 assert.match(script, /draftNeedsRegenerate=false/);
 assert.match(script, /if\(draftNeedsRegenerate\)/);
 assert.match(script, /selectedProblems\.clear\(\)/);
 assert.match(script, /renderIssueTemplates\(\)/);
 assert.match(script, /\$\('issueTemplates'\)\.hidden=kind!=='problem'/);
});

test('mail actions are clickable in the request summary and shipping text stays in one line', () => {
 assert.match(page, /\.order-buttons \.btn\{flex:none;white-space:nowrap\}/);
 assert.match(page, /minmax\(242px,1\.6fr\)/);
 assert.match(page, /data-mail="problem"/);
 assert.match(page, /data-mail="shipping"/);
 assert.match(script, /ev\.preventDefault\(\);ev\.stopPropagation\(\);openDraft\(order,b\.dataset\.mail\)/);
 assert.match(script, /await api\('record-mail-handoff'/);
 assert.match(script, /window\.location\.href=uri/);
 assert.match(page, /id="issueTemplateChoices"/);
});

test('shipping action remains on one line and is disabled until every item is shipped',()=>{
 const match=page.match(/const readyToConfirm=([^;]+);/);
 assert.ok(match,'shipping-confirmation state must be calculated from every item');
 const canShip=statuses=>vm.runInNewContext(match[1],{order:{items:statuses.map(status=>({status}))}});
 assert.equal(canShip(['Shipped','Invoiced']),true);
 assert.equal(canShip(['Shipped','Open']),false);
 assert.equal(canShip(['Invoiced','Problem']),false);
 assert.equal(canShip([]),false);
 assert.match(page,/disabled aria-disabled="true" title="/);
 assert.match(page,/\.order-buttons \.btn\{flex:none;white-space:nowrap\}/);
 for(const [lang,strings] of Object.entries(i18n)){
  assert.ok(strings['urgentOrderV2.shippingNotReady'],lang+' missing unavailable-shipping reason');
 }
});

test('mail dialog heading and shipping preparation feedback follow DE/EN interface language',()=>{
 assert.match(script,/\$\('mailTitle'\)\.textContent=\(kind==='problem'\?localeV2\('reportProblem'/);
 assert.match(script,/localeV2\('shippingConfirmation','Versandbestätigung'\)/);
 assert.match(script,/\$\('mailIssue'\)\.placeholder=localeV2\('problemPrompt'/);
 assert.match(script,/localeV2\('mailShippingPreparing','Versandbestätigung wird vorbereitet\.'\)/);
 for(const lang of ['de','en','pl','es','fr','it']){
  assert.ok(i18n[lang]['urgentOrderV2.mailShippingPreparing'],lang+' shipping draft preparation is missing');
  assert.ok(i18n[lang]['urgentOrderV2.reportProblem'],lang+' problem title is missing');
  assert.ok(i18n[lang]['urgentOrderV2.shippingConfirmation'],lang+' shipping confirmation title is missing');
 }
 assert.equal(i18n.en['urgentOrderV2.mailShippingPreparing'],'Preparing shipping confirmation.');
});

test('all pending mail drafts block handoff, including changed shipping language',()=>{
 assert.match(script,/const button=\$\('generateMail'\);if\(button\.disabled\)return;\s*draftNeedsRegenerate=true;/);
 assert.match(script,/if\(draftNeedsRegenerate\)\{setMessage\('mailMessage'/);
 assert.match(script,/\$\('mailLanguage'\)\.addEventListener\('change',\(\)=>\{\s*draftNeedsRegenerate=true;/);
 assert.match(script,/if\(modalKind==='shipping'&&!\$\('generateMail'\)\.disabled\)\{generateDraft\(\);return;\}/);
});
