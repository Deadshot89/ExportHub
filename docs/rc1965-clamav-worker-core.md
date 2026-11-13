# RC1965 – offline testable ClamAV worker core (P0 #1329)

**Status:** code/test preparation only. The existing ABD_SCAN_PENDING protection is NOT fixed. No Azure provisioning, new charges, Defender activation, PR merge or production change.

## Verified context and cloud choice

TESTSERVICE is configured for storage account exporthubtestde89. The owner observed the Defender activation offer and rejected the monthly fee. There is no always-on company server. A scale-to-zero **Azure Container Apps Consumption Event Job** is the technically preferred cloud candidate, but compute free grants are subscription-shared, while Queue, Registry, Storage, logging and networking may incur charges.

Official references:
- https://learn.microsoft.com/en-us/azure/container-apps/jobs
- https://learn.microsoft.com/en-us/azure/container-apps/billing
- https://docs.clamav.net/manual/Installing/Docker.html

## What the code actually does

tools/rc1965-clamav/isolated-scan-core.cjs combines the still-inert HMAC queue candidate (RC1964), local immutable-snapshot ClamAV prototype (RC1956), and candidate proof (RC1963).

1. Reject any unsigned, expired, changed or non-TESTSERVICE queue candidate before accessing data.
2. Require a trusted, **atomic one-time job claim** adapter; duplicate or unavailable jobs fail closed.
3. Read a fixed-scope Blob snapshot through a trusted injected adapter only (no Azure SDK or customer data access in this code).
4. Compare ETag, byte length and SHA-256 against signed original; stage private 0700 directory and 0600 file.
5. Read trusted ClamAV signature metadata **before** scanning, then invoke the RC1956 scanner using a second private immutable copy; any malware/error/timeout blocks.
6. Read the Blob **again** and compare its ETag, SHA-256 and byte length; re-read signature metadata **after** scanning and reject any change. Only the unchanged **pre-scan** value may enter a signed, short-lived candidate proof. A deployed adapter must also attest that the inspected metadata belongs to the engine's actually loaded signatures, not just a newer file on disk.
7. Remove both staged files; cleanup failure invalidates positive evidence. Never echo paths, keys, customer filenames or low-level scanner errors.

**No trust escalation:** Every result carries authorizedForRelease:false, dispatchAuthorized:false and deployAuthorized:false. The receipt itself also has authorizedForRelease:false. The current production API still requires the original genuine Defender clean tag; it is NOT wired to this helper.

**RC1967 bounded Azure read:** The inert RC1966 `createBoundedReadSnapshot` adapter now has a fixed 35-second maximum per snapshot, with one AbortSignal shared across the conditional properties request, byte-range download, and response stream. A stalled response stream is explicitly destroyed; timeout errors remain sanitized and fail closed. The future trusted Azure worker still needs an independent hard execution deadline and Azure SDK authentication/authorization controls. This does not attest scan success or allow analysis.

## Remaining gates before a working TESTSERVICE scanner

- [ ] Prove zero additional total Azure cost, including existing subscription consumption and all side resources; otherwise STOP until the owner explicitly authorizes a budget.
- [ ] Provide pinned/up-to-date and independently verified ClamAV container image and signatures; synthetic mocked scanner success in tests is NOT a real AV pass.
- [ ] Use Managed Identity and fixed TESTSERVICE quarantine; no upload-supplied URL, SAS, key or arbitrary path.
- [ ] Implement capped SDK download with conditional ETag/blob version, trusted metadata and independently computed hash.
- [ ] Implement a durable Azure-backed atomic claim, bounded retry/poison queue and identity-bound one-time attestation. Injected adapters in the prototype do NOT implement any of these trusted services.
- [ ] Prove EICAR, clean, malware-positive, encrypted/macro/ZIP-bomb, invalid signatures, changed blob and failure cases with actual ClamAV.
- [ ] Authenticated TESTSERVICE upload -> genuine server-verified clean -> positions -> editor E2E; then full security, CI and separate explicit deployment approvals.

No cloud job has been deployed. Existing ABD_SCAN_PENDING remains a fail-closed blocker, without any fake clean tag or fallback.

## RC1966 – Bounded Azure Blob reader (still offline)

`tools/rc1966-clamav/bounded-blob-snapshot.cjs` is a **dependency-injected,
unconnected** Azure-SDK-compatible reader that a future isolated worker can
use. It does not authenticate, create an Azure client, open a network connection
or interact with the running ExportHUB API on its own.

