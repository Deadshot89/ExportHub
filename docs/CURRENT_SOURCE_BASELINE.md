# Aktuelle Migrations-Baseline – RC826

Professional 0.3 wurde gegen das echte Legacy-Backup aus ExportHUB Internal geprüft. Die Quelle besitzt keinen modernen `type/version/exportedAt`-Kopf und wird daher als `legacy-state-users` mit bestätigtem Versionshinweis RC826 behandelt.

## Bestands-Baseline

- 65 eindeutige Kunden
- 208 Sendungs-Quellstände → 128 eindeutige Sendungen
- 23 Benutzer
- 602 Dokument-Quellobjekte → 305 eindeutige Dokumente
- 68 eindeutige POD-Dokumentartefakte
- 61 Sendungen mit POD-Evidenz

## Dokumentstatus

- 61 eingebettete Dateien per SHA-256 verifiziert
- 32 Remote-Dokumente müssen vor Cutover separat gesichert werden
- 212 Dokumentartefakte besitzen im Backup keinen Dateiinhalte und bleiben ausdrücklich offen
- 35 POD-Dokumente sind noch nicht vollständig lokal verifiziert

## Dokumentarten

- 68 POD
- 151 Lieferscheine
- 35 ABD
- 48 sonstige Dokumente
- 2 Rechnungen
- 1 Ladeliste

Alle 35 ABD-Dokumente, 68 POD-Dokumente und 151 Lieferschein-Dokumente konnten einer Sendungsreferenz zugeordnet werden.

Die Quellversion ist über den SHA-256-Fingerprint an die konkrete Backup-Datei gebunden. Der detaillierte RC826-Dokumentbericht wird aus Datenschutzgründen nicht in das Professional-Quellrepository aufgenommen.
