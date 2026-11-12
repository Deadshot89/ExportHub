# SOP-Neuaufbau Phase 1 – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neues SOP-Modul `sop2` mit eigenem Speicher, Hash-Kette, Vier-Augen-Freigabe, Zweisprachigkeit (de/en), Import der Altinhalte als Entwürfe und Coverage-Dashboard auf echten Daten.

**Architecture:** Neue Azure-Function `api/sop-documents` (dünn) über reiner Logik in `api/shared/` (Hash-Kette, Regeln, Dienst, Speicher). Speicher: privater Blob je SOP und Umgebung, nicht im Team-State. Neue Oberfläche `assets/sop2/` neben dem alten System; das alte System bleibt bis Phase 4 unverändert.

**Tech Stack:** Node (Azure Functions, `node --test`), `@azure/storage-blob`, Vanilla-JS-Module, sechs Sprachpakete.

**Spec:** `docs/superpowers/specs/2026-11-07-sop-neuaufbau-design.md`

## Global Constraints
- SOP-Nummer `SOP-EH-<nnn>`; Status `draft → review → approved → archived`; je SOP genau **eine** gültige (letzte freigegebene) Version.
- Inhalt je Version in **Deutsch und Englisch** (Pflicht für Einreichung und Freigabe); beide Fassungen haben **dieselben Schritte** (ein Schritt trägt `de` und `en`); weitere Sprachen optional, Leser fällt auf Englisch zurück.
- Freigeber ist **nicht** der Autor der Version; Freigabe durch jede weitere Person mit SOP-Bearbeitungsrecht (`rights.sop`), kein Administrator nötig, kein Ausnahmeweg.
- Freigeber, Datum, Version setzt der **Server aus der Sitzung**; keine festen Freigabestempel im Code.
- Verlauf je SOP mit `seq`, `prevHash`, `hash` (SHA-256), nie überschrieben oder gelöscht; gebrochene Kette sperrt Schreibzugriffe.
- Speicher getrennt je Umgebung (`production`, `testservice`), Muster wie `quality-capa` (`isolationConfig`, `primaryConnection`).
- Importierte Altinhalte: Entwurfsversion `0.1`, Verlauf „importiert aus Handbuch RC1016, nicht freigegeben“, kein Stempel.
- Alter Handbuch-Code und seine Tests bleiben bis Phase 4 unverändert und grün (keine Tests abschwächen).
- Neue Oberflächentexte in de, en, pl, es, fr, it (`npm run verify:i18n` bzw. `node scripts/i18n-audit.mjs --strict` 0 Treffer).
- Vor jedem Commit jede geänderte Datei gegen `origin/main` diffen; breite Testgruppen nicht im Commit-Verzeichnis ausführen (Patch-Skripte schreiben Dateien um).
- Kein Merge, kein Deployment ohne ausdrückliche Freigabe von Deadshot89.

## Review Focus
1. Zwei Personen bearbeiten dieselbe SOP gleichzeitig → `409 CONFLICT`, keine verlorene Änderung (Task 3, 4).
2. Autor gibt eigene Version frei, auch mit anderer Schreibweise des Benutzernamens oder aus zweiter Sitzung → abgelehnt (Task 2, 5).
3. Eingereichte Version mit leerem Englisch oder HTML/Script in Texten → Einreichung abgelehnt bzw. Darstellung maskiert (Task 2, 7).
4. Beschädigter oder manipulierter Verlauf → Schreiben gesperrt, Anzeige „nicht integer“ (Task 1, 3).
5. Import: zweimal ausgeführt, von Nicht-Admin, zu groß, mit fremden Feldern → idempotent, 403, 413, Felder verworfen (Task 6).

