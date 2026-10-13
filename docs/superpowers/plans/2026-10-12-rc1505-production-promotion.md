# RC1505 Production Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entkopple normale `main`-Integration vollständig von Production-Deployments und führe eine explizit bestätigte, SHA-feste manuelle Production-Promotion ein.

**Architecture:** Der bestehende RC1112-Main-Workflow bleibt für Build, Regression, TESTSERVICE und Demo zuständig und darf keinen Production-Token oder Production-Upload mehr ausführen. Ein neuer manueller Workflow `ExportHUB Production Release` checkt einen expliziten `release_sha` aus, verifiziert dessen Herkunft aus `main`, baut denselben RC1112-Stand reproduzierbar und deployt erst nach Bestätigung `PRODUCTION FREIGEBEN`; nachgelagerte Production-Workflows werden ausschließlich an diesen echten Production-Release gekoppelt.

**Tech Stack:** GitHub Actions YAML, Node.js 20, Node Test Runner, Bash, Playwright, Azure Static Web Apps Deploy Action.

**Spec:** `docs/superpowers/specs/2026-10-12-rc1505-production-promotion-design.md`

## Global Constraints

- Ein normaler Merge oder Push auf `main` darf Production nicht automatisch deployen.
- Production darf nur über `workflow_dispatch` des Production-Release-Workflows verändert werden.
- `confirm_production` muss exakt und case-sensitiv `PRODUCTION FREIGEBEN` entsprechen.
- `release_sha` ist Pflicht; Checkout, Guard, Build und Deploy verwenden exakt diesen SHA.
- Der freigegebene SHA darf nicht automatisch auf den neuesten `main`-Stand verschoben werden.
- TESTSERVICE/Demo und Production verwenden weiterhin dieselbe RC1112-Buildkette.
- Production-spezifische Secrets dürfen nur im manuellen Production-Workflow vorkommen.
- Stale-Deploy-Guards bleiben erhalten und werden auf die Promotion-Semantik angepasst.
- PR #679 bleibt während Implementierung und Verifikation **Draft**. Nicht `ready for review` setzen, kein Auto-Merge aktivieren und nicht mergen, bevor der Benutzer dies ausdrücklich freigibt.
- Während RC1505-Entwicklung keine Änderungen direkt auf `main` und kein Production-Deploy.

## Review Focus

- Ein `main`-Push mit deploy-relevanten Dateien darf keinen erreichbaren Production-Azure-Upload enthalten.
- Ein manueller Production-Dispatch mit falschem Bestätigungstext muss vor Checkout/Build/Deploy abbrechen.
- Ein gültiger, aber nicht von `main` erreichbarer SHA muss vor jedem Deploy abgewiesen werden.
- Nachgelagerte Workflows, die Production lesen oder verändern, dürfen nicht mehr auf den normalen Main-Workflow reagieren.
- Doppelte oder zeitlich überholte Production-Promotion darf keinen neueren Stand überschreiben; der Stale-Guard muss den explizit freigegebenen SHA schützen.

---

### Task 1: RC1505-Sicherheitsverträge zunächst rot machen

**Files:**
- Create: `test/rc1505-production-promotion.test.mjs`
- Read: `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml`
- Read: `.github/workflows/packmeldungen-production.yml`

**Interfaces:**
- Consumes: aktuelle Workflow-Dateien auf dem RC1505-Branch.
- Produces: statische Sicherheitsverträge für Main-Verifikation, manuellen Production-Release und Production-Folgejobs.

- [ ] **Step 1: Write the failing main/workflow contract tests**

Im neuen Test mindestens diese Assertions festlegen:
- Main-Workflow heißt künftig `ExportHUB RC1112 Main Verification`.
- Main-Workflow enthält `push` auf `main`, TESTSERVICE-Deploy und `deployment_environment: testservice`.
- Main-Workflow enthält **nicht** `AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310`.
- Main-Workflow enthält **nicht** `Deploy ExportHUB production`.
- `.github/workflows/exporthub-production-release.yml` existiert.
- Production-Workflow enthält `name: ExportHUB Production Release`, `workflow_dispatch`, Inputs `release_sha` und `confirm_production`.
- Production-Workflow enthält keinen `push:`-Trigger.
- Production-Workflow enthält den exakten Text `PRODUCTION FREIGEBEN` und das Production-Azure-Secret.

- [ ] **Step 2: Add SHA and downstream assertions**

