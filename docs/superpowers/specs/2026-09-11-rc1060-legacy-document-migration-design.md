# RC1060 Legacy-Dokumentmigration – Design

## Ziel
Die noch im zentralen ExportHUB-Team-State eingebetteten Legacy-Dokumente werden kontrolliert in den mit RC1059 eingeführten Dokument-Blob-Storage ausgelagert. Der zentrale State wird dadurch kleiner, ohne bestehende Dokumente, QR-Codes, Lieferavis, Sendungen oder Legacy-Lesewege zu beschädigen.

## Ausgangslage
RC1059 schreibt neue Inline-Dokumente bereits in einen dedizierten, geschützten Dokument-Container. Die Live-Diagnose vom 11.09.2026 zeigt in Produktion 158 Inline-Payloads mit rund 73,7 MB Dokumentdaten bei rund 130 MB Gesamt-State; TESTSERVICE enthält 76 Inline-Payloads mit rund 30,2 MB. `blobDocumentEntries` ist vor der Migration noch 0.

## Architektur
Die Migration läuft serverseitig und strikt pro Umgebung. Sie verarbeitet nur bereits vorhandene Inline-Dokumente und verwendet dieselbe hashbasierte Ablage und dieselben geschützten Downloadpfade wie RC1059. Jeder Eintrag folgt der Reihenfolge: Inline-Payload lesen und dekodieren → Blob schreiben → geschriebenen Blob verifizieren → erst danach die State-Referenz auf Blob umstellen. Ein fehlgeschlagener Upload oder eine fehlgeschlagene Verifikation darf den ursprünglichen Inline-Eintrag nicht verändern.

Die Verarbeitung erfolgt in kleinen Batches und ist idempotent. Bereits migrierte Blob-Referenzen werden übersprungen. Ein erneuter Lauf darf weder Dokumente duplizieren noch gültige Referenzen verändern. Produktion und TESTSERVICE verwenden getrennte Blobpfade und dürfen niemals gegenseitig Dokumente lesen oder migrieren.

## Sicherheit und Datenintegrität
- Keine Löschung eines Inline-Payloads vor erfolgreichem Upload und erfolgreicher Blob-Verifikation.
- Hash und Byte-Länge des gespeicherten Inhalts müssen mit dem Quelldokument übereinstimmen.
- Fehlgeschlagene Einträge bleiben unverändert und werden als Fehler gezählt.
- Legacy-URLs und bereits bestehende Blob-Referenzen bleiben unverändert.
- Bestehende QR-Codes, Avis-Links und öffentliche Routing-/Token-Verträge werden nicht verändert.
- Der Dokumentdownload bleibt sitzungsgeschützt und umgebungsgebunden.
- Kein automatischer Cross-Environment-Zugriff.

## Migrationsteuerung
Ein geschützter Admin-Migrationsendpunkt verarbeitet pro Aufruf eine begrenzte Anzahl Inline-Dokumente. Er liefert ausschließlich aggregierte Fortschrittsdaten: `found`, `migrated`, `skipped`, `failed`, `remaining`, `bytesMoved`, `done`. Keine Dokumentinhalte oder Secrets werden in Diagnoseantworten oder Logs ausgegeben.

Der Batch ist fortsetzbar: Nach jedem erfolgreichen Batch wird der verkleinerte State gespeichert. Der nächste Aufruf scannt den aktuellen State erneut und verarbeitet die verbleibenden Inline-Payloads. Damit ist kein separater fragiler Cursor erforderlich.

## Fehlerbehandlung
Bei einem Fehler an einem einzelnen Dokument wird dieses Dokument nicht verändert. Der Batch darf mit weiteren unabhängigen Dokumenten fortfahren, sofern der State konsistent bleibt. Ein State-Speicherfehler beendet den Aufruf mit Fehler und darf nicht als erfolgreiche Migration gemeldet werden. Blob-Dateien, die bereits sicher geschrieben wurden, sind hashbasiert und können beim nächsten Lauf wiederverwendet werden.

## Rollout
1. Regressionen für Idempotenz, Hash-/Byte-Verifikation, Fehler-Rollback, Batchgrenze und Umgebungstrennung.
2. Implementierung auf isoliertem RC1060-Branch.
3. Vollständiger Main-/Release-Vertrag vor Integration.
4. Deployment zuerst über den bestehenden Drei-Umgebungen-Workflow.
5. Migration zunächst TESTSERVICE; Live-Diagnose prüfen.
6. Erst danach Produktion in kleinen Batches.
7. Nach jedem Produktionsbatch State-Größe, Inline-Payload-Anzahl, Blob-Dokumentanzahl und API-Lesezeiten prüfen.

## Erfolgskriterien
RC1060 ist abgeschlossen, wenn TESTSERVICE und Produktion `inlinePayloadCount = 0` für migrierbare Legacy-Dokumente melden, die entsprechenden `blobDocumentEntries` gestiegen sind, alle Regressionen und Live-Probes grün sind und bestehende Dokumente weiterhin über den geschützten Dual-Read-Pfad geöffnet bzw. in ZIP-Ausgaben verwendet werden können.