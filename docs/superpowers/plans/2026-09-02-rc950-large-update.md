# RC950 Large Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ExportHUB TESTSERVICE als ein einziges RC950-Großrelease schneller, stabiler und berechenbarer machen, ohne QR-/Kunden-Avis-Fachlogik oder Produktionsdateien anzufassen.

**Architecture:** `TESTVERSION.html` bleibt die integrierte TESTSERVICE-Anwendung. RC950 repariert nur aktive Codepfade und ersetzt aktive defekte Blöcke direkt; keine zusätzlichen Reparatur-Overlays über alte Blöcke. Diagnose und Regression laufen über branch-lokale Python-Skripte/GitHub Actions, bevor RC950 nach `main` übernommen und einmalig deployed wird.

**Tech Stack:** HTML/CSS/Vanilla JavaScript, Python 3 für statische Regression/Audits, Node.js >=20 für vorhandene Repository-Tests, GitHub Actions, Azure Static Web Apps TESTSERVICE.

**Spec:** `docs/superpowers/specs/2026-09-02-rc950-large-update-design.md`

## Global Constraints

- App-Release ist genau `RC950`; keine Zwischen-RC wird deployed.
- Produktionsdateien `index.html`, `location.html`, `pickup.html` und Produktionskonfiguration werden nicht geändert.
- QR-Abholung und Kunden-Avis werden fachlich nicht verändert.
- Benachrichtigungscenter/Warncenter-Trennung aus RC918 bleibt unverändert.
- RC946 Pointer-Drag für Aufgaben/Lager bleibt Grundlage.
- Ab `Abgeholt` oder POD vorhanden bleibt die Sendung nicht bearbeitbar/speicherbar.
- Keine neuen Reparaturblöcke über alten aktiven Blöcken.

---

### Task 1: Aktive Pfade auditieren und RED-Regressionssuite anlegen

**Files:**
- Create: `.github/rc950_audit.py`
- Create: `.github/rc950_regression.py`
- Create: `.github/workflows/rc950-large-update-check.yml`
- Create: `docs/superpowers/rc950-audit.txt` (Workflow-Ausgabe)

**Interfaces:**
- Consumes: `TESTVERSION.html` auf `rc950-large-update`.
- Produces: Treffer/Umgebungen für Render, ResizeObserver, save/persist, print/PDF, Navigation/View, Suche, Colli, RC946 Drag; statische RC950-Akzeptanzprüfungen.

- [ ] **Step 1: RED-Test schreiben**

`rc950_regression.py` prüft mindestens:
```python
assert "version:'RC950',cache:'950',loginReturn:'/TESTVERSION.html?v=950'" in text
assert 'function rc950ScheduleLayout' in text
assert 'function rc950BusyBegin' in text
assert 'function rc950BusyEnd' in text
assert 'function rc950PreserveActiveInput' in text
assert 'rc946TaskPointer' in text
assert 'moveShipmentKey(' in text
assert 'exporthub-rc945-compact-stable-colli-layout' in text
```
Zusätzlich wird geprüft, dass keine native Task-/Warehouse-`draggable="true"`-Bindung zurückkehrt und dass die RC918-Texte zur Trennung Benachrichtigungen/Warncenter erhalten bleiben.

- [ ] **Step 2: RED ausführen**

Run: `python3 .github/rc950_regression.py`
Expected: FAIL am RC950-Buildmarker und mindestens einem fehlenden RC950-Helfer.

- [ ] **Step 3: Audit-Skript schreiben**

Das Skript liest `TESTVERSION.html`, zählt Vorkommen der folgenden Suchgruppen und schreibt jeweils den letzten aktiven Kontext in `docs/superpowers/rc950-audit.txt`:
```python
needles = [
  'function renderView', 'function render(', 'ResizeObserver',
  "addEventListener('resize'", 'requestAnimationFrame',
  'function persist(', 'function save', 'await persist',
  'window.print(', 'print(', 'PDF',
  'function navigate', 'viewchange', 'currentView', 'setView',
  'search', 'Suche', 'data-search',
  'exporthub-rc945-compact-stable-colli-layout', 'rc573ColliCard',
  'rc946TaskPointer', 'bindWarehouseDnD', 'moveShipmentKey('
]
```

- [ ] **Step 4: Auditworkflow ausführen und Ergebnis sichern**

Workflow führt `python3 .github/rc950_audit.py` und den RED-Test aus; der RED-Test darf in dieser Auditphase bewusst fehlschlagen, der Audit muss erfolgreich erzeugt werden.

