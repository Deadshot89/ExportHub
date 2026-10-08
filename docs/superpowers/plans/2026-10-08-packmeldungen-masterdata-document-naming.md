# ExportHUB360 Packmeldungen Master Data & Document Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die bestehende Packmeldung nutzt den ExportHUB-Kunden- und Verpackungsstamm, übernimmt Verpackungsmaße automatisch und benennt PDF-Lieferscheine auf der gesamten ExportHUB-Seite nur bei eindeutig erkannten DNC-/SIDE-Referenzen automatisch korrekt um.

**Architecture:** Kundensuche wird über eine stark eingeschränkte, rate-limitierte Public-Search-Action der bestehenden Pack-API bereitgestellt, die nur Kundennummer und Kundenname liefert; Freitext bleibt nach bewusster Bestätigung möglich. Verpackungsgrundmaße werden in einem kleinen gemeinsamen Katalog gekapselt und von Packmeldung und bestehender Sendungserfassung wiederverwendet. DNC/SIDE-Erkennung wird als zentrale, pure Dokument-Normalisierungslogik umgesetzt; Uploadpfade rufen sie vor dem Speichern auf, Druckdarstellungen verwenden nur eine separate Display-Funktion zum Entfernen von `.pdf`.

**Tech Stack:** Vanilla JavaScript/CSS, Node.js 20 Azure Functions, bestehender ExportHUB-State-/Blob-Store, `node:test`, Playwright E2E, keine D365-API.

**Spec:** `docs/superpowers/specs/2026-10-08-packmeldungen-design.md`

## Global Constraints

- Keine D365-API und keine D365-Anpassung.
- Der Packbereich bleibt loginfrei; er darf keine komplette interne Kundenliste oder andere interne Daten offenlegen.
- Kundensuche liefert nur minimale Trefferfelder: Kunden-ID, Kundennummer und Kundenname.
- Gibt es keinen passenden Kunden, darf Freitext nur nach ausdrücklicher Bestätigung übernommen werden.
- Packstücktypen der Packmeldung müssen dieselben kanonischen Bezeichnungen und Grundmaße wie die normale Sendungserfassung verwenden.
- Automatische Maße bleiben sichtbar und dürfen manuell korrigiert werden, wenn die tatsächliche Verpackung abweicht.
- PDF-Dateien werden nur bei eindeutig erkannter DNC- oder SIDE-Referenz umbenannt.
- DNC-Zielname: `DNC<Nummer>.pdf`; SIDE-Zielname: `SIDE<Nummer>.pdf`.
- Kein Treffer oder mehrdeutiger/widersprüchlicher Treffer: Originaldateiname bleibt unverändert.
- Der PDF-Inhalt darf durch die Umbenennung nicht verändert werden.
- Auf Deckblatt und Ladeliste wird die Dateiendung `.pdf` ausgeblendet; gespeicherter/downloadbarer Dateiname behält `.pdf`.
- Bestehende Nicht-PDF-Dateien und Dokumenttypen dürfen nicht umbenannt werden.
- Bestehende QR-, Aufgaben-, Sendungs-, AVIS-, Blob- und Druckprozesse müssen regressionsfrei bleiben.

## Review Focus

- **Kundendaten-Leak:** anonyme Suche darf nie den gesamten Kundenstamm liefern; kurze/leere Query muss abgewiesen bzw. leer beantwortet werden und Trefferzahl bleibt begrenzt. Test in Task 1.
- **Freitext-Verwechslung:** ein nicht ausgewählter Kundenname darf nicht stillschweigend als Stammdatenkunde gespeichert werden; er braucht den expliziten Freitext-Status. Test in Task 2.
- **False-positive Dokumentname:** Text mit mehreren unterschiedlichen DNC/SIDE-Referenzen darf niemals automatisch auf eine davon umbenannt werden. Test in Task 4.
- **Upload-Regression:** PDF-Normalisierung darf Daten/Blob-ID/MIME-Type nicht verändern und Nicht-PDF-Dateien nicht anfassen. Test in Task 5.
- **Druck/Download-Abweichung:** Deckblatt/Ladeliste zeigen `DNC...`/`SIDE...` ohne `.pdf`, Download bleibt `...pdf`. Test in Task 6.

---

## File Structure

**Create**
- `assets/packaging-catalog.js` — kanonische Verpackungsnamen und bekannte Grundmaße; pure Lookup-Funktionen ohne DOM.
- `assets/document-reference-normalizer.js` — pure DNC/SIDE-Referenzerkennung, sichere Zielnamensbildung und Druck-Displayname.
- `test/packaging-catalog.test.mjs` — Verpackungsnamen/Grundmaße und unbekannter Typ.
- `test/document-reference-normalizer.test.mjs` — DNC/SIDE-Erkennung, Ambiguität, kein Treffer, Displayname.
- `test/pack-notification-customer-search.test.mjs` — öffentliche, minimierte Kundensuche und Freitextvertrag.

