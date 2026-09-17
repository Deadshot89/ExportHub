# Kundenportal-Zugangsdaten – Design

## Ziel
ExportHUB soll kundenspezifische Login-Daten für externe Kundenportale zentral im Kundenstamm speichern und in „Sendung erstellen“ automatisch passend zum ausgewählten Kunden bereitstellen. Die Funktion ist nur für ausdrücklich berechtigte Benutzer sichtbar und verwendbar.

## Geltungsbereich
- Speicherung der Portalzugänge am Kunden, nicht an der Sendung.
- Unterstützung mehrerer Portalzugänge pro Kunde.
- Anzeige der passenden Portalzugänge in der Kachel „Kundenportal“ unter „Sendung erstellen“.
- Rechtegesteuerte Nutzung und Verwaltung.
- Erneute Bestätigung mit dem persönlichen ExportHUB-Passwort vor Offenlegung sensibler Zugangsdaten.
- Audit-Protokoll für Anzeigen, Ändern und Löschen ohne Speicherung des eigentlichen Passworts im Protokoll.

## Datenmodell
Jeder Kunde erhält ein optionales Feld `portalCredentials`, das eine Liste von Portalzugängen enthält. Ein Portalzugang besitzt mindestens:

- `id`: stabile technische ID.
- `name`: Anzeigename des Portals, z. B. „Bosch Supplier Portal“.
- `url`: Portal-URL.
- `usernameEncrypted`: verschlüsselter Benutzername.
- `passwordEncrypted`: verschlüsseltes Passwort.
- `note`: optionale interne Notiz.
- `active`: Aktivstatus.
- `createdAt`, `createdBy`, `updatedAt`, `updatedBy`.

Benutzername und Passwort dürfen nicht unverschlüsselt im ausgelieferten HTML, im Browser-LocalStorage oder im allgemein synchronisierten ExportHUB-State gespeichert werden.

## Verschlüsselung und Geheimnisverwaltung
Portal-Benutzername und Portal-Passwort werden serverseitig verschlüsselt. Der für die Verschlüsselung erforderliche Schlüssel kommt aus einer serverseitigen Azure-Konfiguration und wird niemals an den Browser ausgeliefert oder in das Repository geschrieben.

Für neue Verschlüsselung wird ein authentifiziertes Verfahren mit zufälligem IV/Nonce verwendet. Ein verschlüsselter Datensatz enthält nur Ciphertext und die zum Entschlüsseln erforderlichen nicht-geheimen Metadaten. Manipulierte Ciphertexte müssen bei der Entschlüsselung abgewiesen werden.

## Berechtigungen
Es werden zwei eigenständige Rechte ergänzt:

### `customerPortal.use`
Erlaubt:
- Kachel „Kundenportal“ in „Sendung erstellen“ sehen.
- vorhandene Portalnamen und Portal-URLs sehen.
- Portal öffnen.
- nach erfolgreicher Re-Authentifizierung Benutzername und Passwort entschlüsseln, anzeigen und kopieren.

### `customerPortal.manage`
Erlaubt zusätzlich:
- Portalzugänge im Kundenstamm anlegen.
- ändern.
- deaktivieren oder löschen.

Globale Administratoren besitzen beide Rechte automatisch. Für alle anderen Benutzer werden die Rechte über das vorhandene ExportHUB-Rechtesystem vergeben.

Benutzer ohne `customerPortal.use` sehen in „Sendung erstellen“ keine Kundenportal-Kachel und erhalten auch über direkte API-Aufrufe keine Zugangsdaten.

## Kundenstamm
Im Kundenordner wird ein neuer geschützter Bereich „Kundenportal“ eingefügt. Dort werden die zu diesem Kunden gehörenden Portalzugänge verwaltet.

Ansicht für Benutzer mit `customerPortal.manage`:
- Portalname.
- Portal-URL.
- Benutzername verdeckt.
- Passwort verdeckt.
- optionale Notiz.
- Status aktiv/inaktiv.
- letzte Änderung.
- Aktionen: Bearbeiten, Löschen/Deaktivieren, Zugangsdaten anzeigen.

Beim Anlegen oder Ändern werden Zugangsdaten ausschließlich an einen geschützten Server-Endpunkt übertragen und dort verschlüsselt gespeichert.

## Sendung erstellen
Unter „Sendung erstellen“ wird eine neue Kachel „Kundenportal“ in den kundenbezogenen Bereich integriert.

Verhalten:
1. Noch kein Kunde ausgewählt: neutrale Information „Bitte zuerst einen Kunden auswählen“ oder die Kachel bleibt leer.
2. Kunde ausgewählt, kein Portal hinterlegt: „Für diesen Kunden ist kein Kundenportal hinterlegt.“
3. Kunde ausgewählt, ein Portal hinterlegt: Portalname und Aktionen anzeigen.
4. Kunde ausgewählt, mehrere Portale hinterlegt: Auswahl der aktiven Portale dieses Kunden anbieten.
5. Kunde wird gewechselt: alle vorher geladenen oder offengelegten Zugangsdaten sofort aus der UI entfernen und nur Daten des neuen Kunden laden.

Die Sendung selbst speichert keine Kopie der Zugangsdaten.

## Re-Authentifizierung
Die Aktion „Zugangsdaten anzeigen“ fordert das persönliche ExportHUB-Passwort des aktuell angemeldeten Benutzers an.