Im selben Test festlegen:
- `release_sha` wird für Checkout/Ref und einen `git merge-base --is-ancestor`-Guard verwendet.
- Production-Workflow ruft `.github/rc1112/build-three-env.mjs` auf.
- `packmeldungen-production.yml` hört auf `ExportHUB Production Release` und nicht mehr auf `ExportHUB RC1112 Drei-Umgebungen Deploy`.
- Produktionsbezogene Follow-up-Workflows dürfen den alten Drei-Umgebungen-Workflow nicht mehr als Production-Ereignis verwenden.

- [ ] **Step 3: Run targeted tests and confirm RED**

Run:
```bash
node --test test/rc1505-production-promotion.test.mjs
```
Expected: FAIL, weil der neue Production-Workflow noch fehlt und der alte Main-Workflow Production noch enthält.

- [ ] **Step 4: Commit test-only RED state**

```bash
git add test/rc1505-production-promotion.test.mjs
git commit -m "test(rc1505): define safe production promotion contracts"
```

### Task 2: Main-Workflow auf Verifikation + TESTSERVICE/Demo begrenzen

**Files:**
- Modify: `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml`
- Modify: `test/rc1005-three-env-sync.test.mjs`
- Modify: `test/rc1018-production-deploy.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: RC1112 Buildkette und bestehende Main-Gates.
- Produces: Workflow `ExportHUB RC1112 Main Verification`, der einen getesteten Release-Kandidaten baut und TESTSERVICE/Demo verifiziert, aber Production weder Secret noch Upload zugänglich macht.

- [ ] **Step 1: Update historical tests to the new contract**

`test/rc1005-three-env-sync.test.mjs` und `test/rc1018-production-deploy.test.mjs` so ändern, dass sie nicht mehr den gemeinsamen Production-Deploy verlangen, sondern:
- gemeinsame RC1112-Buildbasis für Production-Kandidat, TESTSERVICE und Demo verlangen,
- TESTSERVICE-Deploy im Main-Workflow verlangen,
- Production-Deploy im Main-Workflow ausdrücklich verbieten,
- den neuen manuellen Production-Workflow als Production-Pfad verlangen.

- [ ] **Step 2: Run the migrated historical tests and confirm RED**

Run:
```bash
node --test test/rc1005-three-env-sync.test.mjs test/rc1018-production-deploy.test.mjs test/rc1505-production-promotion.test.mjs
```
Expected: FAIL gegen den noch ungetrennten Workflow.

- [ ] **Step 3: Rename and trim the Main workflow**

In `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml`:
- `name:` auf `ExportHUB RC1112 Main Verification` ändern.
- Build, Freigabevertrag, lokale Browser-Gates, TESTSERVICE-Deploy, Release-Center-Testaktivierung, TESTSERVICE-Browser-Gate und TESTSERVICE-Readiness behalten.
- `RC1381 PRODUCTION stale-deploy guard`, `Deploy ExportHUB production` und alle ausschließlich nach Production-Upload sinnvollen Schritte aus diesem Workflow entfernen.
- Kombinierte Live-Prüfungen, die Production und TESTSERVICE zusammen prüfen, so aufteilen, dass der Main-Workflow nur den TESTSERVICE-Anteil behält; Production-Anteile wandern in Task 3.
- Production-Azure-Secret vollständig aus dieser Datei entfernen.

- [ ] **Step 4: Update README release wording**

README so umstellen, dass der Standardpfad `main -> Main Verification -> TESTSERVICE/Demo` dokumentiert wird und Production auf `ExportHUB Production Release` verweist.

- [ ] **Step 5: Run targeted contracts**

Run:
```bash
node --test test/rc1005-three-env-sync.test.mjs test/rc1018-production-deploy.test.mjs test/rc1505-production-promotion.test.mjs
```
Expected: Main-spezifische Assertions PASS; Production-Workflow-bezogene Assertions dürfen bis Task 3 noch FAIL sein.

- [ ] **Step 6: Commit Main separation**

```bash
git add .github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml test/rc1005-three-env-sync.test.mjs test/rc1018-production-deploy.test.mjs README.md
git commit -m "refactor(rc1505): stop main workflow before production"
```

### Task 3: Manuellen, SHA-festen Production-Release implementieren

**Files:**
- Create: `.github/workflows/exporthub-production-release.yml`
- Modify: `test/rc1505-production-promotion.test.mjs`

**Interfaces:**
- Consumes: `release_sha:string`, `confirm_production:string`, RC1112 Buildkette, Production-Azure-Secret.
- Produces: Workflow `ExportHUB Production Release`, der exakt einen von `main` erreichbaren Commit reproduziert, Production deployt und die bisherigen Production-Live-Gates ausführt.

- [ ] **Step 1: Add failing confirmation and SHA-shape assertions**

`test/rc1505-production-promotion.test.mjs` erweitern:
- `confirm_production` ist required.
- `release_sha` ist required.
- Workflow enthält Guard `confirm_production != 'PRODUCTION FREIGEBEN'` bzw. logisch äquivalent und beendet dann vor Deploy.
- SHA wird als vollständiger Commit validiert und nicht durch `${{ github.sha }}` ersetzt.

- [ ] **Step 2: Create workflow_dispatch shell**

`.github/workflows/exporthub-production-release.yml` anlegen mit:
- Name `ExportHUB Production Release`.
- ausschließlich `workflow_dispatch`.
- Inputs `release_sha` und `confirm_production`, beide required.
- `contents: read`, `id-token: write` nur soweit bestehende Production-Readiness das benötigt.
- eigener Concurrency-Key `exporthub-production-release`, `cancel-in-progress: false`.

- [ ] **Step 3: Implement pre-deploy approval and provenance guards**

Vor Build/Deploy in dieser Reihenfolge prüfen:
1. `confirm_production` exakt `PRODUCTION FREIGEBEN`.
2. `release_sha` entspricht `/^[0-9a-fA-F]{40}$/`.
3. `git rev-parse "${release_sha}^{commit}"` existiert.
4. `origin/main` vollständig genug fetchen.
5. `git merge-base --is-ancestor "$release_sha" origin/main` ist erfolgreich.
6. Checkout exakt auf `release_sha`.
7. Nach Checkout `git rev-parse HEAD` exakt gegen Input vergleichen.

- [ ] **Step 4: Re-run release contracts on the selected SHA**

Mindestens:
```bash
node --test test/rc1505-production-promotion.test.mjs test/rc1005-three-env-sync.test.mjs test/rc1018-production-deploy.test.mjs
npm test
node .github/rc1112/build-three-env.mjs
```
Danach die bestehenden RC1112-Buildmarker für `dist-rc1112/index.html`, `TESTVERSION.html`, `demo.html` und `production-version.js` prüfen.

- [ ] **Step 5: Prepare production package from the selected SHA**

Die bestehende `.rc1112_production_app`-Paketlogik aus dem alten Main-Workflow unverändert übernehmen. Unmittelbar vor Upload erneut `git rev-parse HEAD == release_sha` prüfen.

- [ ] **Step 6: Move Production deploy and live gates**

In den manuellen Workflow verschieben:
- `RC1381 PRODUCTION stale-deploy guard`, angepasst auf den expliziten `release_sha`.
- `Deploy ExportHUB production` mit `AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310`.
- `RC1170 PRODUCTION Kundenportal-Verschlüsselung prüfen`.
- `RC1249 PRODUCTION AVIS-Mail-Konfiguration prüfen`.
- Production-Anteile der QR/POD-, Lieferavis-, Live-HTML-, Print-, Nur-Deckblatt-, Domain-, Login-, Historie-, Kunden-, Verpackungs- und Diagnose-Liveprüfungen, die bisher erst nach Production-Deploy sinnvoll waren.
- Production Read-only Browser Smoke.

- [ ] **Step 7: Add negative-path tests**

`test/rc1505-production-promotion.test.mjs` muss statisch belegen:
- falscher Bestätigungstext erreicht keinen Azure-Deploy-Schritt,
- SHA-Guard liegt vor Build und Deploy,
- Production-Secret kommt nur in `exporthub-production-release.yml` vor.

- [ ] **Step 8: Run targeted tests**

Run:
```bash
node --test test/rc1505-production-promotion.test.mjs test/rc1005-three-env-sync.test.mjs test/rc1018-production-deploy.test.mjs
```
Expected: PASS.

- [ ] **Step 9: Commit manual Production release**

```bash
git add .github/workflows/exporthub-production-release.yml test/rc1505-production-promotion.test.mjs
git commit -m "feat(rc1505): add explicit production promotion workflow"
```

### Task 4: Alle Production-Folgejobs an die echte Promotion koppeln

**Files:**
- Modify: `.github/workflows/packmeldungen-production.yml`
- Modify: `.github/workflows/rc1453-mail-cleanup.yml`
- Modify: `.github/workflows/rc1083-live-probe.yml`
- Modify: `.github/workflows/rc1137-state-compaction.yml`
- Modify: `.github/workflows/rc1267-state-backup.yml`
- Modify: `.github/workflows/rc1251-frame-protection.yml`
- Modify: `test/pack-notification-production.test.mjs`
- Modify: `test/rc1364-diagnostics-live-probe.test.mjs`
- Modify: `test/rc1453-mail-contamination-cleanup.test.mjs`
- Modify: `test/rc1137-state-maintenance.test.mjs`
- Modify: `test/rc1505-production-promotion.test.mjs`

**Interfaces:**
- Consumes: Workflow-Namen `ExportHUB RC1112 Main Verification` und `ExportHUB Production Release`.
- Produces: klare Trennung zwischen TESTSERVICE-Folgearbeiten nach Main-Verifikation und Production-Folgearbeiten nach manueller Promotion.

- [ ] **Step 1: Retarget production-only followers**

Folgende Workflows dürfen als Production-Ereignis ausschließlich `ExportHUB Production Release` abonnieren:
- `packmeldungen-production.yml`
- `rc1453-mail-cleanup.yml`

Ihre `if:`-Guards weiterhin auf erfolgreichen `workflow_run` begrenzen; alte Abhängigkeit vom RC1112-Drei-Umgebungen-Deploy entfernen.

- [ ] **Step 2: Split dual-environment live probe semantics**

`rc1083-live-probe.yml` auf beide Workflow-Namen hören lassen:
- nach `ExportHUB RC1112 Main Verification` nur TESTSERVICE prüfen,
- nach `ExportHUB Production Release` nur Production prüfen,
- manueller Dispatch darf weiterhin beide prüfen.

- [ ] **Step 3: Split state compaction semantics**

`rc1137-state-compaction.yml` ebenfalls auf beide Workflow-Namen routen:
- TESTSERVICE-Kompaktierung nur nach erfolgreicher Main-Verifikation,
- PRODUCTION-Kompaktierung nur nach erfolgreichem `ExportHUB Production Release`, nicht mehr als `needs: testservice` desselben Main-Ereignisses.

- [ ] **Step 4: Retarget release-triggered state backup**

`rc1267-state-backup.yml`:
- `schedule` und manuellen Dispatch unverändert behalten,
- `workflow_run`-Trigger auf `ExportHUB Production Release` umstellen, damit ein normaler Main-Merge keine automatischen Production-Backup-Schreibvorgänge mehr auslöst.

- [ ] **Step 5: Split frame-protection live semantics**

`rc1251-frame-protection.yml` behält `push`/`pull_request` für den statischen Security-Vertrag und hört beim `workflow_run` auf **beide** neuen Workflow-Namen:
- nach `ExportHUB RC1112 Main Verification` prüft der `live`-Job ausschließlich TESTSERVICE-Headers,
- nach `ExportHUB Production Release` prüft der `live`-Job ausschließlich Production-Headers,
- der `contract`-Job bleibt für `workflow_run` deaktiviert und läuft weiter nur auf `push`/`pull_request`.

Damit wird Production nicht mehr nach einem Main-Merge als „frisch deployed“ geprüft.

- [ ] **Step 6: Migrate follower tests**

Die zugehörigen Tests so ändern, dass sie die neuen Trigger-Namen und Environment-Routen exakt prüfen. `test/rc1505-production-promotion.test.mjs` zusätzlich alle `.github/workflows/*.yml` auf Production-Folgepfade prüfen lassen, die noch den alten Main-Deploy als Production-Signal verwenden; `rc1251-frame-protection.yml` muss dabei die getrennte TESTSERVICE-/Production-Liveprüfung belegen.

- [ ] **Step 7: Run follower contracts**

Run:
```bash
node --test --test-concurrency=1 \
  test/pack-notification-production.test.mjs \
  test/rc1364-diagnostics-live-probe.test.mjs \
  test/rc1453-mail-contamination-cleanup.test.mjs \
  test/rc1137-state-maintenance.test.mjs \
  test/rc1505-production-promotion.test.mjs
```
Expected: PASS.

- [ ] **Step 8: Commit downstream isolation**

```bash
git add .github/workflows/packmeldungen-production.yml .github/workflows/rc1453-mail-cleanup.yml .github/workflows/rc1083-live-probe.yml .github/workflows/rc1137-state-compaction.yml .github/workflows/rc1267-state-backup.yml .github/workflows/rc1251-frame-protection.yml test/pack-notification-production.test.mjs test/rc1364-diagnostics-live-probe.test.mjs test/rc1453-mail-contamination-cleanup.test.mjs test/rc1137-state-maintenance.test.mjs test/rc1505-production-promotion.test.mjs
git commit -m "fix(rc1505): route production followers through manual release"
```

### Task 5: Alte Release-Verträge und Dokumentation vollständig migrieren

**Files:**
- Modify as needed: tests returned by repository search for `ExportHUB RC1112 Drei-Umgebungen Deploy` and `Deploy ExportHUB production`
- Modify: `README.md`
- Modify as needed: release/runbook documentation that describes automatic Production promotion

**Interfaces:**
- Consumes: neue Workflow-Namen und Promotion-Semantik from Tasks 2–4.
- Produces: keine aktiven Tests oder aktuelle Betriebsdokumente, die einen normalen Main-Merge noch als Production-Freigabe behandeln.

- [ ] **Step 1: Search all active references**

Run:
```bash
git grep -n "ExportHUB RC1112 Drei-Umgebungen Deploy" -- . ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*'
git grep -n "Deploy ExportHUB production" -- . ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*'
```

Jeden Treffer klassifizieren. Aktive Workflow-/Test-/README-Verträge müssen migriert werden; bewusst historische Dokumente dürfen bleiben, wenn sie klar als historisch markiert sind.

- [ ] **Step 2: Update active contracts**

Mindestens bereits bekannte Treffer prüfen und bei Bedarf migrieren:
- `test/rc1005-three-env-sync.test.mjs`
- `test/rc1018-production-deploy.test.mjs`
- `test/rc1137-state-maintenance.test.mjs`
- `test/rc1364-diagnostics-live-probe.test.mjs`
- `test/rc1453-mail-contamination-cleanup.test.mjs`
- `test/pack-notification-production.test.mjs`
- `.github/workflows/rc1083-live-probe.yml`
- `.github/workflows/rc1453-mail-cleanup.yml`
- `.github/workflows/rc1137-state-compaction.yml`
- `.github/workflows/rc1267-state-backup.yml`
- `.github/workflows/rc1251-frame-protection.yml`
- `README.md`

- [ ] **Step 3: Verify no active old Production trigger remains**

Run the two `git grep` commands again. Expected: keine aktiven Workflow-/Test-/README-Treffer, die den alten Main-Workflow als Production-Freigabe behandeln.

- [ ] **Step 4: Commit contract/documentation migration**

```bash
git add test .github/workflows README.md docs
git commit -m "docs(rc1505): align release contracts with manual production promotion"
```

### Task 6: Vollständige RC1505-Verifikation ohne Production-Deploy

**Files:**
- Verify only; no production mutation.

**Interfaces:**
- Consumes: vollständiger RC1505-Branch.
- Produces: belegbarer Release-Gate-Stand für PR #679, weiterhin Draft.

- [ ] **Step 1: Run syntax and targeted safety checks**

```bash
node --test test/rc1505-production-promotion.test.mjs
node --test --test-concurrency=1 test/rc1005-three-env-sync.test.mjs test/rc1018-production-deploy.test.mjs test/pack-notification-production.test.mjs test/rc1364-diagnostics-live-probe.test.mjs test/rc1453-mail-contamination-cleanup.test.mjs test/rc1137-state-maintenance.test.mjs
```
Expected: PASS.

- [ ] **Step 2: Run full Node regression**

```bash
npm test
```
Expected: PASS, exit code 0.

- [ ] **Step 3: Run i18n verification**

```bash
npm run verify:i18n
```
Expected: PASS, exit code 0.

- [ ] **Step 4: Build the RC1112 three-environment artifacts locally**

```bash
node .github/rc1112/build-three-env.mjs
node .github/rc1121/verify-final-html.mjs
```
Expected: production candidate, TESTSERVICE and Demo artifacts build successfully without any Azure upload.

- [ ] **Step 5: Verify Production secret isolation**

```bash
git grep -n "AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310" -- .github/workflows
```
Expected: Production-Deploy-Secret nur in ausdrücklich manuellen Production-/Emergency-Workflows; niemals im automatischen Main-Verification-Workflow.

- [ ] **Step 6: Verify PR workflow gates on the final head**

Alle für PR #679 ausgelösten RC-Gates müssen auf demselben finalen Head erfolgreich abgeschlossen sein. Bei einem roten Gate Ursache beheben, Test ergänzen und erneut verifizieren.

- [ ] **Step 7: Keep PR draft and report evidence**

PR #679 bleibt Draft. Nicht `ready for review`, nicht mergen und kein Production-Workflow dispatchen. Abschlussbericht enthält:
- finalen Head-SHA,
- Ergebnis der targeted/full/i18n/build Verifikation,
- Liste der geänderten Workflows,
- Nachweis, dass Main keinen Production-Deploy/Production-Token mehr enthält,
- Hinweis, dass Production unverändert blieb.
