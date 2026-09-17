# Kundenportal-Zugangsdaten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kundenspezifische externe Portal-Zugangsdaten sicher im ExportHUB-Kundenstamm verwalten und in „Sendung erstellen“ ausschließlich berechtigten Benutzern passend zum ausgewählten Kunden zur Verfügung stellen.

**Architecture:** Portal-Secrets werden nicht in `team-state.json` oder im Browser-State gespeichert, sondern in einem eigenen serverseitigen Azure-Blob. Ein dedizierter Azure-Function-Endpunkt liefert standardmäßig nur Metadaten und entschlüsselt Benutzername/Passwort erst nach gültiger Sitzung, `customerPortal.use`-Recht und erneuter Prüfung des persönlichen ExportHUB-Passworts. Die UI wird als isoliertes RC1148-Asset ergänzt und nur über kleine Integrationspunkte in `index.html` eingebunden.

**Tech Stack:** Vanilla JavaScript, Node.js >=20, Azure Functions, Azure Blob Storage, Node `crypto` AES-256-GCM, bestehende ExportHUB-Session-/Audit-Infrastruktur, Node Test Runner, Playwright-E2E.

**Spec:** `docs/superpowers/specs/2026-09-17-customer-portal-credentials-design.md`

## Global Constraints

- Portalzugänge gehören dauerhaft zum Kunden und niemals zur einzelnen Sendung.
- Mehrere Portalzugänge pro Kunde sind erlaubt.
- `customerPortal.use` steuert Anzeigen/Öffnen/Entschlüsseln; `customerPortal.manage` steuert Anlegen/Ändern/Löschen.
- Globale Administratoren besitzen beide Rechte automatisch.
- Benutzer ohne `customerPortal.use` sehen keine Kundenportal-Kachel in „Sendung erstellen“ und erhalten auch serverseitig keine Portal-Metadaten oder Secrets.
- Benutzername und Passwort dürfen nicht im Klartext in HTML, JavaScript-Bundles, LocalStorage, SessionStorage, `team-state.json`, Sendungen, allgemeinen Logs oder Auditdaten landen.
- Offenlegung erfordert immer die erneute Prüfung des persönlichen ExportHUB-Passworts des aktuell angemeldeten Benutzers.
- Kundenwechsel, Logout, Navigation oder Timeout entfernt offengelegte Klartextwerte sofort aus der UI.
- Bestehende Kunden-, Sendungs-, Login-, Rechte-, Lieferavis- und QR-Funktionen dürfen nicht regressieren.

---

### Task 1: Rechtevertrag für Kundenportal ergänzen

**Files:**
- Modify: `api/shared/user-policy.js`
- Modify: `index.html`
- Create: `test/rc1148-customer-portal-rights.test.mjs`

**Interfaces:**
- Consumes: bestehende `normalizeUser()`, `defaultRights()`, `normalizeRights()` und globale Admin-Erkennung.
- Produces: `rights.customerPortal` mit mindestens `use` und `manage` sowie UI-Helfer, die diese Rechte lesen, ohne generische Admin-Flags zu missbrauchen.

- [ ] **Step 1: RED-Test für neue Rechte schreiben**

Der Test lädt `api/shared/user-policy.js` und prüft:

```js
assert.equal(normalizeUser({ user: 'Normal', rights: {} }, 0).rights.customerPortal.use, false);
assert.equal(normalizeUser({ user: 'Normal', rights: { customerPortal: { use: true } } }, 0).rights.customerPortal.use, true);
assert.equal(normalizeUser({ user: 'Admin', globalAdmin: true }, 0).rights.customerPortal.use, true);
assert.equal(normalizeUser({ user: 'Admin', globalAdmin: true }, 0).rights.customerPortal.manage, true);
```

Zusätzlich statisch prüfen, dass `index.html` im Rechteeditor die Bezeichnungen `Kundenportal verwenden` und `Kundenportal verwalten` enthält.

- [ ] **Step 2: RED-Test ausführen**

Run:

```bash
node --test test/rc1148-customer-portal-rights.test.mjs
```

