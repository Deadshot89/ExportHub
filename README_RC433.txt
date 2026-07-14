ExportHUB Private RC433 – separate QR-Abholseite und Azure-API
===================================================================

Dieses Paket muss vollständig in das Stammverzeichnis des GitHub-Repositories kopiert werden:

- index.html                         Hauptanwendung (Microsoft-Anmeldung erforderlich)
- pickup.html                        kleine öffentliche Abholbestätigung für Fahrer
- staticwebapp.config.json           öffentliche QR-Seite + geschützte Hauptanwendung
- api/                               Azure Functions für Token, Einmalbestätigung und POD
- WORKFLOW_AENDERUNG_RC433.yml       erforderliche Workflow-Werte

WICHTIG
=======
Nur index.html hochzuladen reicht nicht. pickup.html, staticwebapp.config.json und der komplette
Ordner api müssen im Repository liegen. In Azure Static Web Apps muss außerdem die App-Einstellung
AzureWebJobsStorage auf ein Azure-Storage-Konto zeigen.

GitHub-Actions-Workflow
=======================
Im vorhandenen Workflow unter .github/workflows/azure-static-web-apps-....yml müssen die Werte sein:

app_location: "/"
api_location: "api"
output_location: ""

Die vorhandene Azure-Deployment-Token-Zeile darf nicht ersetzt oder gelöscht werden.

Sicherheits- und Zugriffslogik
==============================
- / und index.html: Microsoft/Entra-Anmeldung erforderlich
- /pickup.html: öffentlich, damit Fahrer kein Microsoft-Konto benötigen
- /api/pickup-init: nur für angemeldete ExportHUB-Benutzer
- Status, Bestätigung und POD: über zufälligen 48-stelligen Token + festen PIN 25846
- Im API-Speicher wird intern 025846 gehasht; der PIN steht nicht im QR-Code
- QR kann genau einmal die Abholung bestätigen
- Nach fünf falschen PINs: 15 Minuten Sperre
- POD-Upload: nur in der bestätigten Sitzung, maximal 60 Minuten

Ablauf nach Deployment
=======================
1. Alle Paketdateien nach GitHub kopieren und committen.
2. Workflow auf api_location: "api" prüfen.
3. Azure Portal > Static Web App > Configuration > Application settings:
   AzureWebJobsStorage setzen.
4. GitHub-Deployment abwarten.
5. ExportHUB mit Microsoft anmelden.
6. In „Sendung erstellen“ den Button „QR-Dienst testen“ drücken.
7. Erst wenn „QR-Dienst und Speicher sind bereit“ angezeigt wird, Ladeliste 1 drucken.
8. QR mit einem Handy scannen und PIN 25846 eingeben.

Fehleranzeige
=============
Die neue pickup.html zeigt sofort eine verständliche Meldung, wenn:
- der API-Ordner nicht deployt wurde,
- api_location nicht auf api zeigt,
- AzureWebJobsStorage fehlt,
- der QR-Token noch nicht registriert ist,
- der QR bereits verwendet oder abgelaufen ist.
