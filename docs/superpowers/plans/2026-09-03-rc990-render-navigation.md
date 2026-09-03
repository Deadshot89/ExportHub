# RC990 Rendering, Fokus & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unnötige Vollrender reduzieren und Fokus, Scrollposition, Eingaben sowie echte Zurück-Navigation zuverlässig erhalten.

**Architecture:** RC950-Frame-Batching und RC975/RC976-Renderintegrität bleiben Grundlage. RC990 erweitert die vorhandene Snapshot-/Restore-Idee auf Navigation und Teilupdates, führt aber kein zweites Renderframework ein; bestehende View-/History-Pfade werden an ihrer aktiven Quelle korrigiert.

**Tech Stack:** Vanilla JavaScript/DOM APIs, requestAnimationFrame, History API, Node.js >=20, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-03-rc990-large-ux-design.md`

## Global Constraints
- Teiländerungen sollen keinen unnötigen Vollrender auslösen, wenn der bestehende DOM-Bereich gezielt aktualisiert werden kann.
- Fokus, Cursorposition, Eingabewert und Scrollposition müssen bei UI-Aktualisierungen erhalten bleiben, sofern das Element weiterhin existiert.
- Sichtbare Benutzereingaben dürfen nicht durch einen älteren Teamstand oder ein spätes Render überschrieben werden.
- F5 bleibt Reload und kein Logout.
- Mobile Navigation verwendet dieselben Zielansichten wie Desktop.
- Keine Fachänderungen an gespeicherten Sendungsdaten.

---

### Task 1: RED-Vertrag für Render-/Navigationsstabilität

**Files:**
- Create: `test/rc990-render-navigation.test.mjs`
- Existing tests: `test/rc975-global-render-integrity.test.mjs`, `test/rc976-render-fallback-recovery.test.mjs`
- Modify later: `TESTVERSION.html`

**Interfaces:**
- Produces: statische Verträge für `rc990CaptureUiState`, `rc990RestoreUiState`, View-History und deduplizierte Renderplanung.

- [ ] **Step 1: Failing tests schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('TESTVERSION.html','utf8');

test('RC990: UI-State Snapshot und Restore sind vorhanden',()=>{
  assert.match(html,/function\s+rc990CaptureUiState\s*\(/);
  assert.match(html,/function\s+rc990RestoreUiState\s*\(/);
});

test('RC990: Navigation besitzt einen echten View-Verlauf',()=>{
  assert.match(html,/rc990ViewHistory/);
  assert.match(html,/function\s+rc990RememberView\s*\(/);
  assert.match(html,/function\s+rc990BackView\s*\(/);
});

test('RC990: Renderplanung dedupliziert denselben Grund pro Frame',()=>{
  assert.match(html,/rc990RenderFrame|rc990ScheduleRender/);
  assert.match(html,/requestAnimationFrame/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-render-navigation.test.mjs`

Expected: FAIL for missing RC990 helpers.

- [ ] **Step 3: Existing render integrity baseline ausführen**