Expected: FAIL, weil `rights.customerPortal` noch nicht existiert.

- [ ] **Step 3: Rechte normalisieren**

In `api/shared/user-policy.js` ein separates Funktionsrecht ergänzen, ohne es als normales Navigationsmodul zu behandeln:

```js
function normalizeCustomerPortalRights(value, admin) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    use: admin || source.use === true || source.manage === true,
    manage: admin || source.manage === true
  };
}
```

`defaultRights(admin)` und `normalizeRights(value, admin)` müssen `result.customerPortal` damit befüllen. `publicUser()` übernimmt es über den bestehenden `rights`-Clone automatisch.

Im aktiven Rechteeditor von `index.html` zwei Checkboxen/Schalter unter einem Abschnitt `Kundenportal` ergänzen. `manage=true` setzt automatisch auch `use=true`; beim Entfernen von `use` muss `manage=false` werden.

- [ ] **Step 4: GREEN-Test ausführen**

Run:

```bash
node --test test/rc1148-customer-portal-rights.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Bestehende Rechte-Regressionen ausführen**

Run:

```bash
npm run test:security
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/shared/user-policy.js index.html test/rc1148-customer-portal-rights.test.mjs
git commit -m "feat(RC1148): add customer portal access rights"
```

---

### Task 2: Separaten verschlüsselten Portal-Credential-Store bauen

**Files:**
- Create: `api/shared/customer-portal-store.js`
- Modify: `api/local.settings.example.json`
- Create: `test/rc1148-customer-portal-store.test.mjs`

**Interfaces:**
- Consumes: `EXPORTHUB_STORAGE_CONNECTION_STRING` / `AzureWebJobsStorage` und neue serverseitige Konfiguration `EXPORTHUB_CUSTOMER_PORTAL_KEY`.
- Produces:
  - `listMetadata(customerId)` → Array ohne Klartext-Secrets.
  - `create(customerId, input, actor)` → Metadaten des neuen Portals.
  - `update(customerId, portalId, input, actor)` → Metadaten.
  - `remove(customerId, portalId)` → boolean.
  - `reveal(customerId, portalId)` → `{ username, password }` nur serverintern.
  - `error(code, message, status)` für konsistente API-Fehler.

- [ ] **Step 1: RED-Tests für Verschlüsselung und Kundentrennung schreiben**

Tests mit in-memory/mock Blob-Client oder exportierten Pure-Helpern prüfen:

```js
const encrypted = encryptSecret('user@example.test', fixedKey);
assert.notEqual(encrypted.ciphertext, 'user@example.test');
assert.equal(decryptSecret(encrypted, fixedKey), 'user@example.test');
```

Zusätzlich:
- Passwort und Benutzername tauchen nicht im serialisierten Metadatenobjekt auf.
- `listMetadata('KUNDE-A')` liefert niemals Portale von `KUNDE-B`.
- Manipulierter Auth-Tag führt zu `SECRET_DECRYPT_FAILED`.
- Portal-IDs sind zufällig/stabil und nicht aus Passwort/Benutzername abgeleitet.

- [ ] **Step 2: RED-Test ausführen**

```bash
node --test test/rc1148-customer-portal-store.test.mjs
```

Expected: FAIL, Modul fehlt.

- [ ] **Step 3: AES-256-GCM-Helfer implementieren**

`EXPORTHUB_CUSTOMER_PORTAL_KEY` wird als serverseitiges Geheimnis benötigt. Der Store leitet aus der konfigurierten Zeichenfolge einen 32-Byte-Schlüssel ab:

```js
const key = crypto.createHash('sha256')
  .update('ExportHUB/customer-portal/v1|' + configuredSecret)
  .digest();