## File Structure
| Datei | Verantwortung |
|---|---|
| `api/shared/hash-chain.js` | reine Hash-Kette (Ereignis anhängen, prüfen) |
| `api/shared/sop-rules.js` | reine Regeln: Status, Rechte, Vier-Augen, Zweisprachigkeit |
| `api/shared/sop-service.js` | reine Dokumentoperationen auf einem SOP-Objekt |
| `api/shared/sop-store.js` | Blob-Speicher je SOP, ETag-Wiederholung |
| `api/sop-documents/{function.json,index.js}` | HTTP, Sitzung, Aktionsverteilung |
| `assets/sop2/sop2-client.js` | Fetch-Schicht |
| `assets/sop2/sop2-reader.js`, `sop2-editor.js` | Leser (de/en) und Editor |
| `assets/sop2/sop2-coverage.js` | echte Daten → vorhandenes Dashboard `rc1506` |
| `assets/sop2/sop2-mount.js` | Einhängen in die SOP-Ansicht, Umgebungsschalter |
| `assets/i18n/sop2.js` | Texte, sechs Sprachen |
| `assets/sop2/legacy-en.json` | englische Entwurfsfassungen der 24 Altinhalte |
| `test/sop2-*.test.mjs` | Tests je Einheit |

PR-Schnitt: **PR 1** Tasks 1–5 (Backend), **PR 2** Tasks 6 und 11 (Import und Inhalt), **PR 3** Tasks 7–10 (Oberfläche), **PR 4** Task 12 (Doku).

---

### Task 1: Hash-Kette
**Files:** Create `api/shared/hash-chain.js`; Test `test/sop2-hash-chain.test.mjs`
**Interfaces — Produces:** `appendEvent(history: Event[], input: {action: string, actor: string, data?: object, at?: string}): Event` (gibt das neue Ereignis zurück, hängt nicht an); `verifyChain(history: Event[]): {ok: boolean, brokenAt: number}`; `Event = {seq, at, action, actor, data, prevHash, hash}`; erstes `prevHash` ist `'GENESIS'`.

- [ ] **Step 1: Tests** `test/sop2-hash-chain.test.mjs`: „Kette aus 5 Ereignissen ist ok“; „geänderter `actor` bricht bei seq 3 (`brokenAt` 3)“; „gelöschtes Ereignis, vertauschte Reihenfolge und geänderte `data` werden erkannt“; „Hash hängt nicht von der Schlüsselreihenfolge in `data` ab“; „leere Kette ist ok“.
- [ ] **Step 2:** `node --test test/sop2-hash-chain.test.mjs` → FAIL (Modul fehlt).
- [ ] **Step 3:** `hash-chain.js` implementieren; SHA-256 über `JSON.stringify([seq, at, action, actor, canonical(data), prevHash])`, `canonical` sortiert Schlüssel rekursiv.
- [ ] **Step 4:** Test → PASS. **Step 5:** Commit `feat(sop2): Hash-Kette`.

### Task 2: Regeln
**Files:** Create `api/shared/sop-rules.js`; Test `test/sop2-rules.test.mjs`
**Interfaces — Produces:** `STATUS = {DRAFT:'draft', REVIEW:'review', APPROVED:'approved', ARCHIVED:'archived'}`; `userKey(user): string` (kleingeschrieben, aus `user|login|username|name`); `canRead(user)`, `canEdit(user): boolean` (wie `quality-capa`: `isAdmin` oder `rights.sop` read/edit/level); `canApprove(user, version): boolean` (= `canEdit` und `userKey(user) !== userKey` des Autors **und** des letzten Bearbeiters der Version); `canTransition(from, to): boolean` (erlaubt: draft→review, review→draft, review→approved, approved→archived); `validateContent(content): {ok: boolean, errors: {code: string, part?: string, lang?: string, index?: number}[]}`.
Inhaltsform: `content = {de: {purpose, scope, responsibilities[], prerequisites[], checks[], deviations[], records[]}, en: {…gleich…}, steps: [{id, de, en, screenshot?, tourTarget?}]}`; Pflichtteile: purpose, scope, responsibilities, checks, records, mindestens ein Schritt; `validateContent` nennt jedes fehlende Pflichtfeld je Sprache (`EMPTY_PART`) und Schritte ohne `de` oder `en` (`STEP_LANG_MISSING`).

