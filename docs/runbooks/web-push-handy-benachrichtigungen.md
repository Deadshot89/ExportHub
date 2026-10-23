# Handy-Benachrichtigungen per Web Push

Bisher kamen Benachrichtigungen nur, solange ExportHUB im Browser offen und angemeldet war. Mit Web Push schickt der Server sie selbst. Sie kommen deshalb auch bei geschlossenem Browser und ohne Login an.

## Für Benutzer

1. In ExportHUB unter **Benachrichtigungen** bei „Handy-Benachrichtigungen“ auf **Auf diesem Gerät aktivieren** tippen und die Browser-Abfrage erlauben. Das ist einmal pro Gerät nötig.
2. Mit **Testnachricht senden** prüfen, ob die Benachrichtigung ankommt.
3. Danach kommen ohne Login:
   - **Aufgaben-Erinnerungen** zu den TaskPlanner-Zeiten der Aufgabe (Standard 09:00, 13:00 und 15:30 Uhr, nur an Arbeitstagen in NRW). Es gelten dieselben Regeln wie auf der Website: Zuständigkeit, Fälligkeit, Zurückstellen und Feiertage.
   - **Neue Packmeldungen**, sofort beim Eingang. Diese bekommen nur Benutzer mit Bearbeitungsrecht.
4. Beim Antippen öffnet sich eine Detailseite (`/assets/web-push/inbox.html`), die ohne Anmeldung lesbar ist. Erst „In ExportHUB öffnen“ führt in den geschützten Bereich.
5. Ausschalten geht in ExportHUB oder auf der Detailseite, auch ohne Login.

Unterstützt werden Chrome, Edge und Firefox auf Android, Windows und Mac. Auf dem iPhone/iPad geht es ab iOS 16.4: ExportHUB in Safari über Teilen → „Zum Home-Bildschirm“ hinzufügen, über das neue Symbol öffnen und dort aktivieren. Die Android-Test-App (WebView) kann kein Web Push. Auf Android ExportHUB deshalb in Chrome öffnen und dort aktivieren.

## Technik

| Teil | Datei |
| --- | --- |
| Push-Versand (VAPID, aes128gcm, ohne Fremdpaket) | `api/shared/web-push.js` |
| Geräte und Versandprotokoll | `api/shared/web-push-store.js`, Blob `web-push/subscriptions.json` bzw. `testservice/web-push/subscriptions.json` |
| Fällige Erinnerungen (TaskPlanner-V2-Regeln) | `api/shared/web-push-reminders.js` + Kopie `api/shared/taskplanner-v2/` |
| API | `api/web-push` (`/api/web-push`) |
| Zeitplan | `.github/workflows/web-push-reminders.yml`, stündlich an Werktagen, Anmeldung per GitHub-OIDC |
| Packmeldung-Sofortpush | `api/pack-notification` ruft `createPackNotifier` auf, maximal 5 s, Fehler blockieren die Meldung nicht |
| Browser | `assets/web-push/` (Service Worker, Client, Detailseite, Manifest, Icons), eingebunden über `build-three-env.mjs` (nicht in der Demo) |

- **Keine Einrichtung nötig:** Den VAPID-Schlüssel erzeugt der Server beim ersten Aufruf und speichert ihn im Blob `web-push/vapid-keys.json`. Optional lässt er sich über die App-Settings `EXPORTHUB_WEB_PUSH_VAPID_PUBLIC_KEY` und `EXPORTHUB_WEB_PUSH_VAPID_PRIVATE_KEY` (base64url) vorgeben. Wenn der Schlüssel wechselt, müssen alle Geräte neu aktivieren.
- **Notaus:** `EXPORTHUB_WEB_PUSH_ENABLED=false`. Danach wird nichts mehr gesendet, und Abmelden bleibt möglich.
- **Kein Doppelversand:** Das Versandprotokoll merkt sich jede Erinnerung (Aufgabe, Tag, Zeit, Benutzer). Eine verspätete GitHub-Ausführung sendet nur später, nie doppelt. Bei einer Störung des Push-Dienstes holt der nächste Lauf den Versand nach.
- **Aufräumen:** Geräte, die der Push-Dienst als abgemeldet meldet (404/410), nach 20 Fehlversuchen in Folge oder von deaktivierten Benutzern werden entfernt.
- **Sicherheit:** Endpunkte sind nur zu bekannten Push-Diensten erlaubt (kein SSRF). Für Aktivieren und Test ist eine Sitzung nötig. Status, Abmelden und Kategorien laufen über die geheime Geräte-Adresse. Der Inhalt ist Ende-zu-Ende für das Gerät verschlüsselt.
- **TaskPlanner geändert?** Nach Änderungen an `assets/taskplanner-v2-{core,recurrence,ui}.js` die Kopie aktualisieren: `cp assets/taskplanner-v2-{core,recurrence,ui}.js api/shared/taskplanner-v2/`. Der Test `test/web-push.test.mjs` schlägt sonst fehl.

## Prüfen

- Workflow „Web Push Aufgaben-Erinnerungen“ manuell starten (`workflow_dispatch`). Das Log zeigt je Umgebung `subscriptions`, `messages`, `sent`, `failed` und `removed`.
- Tests: `node --test test/web-push.test.mjs`