```

Jedes Secret verwendet einen neuen 12-Byte-Nonce und speichert `{ v: 1, alg: 'aes-256-gcm', iv, tag, ciphertext }` base64url-codiert.

- [ ] **Step 4: Separates Blob-Dokument implementieren**

Default-Blob: `customer-portal-credentials.json`, überschreibbar über `EXPORTHUB_CUSTOMER_PORTAL_BLOB`.

Schema:

```js
{
  schemaVersion: 1,
  customers: {
    "<customerId>": [
      {
        id,
        name,
        url,
        usernameEncrypted,
        passwordEncrypted,
        note,
        active,
        createdAt,
        createdBy,
        updatedAt,
        updatedBy
      }
    ]
  }
}
```

`listMetadata()` entfernt `usernameEncrypted` und `passwordEncrypted` vollständig und liefert nur `hasUsername` / `hasPassword` als boolesche Statusfelder.

- [ ] **Step 5: Konfigurationsbeispiel ergänzen**

In `api/local.settings.example.json` nur den Namen des Secrets dokumentieren, niemals einen echten Schlüssel:

```json
"EXPORTHUB_CUSTOMER_PORTAL_KEY": "replace-with-azure-secret",
"EXPORTHUB_CUSTOMER_PORTAL_BLOB": "customer-portal-credentials.json"
```

- [ ] **Step 6: GREEN-Test ausführen**

```bash
node --test test/rc1148-customer-portal-store.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/shared/customer-portal-store.js api/local.settings.example.json test/rc1148-customer-portal-store.test.mjs
git commit -m "feat(RC1148): add encrypted customer portal store"
```

---

### Task 3: Geschützte Customer-Portal-API mit Re-Authentifizierung und Audit bauen

**Files:**
- Create: `api/customer-portal-credentials/function.json`
- Create: `api/customer-portal-credentials/index.js`
- Modify: `api/shared/auth-store.js` only if a small reusable session/current-password helper is required; otherwise consume existing exports unchanged.
- Create: `test/rc1148-customer-portal-api.test.mjs`

**Interfaces:**
- Consumes: `customer-portal-store`, bestehende ExportHUB-Session-Prüfung, `verifyCredential()`, `credentialOf()`, `addAudit()` und `mutateTeam()`.
- Produces one POST endpoint `/api/customer-portal-credentials` with actions:
  - `list` `{ customerId }`
  - `create` `{ customerId, portal: { name, url, username, password, note, active } }`
  - `update` `{ customerId, portalId, portal: {...} }`
  - `delete` `{ customerId, portalId }`
  - `reveal` `{ customerId, portalId, password }`

- [ ] **Step 1: RED-API-Vertragstests schreiben**

Mit Stubbed Auth/Store oder direkt importiertem Handler prüfen:

```js
assert.equal((await call({ action: 'list' }, noPortalRights)).status, 403);
assert.equal((await call({ action: 'create' }, useOnlyUser)).status, 403);
assert.equal((await call({ action: 'list', customerId: 'A' }, useUser)).status, 200);
assert.equal((await call({ action: 'reveal', customerId: 'A', portalId: 'P1', password: 'wrong' }, useUser)).status, 401);
```

Weitere Pflichtfälle:
- `reveal` mit korrektem persönlichem Passwort liefert genau einen Datensatz.
- `customerId=A + portalId` eines Kunden B liefert generisch 404/403 ohne Fremdmetadata.
- Response-Header enthalten `Cache-Control: no-store`.
- API-Fehler/Logs geben nie Portalpasswort oder Portalbenutzername aus.

- [ ] **Step 2: RED-Test ausführen**

```bash
node --test test/rc1148-customer-portal-api.test.mjs
```

Expected: FAIL, Endpoint fehlt.

- [ ] **Step 3: Session und Rechte serverseitig validieren**

Die Funktion muss die aktuelle ExportHUB-Sitzung genauso streng wie bestehende geschützte APIs validieren: Token vorhanden, Sitzung aktiv/nicht abgelaufen, Benutzer aktiv, `authVersion` passend, kein offener Passwortwechsel.

Rechtefunktion:

```js
function portalRights(user) {
  if (isAdmin(user)) return { use: true, manage: true };
  const r = user && user.rights && user.rights.customerPortal || {};
  return { use: r.use === true || r.manage === true, manage: r.manage === true };
}
```

`list`/`reveal` benötigen `use`; `create`/`update`/`delete` benötigen `manage`.

- [ ] **Step 4: Re-Authentifizierung für `reveal` implementieren**

Das eingegebene Passwort wird ausschließlich gegen `credentialOf(currentUser)` mit `verifyCredential()` geprüft. Es darf nicht in Audit, Error-Objekten oder Console-Logs landen. Bei Fehler: generische Meldung `Das ExportHUB-Passwort ist nicht korrekt.` und keine Secret-Rückgabe.

- [ ] **Step 5: Audit implementieren**

Erlaubte Audittypen:

```js
CUSTOMER_PORTAL_CREATED
CUSTOMER_PORTAL_UPDATED
CUSTOMER_PORTAL_DELETED
CUSTOMER_PORTAL_REVEALED
CUSTOMER_PORTAL_REVEAL_DENIED
```

Audit-Metadaten enthalten nur `customerId`, `portalId`, `portalName`, Actor und Zeitpunkt. Niemals `username`, `password`, Ciphertext, Auth-Tag oder Nonce.

- [ ] **Step 6: `function.json` registrieren**

POST/OPTIONS, `authLevel: anonymous`, da ExportHUB die eigene Sitzung innerhalb des Handlers prüft, konsistent zu vorhandenen Endpunkten.

- [ ] **Step 7: GREEN-Test ausführen**

```bash
node --test test/rc1148-customer-portal-api.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Security-Suite ausführen**