- [ ] **Step 1: Tests:** „Autor kann eigene Version nicht freigeben, auch bei `Anna.M` vs `anna.m`“; „letzter Bearbeiter kann nicht freigeben“; „zweite Person mit Bearbeitungsrecht kann, Leser nicht“; „kein Admin nötig“; „Statusübergänge nur wie erlaubt (z. B. draft→approved verboten)“; „leeres Englisch → `EMPTY_PART` mit `lang:'en'`“; „Schritt ohne `en` → `STEP_LANG_MISSING`“; „vollständiger Inhalt ist ok“.
- [ ] **Step 2:** Tests → FAIL. **Step 3:** `sop-rules.js` implementieren. **Step 4:** → PASS. **Step 5:** Commit `feat(sop2): Regeln`.

### Task 3: Speicher
**Files:** Create `api/shared/sop-store.js`; Test `test/sop2-store.test.mjs`
**Interfaces — Consumes:** `hash-chain.verifyChain`. **Produces:** `createStore(containerFor: (environment: string) => {container, prefix}): Store`; `Store.listDocs(env): Promise<SopDoc[]>`; `Store.getDoc(env, id): Promise<SopDoc|null>`; `Store.mutateDoc(env, id, updater: (doc|null) => SopDoc, options?: {create?: boolean}): Promise<SopDoc>` (ETag-Wiederholung bis 7, danach `CONCURRENT_UPDATE` 409; Schreiben verweigert mit `HISTORY_BROKEN` 409, wenn `verifyChain(doc.events)` fehlschlägt); `defaultStore(): Store` nutzt `isolationConfig/primaryConnection` wie `quality-capa`, Pfad `<prefix>sop2/docs/<id>.json`. `SopDoc = {schemaVersion:1, id, revision, area, functionId, title, versions: Version[], events: Event[]}`; `Version = {version, status, author, lastEditor, content, createdAt, updatedAt, submittedBy?, approvedBy?, approvedAt?}`.

- [ ] **Step 1: Tests** mit einem In-Memory-Container (Fake mit ETag): „anlegen und lesen“; „zwei parallele `mutateDoc` ergeben beide eine gültige Revision oder einen 409, nie einen verlorenen Schreibzugriff“; „manipulierter Verlauf → `HISTORY_BROKEN`“; „TESTSERVICE und Produktion verwenden getrennte Pfade“; „ungültige ID (`../x`) → 400“.
- [ ] **Step 2–4:** FAIL → implementieren → PASS (`id` muss `^SOP-EH-\d{3}$` entsprechen). **Step 5:** Commit `feat(sop2): Speicher`.

### Task 4: Dienst – Entwurf und Einreichung
**Files:** Create `api/shared/sop-service.js`; Test `test/sop2-service.test.mjs`
**Interfaces — Consumes:** Tasks 1–2. **Produces** (alle rein: nehmen `doc|null`, `input`, `user`, `now`, geben neues `doc` zurück, werfen `Error` mit `code` und `status`): `createDraft(null, {id, title, area, functionId, content?}, user, now)`; `updateDraft(doc, {revision, version, content?, title?}, user, now)` (nur Status draft, `revision` muss passen sonst 409); `submit(doc, {revision, version}, user, now)` (nur wenn `validateContent` ok, sonst 422 mit `errors`); `newVersion(doc, {revision}, user, now)` (kopiert die gültige Version als Entwurf `n+1`, Versionsnummer `major.minor` aufwärts).
Jedes Ereignis über `appendEvent` mit `actor = userKey`-Anzeigenamen aus der Sitzung; Autor wird bei Anlage gesetzt, `lastEditor` bei jeder Änderung.

