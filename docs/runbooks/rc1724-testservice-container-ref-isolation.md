# RC1724 – TESTSERVICE-Containerfotos strikt von Produktion trennen

## Problem
Der öffentliche QR-Upload schreibt Containerfotos zuerst nach Azure und danach
in die Microsoft-365-REF-Ablage. Die bisherige Funktion
`reference-folder-upload.upload(reference, name, buffer, mimeType)` erhielt
keine Umgebung und konnte einen TESTSERVICE-Upload damit an das Produktions-
REF-Ziel oder den Benutzer-Default-Drive senden. Ein E2E-Test könnte echte
Kundenordner verändern.

## Verbindliche TESTSERVICE-Einstellung
Nur in der Azure Static Web App **TESTSERVICE**, nach unabhängig geprüfter
Ordnerzuordnung und App-Berechtigung, folgende App-Settings hinterlegen:

- `EXPORTHUB_TEST_REFERENCE_DRIVE_ID` – Drive-ID einer separaten TESTSERVICE-Bibliothek
- `EXPORTHUB_TEST_REFERENCE_FOLDER_ID` – ID des dort existierenden REF-Stammordners

Die Ziel-IDs müssen **nicht** im Repository oder in CI-Logs veröffentlicht werden.
Beide sind erforderlich, auch wenn die Produktions-REF-Ablage noch den älteren
Benutzerpfad verwendet. Ohne das geprüfte Paar schlägt ein TESTSERVICE-Foto
bewusst mit `GRAPH_TEST_REFERENCE_TARGET_NOT_CONFIGURED` fehl, **bevor**
Graph kontaktiert wird. Wenn das Paar mit der expliziten Produktionskonfiguration
identisch ist, wird `GRAPH_TEST_REFERENCE_TARGET_NOT_ISOLATED` gemeldet.

Produktionsaufrufe (ohne Umgebung oder mit `production`) verwenden
unverändert `EXPORTHUB_REFERENCE_DRIVE_ID` /
`EXPORTHUB_REFERENCE_FOLDER_ID` beziehungsweise den Legacy-User-Drive.

## Isolierter Nachweistest
1. Unter Admin-Zugriff ausschließlich lesend prüfen, dass das TESTSERVICE-Ziel
   existiert, eine Ordner-Facette besitzt und von der Graph-App erreichbar ist.
2. Mit eigenem, unbenutztem sechsstelligen E2E-Referenzcode eine Testsendung
   im TESTSERVICE anlegen. Keine reale Sendung/Referenz verwenden.
3. Über deren echten QR-Abhol-Link nacheinander die drei JPEG-Fotoarten
   `loaded`, `number`, `sealed` hochladen.
4. Nur bei `referenceFolderSaved=true`, `storedUnderReference=true` und
   `linkedToShipment=true` als erfolgreich werten. Per Graph GET Foto-ID,
   Name, Größe und Parent-ID unabhängig bestätigen.
5. Nach Browser-Neustart in der Sendungsansicht alle drei Fotos als Vorschau
   laden und herunterladen. Den Azure-Download der exakt richtigen
   `shipmentId` verifizieren; falsche Sendungs-ID muss abgewiesen werden.
6. Testdaten und Testbilder **nur nach expliziter Zuordnung** kontrolliert
   entfernen; niemals produktive REF-Ordner, Original-PODs oder QR-Daten löschen.

Diese Codeänderung stellt die **Sperre und Zielauswahl** bereit. Sie bestätigt
keine tatsächliche SharePoint-Konfiguration, keinen Live-Upload und keine
erfolgreiche Produktion. Freigabe erst nach isoliertem End-to-End-Nachweis.