```bash
npm run test:security
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add api/customer-portal-credentials api/shared/auth-store.js test/rc1148-customer-portal-api.test.mjs
git commit -m "feat(RC1148): add secured customer portal credentials api"
```

---

### Task 4: Kundenstamm-UI zur Verwaltung ergänzen

**Files:**
- Create: `assets/rc1148-customer-portal-credentials.js`
- Modify: `index.html`
- Create: `test/rc1148-customer-portal-ui.test.mjs`

**Interfaces:**
- Consumes: aktuelle ExportHUB-Session, aktuellen Benutzer/Rechte, Kunden-ID/ausgewählten Kunden und POST `/api/customer-portal-credentials`.
- Produces: geschützte Sektion `Kundenportal` im Kundenordner mit List/Create/Edit/Delete/Re-Auth-Reveal.

- [ ] **Step 1: RED-UI-Vertragstest schreiben**

Statisch/dynamisch prüfen:
- Asset wird genau einmal eingebunden.
- UI enthält keine fest verdrahteten Passwörter oder Secret-Felder mit vorausgefülltem Klartext.
- Verwaltungsaktionen werden nur bei `customerPortal.manage` gerendert.
- Use-only-Benutzer kann anzeigen, aber nicht bearbeiten/löschen.
- Benutzer ohne `customerPortal.use` bekommt keine Portalaktionen.

- [ ] **Step 2: RED-Test ausführen**

```bash
node --test test/rc1148-customer-portal-ui.test.mjs
```

Expected: FAIL, Asset fehlt.

- [ ] **Step 3: RC1148-Client-API implementieren**

Das Asset kapselt alle Calls in eine Funktion, die den vorhandenen ExportHUB-Sessiontoken übernimmt und niemals Portal-Secrets persistiert:

```js
async function portalApi(action, payload) {
  return fetch('/api/customer-portal-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-ExportHUB-Token': currentSessionToken() },
    cache: 'no-store',
    body: JSON.stringify({ action, ...payload })
  });
}
```

Klartext-Credentials bleiben nur in flüchtigen lokalen Variablen/DOM-Textknoten und werden beim Schließen/Wechseln überschrieben.

- [ ] **Step 4: Kundenstamm-Sektion implementieren**

Im Kundenordner wird für `manage` eine Sektion `Kundenportal` injiziert. Formularfelder: Portalname, URL, Benutzername, Passwort, interne Notiz, Aktivstatus. Bei Bearbeitung bleiben leere Benutzername-/Passwortfelder unverändert; sie werden nicht aus dem Server zurückgeladen.