- Exact blob identity is derived from the existing ABD quarantine scheme:
  `rc1294/testservice/<scopeHash>/<uploadSha256>-<uploadNonce>.<kind>`.
  The worker context must supply the **SHA-256 of this complete blob name**
  as `blobKeyHash`; if it differs, the read adapter refuses the job.
- A future trusted worker must supply the TESTSERVICE-only authorized
  `ContainerClient` via managed identity. A request or browser **cannot**
  select an arbitrary storage account, container, blob path or URL.
- Before the download the adapter checks the Blob's ETag, `BlockBlob` type
  and exact length; the SDK's Blob `download(0, length, ...)` call is
  conditional on `ifMatch`, sets `maxRetryRequests:0` and limits the range.
  A bounded stream additionally rejects too many bytes, missing data,
  changed ETag or content-length inconsistencies.
- SHA-256 of actual bytes must match the signed original. Every error is
  reduced to `RC1966_BLOB_UNVERIFIED`, without revealing Azure internals.
- The RC1965 worker already reads twice and rechecks ETag/hash. This adapter
  is intentionally **not connected** to the RC1965 runner or `api/abd-analysis`
  until a fully restricted, independently audited Azure worker exists.

**Operational limits:** The future queue issuance must derive `blobKeyHash`
from the server-owned blob name, enforce the correct account/container and
bind the job to a durable atomic claim. The current HMAC candidate proof
does not attest Azure resource ownership, provider identity or antivirus
signature status. An Azure ETag is a conditional-read guard, **not** an
immutable version ID or standalone release permit.

No real Azure reads or charges were performed by this patch. The local
synthetic adapter checks passed; the complete repository CI must be
independently successful before any merge. **Do not rerun cancelled CI
automatically or weaken gates.**

Azure API references:
- https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/blobclient
- https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/blobdownloadoptions
- https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/blobrequestconditions

## RC1968 – Hard deadline even when SDK ignores cancellation

A specific failure mode remained in RC1967: the AbortController timeout
only signalled the SDK, but a noncooperative or stalled
`getProperties()`, `download()` or async stream iterator could ignore the
signal and leave the awaited Promise unresolved indefinitely.

RC1968 now races the complete read against a separate bounded rejection.
The active stream is destroyed when the deadline fires. A download response
that resolves **after** the deadline is still adopted and its stream
destroyed before its data can be accepted. All errors return only
`RC1966_BLOB_UNVERIFIED` and never authorize parsing.

Three isolated synthetic tests cover an SDK ignoring the abort signal,
a late download response and an iterator that never returns. This is still
not a live Azure test or a guarantee that a noncooperative underlying SDK
task frees every resource instantly: a separately enforced container/job
execution timeout remains mandatory.

No Azure client, queue, Container Apps job or paid resource was created.
The existing ABD API and its scan gate remain untouched; no deployment
is authorized by this change.

## RC1969 – bounded stream-chunk allocation

Code review of RC1966/RC1968 uncovered a memory-pressure flaw:
a single oversized or invalid `Uint8Array` transport chunk was first
copied with `Buffer.from(part)`, **then** the maximum length was checked.
This temporarily allocated memory proportional to an untrusted chunk.

The updated offline adapter validates `part.byteLength` against both
the remaining expected Blob length and the total 12 MiB budget **before**
allocating a copy. Empty chunks and nonbinary chunks fail closed. Two
additional synthetic regressions ensure that rejected transport chunks
are never duplicated and that malformed chunks cannot produce a clean
candidate. Exact-length, ETag and SHA-256 validation remain unchanged.

No Azure storage read, ClamAV process, deployment or resource creation
was performed. All scans and parser releases remain blocked until an
authorized real trusted worker, malware verification and independently
proven cost envelope are available.

## RC1971 – Reject stale ClamAV signatures before scan

A real performance/security gap remained in the offline worker core:
previously, `getDefinitionsUpdatedAt()` was checked for validity only
when creating the candidate receipt **after** running the scanner. A
stale, future, absent or malformed signature timestamp could therefore
consume ClamAV CPU and memory even though no candidate would be
accepted. On a consumption-billed cloud job that is unnecessary work.

The worker checks definition metadata after the signed queue and
atomic claim but **before EICAR self-test, first Blob read, or clamscan**
(RC1974). It requires a positive, safe integer timestamp that is not
in the future and no more than 24 hours old. A second read immediately
before scanning detects updates during the EICAR self-test; the final
post-scan verification rejects updates during customer-file scanning.
Stale or inconsistent signatures remain blocked with no proof or release.

