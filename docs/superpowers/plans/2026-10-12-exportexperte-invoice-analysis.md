# Exportexperte Rechnungsanalyse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die bestehende RC1294-Rechnungsanalyse zu einem sicheren, gruppierten ABD-Analysepfad erweitern, ohne den manuellen ABD-Prozess oder den Versandpfad zu verändern.

**Architecture:** Die vorhandene API `/api/abd-analysis` und `api/shared/abd-analysis.js` bleiben die technische Basis. Gruppierung, Kontrollsumme und Prüfstatus werden serverseitig als einzige fachliche Rechenquelle erzeugt; das Frontend rendert dieses Modell nur. PDF/Excel und die optionale Übergabe in den bestehenden ABD-Prozess konsumieren dasselbe Ergebnisobjekt.

**Tech Stack:** Node.js >=20, ESM, Azure Functions/API, Azure Blob Quarantäne, ExcelJS, bestehende PDF-Parser, Browser-JavaScript, Node Test Runner, bestehender ExportHUB Build/E2E-Stack.

**Spec:** `docs/superpowers/specs/2026-10-12-exportexperte-upgrade-design.md` und `docs/superpowers/specs/2026-10-12-exportexperte-upgrade-self-review.md`

## Global Constraints

- Bestehende Pfade „ABD manuell erstellen“ und „Aus Sendung erstellen“ bleiben fachlich und technisch erhalten.
- Neue Startauswahl ist nur Routing.
- Gruppierungsschlüssel ist ausschließlich `normalizedCommodityCode + normalizedOriginCountry`.
- Positionen ohne bestätigten HS-Code, bestätigtes Ursprungsland oder Warenwert bleiben `unassigned`.
- Keine stillschweigende Währungsumrechnung.
- UI, PDF, Excel und ABD-Übergabe verwenden dieselbe Gruppierungs- und Summenlogik.
- Kontrollsumme: `difference = invoiceTotal - groupedTotal`; Abweichung verhindert „vollständig geprüft“.
- PDF, gescannte PDF, JPG und PNG sind Pflichtformate; XLSX und CSV bleiben unterstützt.
- Servervalidierung, Quarantäne und Malware-Scan bleiben Pflicht.
- Fehlende Kopfdaten werden nicht erfunden.

## Review Focus

- Mehrere Rechnungen mit gleicher HS/Ursprung-Kombination dürfen nur innerhalb fachlich kompatibler Währung zusammengezählt werden.
- Eine Position mit unsicherem oder fehlendem HS-Code darf niemals als geprüfte Gruppe erscheinen.
- Eine Änderung von HS-Code/Ursprung/Wert muss Gruppen und Kontrollsumme deterministisch neu berechnen.
- JPG/PNG und gescannte PDFs müssen dieselben Sicherheitsgates durchlaufen wie PDF/XLSX/CSV.
- Der bestehende manuelle ABD- und Sendungs-Flow muss ohne Rechnungsanalyse unverändert weiter funktionieren.

---

### Task 1: Bestandsschutz-Verträge festschreiben

**Files:**
- Modify: `test/rc1294-abd-analysis.test.mjs`
- Modify/Create: `test/rc1499-exportexperte-bestandsschutz.test.mjs`
- Reference: `assets/rc1294-abd-self-service.js`
- Reference: bestehender ABD-UI-Code in `index.html` / Runtime-Modulen

**Interfaces:**
- Consumes: vorhandene DOM-IDs und Aktionen des manuellen ABD- und Sendungsflusses.
- Produces: Regressionstests, die diese Verträge vor jeder weiteren Änderung schützen.

- [ ] **Step 1: Write failing/contract tests**
  - Testname `manual_abd_flow_contract_remains_available`.
  - Assert: Kundensuche, Referenznummer, Empfängerland, Sprache, ABD-Empfänger, Colli-Funktionen, Outlook-Aktion, Mailtext-Kopie und Speichern bleiben auffindbar.
  - Testname `shipment_abd_flow_contract_remains_available`.
  - Assert: bestehender Einstieg aus Sendung und Datenübernahme bleiben auffindbar.

