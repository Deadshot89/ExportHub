# RC990 Release Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release-Center-Bestätigungen ohne Scrollsprung ausführen, offene Änderungen aus einer konsistenten Quelle zählen und offene/veröffentlichte Einträge klar trennen.

**Architecture:** Die bestehende Release-Center-Logik in `TESTVERSION.html` bleibt fachlich maßgeblich. RC990 ergänzt eine kleine Zustandsbrücke für Scroll/Fokus/Änderungsanker und vereinheitlicht die Berechnung sichtbarer offener Änderungen mit dem Zähler; keine zweite Release-Quelle und keine neue Persistenzlogik.

**Tech Stack:** HTML/CSS/Vanilla JavaScript, Node.js >=20, `node:test`, GitHub Actions, Azure Static Web Apps.

**Spec:** `docs/superpowers/specs/2026-09-03-rc990-large-ux-design.md`

## Global Constraints
- Ausgangspunkt ist der geprüfte RC980-Stand auf `main`.
- Entwicklung und Veröffentlichung erfolgen ausschließlich im TESTSERVICE.
- Produktionsdateien werden nicht direkt durch ChatGPT verändert; Produktion bleibt an das Release Center gebunden.
- Keine D365-Integration oder direkte D365-Verknüpfung.
- Release- und Speicherlogik selbst bleibt fachlich unverändert.
- Mehrere Bestätigungen hintereinander dürfen keinen sichtbaren Sprung nach oben auslösen.

---

### Task 1: Release-Center-Quellen und Renderpfad exakt auditieren

**Files:**
- Create: `test/rc990-release-center.test.mjs`
- Inspect/Modify later: `TESTVERSION.html`

**Interfaces:**
- Consumes: bestehende Release-Center-Datenquelle und Bestätigungs-/Renderhandler in `TESTVERSION.html`.
- Produces: statischer Vertrag für RC990-Marker, Positionsspeicher, gemeinsamen offenen Datensatz und Trennung der Ansichten.

- [ ] **Step 1: Failing test mit Quellankern schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html', 'utf8');
const build = Number((html.match(/version:'RC(\d+)'/) || [])[1] || 0);

test('RC990: Build ist auf RC990 oder höher', () => {
  assert.ok(build >= 990, `gefunden RC${build}`);
});