---

### Task 2: Render-/Layout-Arbeit bündeln

**Files:**
- Modify: `TESTVERSION.html`
- Modify: `.github/rc950_regression.py`

**Interfaces:**
- Produces: `rc950ScheduleLayout(reason)` als einzige RC950-Schnittstelle für gebündelte Layout-Neuberechnung im berührten aktiven Pfad.

- [ ] **Step 1: Test ergänzen**

```python
assert 'function rc950ScheduleLayout(reason)' in text
assert 'cancelAnimationFrame(rc950LayoutFrame)' in text
assert 'requestAnimationFrame(function(){rc950LayoutFrame=0;' in text
```

- [ ] **Step 2: Test ausführen und erwartetes FAIL bestätigen**

- [ ] **Step 3: Aktive Mehrfach-Layoutaufrufe direkt ersetzen**

Implementierung:
```javascript
var rc950LayoutFrame=0;
function rc950ScheduleLayout(reason){
  if(rc950LayoutFrame)cancelAnimationFrame(rc950LayoutFrame);
  rc950LayoutFrame=requestAnimationFrame(function(){
    rc950LayoutFrame=0;
    // ruft nur die im Audit bestätigten bestehenden aktiven Layout-/Masonry-Funktionen einmal auf
  });
}
```
Direkte aufeinanderfolgende Aufrufe derselben aktiven Layoutfunktion in Resize-/Viewchange-Pfaden werden durch `rc950ScheduleLayout(...)` ersetzt; fachliche Renderfunktionen werden nicht umgangen.

- [ ] **Step 4: Regression GREEN**

---

### Task 3: Busy-Status für Speichern, Druck und PDF vereinheitlichen

**Files:**
- Modify: `TESTVERSION.html`
- Modify: `.github/rc950_regression.py`

**Interfaces:**
- Produces: `rc950BusyBegin(label)`, `rc950BusyEnd()`, `rc950WithBusy(label, fn)`.

- [ ] **Step 1: Test ergänzen**

```python
for marker in ['function rc950BusyBegin(label)','function rc950BusyEnd()','function rc950WithBusy(label,fn)']:
    assert marker in text
assert 'aria-busy' in text
```

- [ ] **Step 2: RED bestätigen**

- [ ] **Step 3: Bestehenden aktiven Arbeitsindikator direkt erweitern**

Die Helfer setzen/entfernen einen vorhandenen Status-/Busy-Host oder den im aktiven Pfad vorhandenen Ladeindikator. `rc950WithBusy` verwendet `Promise.resolve().then(fn).finally(rc950BusyEnd)` und erzeugt **keinen** zusätzlichen Persist-Aufruf.

Nur länger laufende aktive Save-/PDF-/Print-Einstiege werden damit umschlossen; lokale Eingaben, Drag und normale Viewwechsel bleiben ohne Overlay-Flash.

- [ ] **Step 4: GREEN bestätigen**

---

### Task 4: Sendungserstellung/Colli stabilisieren und Eingaben erhalten

**Files:**
- Modify: `TESTVERSION.html`
- Modify: `.github/rc950_regression.py`

**Interfaces:**
- Produces: `rc950PreserveActiveInput(root)` / `rc950RestoreActiveInput(snapshot, root)` für gezielte Re-Render im Sendungsbereich.

- [ ] **Step 1: Tests ergänzen**

```python
assert 'function rc950PreserveActiveInput(root)' in text
assert 'function rc950RestoreActiveInput(snapshot,root)' in text
assert 'exporthub-rc945-compact-stable-colli-layout' in text
assert 'overflow-anchor:none!important' in text
```

- [ ] **Step 2: RED bestätigen**

- [ ] **Step 3: Aktiven Sendungs-Re-Render absichern**

Snapshot enthält nur Fokusfeld, `selectionStart/selectionEnd`, `value`, Scrollposition des betroffenen Sendungscontainers und stabile Datenattribute/IDs. Nach dem bestehenden Render wird derselbe Fokus/Scroll wiederhergestellt, sofern das Element noch existiert. Fachliche Datenquelle bleibt unverändert.

- [ ] **Step 4: Colli-Layout nur im aktiven RC945-Block nachschärfen**

Keine zusätzliche CSS-Generation. Der bestehende Marker `exporthub-rc945-compact-stable-colli-layout` bleibt derselbe Block; Zeilenhöhe bleibt `auto`, `overflow-anchor:none`, Desktop-Grid bleibt 12 Spalten/2 Reihen und Mobile <=620 px bleibt einspaltig.