The additional RC1971 test uses synthetic timestamps and a mock runner
whose invocation count must remain **zero** on every invalid value.
This proves fail-fast control flow, not the authenticity of the
signature database or a real ClamAV malware-detection result.

No Azure job, resource, queue, scan or release was activated. The
existing ABD API continues to block unverifiable uploads.

## RC1972 – tatsächliche Scannerbereitschaft vor Kundendaten prüfen (offline)

Die bisherige Integrations-Testkette RC1970 simulierte nur einen
`clamscan`-Exitcode und war kein Beweis dafür, dass ein ClamAV-Prozess
überhaupt funktioniert. Das neue, weiterhin **nicht angeschlossene**
`tools/rc1972-clamav/engine-selftest.cjs` stellt deshalb eine
fail-closed-Bereitschaftsprüfung für die spätere isolierte
Container-Laufzeit bereit.

- Im privaten temporären Verzeichnis werden nur zwei **harmlose**
  Laufzeit-Prüfdateien mit eingeschränkten Dateirechten angelegt:
  unkritischer Klartext und das offizielle, nicht schädliche
  68-Byte-EICAR-Antivirus-Testmuster.
- Der vorhandene `RC1956.runClamscan` muss bei der harmlosen Datei
  Exitcode **0** (keine Bedrohung) und beim EICAR-Muster Exitcode **1**
  (Testsignatur erkannt) zurückliefern. Fehler, Timeout, sonstiger
  Exitcode, falsch-positive Klartexterkennung oder verpasste
  EICAR-Erkennung liefern `verified:false`.
- Ein selbsttest-positiver Befund ist **niemals ein Kunden-Dateiurteil**:
  `authorizedForRelease:false` bleibt für alle Ergebnisse zwingend.
  Die tatsächliche Scan-Engine muss in einer unabhängig authentisierten,
  isolierten TESTSERVICE-Laufzeit gestartet und mit wirklich geladenen,
  aktuellen Virensignaturen geprüft werden.
- Alle Prüfdateien werden nach dem Test entfernt. Misslingt das
  Aufräumen, gilt die Prüfung ebenfalls als fehlgeschlagen.
  Öffentliche Rückgaben enthalten keine Dateinamen, Scanner-Stderr
  oder Zugangsdaten.
- Sieben synthetische Node-Regressionen prüfen die Kontrolllogik
  mit einem **Mock-Runner**. Dies belegt noch keinen realen EICAR-Scan.
  Ein echter Lauf ist erst mit einer autorisierten,
  tatsächlich bereitgestellten ClamAV-Engine möglich.
- Quelle: https://www.eicar.org/download-anti-malware-testfile/
  und https://github.com/Cisco-Talos/clamav/blob/main/docs/man/clamscan.1.in

**Grenze:** RC1973 bindet den Selbsttest inzwischen an den isolierten
RC1965-Kern, aber noch nicht an Azure oder die produktive ABD-API. Vor einem
vertrauenswürdigen Worker-Start wäre zusätzlich eine verifizierte,
identitätsgebundene Engine-/Signatur-Attestation und echte EICAR-Abnahme
notwendig. Es gibt weiterhin keinen garantierten Nullkosten-Cloudbetrieb,
keinen Merge, kein Deployment und keine Parserfreigabe.

## RC1973 – EICAR-Bereitschaft vor jedem Blob-Read erzwingen

RC1972 konnte bislang nur separat aufgerufen werden. Ein späterer
Aufrufer von `scanOfflineCandidate` konnte deshalb trotz fehlerhafter
ClamAV-Bereitschaft anfangen, Kundendaten aus der Quarantäne zu lesen.

Der isolierte RC1965-Worker verlangt jetzt im Standardpfad nach
erfolgreicher signierter Queue-Prüfung **und** atomarem One-Time-Claim
den tatsächlichen `verifyClamAvEngine()`-Selbsttest **vor dem ersten
Blob-Lesevorgang**. Nur `verified:true` **bei zugleich**
`authorizedForRelease:false` lässt den weiteren (ohnehin nur
kandidatenfähigen) Prüfpfad zu. Fehlende/falsche/abbrechende
Bereitschaft, Exception und ungültiger Adapter liefern fail-closed;
ungültige Queue- oder Replay-Aufträge starten erst gar keinen
teuren Selbsttest.