test('RC990: Release Center besitzt einen expliziten Positionserhalt', () => {
  assert.match(html, /function\s+rc990CaptureReleaseViewport\s*\(/);
  assert.match(html, /function\s+rc990RestoreReleaseViewport\s*\(/);
  assert.match(html, /requestAnimationFrame[\s\S]{0,800}rc990RestoreReleaseViewport/);
});

test('RC990: sichtbare offene Änderungen und Zähler verwenden dieselbe Quelle', () => {
  assert.match(html, /function\s+rc990OpenReleaseChanges\s*\(/);
  assert.match(html, /rc990OpenReleaseChanges\([^)]*\)[\s\S]{0,1200}(?:length|\.map|\.forEach)/);
});
```

- [ ] **Step 2: Test ausführen und RED bestätigen**

Run: `node --test test/rc990-release-center.test.mjs`

Expected: FAIL bei Build/RC990-Helfern; bestehender RC980-Code darf unverändert weiter parsebar sein.

- [ ] **Step 3: Bestehende RC971–RC980-Baseline zusätzlich ausführen**

Run: `node --test test/rc971-global-form-field-standard.test.mjs test/rc972-field-exception-audit.test.mjs test/rc973-long-text-autogrow.test.mjs test/rc975-global-render-integrity.test.mjs test/rc976-render-fallback-recovery.test.mjs test/rc977-colli-typography.test.mjs test/rc978-shipment-fluid-layout.test.mjs test/rc979-shipment-inner-density.test.mjs test/rc980-colli-row-stability.test.mjs`

Expected: PASS; RC990 startet nicht auf einem bereits defekten Stand.

- [ ] **Step 4: Commit**

```bash
git add test/rc990-release-center.test.mjs
git commit -m "RC990 RED: Release Center Position und Zähler absichern"
```

### Task 2: Positionserhalt als isolierte Zustandsbrücke implementieren

**Files:**
- Modify: `TESTVERSION.html` (Build-Block um Zeile ~311; aktiver Release-Center-Bestätigungs-/Renderpfad)
- Test: `test/rc990-release-center.test.mjs`

**Interfaces:**
- Produces: `rc990CaptureReleaseViewport(root, changeKey)` → Snapshot-Objekt; `rc990RestoreReleaseViewport(snapshot, root)` → boolean.
- Snapshot shape: `{winX, winY, rootTop, rootLeft, activeId, changeKey}`.

- [ ] **Step 1: Test um den Snapshot-Vertrag erweitern**

```js
test('RC990: Snapshot enthält Fenster, Container, Fokus und Änderungsanker', () => {
  const block = html.match(/function\s+rc990CaptureReleaseViewport[\s\S]{0,1800}?\n}/)?.[0] || '';
  for (const key of ['winX','winY','rootTop','rootLeft','activeId','changeKey']) {
    assert.match(block, new RegExp(key));
  }
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-release-center.test.mjs`

Expected: FAIL für Snapshot-Vertrag.

- [ ] **Step 3: Minimalen Positionsspeicher implementieren**

Implementierungsform in `TESTVERSION.html`:

```js
function rc990CaptureReleaseViewport(root, changeKey){
  var active=document.activeElement;
  return {
    winX:Number(window.scrollX)||0,
    winY:Number(window.scrollY)||0,
    rootTop:root?Number(root.scrollTop)||0:0,
    rootLeft:root?Number(root.scrollLeft)||0:0,
    activeId:active&&active.id?String(active.id):'',
    changeKey:String(changeKey||'')
  };
}
function rc990RestoreReleaseViewport(snap,root){
  if(!snap)return false;
  var anchor=snap.changeKey&&document.querySelector('[data-release-change-key="'+CSS.escape(snap.changeKey)+'"]');
  if(anchor&&typeof anchor.scrollIntoView==='function')anchor.scrollIntoView({block:'nearest'});
  else window.scrollTo(snap.winX,snap.winY);
  if(root){root.scrollTop=snap.rootTop;root.scrollLeft=snap.rootLeft;}
  var active=snap.activeId&&document.getElementById(snap.activeId);
  if(active&&typeof active.focus==='function')active.focus({preventScroll:true});
  return true;
}
```

Do not add a global `scrollTo(0,0)` or unconditional `scrollIntoView({block:'start'})`.

- [ ] **Step 4: Den bestehenden Bestätigungspfad um Snapshot → Render → Restore wickeln**

Before the existing confirmation mutation:

```js
var rc990Viewport=rc990CaptureReleaseViewport(releaseRoot,stableChangeKey);
```

After the existing render has completed:

```js
requestAnimationFrame(function(){rc990RestoreReleaseViewport(rc990Viewport,releaseRoot);});
```

- [ ] **Step 5: Test ausführen**

Run: `node --test test/rc990-release-center.test.mjs`

Expected: PASS for position-contract tests.

- [ ] **Step 6: Commit**

```bash
git add TESTVERSION.html test/rc990-release-center.test.mjs
git commit -m "RC990: Release Center Position bei Bestätigung erhalten"
```

### Task 3: Offenen Zähler und sichtbare Liste auf eine Quelle vereinheitlichen

**Files:**
- Modify: `TESTVERSION.html`
- Test: `test/rc990-release-center.test.mjs`

**Interfaces:**
- Produces: `rc990OpenReleaseChanges(state)` → Array mit ausschließlich aktuell nicht veröffentlichten Änderungen.

- [ ] **Step 1: Failing assertions für Filterkriterien ergänzen**

```js
test('RC990: offene Release-Änderungen filtern veröffentlichte/duplizierte Einträge aus', () => {
  const fn = html.match(/function\s+rc990OpenReleaseChanges[\s\S]{0,2600}?\n}/)?.[0] || '';
  assert.match(fn, /published|released/i);
  assert.match(fn, /Set\(|seen|dedup/i);
  assert.match(fn, /return\s+out|return\s+.*filter/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-release-center.test.mjs`

Expected: FAIL until filter exists.

- [ ] **Step 3: Bestehende aktive Quelle kapseln, nicht kopieren**

Implement a single normalizer that receives the same array/state already used by the Release Center. Derive a stable key from existing change id/version/key fields, exclude published/released entries using the existing flags, and deduplicate with `Set`.

- [ ] **Step 4: Beide Verbraucher umstellen**

The open list renderer and the numeric badge/counter must both call `rc990OpenReleaseChanges(...)`. No second count from localStorage/cache/legacy array may remain active.

- [ ] **Step 5: Regression ausführen**

Run: `node --test test/rc990-release-center.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add TESTVERSION.html test/rc990-release-center.test.mjs
git commit -m "RC990: Release Center offene Änderungen konsistent zählen"
```

### Task 4: Offene, bestätigte und veröffentlichte Bereiche visuell trennen

**Files:**
- Modify: `TESTVERSION.html`
- Test: `test/rc990-release-center.test.mjs`

**Interfaces:**
- Produces: stabile DOM-Gruppen mit `data-release-group="open|confirmed|published"`; published group supports collapse state.

- [ ] **Step 1: Failing DOM/CSS assertions schreiben**

```js
test('RC990: Release Center trennt Statusgruppen und veröffentlichten Bereich einklappbar', () => {
  assert.match(html, /data-release-group=["']open["']/);
  assert.match(html, /data-release-group=["']confirmed["']/);
  assert.match(html, /data-release-group=["']published["']/);
  assert.match(html, /aria-expanded|details[\s>]/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-release-center.test.mjs`

- [ ] **Step 3: Bestehende Gruppen semantisch markieren und Published-Gruppe einklappbar machen**

Prefer existing buttons/details if present. Preserve all existing confirmation buttons and permissions. Do not alter persistence or release eligibility.

- [ ] **Step 4: Release-Center-Tests + Renderintegrität ausführen**

Run: `node --test test/rc990-release-center.test.mjs test/rc975-global-render-integrity.test.mjs`

Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add TESTVERSION.html test/rc990-release-center.test.mjs
git commit -m "RC990: Release Center Statusgruppen klar trennen"
```
