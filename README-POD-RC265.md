# ExportHUB RC265 — POD-Backend

Diese Dateien ersetzen die NOT_IMPLEMENTED-Platzhalter für den echten digitalen POD.

## Zu ersetzende Dateien im GitHub-Repo

| Datei in diesem Paket | Pfad im Repo | Aktion |
|---|---|---|
| api-shared-pickup-store.js | /api/shared/pickup-store.js | ersetzen (oder neu anlegen) |
| api-pickup-confirm-index.js | /api/pickup-confirm/index.js | ersetzen |
| api-pickup-status-index.js | /api/pickup-status/index.js | neu anlegen |
| api-pickup-pod-index.js | /api/pickup-pod/index.js | ersetzen (Platzhalter entfernen) |
| api-pickup-confirm-function.json | /api/pickup-confirm/function.json | ersetzen |
| api-pickup-status-function.json | /api/pickup-status/function.json | neu anlegen |
| api-pickup-pod-function.json | /api/pickup-pod/function.json | ersetzen |

## Was sich ändert

### pickup-confirm (erweitert)
- Empfängt zusätzlich Felder: `signature`, `signatureData`, `signatureDataUrl` oder `driverSignature` (Base64-Data-URL)
- Speichert die Unterschrift als PNG/JPEG-Blob in Azure Storage
- Setzt `signatureBlobName`, `signatureContentType`, `signatureUploadedAt` im Record
- Bestehende PIN-/Token-Logik bleibt unverändert

### pickup-pod (neu implementiert)
- GET /api/pickup-pod?token=XXX
- Lädt die Unterschrift aus Azure Storage und liefert sie als Bild zurück
- Content-Type: image/png (oder image/jpeg)
- Das Frontend (fetchProof) liest das Bild als Blob → Data-URL → sh.pickupDriverSignature
- Dadurch erscheint die Unterschrift automatisch auf der Ladeliste

### pickup-status (neu)
- GET /api/pickup-status?token=XXX
- Liefert Status, confirmedAt, hasSignature, signatureBlobName, podFiles etc.
- Wird vom Frontend genutzt, um zu prüfen ob ein POD vorhanden ist

### shared/pickup-store.js
- Neue shared-Bibliothek mit allen Hilfsfunktionen
- Azure-Blob-Storage-Clients, Record read/write, Signature upload/download
- Enthält: json, body, err, now, hash, safeEqualHex, validToken, expired,
  readJson, writeJson, uploadBytes, downloadBytes, clients, globalPin,
  mutateRecord, publicRecord, createConfirmationPod, updateTeam

## Voraussetzungen

- Azure Storage Container `exporthub-data` muss existieren
- Application Settings:
  - EXPORTHUB_STORAGE_CONNECTION_STRING (Pflicht)
  - EXPORTHUB_STORAGE_CONTAINER (optional, default: exporthub-data)
  - EXPORTHUB_PICKUP_PIN (optional, 4-stellige PIN; sonst aus Signing-Secret abgeleitet)
  - EXPORTHUB_RECORDS_PREFIX (optional, default: records/)
  - EXPORTHUB_SIGNATURES_PREFIX (optional, default: signatures/)

## Vor dem Deploy

1. Dateien in die entsprechenden Pfade kopieren
2. Azure-Build abwarten (GitHub Actions)
3. Mit Testsendung prüfen:
   - QR öffnen
   - Unterschrift erfassen
   - PIN bestätigen
   - Sendungsübersicht: POD vorhanden
   - POD herunterladen: Ladeliste 1 + 2 mit sichtbarer Unterschrift

## Hinweise

- Alte Bestätigungen ohne gespeicherte Unterschrift können nicht rekonstruiert werden.
- Derselbe QR kann nach diesem Update erneut unterschrieben werden, solange im
  Record confirmedAt vorhanden, aber signatureBlobName fehlt.
- pickup-complete ist nicht Teil dieses Pakets — falls das Frontend /api/pickup-complete
  aufruft, muss diese Funktion separat implementiert oder als pickup-pod-Alias angelegt werden.