Der Server prüft:
- gültige aktive ExportHUB-Sitzung.
- Benutzer besitzt `customerPortal.use`.
- eingegebenes Passwort gehört zum aktuell angemeldeten Benutzer.
- gewünschter Portalzugang gehört zum angeforderten Kunden.

Nur bei Erfolg werden Benutzername und Passwort entschlüsselt und an diese konkrete Anfrage zurückgegeben.

Nach der Offenlegung werden die Zugangsdaten nach kurzer Zeit wieder verdeckt. Bei Kundenwechsel, Logout, Navigation aus „Sendung erstellen“ oder Ablauf der Sitzung werden die Klartextwerte sofort aus der UI entfernt.

## API-Grenzen
Die Funktion wird als eigener Serverbereich umgesetzt, damit die Secrets nicht in die bestehende allgemeine Kunden-/State-Synchronisierung gelangen.

Benötigte Operationen:
- Metadaten der Portalzugänge für einen Kunden abrufen, ohne Secrets.
- Portalzugang anlegen.
- Portalzugang ändern.
- Portalzugang löschen/deaktivieren.
- einen konkreten Portalzugang nach Passwort-Re-Authentifizierung entschlüsseln.

Jede Operation validiert die Berechtigung serverseitig. Clientseitige Rechteprüfung dient nur der UI und ersetzt niemals die Serverprüfung.

## Audit
Folgende Aktionen werden protokolliert:
- Portalzugang angelegt.
- Portalzugang geändert.
- Portalzugang deaktiviert/gelöscht.
- Zugangsdaten erfolgreich angezeigt.
- unberechtigter bzw. fehlgeschlagener Offenlegungsversuch.

Das Audit enthält Benutzer, Zeitpunkt, Kunde, Portal-ID/Portalname und Aktion. Benutzername und Passwort des Kundenportals werden nicht in Auditdaten geschrieben.

## Sicherheitsregeln
- Keine Portal-Passwörter in GitHub, HTML, JavaScript-Bundles, LocalStorage, SessionStorage, allgemeinen State-Dateien oder Log-Ausgaben.
- Keine Klartext-Rückgabe in Kundenlisten oder Sendungsdaten.
- Kein Zugriff allein aufgrund einer sichtbaren Kachel; Serverrechte sind zwingend.
- Kein Zugriff auf Portalzugänge eines anderen Kunden durch manipulierte IDs.
- Kein gemeinsames Master-Passwort für die Offenlegung.
- Re-Authentifizierung immer gegen das persönliche ExportHUB-Passwort.
- Fehlertexte dürfen nicht verraten, ob fremde Portal-IDs existieren.

## UI
### Kundenstamm
Neue Sektion:

**Kundenportal**

Portalname  
Portal-URL  
Benutzername: `••••••••`  
Passwort: `••••••••`  
Notiz  

Aktionen: `Portal öffnen`, `Zugangsdaten anzeigen`, `Bearbeiten`, `Löschen`.

### Sendung erstellen
Neue Kachel:

**Kundenportal**

`<Portalname>`  
Benutzer: `••••••••`  
Passwort: `••••••••`  

Aktionen: `Portal öffnen`, `Zugangsdaten anzeigen`.

„Zugangsdaten anzeigen“ öffnet einen kleinen Sicherheitsdialog:

„Zur Sicherheit bitte dein ExportHUB-Passwort bestätigen.“

## Fehlerbehandlung
- Falsches ExportHUB-Passwort: Zugangsdaten bleiben verdeckt; standardisierte Fehlermeldung.
- Keine Berechtigung: HTTP 403 und keine Secret-Rückgabe.
- Kunde/Portal passen nicht zusammen: generische Nicht-verfügbar-Antwort; keine Information über fremde Datensätze.
- Verschlüsselungsschlüssel fehlt: Speichern und Offenlegen werden blockiert; bestehende übrige ExportHUB-Funktionen bleiben nutzbar.
- Entschlüsselung fehlschlägt: kein Klartext, Audit-Sicherheitsereignis und verständliche Fehlermeldung für berechtigte Benutzer.

## Tests und Abnahmekriterien
Die Funktion gilt als fertig, wenn mindestens folgende Fälle automatisiert geprüft sind:

1. Benutzer ohne Portalrecht sieht keine Kachel und kann keinen Secret-Endpunkt verwenden.
2. Benutzer mit `customerPortal.use` sieht nur Portale des ausgewählten Kunden.
3. Benutzer mit `customerPortal.manage` kann Portalzugänge im Kundenstamm pflegen.
4. Falsches persönliches Passwort liefert keine Zugangsdaten.
5. Korrektes persönliches Passwort liefert nur den angeforderten Portalzugang des angeforderten Kunden.
6. Manipulierte Kunden-/Portal-Kombination liefert keine Daten.
7. Kundenwechsel entfernt zuvor offengelegte Klartextdaten sofort.
8. Portalzugänge erscheinen nicht im allgemeinen Kunden-/Sendungs-State im Klartext.
9. Audit enthält die Aktion, aber niemals das Kundenportal-Passwort.
10. Bestehende Funktionen „Kunden“, „Sendung erstellen“, Login und Rechtesystem bleiben funktionsfähig.

## Nicht im Scope
- Automatisches Login in fremde Kundenportale.
- Browser-Passwortmanager-Funktionalität.
- Teilen der Zugangsdaten per E-Mail.
- Hinterlegen der Portalzugänge direkt an einzelnen Sendungen.
- Gemeinsames Master-Passwort für alle Mitarbeiter.