- [ ] **Step 1: Tests:** „Anlage setzt Autor und Version `0.1` bzw. `1.0`, Status draft, Ereignis `CREATED`“; „Update mit alter `revision` → 409“; „Submit mit leerem Englisch → 422 und Fehlerliste, Status bleibt draft“; „Submit ok → Status review, `submittedBy`“; „Update einer eingereichten Version → 409 `NOT_DRAFT`“; „`newVersion` erzeugt Entwurf, gültige Version bleibt unverändert“; „Texte werden unverändert gespeichert (Maskierung erst beim Rendern)“.
- [ ] **Step 2–4:** FAIL → implementieren → PASS. **Step 5:** Commit `feat(sop2): Dienst Entwurf und Einreichung`.

### Task 5: Dienst – Freigabe, API
**Files:** Modify `api/shared/sop-service.js`; Create `api/sop-documents/function.json`, `api/sop-documents/index.js`; Modify `.github/rc1112/build-three-env.mjs` (Prüfzeile wie bei `quality-capa`, Zeile um 1901); Test `test/sop2-service.test.mjs`, `test/sop2-api.test.mjs`
**Interfaces — Produces:** `approve(doc, {revision, version}, user, now)` (nur Status review, `canApprove`, setzt `approvedBy/approvedAt` aus `user`/`now`; die bisher gültige Version wird `archived`, genau eine bleibt `approved`); `reject(doc, {revision, version, reason}, user, now)` (review→draft, `reason` ≥ 8 Zeichen); `archive(doc, {revision}, user, now)` (verlangt zweite Person wie `approve`). API: `POST /api/sop-documents` mit `action` ∈ `list|get|create|update|submit|approve|reject|new-version|archive`; `list` und `get` mit `canRead`, alle anderen mit `canEdit`; Antwort enthält `historyIntegrity: {ok, brokenAt}` je Dokument; Route `sop-documents`, nur `post`/`options`; `module.exports._test = {handle}`, damit Tests `handle(context, req, {store, auth})` ohne Azure aufrufen.

- [ ] **Step 1: Tests (Dienst):** „Autor freigeben → 403 `FOUR_EYES`“; „zweite Person gibt frei, `approvedBy` kommt aus der Sitzung, nicht aus der Anfrage“; „zweite Freigabe archiviert die vorherige Version, genau eine `approved`“; „`reject` ohne Begründung → 422“; „approve auf draft → 409“.
- [ ] **Step 2: Tests (API):** „ohne Sitzung 401“; „Leser darf `list`/`get`, nicht `create` (403)“; „Anfrage mit eingeschleustem `approvedBy` im Body wird ignoriert“; „unbekannte Aktion 400“; „OPTIONS → 204“; „Antwort enthält `historyIntegrity`“.
- [ ] **Step 3:** FAIL → implementieren → PASS. **Step 4:** `node --test test/sop2-*.test.mjs` und `node scripts/i18n-audit.mjs --strict` (0 Treffer). **Step 5:** Diff gegen `origin/main` prüfen, Commit, PR 1 öffnen.

### Task 6: Import der Altinhalte
**Files:** Modify `api/shared/sop-service.js`, `api/sop-documents/index.js`; Test `test/sop2-import.test.mjs`
**Interfaces — Produces:** Aktion `import-legacy` mit Body `{items: [{number, title, area, sections: {purpose, scope, responsibilities[], prerequisites[], checks[], deviations[], records[], steps[]}}], en?: {[number]: …}}` (der Browser liefert den geladenen Altkatalog, `api/` kann `assets/` nicht lesen); `importLegacy(existingIds: string[], payload, user, now): {docs: SopDoc[], skipped: string[]}`; nur `rights.sop`-Admin; Body ≤ 2 MB (413), ≤ 60 Einträge, unbekannte Felder verworfen, Zahlen nur `SOP-EH-\d{3}`; vorhandene IDs werden übersprungen; Version `0.1`, Status draft, Ereignis `IMPORTED` mit Text „importiert aus Handbuch RC1016, nicht freigegeben“; deutsche Texte aus `sections`, englische aus `en[number]` oder leer.

