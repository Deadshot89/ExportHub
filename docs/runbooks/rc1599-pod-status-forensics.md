# RC1599 · POD-Statusforensik (P0 #899)

Dieses Werkzeug untersucht **nur lokal** zwei bereits durch berechtigte Administratoren bereitgestellte, unveränderte Team-State-JSON-Snapshots. Es führt keine Netzwerkanfragen aus und kann weder Azure-Blobs noch Sendungsdaten schreiben.

## Schutzvorgaben

- Produktive Backups nicht in Pull Requests, öffentliche Issues, CI-Artefakte, Chats oder Git-Repositories hochladen.
- Vor der Analyse die Backups **unverändert und zugriffsgeschützt** aus dem berechtigten Recovery-Prozess sichern und ihr Datum sowie die Blob-Eigenschaften intern dokumentieren.
- Keinen automatischen POD-Statusaudit erneut aktivieren. RC1598 sperrt den mutierenden Job und (nach Production Deployment) den mutierenden API-Aufruf.
- POD-Metadaten, Storage-Pfade und der Status „POD vorhanden“ **beweisen keine** lesbare, authentisch signierte PDF. Für echte Wiederherstellung müssen Originalsignaturen, Dateiintegrität, Pickup-Record, ETag und Archivkopien geprüft werden.
- Keine pauschale Statusänderung, kein kompletter Team-State-Rollback und keine erzeugten Unterschriften.

## Anwendung

Node.js ab Version 20:

~~~bash
node scripts/rc1599-pod-state-forensics.mjs \
  --before /secure/team-state-before.json \
  --after /secure/team-state-after.json
~~~

Das JSON-Ergebnis liefert ausschließlich Summen: Unterschiede zwischen \`shipments\` und \`savedShipments\`, Rückstufungen \`POD vorhanden\` → \`Abgeholt\`, erneutes Auftauchen \`Abgeholt\` → \`POD vorhanden\`, unveränderte Sendungs-Zeitstempel und Änderungen an POD-Dateimetadaten. Die SHA-256-Werte der eingelesenen Dateien werden ausgegeben, damit die verwendeten Snapshot-Versionen nachvollziehbar bleiben.

**Nur in geschützter lokaler Umgebung:** Die Option \`--show-refs\` ergänzt betroffene Sendungsreferenzen. Die Ausgabe darf nicht in öffentlichen GitHub-Logs, Issues oder PRs landen.

Das Skript stellt **keine** Verbindung zu Azure her. Liegen die echten Backups nicht vor, liefert es folglich **keinen** Produktionsbeleg. Die Diagnosehypothese der fehlenden sendungsspezifischen Zeitstempel ist erst nach kontrolliertem Vergleich von echten Vorher-/Nachher-Snapshots und Schreibereignissen bestätigt oder widerlegt.

## Tests

~~~bash
node --test test/rc1599-pod-state-forensics.test.mjs
~~~

## RC1608: Mehrfache Referenzen und unvollständige Snapshots

Die automatische Zuordnung zwischen Vorher- und Nachher-Snapshot ist nur eindeutig,
wenn jede Sendungsreferenz in jeder Sammlung höchstens einmal vorkommt.
Bei doppelten Einträgen **innerhalb derselben Sammlung** führt der Bericht jetzt
`ambiguousDuplicateReferences` getrennt für Vorher, Nachher und die Differenz.
Diese Fälle werden **nicht** mittels eines überschreibenden Maps als vermeintlich
sichere POD-Rückstufung eingestuft. `structuralReviewRequired: true` verlangt eine
manuelle Untersuchung in der geschützten Umgebung.

Der Bericht zählt nun ebenfalls `missingCollectionCopiesAfter`.
Fehlerhafte Snapshot-Strukturen (keine Sendungsliste, falsche Datentypen oder
`state: null`) brechen mit Fehler ab, statt einen irreführenden Null-Bericht
zu erzeugen. Eine vorhandene leere Sendungsliste ist weiterhin zulässig.

Das ist **kein** Nachweis, dass eine konkrete der 89 betroffenen Sendungen
doppelt vorhanden war. Dafür fehlen weiterhin die echten gesicherten Snapshots.
Weder der Vergleich noch seine Tests nehmen Statusänderungen oder Azure-Schreibzugriffe vor.

Regression: `node --test test/rc1599-pod-state-forensics.test.mjs`.
