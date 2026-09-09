# RC1016 SOP-Konsolidierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Den freigegebenen 75er-System-SOP-Katalog revisionssicher auf 24 vollständige RC1016-Arbeitsabläufe konsolidieren und echte RC1016-Demo-Screenshots statt künstlicher SVG-Screenshots verwenden.

**Architecture:** Der historische RC1008/RC1010-Katalog bleibt unverändert. Ein RC1016-Overlay erzeugt aus ihm 24 aktive v2.0-Dokumente, hält den 75er-Bestand als `legacyDocuments` und erweitert `reconcileCatalog`, damit gespeicherte Historie erhalten bleibt, aber der aktive Katalog nicht wieder auf 75 Dokumente anwächst. Echte PNG-Screenshots werden vom RC1016-Chromium-Test erzeugt und unter `assets/sop/screenshots` versioniert.

**Spec:** `docs/superpowers/specs/2026-09-09-rc1016-sop-consolidation-design.md`

## Task 1 – Konsolidierungsvertrag als RED-Test

**Files:**
- Create: `test/rc1016-sop-consolidation.test.mjs`

Der Test lädt Modell, RC1008-Katalog, RC1010-Freigabe und das neue RC1016-Overlay. Er verlangt 24 aktive Dokumente, 75 exakt einmal abgedeckte `combinedFrom`-Nummern, Version 2.0, Freigabestatus und erhaltene `legacyDocuments`.

Zusätzlich prüft er, dass aktive Screenshotquellen nicht mit `data:image/svg+xml` beginnen und dass Aufgaben sowie Abholkalender echte PNG-Quellen besitzen.

## Task 2 – RC1016-SOP-Overlay implementieren

**Files:**
- Create: `assets/sop/rc1016-sop-consolidation.js`

Das Overlay wartet auf RC1010-Katalog und Modell, bildet die 24 freigegebenen Arbeitsabläufe und dedupliziert Pflichtabschnitte. Schritte werden in fachlicher Reihenfolge aus den Quelldokumenten übernommen und mit stabilen RC1016-Step-IDs versehen.

Der neue Katalog enthält `version:'RC1016'`, `documents`, `legacyDocuments`, `legacyByNumber`, `combinedMap`, `byNumber` und `get(number)`.

## Task 3 – Reconcile revisionssicher erweitern

**Files:**
- Modify: `assets/sop/rc1016-sop-consolidation.js`
- Extend: `test/rc1016-sop-consolidation.test.mjs`

Beim Reconcile werden nur die 24 aktiven Nummern zurückgegeben. Historische Versionen und Audit-Einträge einer führenden SOP bleiben erhalten. Die kanonische RC1016-v2.0-Fassung wird ergänzt und als aktuelle freigegebene Version gesetzt, sofern keine echte spätere Benutzerfassung >2.0 existiert.

## Task 4 – RC1016-Build integrieren

**Files:**
- Modify: `.github/rc1016/build-three-env.mjs`
- Extend: `test/rc1016-release-sync.test.mjs`

Das Overlay wird in Produktion, TESTSERVICE und Demo nach RC1010-Freigabe geladen. Die Datei wird nach `dist-rc1016/assets/sop/` kopiert. Alle drei Umgebungen müssen dieselbe RC1016-SOP-Version laden.

## Task 5 – Echte Systembilder erzeugen

**Files:**
- Modify: `browser/rc1016-visual-functional.mjs`
- Create binary PNGs under: `assets/sop/screenshots/`

Der Browser-Test speichert sichere Desktop-Screenshots für Aufgaben, Sendungsübersicht und Abholkalender. Zusätzlich werden Dashboard, Sendungsmaske und SOP-Handbuch aufgenommen, sobald diese Ansichten navigierbar sind. Screenshots werden ohne echte Kundendaten erzeugt.

## Task 6 – Screenshots an SOP-Schritte binden

**Files:**
- Modify: `assets/sop/rc1016-sop-consolidation.js`

Die PNGs werden über `stepId` passenden aktiven SOPs zugeordnet. Mindestens SOP-EH-090 und SOP-EH-095 müssen eigene echte Bilder besitzen. Kein aktives Screenshot-Visual darf ein Data-URI-SVG sein.

## Task 7 – Vollständige Regression und Freigabe

**Files:**
- Modify: `.github/workflows/rc1016-development.yml`

Der Workflow prüft zusätzlich den RC1016-SOP-Vertrag. Anschließend laufen deterministische Gesamttests, Chromium und Drei-Umgebungen-Build. Erst wenn alles grün ist, wird der Branch auf `main` integriert und über den bestehenden gemeinsamen Drei-Umgebungen-Deploy veröffentlicht.