Im synthetischen CI-Test wird die Bereitschaft über einen expliziten
Mock-Adapter simuliert; der Standardpfad verwendet
`verifyClamAvEngine` mit dem tatsächlichen `clamscan`-Prozess. Diese
Testinjektion darf später **nicht** aus untrusted API-/Queue-Daten
übernommen werden; ein autorisierter Azure-Worker muss die
Runner-/Identity-/Signature-Bindung unabhängig prüfen. Der
Selbsttest wird bei einem späteren Job mit zwei Scannerläufen Aufwand
verursachen und benötigt deshalb eine harte Job-Ausführungsgrenze
und eine belastbare Kostenschätzung.

**Keine Produktionsfreigabe:** Weder das funktionierende Scanmodul
noch RC1973 ändern `api/abd-analysis`; es werden keine Azure-Ressourcen,
Echt-Scans oder Cloud-Bereitstellungen durch diesen PR ausgeführt.
`ABD_SCAN_PENDING` bleibt gesperrt.

## RC1974 – frühzeitige Signaturprüfung vor EICAR und Blob-Download

RC1973 erforderte zwar einen EICAR-Selbsttest vor dem ersten
Kundendaten-Download, hatte den Status der Virensignaturen aber
erst **danach** abgefragt. Bei bereits erkennbar veralteten
Definitionen entstanden dadurch EICAR-Scanner-Rechenzeit und
Quarantäne-Downloadkosten ohne Aussicht auf einen gültigen Nachweis.

Der Offline-Kern prüft nun die vertraulichen Signaturmetadaten
unmittelbar nach dem gültigen Queue-Claim, bevor er den EICAR-Selbsttest
oder eine Blob-Leseoperation ausführt. Unbrauchbare Metadaten
blockieren ohne Scannerstart oder Datenlesevorgang.

Eine zweite Signaturmetadatenprüfung vor dem Kundendatei-Scan
erkennt ein Update während des Selbsttests; die bisherige
Post-Scan-Prüfung wird beibehalten. Die beiden neuen RC1974-
Regressionstests prüfen die Reihenfolge und die Sperren mit
synthetischen Metadaten sowie einem simulierten Engine-Check.

**Keine echte Erkennung oder Scan-Freigabe:** Auch jetzt bleiben
`authorizedForRelease:false`, fehlende Azure-Containerlaufzeit,
Cloudkostenprüfung und EICAR-/XLSX-Livetests zwingende Stop-Bedingungen.

## RC1975 – Zeitbudget für den vorgeschlagenen 240-s-Cloudjob

**Nachgewiesener Planungswiderspruch:** Der bisherige Worker erlaubte für
die zwei ClamAV-Engine-Probes je 120 Sekunden, einen Kundendatei-Scan
bis zu 120 Sekunden und zwei bedingte Blob-Lesevorgänge von je
35 Sekunden. Das sind theoretisch **430 Sekunden ohne Overhead**,
obwohl der vorgeschlagene Azure Container Apps Consumption Job in
`RC1964.JOB_SHAPE.maxSeconds` auf **240 Sekunden** geplant ist.
Auch die Aufnahme eines einzigen Kandidaten wäre unter ungünstigen
Bedingungen somit zeitlich unmöglich und könnte unnötigen
Cloud-Rechenverbrauch verursachen.

**Im inerten RC1965-Worker jetzt ausdrücklich begrenzt:**

| Phase | Geplante maximale Dauer |
| --- | ---: |
| EICAR-Klartext-Test | 25 s |
| EICAR-Erkennungstest | 25 s |
| Bedingter Blob-Read vor Scan | 35 s |
| Kundendatei-Scan | 90 s |
| Bedingter Blob-Read nach Scan | 35 s |
| Reserviertes Zeitbudget für Metadata/Claim/Staging/Cleanup | 30 s |
| **Gesamte geplante Obergrenze** | **240 s** |

Die beiden EICAR-Probes erhalten über `engineCheck({timeoutMs:25000})`
jeweils 25 s; der Aufruf von `scanLocalQuarantine` erhält
`timeoutMs:90000`. Der bestehende RC1966-Reader hat weiterhin 35 s
pro Blob-Lesevorgang. Das `TIME_BUDGET` wird aus dem
`JOB_SHAPE.maxSeconds`-Wert überprüft und durch zwei synthetische
Regressionen gegen unbeabsichtigte Erhöhung geschützt.

