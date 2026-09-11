# RC1059 Document Blob Storage Design

## Ausgangslage

RC1057/RC1058 haben den zentralen Team-State live vermessen. Produktion liegt bei rund 130 MB, davon rund 92 MB in `state.shipments`. Etwa 73,7 MB entfallen auf eingebettete Dokument-Payloads; TESTSERVICE zeigt dasselbe Muster. Der aktuelle zentrale JSON-State ist dadurch für Cold Reads und vollständige Saves unnötig teuer und timeout-anfällig.

## Ziel

Neue Dokumente sollen nicht mehr als Base64-/Data-URL-Payload im zentralen Team-State gespeichert werden. Der Team-State enthält künftig nur Metadaten und eine interne Blob-Referenz. Bestehende Inline-Dokumente müssen weiterhin vollständig funktionieren. Bereits ausgegebene QR-Codes, Lieferavis-Links, Abholprozesse, Drucke und historische Sendungen dürfen durch diese Änderung niemals ungültig werden.

## Umfang RC1059

RC1059 führt die neue Blob-Dokumentarchitektur und einen rückwärtskompatiblen Dual-Read ein. Die Massenmigration der bereits vorhandenen Inline-Payloads ist ausdrücklich ein nachgelagerter Schritt und wird erst umgesetzt, wenn RC1059 live stabil ist.

## Architektur

### Separater Dokument-Container

Dokumente werden in einem eigenen Azure-Blob-Container gespeichert. Standardname: `exporthub-documents`, konfigurierbar über `EXPORTHUB_DOCUMENT_CONTAINER`. Produktion und TESTSERVICE werden innerhalb des Containers über Pfadpräfixe getrennt.

Blobpfad:

`rc1059/<environment>/<sha256-prefix>/<sha256>`

Der Inhaltshash ist SHA-256 über die Binärdaten. Dadurch ist ein idempotenter Upload möglich und identische Dokumentinhalte können später dedupliziert werden.

### Dokument-Metadaten im Team-State

Ein ausgelagertes Dokument behält bestehende Identitäts- und Anzeigeinformationen wie `id`, `name`, `fileName`, `type`, `mimeType`, `size`, `uploadedAt` und funktionsspezifische Felder. Zusätzlich enthält es:

- `storage: "blob"`
- `blobName`
- `sha256`
- `size`
- `mimeType`

Die Felder `data`, `payload`, `content`, `base64` und vergleichbare Inline-Binärfelder werden nach erfolgreichem Blob-Upload nicht mehr in den zentralen State geschrieben.

### Dual-Read / Rückwärtskompatibilität

Alle Dokumentleser müssen beide Formate akzeptieren:

1. Legacy: Inline-Payload (`data:...;base64,...`, `payload`, `content`, `base64`).
2. Neu: Blob-Metadaten (`storage:"blob"`, `blobName`, `sha256`).

Legacy-Inhalte werden nicht automatisch gelöscht oder umgeschrieben. Ein bestehendes Dokument funktioniert unverändert, bis eine spätere kontrollierte Migration es erfolgreich in Blob Storage überführt.

### Sicherer Dokumentabruf

Blob-Namen werden niemals als frei zugängliche Azure-URL an den Browser gegeben. Ein authentifizierter interner Abruf-Endpunkt liefert Dokumente für angemeldete ExportHUB-Benutzer. Öffentliche Flows wie Pickup/Lieferavis verwenden weiterhin ihre vorhandenen Token- und Rechteprüfungen; falls sie ein Dokument benötigen, wird der Abruf über den jeweils bereits geschützten öffentlichen Flow vermittelt.

### Schreibpfad

Vor einem Team-State-Save werden nur erkannte echte Inline-Dokumentpayloads extrahiert. Ablauf:

1. Payload validieren und decodieren.
2. SHA-256 berechnen.
3. Blob idempotent hochladen.
4. Upload/Hash/Größe bestätigen.
5. Im zu speichernden Dokumentobjekt Inline-Payload durch Blob-Metadaten ersetzen.
6. Erst danach den Team-State speichern.

Schlägt der Blob-Upload fehl, wird der State nicht auf eine nicht vorhandene Blob-Referenz umgestellt.

### Keine Datenverluste

RC1059 verändert keine vorhandenen Dokumentarrays und keine fachlichen IDs. Merge-Logik bleibt additiv/protektiv. Die neue Normalisierung darf weder `deliveryFiles`, `podFiles`, `abdFiles`, `generatedDocuments`, `documents`, `files`, `attachments` noch andere Dokumentlisten leeren oder neu nummerieren.

## Sicherheitsregeln

- Kein öffentlicher direkter Storage-URL-Leak.
- Dateiname wird für Pfade nicht verwendet; Blobpfad basiert auf Hash.
- MIME-Typ und Größe werden validiert.
- Upload ist idempotent und darf bei Wiederholung kein anderes Dokument überschreiben.
- Produktion und TESTSERVICE bleiben logisch getrennt.
- Keine Änderung an QR-/Avis-Tokenformaten.

## Beobachtbarkeit

Health/Diagnose darf nur aggregierte Zahlen liefern: Anzahl Blob-Dokumente, Anzahl verbliebener Inline-Payloads und geschätzte Inline-Bytes. Keine Dateinamen, Hashes, Blobpfade, Kunden- oder Sendungsreferenzen im öffentlichen Health-Endpunkt.

## Erfolgskriterien RC1059

- Neue Inline-Dokumentpayloads werden vor dem zentralen State-Save in Azure Blob ausgelagert.
- Der zentrale State erhält nur Metadaten/Blob-Referenzen.
- Legacy-Inline-Dokumente bleiben lesbar.
- Neue Blob-Dokumente können über geschützte ExportHUB-Pfade geladen und gedruckt werden.
- QR-, Pickup-, Lieferavis- und bestehende State-Merge-Regressionen bleiben grün.
- Produktion/TESTSERVICE-Deploy und Post-Deploy-Probe sind grün.

## Nachgelagerte Migration

Die bereits vorhandenen Inline-Payloads werden erst in einem separaten RC1060-Migrationsschritt verarbeitet. Migration ist wiederanlaufbar und idempotent: Blob schreiben und verifizieren, danach State-Referenz ersetzen. Vor einer erfolgreichen Verifikation wird niemals ein Legacy-Payload entfernt.
