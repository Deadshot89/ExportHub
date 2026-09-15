# ExportHUB RC1115 – Security- und Audit-Kontrollnachweis

Stand: 15.09.2026  
Geltungsbereich: ExportHUB Produktion, TESTSERVICE und gemeinsame Azure-API

## Zweck

RC1115 dokumentiert die technisch umgesetzten Sicherheits- und Nachweiskontrollen von ExportHUB. Dieses Dokument ist ein technischer Audit-Nachweis und keine eigenständige ISO-Zertifizierung.

## Identität und Zugriff

- Benutzerkonten und Rollen werden serverseitig validiert.
- Globale Administratorrechte werden vor privilegierten Aktionen erneut serverseitig geprüft.
- API-Funktionen sind im RC1115-CI-Vertrag explizit als intern, öffentlich token-geschützt, gemischt oder read-only klassifiziert.
- Neue HTTP-Funktionen führen zu einem fehlgeschlagenen CI-Vertrag, solange keine Sicherheitsklasse festgelegt wurde.
- Öffentliche Geschäftsprozesse wie QR-Abholung und Lieferavis bleiben ohne Benutzerkonto erreichbar, verwenden jedoch nicht erratbare Zugriffstokens und zusätzliche Prozesskontrollen wie Verlader-PINs.

## Sitzungen

- Maximale neue Sitzungslaufzeit: 12 Stunden.
- Serverseitiger Inaktivitäts-Timeout: 30 Minuten.
- Aktivitätsnachführung wird auf 5-Minuten-Intervalle gedrosselt.
- Passwortänderung, Kontodeaktivierung und Admin-Aktionen können bestehende Sitzungen widerrufen.
- Administratoren können aktive Sitzungen einsehen und beenden.
- Die Timeout-Policy gilt auch für Fast-Auth, State-API, Diagnose-Autofix, Verlader-PIN-Administration und Referenzdateien.

## Passwörter

- Mindestlänge: 10 Zeichen.
- Mindestens Großbuchstabe, Kleinbuchstabe und Zahl.
- PBKDF2-SHA256 mit serverseitig festgelegter Mindestanzahl an Iterationen.
- Passwortwiederverwendung wird über die Passwort-Historie verhindert.
- Start- und zurückgesetzte Passwörter erzwingen eine Passwortänderung.

## Browser- und Transporthärtung

Produktion und TESTSERVICE erhalten unter anderem:

- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Content-Security-Policy mit frame-ancestors 'none', object-src 'none' und base-uri 'self'
- Permissions-Policy ohne Kamera, Mikrofon und Geolocation
- Referrer-Policy

Öffentliche QR-/Avis-Seiten behalten ihre strengeren No-Store- und No-Referrer-Regeln.

## Audit und Diagnose

- Sicherheits- und Benutzeraktionen werden im zentralen Audit-Log gespeichert.
- Audit-Aufbewahrung: 365 Tage, zusätzlich mengenmäßig begrenzt.
- Diagnose-Aufbewahrung: 30 Tage.
- Die Historie enthält Benutzer-, Rechte-, Login-, PIN-, Versand-, Druck-, Mail-, ABD-, POD- und weitere Geschäftsereignisse, soweit vom jeweiligen Prozess protokolliert.
- Die RC1115-ISO-/Auditansicht zeigt zusammengefasst Identität, Sitzungen, Backups, Fehler, Auditstatus, POD-Sicherung und Release-Daten.

## Backup und Wiederherstellung

ExportHUB verwendet mehrere Wiederherstellungsquellen:

- Azure Blob Versions-/Snapshot-Historie, soweit im Speicherkonto verfügbar.
- Sicherheitskopien im Recovery-Bereich vor Wiederherstellungsaktionen.
- Forensische Wiederherstellung vorhandener Sendungs- und Kundendaten.
- Separat gespeicherte POD-Dateien.

Der RC1115-Backup-/Restore-Selbsttest:

1. liest den aktuellen Teamstand,
2. schreibt eine neue Sicherheitskopie in den Recovery-Bereich,
3. liest diese Kopie vollständig zurück,
4. validiert Struktur und Revision,
5. vergleicht Original und Rücklesung mit SHA-256,
6. speichert nur den technischen Testnachweis dauerhaft,
7. verändert dabei den produktiven Teamstand nicht.

Der letzte erfolgreiche Lauf ist in der ISO-/Auditansicht sichtbar.

## POD-Sicherung

- Nach vollständig bestätigter QR-Abholung wird der POD serverseitig erzeugt.
- Azure ist die primäre POD-Sicherung.
- Microsoft 365 ist eine zusätzliche Archivkopie.
- Temporäre Microsoft-Graph-Fehler werden automatisch wiederholt.
- POD-Sicherungsstatus und Fehlerzustand werden am Sendungsdatensatz nachvollziehbar gespeichert.
- Bestehende QR-Codes bleiben über den stabilen resourceKey rückwärtskompatibel.

## Release- und Änderungsnachweis

RC1115 wird vor Merge geprüft durch:

- Security-Vertragstests,
- API-Syntaxprüfung,
- Session-Laufzeittest,
- Backup-/Restore-Laufzeittest,
- vollständige Node-Regression,
- historische Release-Regression,
- QR-/Lieferavis-/Abholkalender-Regression,
- POD-Reliability-Regression,
- Drei-Umgebungen-Build und Deploy-Inhaltsprüfung.

Ein RC1115-Merge soll nur erfolgen, wenn die verpflichtenden Prüfketten grün sind.

## Operativer Audit-Ablauf

Für eine technische Kontrolle in ExportHUB:

1. Als globaler Administrator anmelden.
2. Historie öffnen.
3. Bereich „ISO / AUDIT – Technischer Kontrollstatus“ prüfen.
4. Offene Fehler und Warnungen bewerten.
5. Backup-/Restore-Test ausführen und erfolgreichen Zeitstempel prüfen.
6. Primäre POD-Sicherungen ohne offenen Status prüfen.
7. Aktive Benutzer, Administratoren und Sitzungen kontrollieren.
8. Bei Bedarf Historie als CSV oder Drucknachweis exportieren.

## Abgrenzung

RC1115 stellt technische Kontrollen und Nachweise bereit. Organisatorische Anforderungen wie formale Richtlinienfreigaben, Verantwortlichkeiten, Schulungsnachweise, Risikobehandlung, Lieferantenbewertung und ein externes Zertifizierungsaudit liegen außerhalb des Anwendungscodes und müssen organisatorisch geführt werden.