**Grenzen:** Die Timeout-Summen sind lediglich *Softwareziele*, keine
belegte reale ClamAV-Laufzeit und keine garantierte gesamte
Wall-Clock-Ausführungsdauer. Signaturabfragen, ein sich sperrender
Kindprozess und sonstige I/O müssen in einem späteren echten
Containerjob durch eine **unabhängige harte 240-s-Prozess-/Job-Frist**
begrenzt werden. Verfehlt der Scanner unter dem restriktiven
Zeitbudget den Abschluss, bleibt der Auftrag fail-closed; Limits
dürfen nicht durch Umgehen der Malwareprüfung gelockert werden.
Eine Änderung des Zeitprofils erfordert eine neue Kostenrechnung
und Sicherheitsabnahme.

**Unverändert:** Keine Azure-Ressourcenanlage, kein Defender-Abonnement,
kein echter EICAR-Scan, keine wirkliche XLSX-Analyse durch diesen PR.
`authorizedForRelease:false` und `ABD_SCAN_PENDING` bleiben aktiv.

## RC1976 – Scanner-Identität zwischen EICAR und Kundendatei binden

**Gefundener Fehler:** Der RC1973-EICAR-Selbsttest verwendete bisher im
Standardfall `runClamscan`, während `scanLocalQuarantine` einen separat
injektierbaren `runner` verwendete. Damit hätte der Selbsttest eine
funktionierende Engine nachweisen können, obwohl die Kundendatei durch
eine **andere** Scannerfunktion verarbeitet wird. Eine positive
Bescheinigung über die erste Engine beweist nicht, dass die zweite
die Kundendatei tatsächlich geprüft hat.

Der RC1965-Worker gibt deshalb nun **denselben `runner`** an
`engineCheck({runner,timeoutMs})` und den Kundendatei-Scan weiter.
Die Standardimplementierung `verifyClamAvEngine` führt ihre beiden
Probes mit genau diesem Runner aus. Drei neue synthetische Tests prüfen:
(1) identischer Scanner für harmlose Probe, EICAR und Kandidat,
(2) ein Runner mit immer `exitCode:0` wird am EICAR-Test vor jedem
Blob-Lesezugriff erkannt und
(3) ein Runner mit immer `exitCode:1` wird bereits an der harmlosen
Probe blockiert.

**Vertrauensgrenze:** Der injizierte Runner und ein
`engineCheck`-Adapter sind ausschließlich interne
Test-/Laufzeit-Abhängigkeiten, **keine** vom Browser oder der Queue
übernehmbaren Eingaben. Vor der echten Azure-Anbindung muss ein
vertrauenswürdiger Worker den Scannerprozess und die tatsächlich
geladenen Signaturen zusätzlich attestieren. Dieser Baustein
erzeugt weiter nur `authorizedForRelease:false`-Kandidaten.
Weder ein echter ClamAV-Test noch Azure-Datenzugriff ist mit den
synthetischen Regressionen nachgewiesen.

## RC1977 – tatsächlichen Abschlusszeitpunkt signieren

**Nachweisfehler:** `scanOfflineCandidate` erhielt einen `now`-Zeitstempel
bei der Queue-/Einmal-Claim-Verifizierung und reichte diesen erst nach
den EICAR-Probes, Blob-Downloads und dem Kundendateiscan als
`scannedAt` an die kurzlebige RC1963-HMAC-Kandidatenbescheinigung
weiter. Damit konnte die Bescheinigung einen *früheren* statt des
tatsächlichen Abschlusszeitpunktes enthalten. Zudem wurde die
24-Stunden-Aktualität der Signaturen am Startzeitpunkt und nicht
nochmals zur Zeit der finalen Bescheinigung beurteilt.

Der Offline-Worker verwendet nun eine gesonderte
`clock`-Abhängigkeit (in der späteren vertrauenswürdigen Laufzeit
standardmäßig `Date.now`) **nach** der abschließenden Blob- und
Signaturprüfung. Nur ein sicherer, nicht rückwärts laufender
Integer-Zeitstempel mit einer Differenz von höchstens
`TIME_BUDGET.jobMs` zum Startzeitpunkt wird akzeptiert. Die
Signaturen müssen auch am Abschlusszeitpunkt höchstens 24 Stunden alt
sein. Die RC1963-Kandidatenbescheinigung verwendet **diesen**
`finishedAt`-Wert als `scannedAt` und berechnet ihren Ablauf
relativ zum tatsächlichen Abschluss, nicht zum initialen Queue-Auftrag.