Liste zeigt nur Portalname, URL, Aktivstatus, `Benutzername hinterlegt`, `Passwort hinterlegt`, letzte Änderung.

- [ ] **Step 5: Anzeigen-Dialog implementieren**

`Zugangsdaten anzeigen` öffnet einen Dialog mit einem Passwortfeld für das **persönliche ExportHUB-Passwort**. Nach erfolgreichem `reveal` werden Portal-Benutzername und Portal-Passwort angezeigt und mit Kopierbuttons versehen. Nach 60 Sekunden, Dialogschließen, Kundenwechsel, Navigation oder Logout wird `clearRevealedSecrets()` aufgerufen und die Textknoten werden geleert.

- [ ] **Step 6: GREEN-Test ausführen**

```bash
node --test test/rc1148-customer-portal-ui.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add assets/rc1148-customer-portal-credentials.js index.html test/rc1148-customer-portal-ui.test.mjs
git commit -m "feat(RC1148): manage customer portal credentials in customer folder"
```

---

### Task 5: Kundenportal-Kachel unter „Sendung erstellen“ integrieren

**Files:**
- Modify: `assets/rc1148-customer-portal-credentials.js`
- Modify: `index.html` only if a stable hook/data-attribute for the shipment customer area is required.
- Create: `test/rc1148-customer-portal-shipment-card.test.mjs`
- Create: `e2e/specs/customer-portal-credentials.spec.js`

**Interfaces:**
- Consumes: aktuell ausgewählten Kunden in „Sendung erstellen“, `customerPortal.use`, Portal-Metadaten-API.
- Produces: Kachel `Kundenportal`, die immer nur aktive Portale des aktuell ausgewählten Kunden zeigt.

- [ ] **Step 1: RED-Test für Kundenbindung und Secret-Clearing schreiben**

Prüfen:
- ohne `use` wird keine Kachel gerendert.
- ohne ausgewählten Kunden erscheint kein fremdes Portal.
- Kunde A zeigt nur Portal A.
- Wechsel A → B leert zuerst alle Revealed-Werte und lädt danach nur B.
- `currentShipment` oder gespeicherte Sendung erhält niemals `portalPassword`, `portalUsername` oder `portalCredentials`.

- [ ] **Step 2: RED-Test ausführen**

