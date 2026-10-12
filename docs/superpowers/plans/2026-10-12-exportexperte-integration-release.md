# Exportexperte Upgrade Integration and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die vier Exportexperte-Teilpakete zusammenführen, verbliebene Querschnittsanforderungen absichern und erst nach vollständiger Regression als releasefähig einstufen.

**Architecture:** Dieser Plan implementiert keine parallele Fachlogik. Er ergänzt nur fehlende Querschnittsverträge, prüft die exakte Spec-Abdeckung und führt alle Teilmodule über gemeinsame Navigation, Fehlerzustände, Performance- und Release-Gates zusammen.

**Tech Stack:** Node.js >=20, ESM, Browser-JavaScript, bestehender ExportHUB Build/E2E/Node-Test-Stack.

**Spec:** `docs/superpowers/specs/2026-10-12-exportexperte-upgrade-design.md`, `docs/superpowers/specs/2026-10-12-exportexperte-upgrade-self-review.md`

## Global Constraints

- Keine Release-Freigabe bei ungeprüften P0/P1-Fehlern oder fehlgeschlagenen Bestandsschutztests.
- Kein „100 % fertig“, solange ein Pflichtformat, Pflichtpfad, Pflichtquelle oder Release-Gate ungeprüft ist.
- Alle Module müssen Desktop, Tablet und Smartphone unterstützen.
- Tastaturbedienung, sichtbare Fokuszustände sowie Lade-/Fehler-/Erfolgszustände sind Pflicht.
- Fehler in neuen Modulen dürfen den manuellen ABD-Prozess und den Sendungs-ABD-Prozess nicht blockieren.

## Review Focus

- Unvollständige Spec-Abdeckung trotz grüner Unit-Tests.
- Große Tabellen/Resultsets mit Layout-Overflow oder langsamer Neuberechnung.
- Fehlerzustände, die einen Altprozess blockieren oder Daten verlieren.
- Unterschiedliche Ergebnisse zwischen UI, PDF, Excel und KI-Kontext.
- Produktions-/Build-Integration, die lokal funktioniert, aber nicht in allen drei Umgebungen ausgeliefert wird.

---

### Task 1: Exakte Zollwissen-Taxonomie und Artikelstruktur absichern

**Files:**
- Modify: `data/customs-knowledge.json`
- Modify: `test/rc1501-customs-knowledge.test.mjs`

**Interfaces:**
- Consumes: Zollwissen-Datenmodell aus Plan `2026-10-12-exportexperte-customs-knowledge-updates.md`.
- Produces: vollständige Taxonomie und strukturierte Artikelfelder.

- [ ] **Step 1: Write taxonomy contract test**
  - Assert topics at minimum: ABD, Ausfuhranmeldung, Ausgangsvermerk, MRN, HS-Code, Zolltarifnummer, Warenursprung, Präferenzursprung, Nichtpräferenzieller Ursprung, Lieferantenerklärung, Ursprungszeugnis, Handelsrechnung, Proforma-Rechnung, Incoterms, EORI, ATLAS, AES, Ausfuhrbegleitdokument, Zollwert, Warenwert, Dual-Use, Sanktionen, Embargos, Länderinformationen, Schweiz, Großbritannien, USA, Türkei, China, EU/Drittland, typische Fehler bei Ausfuhren.
  - Assert major articles support sections: Was ist das?, Wann benötige ich das?, Welche Informationen brauche ich?, Was muss ich beachten?, Praxisbeispiel, Typische Fehler, Quellen, Stand der letzten fachlichen Prüfung.

- [ ] **Step 2: Run test**
  - Expected: FAIL until dataset structure covers all required topics.

- [ ] **Step 3: Complete structure only with reviewed content**
  - Missing factual content stays explicitly draft/unpublished; never invent facts to satisfy count.

- [ ] **Step 4: Run test**
  - Expected: PASS for structural coverage; draft articles remain excluded from published API.

- [ ] **Step 5: Commit**
  - `git commit -m "test: lock customs knowledge taxonomy"`

### Task 2: Exakte Zoll-Update-Kategorien absichern

**Files:**
- Modify: `api/shared/customs-knowledge.js`
- Modify: `test/rc1501-customs-knowledge.test.mjs`

**Interfaces:**
- Produces: allowed categories `Wichtig`, `Zollrecht`, `ATLAS`, `AES`, `Zolltarif`, `Sanktionen`, `Embargos`, `Länder`, `Verfahren`.

- [ ] **Step 1: Write failing category/source tests**
  - Published update must have one allowed category, source, publication date when source provides it, checkedAt, link/reference and affected area.
  - Preferred official-source class metadata can distinguish Zollverwaltung/EU/TARIC/official authority/legal source.

- [ ] **Step 2: Run test**
  - Expected: FAIL until exact categories are enforced.

- [ ] **Step 3: Implement category validation**

- [ ] **Step 4: Run test**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "test: enforce customs update categories"`

### Task 3: KI-Kontextfragen deterministisch aus Analyseobjekt beantworten

**Files:**
- Modify: `api/shared/customs-ai-context.js`
- Create/Modify: `api/shared/customs-ai-calculations.js`
- Modify: `test/rc1502-customs-ai-context.test.mjs`

**Interfaces:**
- Consumes: tatsächliches `invoiceAnalysis`-Objekt.
- Produces: deterministic helpers for common calculation questions before model phrasing.

- [ ] **Step 1: Write failing deterministic calculation tests**
  - Welche HS-Codes kommen vor?
  - Welche Ursprungsländer kommen vor?
  - Welche Gruppen müssen geprüft werden?
  - Warenwert für HS-Code X + Ursprung Y?
  - Warenwert aller Positionen mit Ursprung X?
  - Welche Positionen sind nicht zugeordnet?
  - Stimmt die Gruppensumme mit dem Rechnungswert überein?
  - Assertions must match actual groups/unassigned/totals, not free-text model guesses.

- [ ] **Step 2: Run test**
  - Expected: FAIL until deterministic calculation layer exists.

- [ ] **Step 3: Implement `answerAnalysisFactQuery(analysis, queryIntent)`**
  - Return structured facts; model may phrase them but may not recalculate them.

- [ ] **Step 4: Run test**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: ground customs AI in analysis calculations"`