- [ ] **Step 1: Tests:** „zweiter Import überspringt alle und ändert nichts“; „Nicht-Admin → 403“; „2,1 MB → 413“; „61 Einträge → 400“; „Eintrag mit `status:'Freigegeben'`/`approvedBy` im Body → Felder verworfen, Version bleibt draft ohne Freigeber“; „Nummer `../x` → übersprungen mit Fehler“; „jeder Import trägt keinen Stempel“.
- [ ] **Step 2–4:** FAIL → implementieren → PASS. **Step 5:** Commit.

### Task 7: Client und Leser
**Files:** Create `assets/sop2/sop2-client.js`, `assets/sop2/sop2-reader.js`; Test `test/sop2-reader.test.mjs`
**Interfaces — Produces:** `Sop2Client = {list(): Promise<SopDoc[]>, get(id), act(action, payload)}` (Header wie `qualitaet.html`: `X-ExportHUB-Token`); `Sop2Reader.render(host: Element, {doc, version, lang: 'de'|'en'|…}): void` (Umschalter Deutsch/Englisch; Sprachen ohne Fassung fallen auf Englisch zurück; **alle Texte maskiert**); `Sop2Reader.pickLanguage(uiLang: string): 'de'|'en'`.

- [ ] **Step 1: Tests (vm mit Fake-DOM, Muster `test/customer-folder-redesign.test.mjs`):** „`<img onerror>`/`<script>` im Text erscheint als Text“; „pl → en, de → de“; „nur die gültige Version wird als gültig gekennzeichnet“; „Hinweis bei `historyIntegrity.ok === false`“.
- [ ] **Step 2–4:** FAIL → implementieren → PASS. **Step 5:** Commit.

### Task 8: Editor
**Files:** Create `assets/sop2/sop2-editor.js`; Test `test/sop2-editor.test.mjs`
**Interfaces — Produces:** `Sop2Editor.mount(host, {doc, version, user, client})`: zweispaltig Deutsch/Englisch, Schritte paarweise (Hinzufügen/Entfernen wirkt auf beide Sprachen), Knöpfe „Speichern“, „Zur Prüfung einreichen“, „Freigeben“, „Zurückweisen“ nach Status und `canApprove` (Freigeben für den Autor ausgeblendet); sendet immer die aktuelle `revision`; bei 409 Hinweis und Neuladen; Sperre bei ungespeicherten Änderungen wie `customer-folder-redesign.js`.

- [ ] **Step 1: Tests:** „Schritt hinzufügen erzeugt Felder in beiden Sprachen“; „Autor sieht kein Freigeben“; „409 zeigt Hinweis und lädt neu, Eingaben gehen nicht verloren (Entwurf bleibt im Formular)“; „Einreichen mit leerem Englisch zeigt die Fehlerliste des Servers“.
- [ ] **Step 2–4:** FAIL → implementieren → PASS. **Step 5:** Commit.

### Task 9: Coverage auf echten Daten
**Files:** Create `assets/sop2/sop2-coverage.js`; Test `test/sop2-coverage.test.mjs`
**Interfaces — Consumes:** `ExportHubSopFunctionRegistry.entries` (25), `ExportHubSopCoverageDashboard.mount(host, {documents, customers, onNavigate})` (Design unverändert). **Produces:** `toCoverageDocuments(docs: SopDoc[], registryEntries): LegacyLikeDoc[]` (gültige freigegebene Version → `status:'Freigegeben'`, sonst Entwurf/fehlend; Tour/Prüfung aus `rc1501`/`rc1503`, sonst fehlt); `Sop2Coverage.mount(host, {client, onOpen})`; „SOP öffnen“/„Schritt öffnen“ rufen `onOpen({number, stepId})` (öffnet Leser/Editor) statt Handbuch-Klick.

