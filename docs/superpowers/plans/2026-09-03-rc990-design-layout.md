# RC990 Design & Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ExportHUB über die Hauptbereiche sichtbar kompakter und konsistenter gestalten, ohne RC977–RC980 oder Fachlogik zu regressieren.

**Architecture:** Bestehende globale Formularregeln aus RC971 bleiben Baseline. RC990 führt einen kanonischen, eng begrenzten Design-Layer für Karten, Überschriften, Statuschips, Buttons und Abstände ein und entfernt/neutralisiert nur aktive widersprüchliche Altregeln; Colli bleibt dokumentierte Ausnahme mit 12px/42px.

**Tech Stack:** HTML/CSS/Vanilla JavaScript, CSS Grid/Container Queries, Node.js >=20, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-03-rc990-large-ux-design.md`

## Global Constraints
- RC977-Colli-Typografie bleibt bestehen: 12 px in den Colli-Feldern, 42 px Feldhöhe.
- RC978–RC980 bleiben funktionale Basis für responsives Sendungsraster, kompakte Innenhöhen und positionsstabile Colli-Zeilen.
- Karten dürfen sich an ihrer tatsächlichen Inhaltshöhe orientieren und sollen nicht künstlich gestreckt werden.
- Drag-&-Drop darf weder durch Designänderungen noch durch neue Animationen verlangsamt werden.
- Warncenter und Benachrichtigungscenter bleiben getrennte Systeme.

---

### Task 1: RED-Vertrag für das RC990-Designsystem

**Files:**
- Create: `test/rc990-design-system.test.mjs`
- Test existing: `test/rc971-global-form-field-standard.test.mjs`, `test/rc977-colli-typography.test.mjs`, `test/rc978-shipment-fluid-layout.test.mjs`, `test/rc979-shipment-inner-density.test.mjs`, `test/rc980-colli-row-stability.test.mjs`

**Interfaces:**
- Produces: statischer Vertrag für `#rc990-design-system`, kanonische Designvariablen und geschützte Colli-Ausnahme.

- [ ] **Step 1: Failing tests schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('TESTVERSION.html','utf8');