- [ ] **Step 2: Run the focused tests**
  - Run: `node --test --test-concurrency=1 test/rc1499-exportexperte-bestandsschutz.test.mjs`
  - Expected: PASS gegen den unveränderten Ausgangsstand oder klarer FAIL, falls der Vertrag schon verletzt ist.

- [ ] **Step 3: Freeze identifiers only where required**
  - Keine Umstrukturierung des Altflows; nur fehlende stabile Selektoren ergänzen, falls Tests sonst nicht robust formulierbar sind.

- [ ] **Step 4: Re-run focused tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "test: lock export expert ABD legacy flows"`

### Task 2: Server-seitiges Analysemodell und Gruppierungs-Engine

**Files:**
- Modify: `api/shared/abd-analysis.js`
- Modify: `test/rc1294-abd-analysis.test.mjs`

**Interfaces:**
- Consumes: normalisierte Rechnungspositionen aus bestehenden Parsern.
- Produces: `buildAbdAnalysis({ header, positions }) -> { header, positions, groups, unassigned, totals, review }` und `groupPositionsByHsOrigin(positions, currencyContext)`.

- [ ] **Step 1: Write failing grouping tests**
  - Gleicher HS + gleiches Land => eine Gruppe, Werte summiert.
  - Gleicher HS + anderes Land => zwei Gruppen.
  - Anderer HS + gleiches Land => zwei Gruppen.
  - Fehlender HS/Ursprung/Wert => `unassigned`.
  - Originalpositionen bleiben über IDs/Referenzen rückverfolgbar.
  - Unterschiedliche Währungen => keine stille Summierung; Review-Warnung.

- [ ] **Step 2: Run focused analysis tests**
  - Run: `node --test --test-concurrency=1 test/rc1294-abd-analysis.test.mjs`
  - Expected: FAIL wegen fehlender Gruppierungsfunktionen.

- [ ] **Step 3: Implement pure grouping functions**
  - Signatures: `normalizeCommodityCode(value)`, `normalizeOriginCountry(value)`, `groupPositionsByHsOrigin(positions, options)`, `calculateAnalysisTotals(header, groups, unassigned)`.
  - Keine UI- oder Persistenzabhängigkeit in diesen Funktionen.

- [ ] **Step 4: Run focused tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: group invoice positions for ABD"`

### Task 3: Kopfdaten und Kontrollsumme

**Files:**
- Modify: `api/shared/abd-analysis.js`
- Modify: `test/rc1294-abd-analysis.test.mjs`

**Interfaces:**
- Consumes: extrahierte Kopfdaten/Positionen.
- Produces: `header.invoiceNumber`, `invoiceDate`, `customer`, `recipient`, `destinationCountry`, `invoiceTotal`, `currency`; `totals.invoiceTotal`, `groupedTotal`, `difference`; `review`-Zähler.

- [ ] **Step 1: Write failing header/total tests**
  - Fehlende Kopfdaten bleiben `null`/leer, nie erfunden.
  - `groupedTotal` enthält nur zugeordnete, währungskompatible Gruppen.
  - `difference` ist exakt und ändert sich nach Positionsänderung.
  - Nicht-null Differenz verhindert vollständigen Reviewstatus.

- [ ] **Step 2: Run tests**
  - Expected: FAIL bis Header-/Totals-Modell vollständig ist.

- [ ] **Step 3: Implement total/review model**
  - Keine Fließkomma-Akkumulation ohne definierte Geldrundung; vorhandene Projektkonvention für Geld verwenden, sonst intern Minor Units oder konsistente Dezimalrundung festlegen.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: add invoice totals and review state"`

### Task 4: JPG/PNG und gescannte Dokumente sicher aufnehmen

