# RC995 QR-Abholung + Kunden-Avis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Development follows RED → GREEN → full verification.

**Goal:** QR-Abholung und Kunden-Avis auf einen gemeinsamen, serverseitig abgesicherten Public-Access-Vertrag umstellen und RC995 ausschließlich im TESTSERVICE veröffentlichen.

**Architecture:** Neuer umgebungsgetrennter Zugriffsspeicher mit ausschließlich gehashten Roh-Tokens; Pickup und Avis bleiben fachlich getrennte Zugriffstypen. Team-State erhält keine Link-Geheimnisse. Bestehende API-Pfade werden auf die neue Sicherheitslogik umgestellt. TESTVERSION erhält nur die dafür nötigen Client-/Druckanpassungen.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Azure Functions Node.js 20, Azure Blob Storage, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-04-rc995-qr-pickup-customer-avis-design.md`

## Globale Grenzen

- `production-version.js` bleibt byte-identisch RC990.
- Kein Produktionsdeploy.
- Keine D365-Integration.
- Keine parallele zweite QR-/Avis-Implementierung neben dem aktiven Pfad.
- POD erst nach Abholung.
- Kundenbestätigung ausschließlich auf Kunden-Avis.
- Öffentliche Antworten enthalten nur whitelisted Sendungsdaten.

### Task 1: RED-Vertrag + Audit

**Files:**
- Add: `.github/rc995/rc995-contract.test.mjs`
- Add: `.github/workflows/rc995-audit-red.yml`

- [ ] Bestehende QR-/Avis-/Druckanker in `TESTVERSION.html` ausgeben.
- [ ] RED-Assertions: gemeinsamer Public-Access-Store fehlt, Pickup speichert Roh-Token, Avis verwendet Team-State-Token, RC995-Druckmarker fehlt, Produktion ist weiterhin RC990.
- [ ] RED-Lauf muss wegen fehlender RC995-Verträge fehlschlagen, nicht wegen Testsyntax.

### Task 2: Gemeinsamen Public-Access-Store bauen

**Files:**
- Add: `api/shared/public-access-store.js`
- Modify: `api/shared/merge.js`

- [ ] Token serverseitig mit `crypto.randomBytes` erzeugen.
- [ ] Nur HMAC/SHA-256-Ableitungswert speichern; kein Roh-Token im Datensatz.
- [ ] `production`/`testservice` in Speicherpfad und Signatur binden.
- [ ] TTL, Revocation, One-time consume, Fehlversuche und temporäre Sperre zentral implementieren.
- [ ] Kurzlebige signierte Avis-Sitzung implementieren.
- [ ] Team-State-Sanitisierung entfernt bekannte Pickup-/Avis-Geheimfelder.

### Task 3: Pickup APIs auf RC995 umstellen

**Files:**
- Modify: `api/pickup-init/index.js`
- Modify: `api/pickup-status/index.js`
- Modify: `api/pickup-confirm-v2/index.js`
- Modify: `api/pickup-pod/index.js`
- Modify: `api/shared/pickup-store.js` soweit für umgebungsgetrennte Team-State-/POD-Verarbeitung erforderlich.

- [ ] Init erzeugt Zugriff serverseitig und liefert Raw-Token einmalig zurück.
- [ ] Status löst ausschließlich aktiven, passenden Pickup-Zugriff auf.
- [ ] Falsche PIN/Referenz zählt als Fehlversuch; Sperre wird serverseitig erzwungen.
- [ ] Bestätigung validiert persönliche PIN, Spedition, Kennzeichen, Soll-/Ist-Colli und Unterschrift.
- [ ] Bestätigung konsumiert Zugriff atomar und schreibt `Abgeholt` + tatsächlichen Zeitstempel + `Abholtag` erledigt.
- [ ] POD-Endpunkt verweigert Schreiben/Lesen vor bestätigter Abholung.

### Task 4: Kunden-Avis auf Einmal-Link umstellen

**Files:**
- Modify: `api/customer-avis/index.js`
- Modify: `customer-avis.html`

- [ ] Avis-Autorisierung liest Public-Access-Record statt Team-State-Token.
- [ ] Referenzprüfung konsumiert den Roh-Link genau einmal.
- [ ] Danach nur kurzlebige signierte Avis-Sitzung akzeptieren.
- [ ] Nur whitelisted Daten und freigegebene Dokumente ausliefern.
- [ ] Termin/Kundenbestätigung ausschließlich über die Avis-Session speichern.
- [ ] Deaktivieren/Reissue invalidiert alte Zugriffe.

### Task 5: TESTVERSION-Integration und Druck/PDF

**Files:**
- Modify: `TESTVERSION.html`

- [ ] Build auf RC995 setzen.
- [ ] Alte clientseitige Tokenpersistenz entfernen/neutralisieren; Init-/Avis-Ausstellung erwartet serverseitig erzeugten Token.
- [ ] Kundenbestätigung aus „Sendung erstellen“ entfernen.
- [ ] Empfängeradresse und physische Colli vollständig an Pickup-Init übergeben.
- [ ] QR nur im echten Druckpfad auf Ladeliste Seite 1 einfügen.
- [ ] QR kompakter darstellen.
- [ ] PDF-Pfad entfernt/ignoriert QR vollständig.

### Task 6: GREEN + Regression + TESTSERVICE

- [ ] `node --test test/rc995-public-access.test.mjs` → PASS.
- [ ] `node --test test/*.test.mjs` → PASS.
- [ ] `node --check` für alle geänderten API-JS-Dateien → PASS.
- [ ] `git diff --check` → PASS.
- [ ] Guard: `production-version.js` SHA/Inhalt unverändert RC990.
- [ ] RC995-Commit auf `main` aus Apply-Workflow erzeugen.
- [ ] ExportHUB TESTSERVICE Deploy muss RC995 live erkennen und API-Smoke-Checks bestehen.
- [ ] Produktionsworkflow darf durch RC995 nicht ausgelöst worden sein.