test('RC990: kanonischer Design-Layer existiert genau einmal',()=>{
  assert.equal((html.match(/id=["']rc990-design-system["']/g)||[]).length,1);
});

test('RC990: Designvariablen definieren kompakte Karten und Aktionen',()=>{
  assert.match(html,/--rc990-card-gap\s*:/);
  assert.match(html,/--rc990-card-pad\s*:/);
  assert.match(html,/--rc990-action-h\s*:/);
  assert.match(html,/--rc990-radius\s*:/);
});

test('RC990: Colli-Ausnahme bleibt 12px und 42px',()=>{
  assert.match(html,/#rc363BlockColli[\s\S]{0,2500}font-size\s*:\s*(?:var\(--rc977-colli-font\)|12px)/);
  assert.match(html,/#rc363BlockColli[\s\S]{0,2500}(?:height|min-height)\s*:\s*var\(--rc971-control-h\)/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-design-system.test.mjs`

Expected: FAIL for missing RC990 design layer.

- [ ] **Step 3: Bestehende Design-/Colli-Baseline ausführen**

Run: `node --test test/rc971-global-form-field-standard.test.mjs test/rc977-colli-typography.test.mjs test/rc978-shipment-fluid-layout.test.mjs test/rc979-shipment-inner-density.test.mjs test/rc980-colli-row-stability.test.mjs`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/rc990-design-system.test.mjs
git commit -m "RC990 RED: Designsystem absichern"
```

### Task 2: Kanonische Designvariablen und Kartenregeln einführen

**Files:**
- Modify: `TESTVERSION.html` (structural `<head>` style section only; never insert by naive last `</head>` search inside printable JS strings)
- Test: `test/rc990-design-system.test.mjs`

**Interfaces:**
- Produces CSS vars: `--rc990-card-gap`, `--rc990-card-pad`, `--rc990-action-h`, `--rc990-radius`, `--rc990-title-size`, `--rc990-muted-size`.

- [ ] **Step 1: Test um Scope-Schutz erweitern**

```js
test('RC990: Design-Layer greift nur Anwendungschrome und bekannte Karten an',()=>{
  const style=html.match(/<style id=["']rc990-design-system["'][^>]*>([\s\S]*?)<\/style>/)?.[1]||'';
  assert.doesNotMatch(style,/\.cmr-|#cmr|\.print-|signature|pod-signature/i);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-design-system.test.mjs`

- [ ] **Step 3: Einen einzigen Style-Layer mit klaren Werten implementieren**

Use values that stay close to existing RC971/RC979 geometry:

```css
#app{
  --rc990-card-gap:12px;
  --rc990-card-pad:14px;
  --rc990-action-h:40px;
  --rc990-radius:14px;
  --rc990-title-size:16px;
  --rc990-muted-size:12px;
}
```

Card-like application panels get `align-self:start`, no unconditional `height:100%`, compact consistent padding/gap, and existing border/background semantics preserved.

- [ ] **Step 4: Remove/neutralize active conflicting height/stretch declarations only where they target the same application cards**

Do not touch print/CMR/signature rules. Prefer deleting obsolete active selectors when safe; otherwise narrow them so the RC990 card selectors are canonical.

- [ ] **Step 5: Design tests + RC975 render-integrity ausführen**

Run: `node --test test/rc990-design-system.test.mjs test/rc975-global-render-integrity.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add TESTVERSION.html test/rc990-design-system.test.mjs
git commit -m "RC990: kanonisches kompaktes Designsystem einführen"
```

### Task 3: Hauptaktionen, Statuschips und responsive Breiten vereinheitlichen

**Files:**
- Modify: `TESTVERSION.html`
- Test: `test/rc990-design-system.test.mjs`

**Interfaces:**
- Produces: three action roles through existing classes/attributes: primary, secondary, destructive; responsive card widths based on available content/container width.

- [ ] **Step 1: Failing assertions für Aktionshierarchie schreiben**

```js
test('RC990: Aktionen besitzen eindeutige visuelle Rollen',()=>{
  const style=html.match(/<style id=["']rc990-design-system["'][^>]*>([\s\S]*?)<\/style>/)?.[1]||'';
  assert.match(style,/primary|data-action-role=["']primary/i);
  assert.match(style,/secondary|data-action-role=["']secondary/i);
  assert.match(style,/destructive|danger|data-action-role=["']destructive/i);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-design-system.test.mjs`

- [ ] **Step 3: Bestehende Buttonklassen semantisch gruppieren**

Do not rename event-bound IDs. Apply visual roles via existing classes or additive `data-action-role` attributes. Destructive actions keep red/error semantics; primary actions remain visually strongest; secondary actions reduce prominence without reducing hit area below the existing usable size.

- [ ] **Step 4: Responsive container rules ergänzen**

Use container/media rules that preserve RC978 shipment layout. At desktop, panels use available content width beside navigation; at tablet/smartphone, main actions wrap and remain fully visible. Do not set widths based on fixed viewport assumptions where a container width is available.

- [ ] **Step 5: Full layout regression ausführen**

Run: `node --test test/rc990-design-system.test.mjs test/rc971-global-form-field-standard.test.mjs test/rc972-field-exception-audit.test.mjs test/rc978-shipment-fluid-layout.test.mjs test/rc979-shipment-inner-density.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add TESTVERSION.html test/rc990-design-system.test.mjs
git commit -m "RC990: Aktionen und responsive Hauptlayouts vereinheitlichen"
```

### Task 4: Dashboard, Lager, Aufgaben, Warncenter und Benachrichtigungen harmonisieren

**Files:**
- Modify: `TESTVERSION.html`
- Test: `test/rc990-design-system.test.mjs`

**Interfaces:**
- Produces: shared card density while preserving existing drag handlers and separate warning/notification semantics.

- [ ] **Step 1: Failing assertions für getrennte Center schreiben**

```js
test('RC990: Warncenter und Benachrichtigungscenter bleiben getrennt markiert',()=>{
  assert.match(html,/Warncenter/i);
  assert.match(html,/Benachrichtigungscenter/i);
  assert.doesNotMatch(html,/rc990[^\n]{0,300}(?:merge|combine)[^\n]{0,100}(?:Warn|Benach)/i);
});
```

- [ ] **Step 2: Dashboard/Lager/Aufgaben auf gemeinsame Kartenvariablen umstellen**

Apply `--rc990-card-gap`, `--rc990-card-pad`, `--rc990-radius`; remove only unnecessary min-heights/stretching. Do not introduce layout animations on draggable cards.

- [ ] **Step 3: Center visuell differenzieren**

Warncenter: stronger warning/error affordance. Benachrichtigungscenter: neutral/informational affordance. Do not merge data arrays, counters, handlers or permissions.

- [ ] **Step 4: Drag-Schutz im Test ergänzen**

Assert known RC946 pointer/drag markers remain present and RC990 style contains no `transition: all` or long animation on draggable card selectors.

- [ ] **Step 5: Tests ausführen**

Run: `node --test test/rc990-design-system.test.mjs test/rc980-colli-row-stability.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add TESTVERSION.html test/rc990-design-system.test.mjs
git commit -m "RC990: Dashboard Lager und Aufgaben visuell harmonisieren"
```