**Modify**
- `api/pack-notification/index.js` — neue `customer-search`-Action mit Query-Mindestlänge, Trefferlimit und Minimalprojektion; bestehende Session/Submit-Logik bleibt unverändert.
- `pack.html` — Kunden-Suchliste/Bestätigungsstatus und Laden des gemeinsamen Verpackungskatalogs/Normalizers.
- `assets/pack-notification.js` — Kundenautocomplete, Freitextbestätigung, Verpackungsmaßübernahme, PDF-Normalisierung vor Aufnahme in `state.documents`.
- `assets/pack-notification.css` — Trefferliste, ausgewählter Kunde, Freitext-Warnung/Bestätigung.
- `test/pack-notification-page.test.mjs` — UI-Vertrag für Kundensuche, Freitext und automatische Maße.
- `test/pack-notification-api.test.mjs` — Public-Search-Sicherheitsvertrag.
- `test/pack-notification-shipment.test.mjs` — Kunden-/Verpackungsdaten und normalisierte Dokumentnamen bleiben beim Shipment-Prefill erhalten.
- `index.html` — gemeinsame Packaging-/Document-Normalizer-Assets laden; bestehende Sendungs-Uploadpfade rufen Normalizer vor dem Speichern auf; bestehende Verpackungsoptionen konsumieren den gemeinsamen Katalog am vorhandenen `rc682`-Packaging-UI-Anker.
- `TESTVERSION.html` — identische Integration wie `index.html`.
- `api/shared/document-blob-store.js` — nur falls nötig: normalisierten `name` unverändert durch Externalisierung/Hydrierung erhalten; keine Umbenennung im Blob-Store selbst.
- `test/rc1059-document-blob-store.test.mjs` — Dateiname über Blob-Roundtrip unverändert.
- `e2e/specs/shipment-create.spec.mjs` — Verpackungsgrundmaße und PDF-Name in regulärer Sendung.
- `e2e/specs/pack-notification.spec.mjs` — Kundensuche, Freitextfallback, Maße und PDF-Name im QR-Prozess.
- `e2e/specs/print-documents.spec.mjs` — Deckblatt/Ladeliste ohne `.pdf`, gespeicherte Datei weiterhin mit `.pdf`.

---

### Task 1: Sichere öffentliche Kundensuche

**Files:**
- Modify: `api/pack-notification/index.js`
- Create: `test/pack-notification-customer-search.test.mjs`
- Modify: `test/pack-notification-api.test.mjs`

**Interfaces:**
- Produces HTTP action: `POST /api/pack-notification?action=customer-search` body `{ stationToken, query }`.
- Response: `{ customers: Array<{ id:string, account:string, name:string }> }`.
- Mindestlänge: 2 nicht-leere Zeichen nach `trim()`.
- Trefferlimit: maximal 10.
- Suche case-insensitive über `account|customerNumber` und `name|customerName`.

- [ ] **Step 1: Write failing customer-search tests** asserting valid station token + `"bosch"` returns only `{id,account,name}`, empty/1-char query returns no records, invalid station token is rejected, and 30 matches are capped at 10.
- [ ] **Step 2: Run** `node --test test/pack-notification-customer-search.test.mjs test/pack-notification-api.test.mjs` and confirm the new tests fail because `customer-search` does not exist.
- [ ] **Step 3: Implement `customer-search`** inside the existing pack API using the persisted `state.customers` source and existing station-token/rate-limit path; do not expose addresses, contacts, emails, notes or arbitrary customer object fields.
- [ ] **Step 4: Run the focused tests** and require PASS.
- [ ] **Step 5: Commit** `feat: add safe pack customer search`.

---

### Task 2: Kundenautocomplete mit bestätigtem Freitext-Fallback

**Files:**
- Modify: `pack.html`
- Modify: `assets/pack-notification.js`
- Modify: `assets/pack-notification.css`
- Modify: `test/pack-notification-page.test.mjs`
- Modify: `test/pack-notification-shipment.test.mjs`

**Interfaces:**
- Pack client state gains `selectedCustomer:{id,account,name}|null` and `customCustomerConfirmed:boolean`.
- Submit payload keeps backward-compatible `customer` string and adds optional `customerId`, `customerAccount`, `customerSource:'master'|'manual'`.
- A master-data selection sets `customerSource:'master'`; manual text requires explicit confirmation and sets `customerSource:'manual'`.