**Files:**
- Modify: `api/abd-analysis/index.js`
- Create: `api/shared/abd-image-extraction.js` (nur wenn kein bestehender OCR-Adapter vorhanden ist)
- Modify: `assets/rc1294-abd-self-service.js`
- Modify: `test/rc1294-abd-analysis.test.mjs`

**Interfaces:**
- Consumes: Quarantäne-Blob nach erfolgreichem Defender-Status.
- Produces: Text/strukturierte Kandidaten im selben Format wie bestehende PDF-/Tabellenparser.

- [ ] **Step 1: Verify existing OCR capability before adding dependency**
  - Repository nach bestehendem Azure AI Document Intelligence/OCR-Adapter und Konfiguration durchsuchen.
  - Falls vorhanden: wiederverwenden. Falls nicht: neuen Adapter nur hinter expliziter Konfiguration einführen; kein Fake-OCR.

- [ ] **Step 2: Write failing format/security tests**
  - `.jpg`, `.jpeg`, `.png` accepted server-side after MIME/magic validation.
  - Malware pending/malicious path behaves identically to existing formats.
  - OCR unavailable => explicit review/error state, not fabricated analysis.

- [ ] **Step 3: Extend upload validation**
  - MIME + extension + content signature prüfen.
  - Client `accept` auf `.pdf,.jpg,.jpeg,.png,.xlsx,.csv` erweitern.

- [ ] **Step 4: Integrate OCR adapter**
  - Output normalized into existing extraction pipeline.

- [ ] **Step 5: Run tests**
  - `node --test --test-concurrency=1 test/rc1294-abd-analysis.test.mjs`
  - Expected: PASS.

- [ ] **Step 6: Commit**
  - `git commit -m "feat: support scanned invoice images securely"`

### Task 5: Start-Router und gruppierte Review-UI

**Files:**
- Modify: `assets/rc1294-abd-self-service.js`
- Create: `assets/rc1499-exportexperte-router.js` if a focused router module is cleaner than extending RC1294
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: `e2e/specs/navigation.spec.mjs`
- Create/Modify: `test/rc1499-exportexperte-ui.test.mjs`

**Interfaces:**
- Consumes: API result `{header, groups, unassigned, totals, review}`.
- Produces: three start choices and a grouped Review UI; no independent grouping math in browser.

- [ ] **Step 1: Write failing UI/E2E contracts**
  - Start choices: Manuell / Aus Sendung / Rechnung analysieren.
  - Manual choice reveals existing flow unchanged.
  - Invoice result primary list contains ABD groups, not article rows.
  - Details expand original positions.
  - Status chips: erkannt / prüfen / fehlt.
  - Copy buttons for HS, origin, value.

- [ ] **Step 2: Run focused tests**
  - Expected: FAIL for new router/group UI only.

- [ ] **Step 3: Implement router**
  - Routing only; do not duplicate or move existing manual/send logic.

- [ ] **Step 4: Replace article-first result rendering with group-first rendering**
  - Original articles remain detail-only.
  - `unassigned` gets a separate warning area.

- [ ] **Step 5: Run focused and navigation tests**
  - Expected: PASS; no console/runtime errors.

- [ ] **Step 6: Commit**
  - `git commit -m "feat: add grouped invoice review flow"`

### Task 6: Korrekturen und Re-Analyse im Review

**Files:**
- Modify: `assets/rc1294-abd-self-service.js`
- Modify: `api/shared/abd-analysis.js` only if a shared normalization helper is required
- Modify: `test/rc1499-exportexperte-ui.test.mjs`

**Interfaces:**
- Consumes: editable HS/origin/value fields for review-required positions/groups.
- Produces: corrected analysis state by invoking shared calculation logic/API contract; updated groups/totals/review.

