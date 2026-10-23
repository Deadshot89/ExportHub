# RC1641 · TESTSERVICE: sicheres Veröffentlichen eines Cosmos-Datenstands (offline)

**Status:** Bibliothek und synthetischer In-Memory-Testvertrag. Keine Azure-Cosmos-Ressource, kein API-Routing, keine produktive Datenmigration oder Kostenfreigabe.

Vorbereitung für den späteren Wechsel vom großen TESTSERVICE-Azure-Blob zu Azure Cosmos DB NoSQL im bestätigten Free-Tier. Die bestehende reine JSON/Gzip-Chunk-Codierung aus RC1636 bleibt zuständig für Komprimierung, SHA-256 und rekonstruierten Team-State. RC1641 ergänzt den sicheren **Publication Commit**.

## Datenfluss

1. Der aufrufende Test-Adapter muss sich ausdrücklich als `environment=testservice` und `partitionKey=testservice` ausweisen. Der Team-State selbst muss `dataEnvironment=testservice` enthalten.
2. Der Aufrufer liefert eine **explizite erwartete Manifest-ETag** (`null` nur zur erstmaligen Anlage). Ohne ETag wird kein Schreibversuch akzeptiert.
3. Unveränderliche Chunk-Items werden über `createImmutableItem(chunk,{ifNoneMatch:'*'})` angelegt. Existierende Chunk-IDs werden nur nach vollständigem Inhaltsvergleich wiederverwendet.
4. **Vor Manifestwechsel** werden alle neuen Chunk-Items über `readItem(id,pk)` zurückgelesen, Base64, Einzel- und Gesamt-SHA-256, Komprimierung und `dataEnvironment` geprüft.
5. Genau **ein** Manifest wird mittels `compareAndSwapManifest` mit `ifMatch:<alte ETag>` oder `ifNoneMatch:'*'` umgeschaltet. Der künftige Cosmos-Adapter muss diese Bedingung **serverseitig und atomar** erzwingen.
6. Nach dem Umschalten wird erneut gelesen und geprüft. Bei Konflikt/Fehler gibt es **keine Freigabe**. Alte Chunks werden **nicht gelöscht**; so bleibt eine geprüfte Rückfallebene möglich.

## Grenzen und Sicherheits-Gates

- Die Schnittstellen sind abstrakte Methoden einer **noch nicht implementierten** Cosmos-DB-Verbindung. CI-Test benutzt ausschließlich einen synthetischen In-Memory-Speicher.
- Ein Adapter darf niemals production Teams, Sessions, Dokumente, POD, ABD, Bilder oder gemeinsame Storage Accounts stillschweigend umleiten.
- Keine Account-/Subscription-/SKU-Verifikation. Auch die verfügbare **25-GB-Free-Tier-Speichergrenze** ist keine Aussage über die bisherige **ca. 220-GB-logische historische Blob-Belegung**. Die tatsächlichen abrechenbaren Bytes und eine geeignete Archivierung sind erst zu bestätigen.
- Aktuelle Azure-Blob-Historie, Backups und alle Produktionsdaten bleiben unangetastet. Keine automatische Datenbereinigung, Löschung, Retention-Änderung oder Rotation.
- Ein vor dem Manifestcommit abgebrochener Import kann unveröffentlichte Chunks zurücklassen. Diese dürfen nicht ohne verifizierte Recovery-/Retention-Regeln entfernt werden.
- Bei einer echten Cosmos-Integration sind Item-Grenze (2 MB), Partitionierung, RU/s, ETag-Konflikte, Netzwerkfehler, Zugriffsrechte, Backup-Strategie, Free-Tier-Accountstatus und die vollständige Rücksicherung **live** zu testen.

## Prüfungen

```bash
node --test --test-concurrency=1 test/rc1636-testservice-cosmos-state-chunks.test.mjs test/rc1641-testservice-cosmos-publication.test.mjs
```

CI: `RC1641 TESTSERVICE Cosmos Publication Safety`. Erst nach einem separaten echten Storage-Adapter und nachgewiesener Kosten-/PROD-Isolation kann ein Test-Migration-Pilot mit eigenen Testdaten erwogen werden.

**0,00 €/Monat laufende TESTSERVICE-Kosten: weiterhin nicht erreicht.**
