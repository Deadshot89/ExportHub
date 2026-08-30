# Aktuelle Migrations-Baseline

Professional 0.2 wurde gegen einen echten Legacy-Export aus ExportHUB Internal geprüft.

Die Quelle besitzt keinen modernen `type/version/exportedAt`-Kopf. Sie besteht aus den Top-Level-Strukturen `state` und `users`. Die Quellversion wird deshalb bei der Migration explizit als Versionshinweis bestätigt und zusätzlich durch SHA-256 an die konkrete Quelldatei gebunden.

Wichtig: Ein Versionshinweis ändert keine Daten im Backup. Er dient ausschließlich der Dokumentation der Herkunft.
