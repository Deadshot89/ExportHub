# RC1003 – Android-Benachrichtigungen direkt und sicher öffnen

## Ziel

ExportHUB-Benachrichtigungen auf Android, insbesondere Fehlerdiagnosen und operative Warnungen, sollen beim Antippen direkt die zugehörige Detailansicht öffnen, ohne den Benutzer erneut durch die normale Website-Anmeldung oder die Firmen-/Bereichsauswahl zu schicken.

Der Direktzugriff darf die bestehende Mandanten- und Rollenisolierung nicht umgehen. Ein Benachrichtigungslink darf ausschließlich genau den freigegebenen Datensatz öffnen, für den er erzeugt wurde.

## Ausgangslage

Die Android-App erzeugt bereits native Benachrichtigungen mit einem `PendingIntent` und übergibt `environment` sowie `route` an `EnvironmentActivity`. Die Activity lädt anschließend die reguläre ExportHUB-Weboberfläche in einer WebView und hängt die Zielroute als Query-Parameter an. Wenn dort keine gültige Website-Sitzung vorliegt oder der aktuelle Benutzerkontext nicht passt, landet der Nutzer erneut im Login oder erhält eine Bereichs-/Berechtigungsfehlermeldung.

## Architektur

### 1. Sicherer Notification-Entry

Für jede direkt öffnende Benachrichtigung erzeugt der Server einen kurzlebigen, einmalig nutzbaren Notification-Entry-Token.

Der Token ist mindestens gebunden an:
- Zielumgebung: `production`, `testservice` oder `demo`
- Benachrichtigungstyp: z. B. `diagnostic`, `warning`, `task`
- konkrete Ziel-ID des Datensatzes
- erlaubte Aktion/Ansicht
- Ablaufzeitpunkt
- einmalige Verwendung
- optional Geräte-/Empfängerbindung, sofern für den bestehenden Push-Kanal verfügbar

Der Token gewährt keinen allgemeinen Website-Zugriff und keine Navigation außerhalb der freigegebenen Detailansicht.

### 2. Native Android-Detailansicht

Beim Antippen einer passenden Push-/lokalen Benachrichtigung öffnet die App nicht mehr zuerst die normale ExportHUB-Webseite, sondern eine eigene native Benachrichtigungs-Detailansicht.

Diese Ansicht zeigt mindestens:
- Titel
- Zeitstempel
- Typ und Schweregrad
- betroffenen ExportHUB-Bereich
- kurze Fehler-/Warnbeschreibung
- relevante Referenz, sofern vorhanden
- Status des Tokens bzw. verständliche Meldung bei Ablauf

Mögliche Aktionen werden ausschließlich serverseitig freigegeben. Beispiele:
- `In ExportHUB öffnen`
- `Diagnose ansehen`
- `Als gelesen markieren`
- `Erledigt`, falls der Datensatz das ausdrücklich unterstützt

### 3. Token-Auflösung

Die App sendet den Notification-Entry-Token an einen separaten API-Endpunkt. Dieser prüft Signatur/Tokenwert, Ablaufzeit, Einmaligkeit, Umgebung, Zieltyp und Ziel-ID.

Bei Erfolg liefert der Endpunkt nur die Daten zurück, die für diese Benachrichtigung freigegeben sind. Erst wenn eine Aktion in den normalen ExportHUB-Arbeitsbereich wechseln soll, wird der reguläre Authentifizierungs- und Rollenfluss verwendet.

### 4. Kein Login-Bypass für den normalen Arbeitsbereich

Der Direktzugriff ersetzt die ExportHUB-Anmeldung nicht. Er ist ausschließlich ein eingeschränkter Benachrichtigungszugang.

Wenn der Nutzer aus der Detailansicht in einen normalen geschützten Bereich wechselt und dort keine gültige Sitzung besteht, darf ExportHUB weiterhin eine Anmeldung verlangen.

## Android-Änderungen