- [ ] **Step 1: Write failing interaction tests**
  - Edit HS code causes regrouping.
  - Edit origin causes regrouping.
  - Edit value updates total/difference.
  - Suggested HS remains `prüfen` until explicit confirmation.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement corrections without client-side duplicate business rules**
  - Client sends corrected normalized inputs to the shared analysis endpoint/helper contract.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: review and correct ABD invoice groups"`

### Task 7: Übergabe an bestehenden ABD-Prozess

**Files:**
- Modify: `assets/rc1294-abd-self-service.js`
- Modify only the narrow ABD bridge module/function that already fills/saves ABD context
- Create/Modify: `test/rc1499-exportexperte-handoff.test.mjs`

**Interfaces:**
- Consumes: vollständig geprüfte `groups` plus invoice header/reference metadata.
- Produces: optional action `Neue ABD-Anfrage mit diesen Daten vorbereiten`; no direct replacement of legacy flow.

- [ ] **Step 1: Write failing handoff tests**
  - Action hidden/disabled while review incomplete or totals differ.
  - Action transfers only supported fields.
  - Grunddaten, Collis, Anhänge, Mailvorgang remain legacy components.

- [ ] **Step 2: Run tests**
  - Expected: FAIL for new bridge.

- [ ] **Step 3: Implement minimal bridge**
  - No automatic send/save.

- [ ] **Step 4: Re-run legacy and handoff tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: prepare ABD request from invoice analysis"`

### Task 8: PDF- und Excel-Ausgabe aus derselben Datenquelle

**Files:**
- Create: `api/shared/abd-analysis-export.js`
- Modify: `api/abd-analysis/index.js` or dedicated export endpoint following existing API patterns
- Modify: `assets/rc1294-abd-self-service.js`
- Create: `test/rc1499-abd-export.test.mjs`

**Interfaces:**
- Consumes: immutable analysis snapshot `{header, groups, unassigned, totals, review}`.
- Produces: PDF report and XLSX with sheet `ABD-Auswertung` and sheet `Rechnungsdetails`.

- [ ] **Step 1: Write failing export tests**
  - PDF contains one row/card per ABD group with HS, origin, grouped value, currency, count.
  - XLSX sheet 1 mirrors groups exactly.
  - XLSX sheet 2 contains original invoice positions.
  - Group totals in exports equal API/UI totals.

- [ ] **Step 2: Run export tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement export adapter over existing analysis snapshot**
  - No regrouping inside exporter.

- [ ] **Step 4: Run export tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: export grouped ABD analysis to PDF and Excel"`

### Task 9: Full regression, performance and release gate

**Files:**
- Modify: `e2e/specs/navigation.spec.mjs`
- Modify/Create: targeted release contract test for RC1499

**Interfaces:**
- Consumes: all previous tasks.
- Produces: evidence that the invoice-analysis slice is releasable without legacy regression.

- [ ] **Step 1: Add end-to-end scenarios**
  - CSV/XLSX/PDF/image upload.
  - Multiple invoices.
  - Grouping checksum.
  - Unassigned warning.
  - Manual ABD and from-shipment regression.

- [ ] **Step 2: Run focused tests**
  - `node --test --test-concurrency=1 test/rc1294-abd-analysis.test.mjs test/rc1499-exportexperte-bestandsschutz.test.mjs test/rc1499-exportexperte-ui.test.mjs test/rc1499-exportexperte-handoff.test.mjs test/rc1499-abd-export.test.mjs`
  - Expected: PASS.

- [ ] **Step 3: Run complete repository test suite**
  - `npm test`
  - Expected: PASS.

- [ ] **Step 4: Run release verification**
  - `npm run verify:release`
  - Expected: PASS.

- [ ] **Step 5: Check browser performance and payload regressions**
  - No repeated full-table rebuild on each keystroke; no unreleased blob URLs; no console errors.

- [ ] **Step 6: Commit evidence/docs if project convention requires it**
  - `git commit -m "test: verify export expert invoice analysis release"`