### Task 4: Einheitliche Fehlerzustände

**Files:**
- Modify: invoice/history/knowledge/AI UI modules created in prior plans
- Create/Modify: `test/rc1503-exportexperte-errors.test.mjs`

**Interfaces:**
- Produces UI states for: ungültiger Dateityp, Datei zu groß, Malware, Scan ausstehend, OCR/Extraktion fehlgeschlagen, keine verwertbaren Positionen, HS fehlt, Ursprung fehlt, Warenwert fehlt, Kontrollsumme abweichend, Speichern fehlgeschlagen, Export fehlgeschlagen, keine Berechtigung.

- [ ] **Step 1: Write failing error-state tests**
  - Every error class has explicit user-facing state.
  - Recoverable errors provide retry/back path.
  - Legacy manual/send ABD controls remain available when new-module errors occur.

- [ ] **Step 2: Run tests**
  - Expected: FAIL for uncovered states.

- [ ] **Step 3: Implement shared error-state mapping where useful**
  - Do not centralize unrelated business logic.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "fix: unify export expert error handling"`

### Task 5: UI/UX and responsive contract

**Files:**
- Modify: all new Exportexperte asset modules as necessary
- Modify: `e2e/specs/navigation.spec.mjs`
- Create/Modify: `test/rc1503-exportexperte-responsive.test.mjs`

**Interfaces:**
- Produces: consistent responsive navigation and data layouts.

- [ ] **Step 1: Write UI contract tests**
  - Compact hierarchy; no unnecessary oversized cards.
  - Sticky table headers on desktop where tables are long.
  - Status chips and critical discrepancy states visible.
  - Progressive details.
  - No whole-page horizontal overflow; large tables stay in controlled scroll containers.
  - Keyboard focus visible; buttons expose loading/error/success states.
  - Navigation does not silently discard unsaved review state.

- [ ] **Step 2: Run tests/E2E at desktop/tablet/mobile viewports**
  - Expected: FAIL on any overflow/accessibility regression.

- [ ] **Step 3: Fix only failing layout/state contracts**

- [ ] **Step 4: Re-run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "fix: harden export expert responsive UX"`

### Task 6: PDF layout regression

**Files:**
- Modify: `api/shared/abd-analysis-export.js`
- Modify: `test/rc1499-abd-export.test.mjs`

**Interfaces:**
- Consumes: grouped analysis snapshot.
- Produces: readable PDF without clipped tables or overlapping elements.

- [ ] **Step 1: Add PDF layout tests/fixtures**
  - Long HS group list, long descriptions in detail appendix, multiple pages.
  - Assert pagination/layout metadata or deterministic generated structure prevents overlap/clipping.

- [ ] **Step 2: Run test**
  - Expected: FAIL if export layout cannot prove safe wrapping/page breaks.

- [ ] **Step 3: Fix pagination/wrapping**

- [ ] **Step 4: Re-run test**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "fix: prevent ABD export PDF overlap"`

### Task 7: Performance and resource cleanup

**Files:**
- Modify: new Exportexperte modules only where profiling identifies cost
- Create/Modify: `test/rc1503-exportexperte-performance.test.mjs`

**Interfaces:**
- Produces: bounded rendering/upload behavior and cleanup.

- [ ] **Step 1: Add measurable performance/resource contracts**
  - Search/filter does not full-render unrelated page areas on every keypress.
  - Repeated analysis does not accumulate polling timers/listeners/object URLs.
  - Large but allowed result sets remain bounded by controlled rendering strategy.
  - Module scripts are loaded once in three-env build.

- [ ] **Step 2: Run contracts and profile representative fixtures**

- [ ] **Step 3: Implement minimal optimizations based on evidence**

- [ ] **Step 4: Re-run contracts**
  - Expected: PASS with no functional regression.

- [ ] **Step 5: Commit**
  - `git commit -m "perf: harden export expert modules"`

### Task 8: Gesamt-Regression und Release Readiness

**Files:**
- Modify: `e2e/specs/navigation.spec.mjs`
- Create/Modify: `test/rc1503-exportexperte-release.test.mjs`

**Interfaces:**
- Consumes: all four implementation plans and all cross-cutting tasks.
- Produces: final release evidence; no automatic production deployment.

- [ ] **Step 1: Build requirement matrix test/checklist**
  - Map every numbered spec section to test(s) and implementation file(s).
  - Any unmapped mandatory requirement => release blocked.

- [ ] **Step 2: Run all targeted Exportexperte tests**
  - Expected: PASS.

- [ ] **Step 3: Run `npm test`**
  - Expected: PASS.

- [ ] **Step 4: Run `npm run verify:release`**
  - Expected: PASS.

- [ ] **Step 5: Run build/E2E for supported environments**
  - Verify modules are present in generated DEV/TEST/PROD builds as appropriate without deploying production.

- [ ] **Step 6: Produce final before/after report**
  - Include implemented, tests, performance findings, known limitations, unverified external dependencies (especially OCR/AI provider), and completion percentage that is <100% if anything remains unverified.

- [ ] **Step 7: Commit**
  - `git commit -m "test: complete export expert release audit"`