- [ ] **Step 1: Add failing page tests** for debounced query after 2 characters, rendering name + customer number, selecting a result, clearing selection when text changes, and disabling submit for unmatched text until `Kunde trotzdem verwenden` is confirmed.
- [ ] **Step 2: Run** `node --test test/pack-notification-page.test.mjs test/pack-notification-shipment.test.mjs` and confirm RED for the new customer behavior.
- [ ] **Step 3: Implement autocomplete and confirmation UI** without exposing a full customer list and without changing the existing session/idempotency flow.
- [ ] **Step 4: Extend submit/detail/shipment-prefill metadata** so master customer IDs/account are preserved when present while manual customers remain valid strings.
- [ ] **Step 5: Run focused tests** and require PASS.
- [ ] **Step 6: Commit** `feat: add pack customer lookup and manual fallback`.

---

### Task 3: Gemeinsamer Verpackungskatalog und automatische Maße

**Files:**
- Create: `assets/packaging-catalog.js`
- Create: `test/packaging-catalog.test.mjs`
- Modify: `pack.html`
- Modify: `assets/pack-notification.js`
- Modify: `test/pack-notification-page.test.mjs`
- Modify: `index.html`
- Modify: `TESTVERSION.html`
- Modify: `e2e/specs/shipment-create.spec.mjs`

**Interfaces:**
- `window.ExportHubPackagingCatalog.list() -> Array<{key,label,length,width,height|null}>`.
- `window.ExportHubPackagingCatalog.get(keyOrLabel) -> entry|null`.
- Known existing dimensions must include: Düsseldorfer Palette `80×60`, Kunststoffpalette `122×116`, Industrie Palette `120×100`, Palettengestell `120×90`, Euro Palette/Einwegpalette `120×80`; unknown height remains `null` and is never invented.

- [ ] **Step 1: Write failing catalog tests** for the known canonical dimensions, aliases used by the existing shipment UI, and `null` for unknown packaging.
- [ ] **Step 2: Run** `node --test test/packaging-catalog.test.mjs test/pack-notification-page.test.mjs` and confirm RED because the shared catalog does not exist.
- [ ] **Step 3: Implement the pure catalog** and load it before both the Packmeldungsclient and existing shipment packaging UI.
- [ ] **Step 4: Replace the provisional Packstücktyp list** with catalog options; selecting/changing a type fills known length/width and only fills height when the catalog has a real height value. Existing manually changed dimensions remain editable.
- [ ] **Step 5: Wire the existing `rc682` packaging option source to the same labels/dimension lookup** without redesigning unrelated shipment code.
- [ ] **Step 6: Run Node tests plus the existing shipment-create Playwright packaging test** and require PASS.
- [ ] **Step 7: Commit** `feat: share packaging catalog with pack flow`.

---

### Task 4: Zentrale DNC/SIDE-Erkennung und sichere Dateinamen

**Files:**
- Create: `assets/document-reference-normalizer.js`
- Create: `test/document-reference-normalizer.test.mjs`

**Interfaces:**
- `extractDocumentReferences(text:string) -> Array<{type:'DNC'|'SIDE', number:string, canonical:string}>` returns unique canonical references in document order.
- `normalizedPdfName(originalName:string, extractedText:string) -> {name:string, renamed:boolean, reference:string|null, reason:'dncs'|'side'|'none'|'ambiguous'}`.
- `printDocumentName(name:string) -> string` strips a terminal `.pdf` case-insensitively for presentation only.
- Canonical result uses no separators: `DNC3019222063.pdf`, `SIDE250071282.pdf`.

- [ ] **Step 1: Write failing tests** covering `DNC3019222063`, `DNC 3019222063`, `DNC-3019222063`, `SIDE250071282`, `SIDE 250071282`, case variants, duplicate same reference, no reference, one DNC + one different SIDE, two different DNCs, non-PDF original name, and `.pdf` display stripping.
- [ ] **Step 2: Run** `node --test test/document-reference-normalizer.test.mjs` and confirm RED because the module does not exist.
- [ ] **Step 3: Implement pure extraction/normalization** so exactly one unique canonical reference permits rename; zero or more than one unique canonical reference preserves `originalName` exactly. Do not mutate binary content.
- [ ] **Step 4: Run focused tests** and require PASS.
- [ ] **Step 5: Commit** `feat: add DNC SIDE document name normalizer`.

---

### Task 5: DNC/SIDE-Normalisierung in allen PDF-Uploadpfaden

**Files:**
- Modify: `assets/pack-notification.js`
- Modify: `index.html`
- Modify: `TESTVERSION.html`
- Modify: `api/shared/document-blob-store.js` only if name preservation currently changes the supplied name.
- Modify: `test/pack-notification-page.test.mjs`
- Modify: `test/rc1059-document-blob-store.test.mjs`
- Modify: `e2e/specs/pack-notification.spec.mjs`
- Modify: `e2e/specs/shipment-create.spec.mjs`

