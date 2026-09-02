# RC960 Kernbetrieb & Stabilität Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kernnavigation, Persistenz, Dokumentausgabe und Interaktionsperformance im TESTSERVICE stabilisieren, ohne RC945/RC946/RC950 zu regressieren.

**Architecture:** Die bestehende aktive Logik in `TESTVERSION.html` bleibt maßgeblich. Ein temporärer Audit extrahiert nur die tatsächlich aktiven Pfade; Änderungen erfolgen direkt an diesen Pfaden. RC960 verwendet die bestehenden Loading-, Frame-Batching- und Edit-Lock-Systeme statt neue Overlay-Generationen einzuführen.

**Tech Stack:** HTML/CSS/Vanilla JavaScript, Node.js 20, GitHub Actions, Azure Static Web Apps.

**Spec:** `docs/superpowers/specs/2026-09-02-rc960-large-update-design.md`

## Global Constraints
- Ausgangspunkt RC950 (`d6c20022926813ef1d1040c0e6f466573bb09f51`).
- Nur TESTSERVICE; keine Produktionsdateien direkt ändern.
- Keine Reparaturblöcke über alte Blöcke.
- RC945 Colli, RC946 Drag und RC950 Frame/Fokus-Optimierung müssen erhalten bleiben.
- QR/Avis nicht fachlich verändern.

---

### Task 1: Aktive Kernpfade auditieren

**Files:**
- Create: `.github/rc960_audit.py`
- Create: `.github/workflows/rc960-large-update-check.yml`
- Inspect: `TESTVERSION.html`

**Interfaces:**
- Consumes: RC950 HTML.
- Produces: eindeutige Treffer/Zeilenbereiche für Save/Autosave, Navigation, Dokumentausgabe, Suche, Kunden-/Dokumentladen, Patch/Render.

- [ ] **Step 1:** Audit-Skript erstellt Abschnitte um Tokens `save`, `autosave`, `operationStart`, `viewerDownload`, `print`, `pdf`, `cmr`, `shipmentsearch`, `showView`, `customer`, `documents`, `rc950ScheduleLayout`, `rc946TaskPointer`, `exporthub-rc945-compact-stable-colli-layout`.
- [ ] **Step 2:** Workflow auf Branch-Push ausführen und Audit-Log lesen.
- [ ] **Step 3:** Doppelte/alte aktive Listener oder synchrone Vollrenderpfade im Audit markieren; keine Änderungen vor Befund.

### Task 2: RED-Regressionsvertrag

**Files:**
- Create: `.github/rc960_regression.py`

**Interfaces:**
- Produces: statische Assertions für RC960 und Schutzmarker RC945/RC946/RC950.

- [ ] **Step 1:** Failing assertions für `RC960`, stabilen Arbeitsstatus, Navigation-Guard, Dokumentfehlerpfad und Erhalt der Schutzmarker schreiben.
- [ ] **Step 2:** `python .github/rc960_regression.py` ausführen; erwarteter Zustand vor Patch: FAIL wegen fehlendem RC960-Marker/RC960-Fixes.

### Task 3: Kernpfade direkt reparieren

**Files:**
- Modify: `TESTVERSION.html`
- Create: `.github/rc960_patch.py`

**Interfaces:**
- Consumes: Audit-Treffer.
- Produces: RC960 Buildmarker und direkte Korrekturen an aktiven Kernpfaden.

- [ ] **Step 1:** Version/Cache/Login-Return auf RC960 setzen.
- [ ] **Step 2:** Längere Kernaktionen an vorhandenes Loading-/Operation-System anbinden; keine neuen Speicheraufrufe erzeugen.
- [ ] **Step 3:** Navigation so korrigieren, dass nur die Zielansicht aktiv ist und der tatsächliche Ursprung für Zurück erhalten bleibt.
- [ ] **Step 4:** Kunden-/Dokumentladen gegen veraltete Antwortüberschreibung schützen; neuere lokale Revision gewinnt.
- [ ] **Step 5:** Druck/PDF/Ladeliste/CMR-Fehler sichtbar abschließen; Spinner/Busy-Status immer beenden.
- [ ] **Step 6:** Bestehendes RC950-Frame-Batching auch für neu gefundene synchrone Kern-Vollrenderpfade wiederverwenden.

### Task 4: GREEN und Baseline

- [ ] **Step 1:** `python .github/rc960_regression.py` → PASS.
- [ ] **Step 2:** `npm test` → alle bestehenden Tests PASS.
- [ ] **Step 3:** `git diff --check` → PASS.
- [ ] **Step 4:** Audit erneut ausführen; verbotene Altpfade dürfen nicht mehr aktiv sein.