Drei synthetische Regressionen prüfen (1) korrekt signierte
`scannedAt`-/`expiresAt`-Felder, (2) fehlende/ungültige/rückwärts
laufende oder über der geplanten 240-s-Grenze liegende Zeitstempel
sowie (3) eine während des Scans ablaufende Signaturgültigkeit.
Keiner dieser Fehler liefert eine Kandidatenbescheinigung oder
Parserfreigabe. Die Injected-`clock`-Funktion ist ein interner
Test-/Job-Adapter, niemals ein Feld aus Browser-/Queue-Daten.

**Grenze:** Die Abschlusszeitkontrolle stoppt keinen hängenden
Scannerprozess; dafür ist weiterhin ein *unabhängiger* harter
Container-Laufzeitabbruch nötig. Sie erlaubt weiterhin
`authorizedForRelease:false` allein und stellt weder einen realen
ClamAV-Scan noch einen kostenfreien Cloudbetrieb oder einen
erfolgreichen Excel-Upload nach.

## RC1978 – Ausnahmebehandlung beim Blob-Stream-Aufräumen

Die RC1968/69-Blob-Leser-Funktion rief `stream.destroy()` auch direkt
im Timer-Callback auf. Wirft ein ungewöhnlicher oder fehlerhafter
Azure-SDK-Stream bei `destroy()` selbst eine Ausnahme, liegt diese
außerhalb der normalen `Promise.race`-/`try/catch`-Behandlung.
Sie kann als unbehandelte Node-Ausnahme den isolierten Worker beenden,
anstatt die angefragte Datei kontrolliert zu sperren.

RC1978 kapselt das Schließen des aktiven Streams in einen
ausnahmesicheren `safeDestroy`-Adapter. Ein fehlgeschlagenes Schließen
im Stream-Iterator setzt außerdem `cleanupFailed`, sodass auch bei
ansonsten korrekt gelesener Länge und SHA-256 **kein Kandidat** aus
dem betroffenen Read zurückgegeben wird. Fehler werden wie bisher
auf `RC1966_BLOB_UNVERIFIED` reduziert. Das ist ein
Availability-/Fail-Closed-Fix, keine neue Scanfreigabe.

Die beiden neuen synthetischen RC1978-Regressionen prüfen
(1) einen hängenden Async-Iterator, dessen `destroy()` im
35-s-Deadline-Callback eine Ausnahme wirft (mit kurzem Testtimeout),
und (2) exakte korrekte Bytes, deren Stream sich nicht sauber
schließen lässt. Beide Fälle müssen sicher und ohne SDK-
Geheimnisse abgewiesen werden. Ein realer Azure SDK-/Container-Livetest
ist damit **nicht** ersetzt.

Keine Azure-Ressource, keine neue laufende Gebühr, keine
Cloudscanner-Bereitstellung oder ABD-Parserfreigabe; der
sichere `ABD_SCAN_PENDING`-Block bleibt bestehen.

## RC1979 – verspätete asynchrone Blob-Stream-Fehler nach Abbruch

RC1978 kapselt synchrone `destroy()`-Ausnahmen; eine davon
unabhängige Node-Stream-Gefahr blieb bestehen: Ein bereits
abgebrochener Azure-SDK-Stream kann *später* noch ein asynchrones
`error`-Event auslösen. Ohne registrierten EventEmitter-Handler
würde Node das Ereignis als ungefangenen Fehler melden, obwohl
der ursprüngliche `Promise.race`-Read bereits korrekt abgebrochen
wurde.

Der RC1966-Reader installiert jetzt beim Übernehmen des SDK-Streams
einen `error`-Listener, der bis zur Freigabe des Streamobjekts
bestehen bleibt. Fehler während der laufenden Async-Iteration werden
weiterhin als ungültiger Download behandelt; das Ignorieren eines
*späten* Events ist niemals ein `clean`-Verdikt. Scheitert schon
die Listener-Registrierung, wird der Stream aufgeräumt und der
Read fail-closed verworfen.

Zwei synthetische RC1979-Regressionen prüfen:
(1) ein SDK-Stream mit nicht kooperierendem Iterator, der nach
einem Timeout noch ein `error`-Event emittiert, darf den Node-Worker
nicht zum Absturz bringen;
(2) eine fehlerhafte `on('error')`-Implementierung darf keine
Blob-Bytes zurückgeben. Kein echter Azure-/ClamAV-Livetest.
`ABD_SCAN_PENDING` und `authorizedForRelease:false` bleiben
bestehen. Keine Cloud-Ressourcen, Kosten, Merge oder Bereitstellung.