- [ ] **Step 1: Tests:** „keine SOPs → alle 25 ‚SOP fehlt‘“; „freigegebene SOP ohne Tour → ‚unvollständig‘“; „Entwurf zählt nicht als SOP vorhanden“; „Dashboard-Markup-Klassen unverändert (Struktur-Snapshot gegen `rc1506`)“.
- [ ] **Step 2–4:** FAIL → implementieren → PASS. **Step 5:** Commit.

### Task 10: Einhängen, Texte, Build
**Files:** Create `assets/sop2/sop2-mount.js`, `assets/i18n/sop2.js`; Modify `.github/rc1112/build-three-env.mjs` (Skript-Injektion und Kopierliste wie bei `shipment-error-report.js`), `staticwebapp.config.json` (Routen für neue Assets); Test `test/sop2-mount.test.mjs`
**Interfaces — Produces:** `ExportHubSop2.enabled(): boolean` = **nur TESTSERVICE und Demo** in Phase 1 (Produktion unverändert, Umschaltung in Phase 3); `ExportHubSop2.mount(sopView)`; ersetzt in der SOP-Ansicht die alte Oberfläche, wenn `enabled()`, über einen Wrapper um `ExportHubIsoSopUi.mount`; Menüname bleibt „SOP“; `assets/i18n/sop2.js`: `ExportHubSop2I18n.packs` mit de, en, pl, es, fr, it.

- [ ] **Step 1: Tests:** „Produktion → `enabled()` false, alte Oberfläche unverändert“; „TESTSERVICE → neue Oberfläche“; „alle sechs Sprachen haben gleiche Schlüssel und Platzhalter“; „Build-Skript injiziert und kopiert alle `assets/sop2/*` und das Sprachpaket“; „Routen in `staticwebapp.config.json` vorhanden“.
- [ ] **Step 2–4:** FAIL → implementieren → PASS; `node scripts/i18n-audit.mjs --strict` 0 Treffer. **Step 5:** Commit, PR 3 öffnen (Hinweis: nicht im Browser geprüft).

### Task 11: Englische Entwurfsfassungen der Altinhalte
**Files:** Create `assets/sop2/legacy-en.json`; Test `test/sop2-legacy-en.test.mjs`
**Interfaces — Produces:** `{ "SOP-EH-001": {title, purpose, scope, responsibilities[], prerequisites[], checks[], deviations[], records[], steps[]}, … }` für alle 24 konsolidierten Nummern; die Oberfläche übergibt sie als `en` an `import-legacy`.

- [ ] **Step 1: Test:** „alle 24 Nummern vorhanden; Schrittanzahl je SOP gleich der des deutschen Altbestands (Quelle: `assets/sop/rc1016-sop-consolidation.js`, im Test per `vm` geladen); keine leeren Texte; kein HTML“.
- [ ] **Step 2–4:** FAIL → Übersetzungen als Entwurf schreiben (fachliche Prüfung vor Freigabe nötig, im PR vermerken) → PASS. **Step 5:** Commit, PR 2 mit Task 6 öffnen.

### Task 12: Dokumentation
**Files:** Modify `docs/WORK_STATUS.md`; Create `docs/runbooks/sop2.md`
**Inhalt:** Speicherorte, Rechte (Lesen, Bearbeiten, Freigeben durch zweite Person), Umgebungsschalter, Import-Ablauf (Admin öffnet SOP, „Altinhalte importieren“), Hinweis auf Phasen 2 bis 4 und offene Entscheidung zum Training-Center-Katalog.

- [ ] **Step 1:** Dokument schreiben; `docs/PROJECT_MAP.md` um `sop2` und `api/sop-documents` ergänzen. **Step 2:** Commit, PR 4 öffnen.

## Nicht in Phase 1
Touren (Phase 2), Schulungsnachweis, Umstellung von Academy und Hilfe-Popups (Phase 3), Rückbau und Produktionsumschaltung (Phase 4), Screenshots.
