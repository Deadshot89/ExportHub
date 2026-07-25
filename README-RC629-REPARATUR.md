# ExportHUB RC629 — Reparatur-Paket

Dieses ZIP enthält alle reparierten und neuen Dateien mit der korrekten Repo-Struktur.

## Was wurde repariert

### Root-Cause-Fixes (Deploy-Probleme)
1. **staticwebapp.config.json** — war eine Functions-Bindung, ist jetzt eine echte SWA-Konfiguration mit Routing, Fallback und Security-Headern.
2. **api/package.json** — war ungültig (enthielt JS-Code), ist jetzt eine gültige package.json mit @azure/storage-blob als Abhängigkeit.
3. **api/exporthub-auth/index.js** — der JS-Code aus der alten package.json, jetzt am richtigen Ort als Azure Function.

### Fehlende Functions
4. **api/exporthub-auth/function.json** — mit route: "exporthub-auth", damit /api/exporthub-auth nicht mehr 404 liefert.
5. **api/pickup-disable/** — neue Function (function.json + index.js), die ein QR-Token deaktiviert. Erfordert Authentifizierung und Bearbeitungsrechte.

### Login-Screen-Optimierungen (index.html)
6. Passwortfeld: autocomplete="current-password" (statt "off")
7. Neuer "Passwort vergessen?"-Link unter dem Anmelden-Button
8. Link leitet auf Admin-Recovery weiter (Passwort-Reset nur durch Admins)
9. CSS für den Link-Button

### CI/CD Pipeline vereinfacht
10. **.github/workflows/...yml** — von 4 Deploy-Versuchen auf 1 reduziert, da Root Causes behoben sind.

## Datei-Übersicht

```
/
├── index.html                                    # angepasster Login-Screen
├── staticwebapp.config.json                      # korrigiert (war Functions-Bindung)
├── .github/workflows/
│   └── azure-static-web-apps-...yml              # vereinfacht (1 Versuch statt 4)
└── api/
    ├── package.json                              # korrigiert (war JS-Code)
    ├── host.json                                 # unverändert
    ├── local.settings.example.json               # unverändert
    ├── exporthub-auth/
    │   ├── function.json                         # NEU (route hinzugefügt)
    │   └── index.js                              # aus alter package.json verschoben
    ├── exporthub-state/
    │   ├── function.json
    │   └── index.js
    ├── pickup-init/
    │   ├── function.json
    │   └── index.js                              # echter Code (RC548)
    ├── pickup-confirm/
    │   ├── function.json
    │   └── index.js
    ├── pickup-pod/
    │   ├── function.json
    │   └── index.js                              # Platzhalter — Original aus Repo übernehmen
    ├── pickup-health/
    │   ├── function.json
    │   └── index.js
    └── pickup-disable/                           # NEU
        ├── function.json
        └── index.js
```

## WICHTIG — vor dem Deploy prüfen

1. **api/pickup-pod/index.js** ist ein Platzhalter. Bitte den Originalcode aus deinem Repo übernehmen — ich konnte ihn nicht aus der index.html sicher extrahieren.
2. **api/exporthub-auth/index.js** verwendet shared/auth-store.js und shared/user-policy.js. Stelle sicher, dass das shared/-Verzeichnis existiert.
3. **api/pickup-disable/index.js** verwendet shared/pickup-store.js mit den Methoden mutateRecord(), validToken(), publicRecord(). Falls diese anders heißen, anpassen.
4. **local.settings.json** (ohne .example) NICHT committen — nur local.settings.example.json ist enthalten.
5. **SWA Secret AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310** muss in GitHub Secrets gesetzt sein.

## Noch offen (manuell zu beheben)

- eval() in index.html (Zeile 12057) — Legacy-Code auslagern
- document.write an 3 Stellen — auf DOM-API umstellen
- 49× console.log in Produktion entfernen
- Auth-Header-Schreibweise vereinheitlichen (kosmetisch)
