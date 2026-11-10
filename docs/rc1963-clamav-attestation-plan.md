# RC1963 – ClamAV candidate attestation: TESTSERVICE-only groundwork

**Issue:** #1329. **Status:** Draft / inert code and synthetic tests only.
This does **not** fix `ABD_SCAN_PENDING` yet. No Azure resources, Defender plan,
new monthly charges, SMTP, production deploy or customer-file processing.

## Confirmed root cause and budget constraint

- Azure TESTSERVICE `EXPORTHUB_STORAGE_CONNECTION_STRING` is configured for the
  storage account identified by the owner as `exporthubtestde89`.
- That account's Azure portal shows **"Microsoft Defender für Speicher aktivieren"**
  with a recurring **USD 10 per storage account per month** and
  **USD 0.15/GB scanned** as displayed in the owner's portal.
- The user explicitly declines Defender's recurring fee. **Do not activate it.**
- Read-only OIDC TESTSERVICE checks previously reported 2 pending results,
  zero clean and both pending longer than two hours. Existing backend accepts
  **only the genuine Defender Blob Index Tag** to enter its parser.
- `tools/rc1956-clamav/scan-local.cjs` is a local prototype, not a trusted
  Azure worker. It deliberately returns `authorizedForRelease:false`.

## What this change prepares

`tools/rc1963-clamav/scan-candidate-attestation.cjs` defines a strict,
testservice-only, short-lived **candidate** receipt authenticated by HMAC-SHA256.
It binds the original SHA-256, size, opaque blob-key hash, user/tenant scope hash,
upload nonce, Azure ETag, environment, candidate-clean verdict, scan timestamp
and signature-definition freshness. Unknown fields, changed content bindings,
stale signatures, expired results, incorrect environment, missing server-only
key or altered MAC fail closed. No path, connection string or account key is
placed in the receipt. Every result, including a successful verification,
returns `authorizedForRelease:false`.

**Critical boundary:** A signed candidate is NOT release authorization.
The code is not imported by `api/abd-analysis/index.js` and writes no Blob
Index Tags. The HMAC issuer must ultimately be a separately attested,
restricted worker identity that runs a REAL, current ClamAV engine and proves
the scanned bytes equal the immutable Azure blob. The worker's secret must not
be available to the browser, upload endpoint, or ordinary user. Do not wire
an API parameter `candidate-clean` or allow a caller-supplied key to bypass
the existing `scan.status!=='clean'` rule.

## Blocking implementation and acceptance steps

1. **Zero-fee execution feasibility:** Identify a trusted *already funded*
   isolated worker, or get separate explicit approval for any cloud compute
   cost. Azure free grants are **not a guaranteed zero-cost solution**.
   No reliance on an employee's PC running, browser JavaScript, GitHub
   Actions as a persistent customer-data scanner, or publicly reachable ports.
2. Dedicated TESTSERVICE storage queue and least-privilege identity; opaque
   fixed-scope job IDs; strict concurrency, retries, dead-letter handling,
   private ephemeral volume, current ClamAV signatures and safe signature
   updates. Never include customer files or secrets in GitHub logs.
3. Server-held signed candidate receipt PLUS independently verified worker
   identity, Azure blob ETag/version, SHA-256 and immutable bytes; one-time
   compare-and-swap result storage and replay protection. No browser-supplied
   signature, status, URL, or clean flag. Add controls for signature age,
   ZIP bombs, macros, encrypted/unscannable files and scanner crash.
4. Attach worker and an isolated, feature-flagged TESTSERVICE API; keep
   production on the existing fail-closed provider until exact-SHA release
   approval. No generic fallback from Defender pending to an unverified
   scanner result.
5. Real ClamAV signature and EICAR tests, clean XLSX, infected XLSX,
   timeouts and modified-blob ETag tests, then authenticated
   TESTSERVICE upload → checked verdict → XLSX positions → editor.
6. Security review, cost proof and full required CI before **separate**
   owner approval to deploy/test anything in Azure or to production.

## Current guarantee

No monthly Defender charge is incurred by this PR. Existing uploads remain
blocked without a genuine Defender clean tag. RC1963 tests use synthetic
objects; no real malware scanner, worker identity, Azure upload or end-to-end
scan was executed as part of this patch.

## RC1964 – günstigste Cloud-Variante, noch OHNE Azure-Bereitstellung

**Entscheidung:** Es ist kein durchgehend laufender Firmenserver verfügbar.
Für die weitere technische Planung wird daher ein **Azure Container Apps
Consumption Job**, eventgesteuert durch eine private Azure Storage Queue und
mit null laufenden Job-Instanzen bei Inaktivität, bevorzugt. Diese Wahl ist
ein Architekturvorschlag, **keine** Bestellung oder Kostenfreigabe.

**Quellen:**
- Microsoft, Verbrauchsabrechnung und abonnementsweit geteilte Freikontingente:
  https://learn.microsoft.com/en-us/azure/container-apps/billing
- Microsoft, Event-Jobs und Azure-Queue-Trigger:
  https://learn.microsoft.com/en-us/azure/container-apps/jobs
- ClamAV, 3–4 GiB empfohlener Arbeitsspeicher:
  https://docs.clamav.net/manual/Installing/Docker.html