```bash
node --test test/rc1148-customer-portal-shipment-card.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Kundenwechsel-Hook implementieren**

Das Asset beobachtet den bestehenden Kunden-Auswahlflow über vorhandene Events/DOM-Änderungen. Eine kanonische `selectedCustomerId()`-Funktion muss die stabile Kunden-ID/Kundennummer verwenden, nicht nur den sichtbaren Namen.

Bei jeder Änderung:

```js
clearRevealedSecrets();
renderPortalCard({ loading: true });
const metadata = await portalApi('list', { customerId });
if (customerId !== selectedCustomerId()) return; // stale response verwerfen
renderPortalCard({ portals: metadata.portals });
```

- [ ] **Step 4: Kachelzustände implementieren**

Kachel `Kundenportal` unter `Sendung erstellen`:
- kein Kunde: `Bitte zuerst einen Kunden auswählen.`
- keine aktiven Portale: `Für diesen Kunden ist kein Kundenportal hinterlegt.`
- ein Portal: Portalname + `Portal öffnen` + `Zugangsdaten anzeigen`.
- mehrere Portale: Auswahl/Liste aller aktiven Portale dieses Kunden.

`Portal öffnen` verwendet nur serverseitig gelieferte/validierte URL-Metadaten und öffnet mit `noopener,noreferrer`.

- [ ] **Step 5: Re-Auth-Dialog wiederverwenden**

Die Kachel verwendet exakt denselben Reveal-Dialog wie der Kundenordner. Das persönliche ExportHUB-Passwort wird nicht gespeichert und nach dem Request sofort aus dem Input entfernt.

- [ ] **Step 6: Browser-E2E ergänzen**

`e2e/specs/customer-portal-credentials.spec.js` deckt mindestens ab:
1. Benutzer ohne Recht: keine Kachel.
2. Use-Benutzer: Kunde A → nur A-Metadaten.
3. falsches Re-Auth-Passwort: Secrets bleiben verdeckt.
4. korrektes Passwort: Secrets sichtbar.
5. Wechsel auf Kunde B: A-Secrets sofort weg.
6. Reload/F5: keine Secrets aus Browser-Speicher wiederhergestellt.

- [ ] **Step 7: GREEN-Tests ausführen**

```bash
node --test test/rc1148-customer-portal-shipment-card.test.mjs
npm test
```

Expected: PASS.

Wenn die E2E-Umgebung lokal verfügbar ist:

```bash
npx playwright test e2e/specs/customer-portal-credentials.spec.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add assets/rc1148-customer-portal-credentials.js index.html test/rc1148-customer-portal-shipment-card.test.mjs e2e/specs/customer-portal-credentials.spec.js
git commit -m "feat(RC1148): show customer portal card in shipment creation"
```

---

### Task 6: Release-Härtung, Secret-Leak-Scan und Regression

**Files:**
- Modify: `package.json` only if the new RC1148 test files need an explicit release alias; normal `npm test` globbing already includes them.
- Create: `test/rc1148-customer-portal-security-gate.test.mjs`
- Modify: `RELEASE_MANIFEST.txt` if production assets are enumerated there.

**Interfaces:**
- Consumes: komplette RC1148-Implementierung.
- Produces: reproduzierbares Release-Gate, das Secret-Leaks und Regressionen blockiert.

- [ ] **Step 1: Security-Gate-Test schreiben**

Der Test scannt ausgelieferte Frontend-Dateien und Beispielkonfigurationen auf verbotene Muster und prüft strukturell:

```js
assert.doesNotMatch(indexHtml, /portalPassword\s*[:=]\s*["'][^"']+/i);
assert.doesNotMatch(indexHtml, /EXPORTHUB_CUSTOMER_PORTAL_KEY\s*[:=]\s*["'][A-Za-z0-9+/=_-]{16,}/i);
```

Zusätzlich wird ein API-Testdatensatz mit markanten Secrets wie `SECRET-USER-RC1148` / `SECRET-PASS-RC1148` erzeugt und geprüft, dass diese Zeichenfolgen niemals in `list`-Response, Audit oder allgemeinem State auftauchen.

- [ ] **Step 2: Security-Gate ausführen**

```bash
node --test test/rc1148-customer-portal-security-gate.test.mjs
```

Expected: PASS erst nach vollständiger Implementierung.

- [ ] **Step 3: Gesamte Release-Verifikation ausführen**

```bash
npm run verify:release
```

Expected: PASS ohne Regressionen.

- [ ] **Step 4: Gezielte manuelle Abnahme im TESTSERVICE**

Mit zwei Testkunden und drei Testbenutzern prüfen:
- Admin kann Rechte vergeben und Portale verwalten.
- Use-only-Benutzer sieht die Kachel und kann nach eigenem Passwort anzeigen, aber nicht verwalten.
- Benutzer ohne Recht sieht weder Kundenordner-Aktionen noch Sendungs-Kachel.
- Wechsel zwischen zwei Kunden zeigt nie die Zugangsdaten des vorherigen Kunden.
- Browser DevTools/Application enthält keine Portal-Credentials in LocalStorage/SessionStorage.
- Network `list` enthält keine Secrets; nur `reveal` liefert sie nach Re-Auth.
- Audit protokolliert Aktionen ohne Credentials.

- [ ] **Step 5: Release-Metadaten aktualisieren und Commit**

```bash
git add test/rc1148-customer-portal-security-gate.test.mjs RELEASE_MANIFEST.txt package.json
git commit -m "test(RC1148): gate customer portal credential security"
```

- [ ] **Step 6: Finalen Branch-Vergleich durchführen**

```bash
git diff main...feature/customer-portal-credentials --check
git status --short
```

Expected: kein Whitespace-Fehler, keine unbeabsichtigten Dateien, keine Klartext-Secrets.