Die bestehende `NotificationHelper`-Logik wird so erweitert, dass Benachrichtigungen einen expliziten Notification-Entry statt nur eine Website-Route transportieren können.

`EnvironmentActivity` bleibt der normale ExportHUB-Arbeitsbereich. Für Notification-Entries wird eine getrennte Activity bzw. ein klar getrenntes natives UI verwendet, damit die normale WebView-Anmeldelogik den Direktzugriff nicht mehr blockiert.

Das Android-Manifest bekommt die dafür nötige Activity-/Deep-Link-Deklaration. Bestehende Produktion/TESTSERVICE/Demo-Trennung bleibt erhalten.

## Server/API-Änderungen

Es wird ein enger Benachrichtigungs-Endpunkt ergänzt, der keine allgemeine Session erstellt. Seine Aufgabe ist ausschließlich:
1. Notification-Entry-Token validieren
2. Zielobjekt und Umgebung prüfen
3. minimierte Detaildaten liefern
4. Token bei Einmalnutzung verbrauchen
5. Zugriff sicher protokollieren

Fehlerfälle liefern keine internen IDs, keine Firmendaten und keine zusätzlichen Details, die außerhalb des freigegebenen Datensatzes liegen.

## Sicherheitsregeln

- Keine dauerhaften Zugangstoken in Push-Nachrichten.
- Tokens sind kurzlebig und einmalig verwendbar.
- Ein Token gilt immer nur für genau ein Zielobjekt und eine erlaubte Ansicht/Aktion.
- Kein Firmenwechsel und keine freie Navigation über einen Notification-Entry.
- Keine Daten anderer Mandanten im Fehlerfall.
- Tokenwerte werden nicht im Klartext in Diagnoseprotokollen gespeichert.
- Produktion, TESTSERVICE und Demo akzeptieren keine Tokens der jeweils anderen Umgebung.
- Abgelaufene, manipulierte, bereits verwendete oder falsch gebundene Tokens werden abgelehnt.

## Benutzerführung

Beim Antippen einer Fehlerdiagnose soll der Nutzer sofort eine ruhige, native Detailansicht sehen statt der Website-Startseite oder eines JavaScript-Dialogs.

Beispielstruktur:
- `ExportHUB Fehlerdiagnose`
- Statuschip `Kritisch`, `Warnung` oder `Info`
- `08.09.2026 · 09:12`
- kurze Ursache
- betroffener Bereich
- Referenz/Sendung, falls relevant
- Primäraktion `Diagnose ansehen`
- Sekundäraktion `In ExportHUB öffnen`

Ist der Link nicht mehr gültig, zeigt die App eine native Meldung wie `Diese Benachrichtigung ist nicht mehr gültig. Öffne ExportHUB, um den aktuellen Stand zu sehen.`

## Teststrategie

Die Implementierung erfolgt testgetrieben.

Pflichttests:
- Benachrichtigung öffnet native Detailansicht statt Web-Login
- gültiger Token liefert ausschließlich den freigegebenen Datensatz
- abgelaufener Token wird abgelehnt
- bereits verwendeter Token wird abgelehnt
- manipuliertes Token wird abgelehnt
- Token aus TESTSERVICE funktioniert nicht in Produktion
- Zugriff auf fremde Firma/Mandant wird verhindert
- normale App-Navigation bleibt anmeldungs- und rollenpflichtig
- bestehende Benachrichtigungskanäle bleiben funktionsfähig
- Android-Build und bestehende Regressionstests bleiben grün

## Release-Vorgehen

Die Umsetzung erfolgt isoliert auf `rc1003-android-notification-direct-open`, basierend auf dem geprüften RC1002-Stand. `main` und Produktion werden während Entwicklung und Test nicht direkt verändert.

Nach grünem Build und erfolgreichen Sicherheits-/Regressionstests kann der Stand separat für TESTSERVICE freigegeben werden. Eine Produktionsübernahme erfolgt erst nach expliziter Freigabe.