Run: `node --test test/rc975-global-render-integrity.test.mjs test/rc976-render-fallback-recovery.test.mjs`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/rc990-render-navigation.test.mjs
git commit -m "RC990 RED: Render Fokus und Navigation absichern"
```

### Task 2: Generischen UI-State-Snapshot auf vorhandenen Fokus-Erhalt aufbauen

**Files:**
- Modify: `TESTVERSION.html` (active render/patch orchestration near RC950 batching code; do not duplicate RC950 helpers unnecessarily)
- Test: `test/rc990-render-navigation.test.mjs`

**Interfaces:**
- Produces: `rc990CaptureUiState(root)` → `{winX,winY,rootTop,rootLeft,id,name,field,value,start,end}`; `rc990RestoreUiState(snapshot,root)` → boolean.

- [ ] **Step 1: Contract assertions für Eingabewert/Cursor ergänzen**

```js
test('RC990: UI Snapshot schützt Wert und Cursor',()=>{
  const fn=html.match(/function\s+rc990CaptureUiState[\s\S]{0,2600}?\n}/)?.[0]||'';
  for(const key of ['value','start','end','winY','rootTop']) assert.match(fn,new RegExp(key));
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-render-navigation.test.mjs`

- [ ] **Step 3: RC950 Snapshot-Funktion wiederverwenden/erweitern**

If `rc950PreserveActiveInput` / `rc950RestoreActiveInput` are still active, wrap or extend them instead of creating conflicting focus logic. RC990 may normalize a broader root and expose stable function names, but must preserve the same behavior for active shipment inputs.

- [ ] **Step 4: Restore erst nach DOM update, niemals vor dem Patch**

Use `requestAnimationFrame` after the existing render/patch completion. Restore value only when the element still corresponds to the same id/name/field and do not overwrite a newer user edit that occurred after snapshot capture.

- [ ] **Step 5: Tests ausführen**

Run: `node --test test/rc990-render-navigation.test.mjs test/rc975-global-render-integrity.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add TESTVERSION.html test/rc990-render-navigation.test.mjs
git commit -m "RC990: UI Zustand über Teilrender erhalten"
```

### Task 3: Unnötige Renderkaskaden deduplizieren

**Files:**
- Modify: `TESTVERSION.html`
- Test: `test/rc990-render-navigation.test.mjs`

**Interfaces:**
- Produces: `rc990ScheduleRender(reason, fn)`; at most one scheduled frame at a time, reasons merged for diagnostics only.

- [ ] **Step 1: Failing test für eine einzige Frame-Queue schreiben**

```js
test('RC990: Renderqueue besitzt genau einen Frame-Handle',()=>{
  const src=html.match(/var\s+rc990RenderFrame[\s\S]{0,2600}?function\s+rc990ScheduleRender[\s\S]{0,2600}?\n}/)?.[0]||'';
  assert.match(src,/if\s*\(rc990RenderFrame\)\s*return/);
  assert.match(src,/rc990RenderFrame\s*=\s*requestAnimationFrame/);
  assert.match(src,/rc990RenderFrame\s*=\s*0/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-render-navigation.test.mjs`

- [ ] **Step 3: Existing RC950 scheduler extendieren**

Do not route every operation through RC990. Only replace repeated synchronous calls to the same existing patch/render function where one frame can safely cover all requested updates. Preserve error reporting and loading status.

- [ ] **Step 4: Reine UI-Patches dürfen keine Save-Funktion aufrufen**

Add static assertion that the RC990 scheduler block does not contain `saveShipment`, state persistence, Azure write calls or `fetch` POSTs.

- [ ] **Step 5: Tests ausführen**

Run: `node --test test/rc990-render-navigation.test.mjs test/rc975-global-render-integrity.test.mjs test/rc976-render-fallback-recovery.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add TESTVERSION.html test/rc990-render-navigation.test.mjs
git commit -m "RC990: redundante Renderkaskaden pro Frame bündeln"
```

### Task 4: Echte View-History und Zurück-Verhalten implementieren

**Files:**
- Modify: `TESTVERSION.html`
- Test: `test/rc990-render-navigation.test.mjs`

**Interfaces:**
- Produces: `rc990RememberView(viewKey)`, `rc990BackView()`, bounded `rc990ViewHistory` array.

- [ ] **Step 1: History-Vertrag präzisieren**

```js
test('RC990: View-History vermeidet direkte Dubletten und ist begrenzt',()=>{
  const src=html.match(/rc990ViewHistory[\s\S]{0,3200}?function\s+rc990BackView[\s\S]{0,1800}?\n}/)?.[0]||'';
  assert.match(src,/\[rc990ViewHistory\.length-1\]/);
  assert.match(src,/splice|slice|shift/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-render-navigation.test.mjs`

- [ ] **Step 3: Nur erfolgreiche Hauptansichtswechsel merken**

Call `rc990RememberView` after the existing view switch has resolved a valid target. Do not add modal/dialog opens, internal card expands or render retries to history.

- [ ] **Step 4: Back uses previous valid view; browser back/popstate remains respected**

The ExportHUB back button should first use the previous app view. If no previous app view exists, retain the existing browser/history fallback. Do not force shipment/start view.

- [ ] **Step 5: Mobile/desktop share same view keys**

Do not create `mobile-*` copies of view identifiers. Add test assertion against separate RC990 mobile history arrays.

- [ ] **Step 6: Tests ausführen**

Run: `node --test test/rc990-render-navigation.test.mjs test/rc975-global-render-integrity.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add TESTVERSION.html test/rc990-render-navigation.test.mjs
git commit -m "RC990: echte Ansichtshistorie und Zurücknavigation stabilisieren"
```

### Task 5: Sendungserstellung gegen RC990-Regression schützen

**Files:**
- Modify only if needed: `TESTVERSION.html`
- Test: existing RC977–RC980 tests plus `test/rc990-render-navigation.test.mjs`

**Interfaces:**
- Consumes RC977 12px Colli font, RC978 container layout, RC979 density, RC980 fixed row geometry.
- Produces no new shipment business interface.

- [ ] **Step 1: RC977–RC980 als gemeinsamen Gate ausführen**

Run: `node --test test/rc977-colli-typography.test.mjs test/rc978-shipment-fluid-layout.test.mjs test/rc979-shipment-inner-density.test.mjs test/rc980-colli-row-stability.test.mjs`

Expected: PASS.

- [ ] **Step 2: Widersprüchliche ältere CSS/JS nur dann entfernen, wenn eine bestehende RC990-Regel dieselbe Verantwortung übernimmt**

No changes to `addRow`/serialization/calculation unless a regression demonstrates a direct render conflict. Do not change LDM/count/weight semantics.

- [ ] **Step 3: Combined tests ausführen**

Run: `node --test test/rc990-render-navigation.test.mjs test/rc977-colli-typography.test.mjs test/rc978-shipment-fluid-layout.test.mjs test/rc979-shipment-inner-density.test.mjs test/rc980-colli-row-stability.test.mjs`

Expected: PASS.

- [ ] **Step 4: Commit only if code changed**

```bash
git add TESTVERSION.html
git commit -m "RC990: Sendungsansicht gegen Renderregression absichern"
```