- [ ] **Step 5: GREEN bestätigen**

---

### Task 5: Navigation und Suche gegen View-Fallback/Verlust absichern

**Files:**
- Modify: `TESTVERSION.html`
- Modify: `.github/rc950_regression.py`

**Interfaces:**
- Bestehende Navigation/View-Funktionen bleiben öffentliche Schnittstelle; RC950 verändert nur aktiven Dispatch-/Fallback-Pfad.

- [ ] **Step 1: Test ergänzen**

Der statische Test bestätigt anhand der im Audit ermittelten aktiven Funktionsnamen, dass Such-Dispatch nicht pauschal die Sendungsansicht erzwingt und dass der aktive Viewname beim erneuten Render erhalten bleibt.

- [ ] **Step 2: RED oder Audit-Nachweis des Defekts sichern**

- [ ] **Step 3: Aktiven Dispatch direkt reparieren**

Unbekannte/fehlende Suchtreffer dürfen keinen Viewwechsel auslösen. Ein expliziter Menü-/Navigationsbefehl bleibt die einzige Quelle für Viewwechsel; Re-Render und Sync rendern die aktuell aktive View erneut.

- [ ] **Step 4: GREEN bestätigen**

---

### Task 6: RC946 Drag-Stabilität und Mobil/Desktop schützen

**Files:**
- Modify: `.github/rc950_regression.py`
- Modify: `TESTVERSION.html` nur falls Audit eine konkrete Kollision zeigt.

- [ ] **Step 1: Tests ergänzen**

```python
assert 'dx*dx+dy*dy<9' in text
assert "closest('button,input,select,textarea,a,label')" in text
assert 'moveTask(id,day.getAttribute' in text
assert 'moveShipmentKey(key,Number(zone.getAttribute' in text
assert 'pointercancel' in text
```

- [ ] **Step 2: RED nur bei echter Regression**

Wenn diese Tests bereits grün sind, wird RC946 nicht umgebaut.

- [ ] **Step 3: Nur erkannte Kollision reparieren**

Keine neue Drag-Generation. Änderungen erfolgen ausschließlich in den bestehenden `rc946TaskPointer`- bzw. Warehouse-Pointer-Handlern.

---

### Task 7: RC950 Gesamttest

**Files:**
- Modify: `.github/rc950_regression.py`
- Modify: `.github/workflows/rc950-large-update-check.yml`

- [ ] **Step 1: Statische RC950-Suite vollständig ausführen**

Run: `python3 .github/rc950_regression.py`
Expected: PASS.

- [ ] **Step 2: Repository Node-Tests ausführen**

Run: `npm test`
Expected: alle Tests PASS.

- [ ] **Step 3: Syntax-/Strukturcheck**

Python extrahiert die RC950-geänderten Inline-Script-Blöcke und lässt sie mit `node --check` prüfen. Zusätzlich werden doppelte RC950-Funktionsdefinitionen als Fehler gewertet.

- [ ] **Step 4: Audit-Nachkontrolle**

`rc950_audit.py` wird erneut ausgeführt; Bericht muss RC950-Marker, einmalige RC950-Helfer und erhaltene RC918/RC945/RC946-Marker bestätigen.

---

### Task 8: In main übernehmen und TESTSERVICE einmal deployen

**Files:**
- Merge branch: `rc950-large-update` -> `main`
- Modify only deployment trigger file if needed: `staticwebapp.testservice.config.json` semantisch unverändert.

- [ ] **Step 1: Branch-Diff gegen main prüfen**

Erlaubte Anwendungsänderung: `TESTVERSION.html`; Test-/Plan-/Auditdateien unter `.github/` und `docs/superpowers/`. Keine Produktions-HTML-Datei darf im Diff sein.

- [ ] **Step 2: RC950 nach main fast-forward/merge übernehmen**

- [ ] **Step 3: TESTSERVICE-Deploy auslösen**

Der bestehende Workflow `.github/workflows/exporthub-testservice-final-artifact-fix.yml` bleibt Deploymentweg.

- [ ] **Step 4: Live-Verifikation**

Deploy-Job muss in allen Runtime-/Security-/State-/Live-Schritten grün sein. Live `/TESTVERSION.html` und `/test` müssen `RC950` liefern.

- [ ] **Step 5: Temporäre Audit-Artefakte entfernen, dauerhafte Regression/Plan-Dokumentation behalten**