**Interfaces:**
- Every browser-side PDF upload path calls one shared helper before building persisted document metadata.
- The helper receives the original `File`, extracts embedded PDF text, then calls `normalizedPdfName(...)`; non-PDF inputs bypass normalization.
- Persisted metadata keeps original binary/data URL/blob content, MIME type and document ID; only `name` may change.

- [ ] **Step 1: Add failing integration tests** proving a text PDF containing one DNC becomes `DNC....pdf`, one SIDE becomes `SIDE....pdf`, an unrelated PDF keeps its original name, an ambiguous PDF keeps its original name, and PNG/JPG names are untouched.
- [ ] **Step 2: Run focused Packmeldung/blob tests** and confirm RED at the upload integration boundary.
- [ ] **Step 3: Add one shared PDF text extraction adapter** used by Packmeldung and the regular ExportHUB upload handlers; keep parsing separate from `normalizedPdfName` so extraction failures degrade to `reason:'none'` and never fabricate a name.
- [ ] **Step 4: Route every existing PDF upload handler that creates shipment/document metadata through the adapter** before persistence; do not retrofit download-only viewers.
- [ ] **Step 5: Verify blob externalization/hydration preserves the supplied normalized `name` and byte payload unchanged.**
- [ ] **Step 6: Run focused Node tests and both Packmeldung + shipment upload E2E specs** and require PASS.
- [ ] **Step 7: Commit** `feat: normalize DNC SIDE names on pdf upload`.

---

### Task 6: Deckblatt und Ladeliste ohne `.pdf`

**Files:**
- Modify: existing print runtime in `index.html` at the delivery-note/packing-slip display mapping only.
- Modify: `TESTVERSION.html` at the identical mapping.
- Modify: `e2e/specs/print-documents.spec.mjs`
- Modify: `test/rc1293-packing-slip-wrap.test.mjs`

**Interfaces:**
- Print-only labels call `printDocumentName(document.name)`.
- Stored/downloaded `document.name` remains unchanged.

- [ ] **Step 1: Add failing print tests** with `DNC3019222063.pdf`, `SIDE250071282.pdf`, and `Lieferschein.pdf`, asserting deckblatt/loading-list text omits only the terminal `.pdf` while the source object still contains the original full filename.
- [ ] **Step 2: Run** `node --test test/rc1293-packing-slip-wrap.test.mjs` plus the focused Playwright print test and confirm the new assertion fails.
- [ ] **Step 3: Replace print-only filename rendering** with `printDocumentName(...)`; do not mutate document objects and do not change viewer/download labels outside the requested print surfaces.
- [ ] **Step 4: Run print regression tests** including long/many-document layout guards and require PASS.
- [ ] **Step 5: Commit** `fix: hide pdf extension on cover and loading list`.

---

### Task 7: End-to-End Regression und TESTSERVICE-Gate

**Files:**
- Modify: `e2e/specs/pack-notification.spec.mjs`
- Modify: `e2e/specs/shipment-create.spec.mjs`
- Modify: `e2e/specs/print-documents.spec.mjs`
- Modify: `.github/workflows/packmeldungen-branch-gate.yml` only to add the new focused tests if not already covered by wildcard.
- Modify: `.github/workflows/packmeldungen-testservice.yml` only to add the same focused tests if not already covered.

**Interfaces:**
- No new runtime interface; this task proves the complete data path.

- [ ] **Step 1: Extend E2E fixtures** with one known master customer, one manual customer, a known packaging type/dimension pair, one DNC PDF, one SIDE PDF and one unrelated PDF.
- [ ] **Step 2: Test Packmeldung master-customer flow**: search -> select -> packaging -> auto dimensions -> upload DNC -> submit -> task -> shipment, preserving customer identity and normalized filename.
- [ ] **Step 3: Test Packmeldung manual-customer flow**: unmatched text cannot submit before explicit confirmation, then submits successfully as `customerSource:'manual'`.
- [ ] **Step 4: Test regular shipment upload flow**: DNC/SIDE rename, unrelated PDF unchanged, download name with `.pdf`, cover/loading-list display without `.pdf`.
- [ ] **Step 5: Run** `node --test --test-concurrency=1 test/pack-notification-*.test.mjs test/document-reference-normalizer.test.mjs test/packaging-catalog.test.mjs test/rc1059-document-blob-store.test.mjs test/rc1293-packing-slip-wrap.test.mjs` and require all PASS.
- [ ] **Step 6: Run syntax checks** for changed assets/API and the existing Packmeldungen build gate.
- [ ] **Step 7: Run relevant Playwright specs** on TESTSERVICE; production remains untouched until this gate is green.
- [ ] **Step 8: Commit** `test: verify pack master data and document normalization`.