**Ablauf als Zielarchitektur (noch NICHT implementiert):**
1. Nur die autorisierte TESTSERVICE-ABD-API legt Dateien in die bekannte,
   isolierte Quarantäne. Sie bestimmt Upload-Nonce, Dateihash, ETag,
   unveränderliche Blob-Version und Benutzer-/Mandantenscope.
2. Ein serverseitig signierter, kurzlebiger Queue-Auftrag enthält ausschließlich
   zufällige Job-ID, Hashwerte, ETag, Bytes, Zeitstempel und Umgebung.
   **Keine** Datei-URLs, Connection Strings, Keys, SAS, Kundennamen oder
   benutzerkontrollierten Pfade.
3. Ein mit Managed Identity eingeschränkter, privater Container-Job
   lädt nur genau die zugewiesene Quarantäne-Dateiversion in temporäre,
   private Speicherung; er prüft Scope, SHA-256, Nonce und ETag vor/nach
   einem *tatsächlichen* ClamAV-Scan mit frischen Signaturen.
4. Nur eine serverseitig einmalig verwendbare, ETag- und versionsgebundene
   Scannerattestation wird vom ABD-Backend akzeptiert. Das bestehende
   fail-closed-Gate darf erst **nach** vollständig verifiziertem TESTSERVICE-E2E
   und eigenständiger Freigabe angepasst werden.
5. Infiziert, unlesbar, verschlüsselt, makrohaltig, zu groß,
   ZIP-Bombenverdacht, veraltete Signaturen, Timeout, verlorene Queue-Meldung,
   widersprüchliche Revision oder Kostenlimit => **gesperrt**.

**Reine Offline-Vorarbeiten in diesem Draft:**
- `tools/rc1964-clamav/cloud-job-preflight.cjs` schätzt bei festem
  Prototypenprofil **2 vCPU / 4 GiB**, maximal 240 Sekunden je Job,
  höchstens eine gleichzeitige Instanz und keine automatischen Retries,
  den voraussichtlichen Rechenverbrauch. Diese Parameter sind Vorschläge,
  **keine** aktiv gesetzten Azure-Ressourcenlimits.
- Beispiel **100 Jobs je bis 240 Sekunden:** 48.000 vCPU-Sekunden
  und 96.000 GiB-Sekunden. Microsofts veröffentlichte Kontingente
  180.000 vCPU-Sekunden / 360.000 GiB-Sekunden pro Monat
  sind **geteilt mit allen anderen Container Apps derselben Subscription**.
  Ohne nachgewiesene tatsächliche Restkontingente bleibt die Rechnung
  `subscription-usage-unknown`.
- Selbst wenn die rechnerischen Kontingente ausreichen, bleiben
  **Container Registry, Storage Queue, Blob-Transaktionen, Image Pulls,
  Logs/Monitoring, Netzwerk und andere Azure-Leistungen** als
  mögliche Zusatzkosten ungeklärt.
- Der signierte Queue-Kandidatenvertrag ist 5 Minuten gültig und
  TESTSERVICE-only. Manipulation, Cross-Scope, Cross-Blob, falsche Umgebung,
  falsche Bytes/ETag oder abgelaufene Aufträge scheitern geschlossen.
  Er **startet keinen Job** und erteilt weder Dispatch- noch Parser-Freigabe.
- Alle Offline-Ergebnisse geben ausdrücklich
  `deployAuthorized:false`, `releaseAuthorized:false` und
  `costGuaranteedZero:false` zurück.

**Harte Abnahme vor jeglicher Bereitstellung:**
- [ ] Vorhandene Azure-Subscription auf *tatsächlich freie* Restkapazität
      und vollständigen Preisrahmen **inkl. Nebenressourcen** prüfen.
- [ ] Ohne belegte Null-Zusatzkosten: ausdrücklich genehmigtes Budget;
      wenn der Betreiber *gar keine* zusätzlichen Kosten akzeptiert,
      darf keine Cloud-Ressource erstellt werden.
- [ ] Getrennte, private Container Registry / Image-Digest-Prüfung und
      vertrauenswürdige ClamAV-Signaturversorgung nachweisen.
- [ ] Azure Managed Identity mit minimalen Queue-/Quarantäne-Rechten,
      keine frei zugänglichen Ports, keine Client-SAS, kein Browser-Scan.
- [ ] Wirkliche Laufzeit- und Wiederholungsgrenzen, Kostenalarme und
      kontrolliertes Abschalten; ein Offline-Rechner ist KEIN Budgetschutz.
- [ ] Synthetische Dateien einschließlich EICAR, saubere XLSX, manipulierte
      Datei und Scanner-Ausfall im isolierten TESTSERVICE vollständig prüfen.
- [ ] Sicherheitsreview, CI und gesonderte Eigentümerfreigabe für jeden
      Azure-Eingriff sowie getrennte Freigabe für einen späteren PROD-Release.

**Kein Deployment, kein Azure-Account-Schreibzugriff, keine laufenden Kosten
durch diesen PR.** `ABD_SCAN_PENDING` bleibt gesperrt, bis der reale
vertrauenswürdige Scanner bereitsteht.
