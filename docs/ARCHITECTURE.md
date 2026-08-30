# ExportHUB Professional 0.1 – Architektur

Professional wird parallel zu ExportHUB Internal entwickelt. Der aktuelle interne RC-Stand bleibt eigenständig.

## Phase 0.1

- statische, modulare Web-App
- Azure-Functions-kompatible API-Struktur
- keine produktive Datenbankverbindung
- Read-only-Migrationsprüfung
- Mandantenmodell bereits im Zieldatenmodell
- vollständige Herkunftszuordnung über Source Pointer

## Zielmodule

- Dashboard
- Mandanten
- Benutzer & Rollen
- Kunden
- Sendungen
- Dokumente
- Aufgaben & Planung
- Audit
- Plattformadministration

## Zieldatenbank

Das mitgelieferte PostgreSQL-Schema ist ein Entwurf für die spätere persistente Plattform. Es wird in 0.1 noch nicht automatisch ausgeführt.
