# RC1004 – Abholkalender Design

## Ziel

ExportHUB erhält einen Abholkalender für den operativen Alltag. Die Oberfläche führt zwei bewusst getrennte Informationsquellen zusammen:

1. **Fixe Abholungen** als wiederkehrende Stammdaten.
2. **Angemeldete Sendungen** als konkrete Sendungsvorgänge aus dem bestehenden ExportHUB-Sendungs- und Pickup-Zustand.

Beide Quellen werden gemeinsam angezeigt, aber weder technisch noch fachlich ineinander umgewandelt.

## Freigegebene Grundregeln

- Der Kalender zeigt ausschließlich **Montag bis Freitag**.
- Der Kalender benötigt **keine Uhrzeiten und keine Zeitfenster**.
- Oberhalb der Wochenansicht gibt es eine kompakte **Heute-Übersicht**.
- Jeder Wochentag enthält zwei getrennte Bereiche:
  - **Fixe Abholungen**
  - **Angemeldete Sendungen**
- Fixe Abholungen werden eindeutig als **FIX** gekennzeichnet.
- Konkrete Sendungen werden eindeutig als **SENDUNG** gekennzeichnet.
- Eine angemeldete Sendung wird niemals automatisch zu einer fixen Abholung.
- Eine fixe Abholung erzeugt niemals automatisch eine Sendung.
- Eine Teilabholung bleibt als offene Sendung sichtbar, bis die vollständige Restmenge abgeholt wurde.
- Nur administrative Benutzer dürfen fixe Abholungen anlegen, ändern, deaktivieren oder wieder aktivieren.
- Normale Mitarbeiter dürfen fixe Abholungen nur lesen.

## Architekturentscheidung

Es wird die freigegebene Variante **„zwei getrennte Datenquellen, eine gemeinsame Oberfläche“** umgesetzt.

### Datenquelle A – Fixe Abholungen

Fixe Abholungen erhalten einen eigenen, von Sendungen unabhängigen Stammdatenbereich. Die Persistenz wird über ein eigenes Store-Modul aufgebaut, das die bereits vorhandenen ExportHUB-Muster für Umgebungs- und Firmenisolation nutzt. Dafür ist keine neue Datenbank erforderlich.

Ein fixer Datensatz enthält mindestens:

- `id`
- Firmen-/Mandantenbezug
- Standort- oder Kundenbezeichnung
- Wochentag: Montag, Dienstag, Mittwoch, Donnerstag oder Freitag
- Wiederholung: wöchentlich, solange der Eintrag aktiv ist
- optionaler Hinweis
- Aktivstatus
- Erstellungs- und Änderungszeitpunkt

Es gibt bewusst **kein Feld für Uhrzeit oder Zeitfenster**. Weitere Wiederholungsintervalle wie zweiwöchentlich oder monatlich gehören nicht zum ersten Umfang.

Mehrere fixe Abholungen dürfen am selben Wochentag existieren. Derselbe Standort darf auch an mehreren Wochentagen vorkommen.

Fixe Abholungen werden nicht hart gelöscht. Im ersten Umfang werden sie deaktiviert und können später wieder aktiviert werden. Deaktivierte Einträge erscheinen nicht in der normalen Heute- oder Wochenansicht, bleiben aber in der Admin-Verwaltung sichtbar. Dadurch bleiben Änderungen nachvollziehbar und versehentliche Datenverluste werden vermieden.

### Datenquelle B – Angemeldete Sendungen

Angemeldete Sendungen werden nicht in einen neuen Kalender-Datenspeicher kopiert. Die Kalenderansicht liest sie als Projektion aus den bestehenden ExportHUB-Sendungs- und Pickup-Daten.

Für die Anzeige werden insbesondere genutzt:

- Sendungsreferenz
- Kunde/Empfänger
- geplanter Abholtag
- Spedition, sofern vorhanden
- Gesamt-Colli
- bereits abgeholte Colli
- offene Rest-Colli
- Pickup-/Sendungsstatus

Der Kalender verwendet für die Zuordnung den Abholtag. Technisch vorhandene Uhrzeiten dürfen in den Quelldaten bestehen bleiben, werden für diesen Kalender aber weder benötigt noch als planungsrelevante Information dargestellt.

Sendungen ohne geplanten Abholtag werden nicht künstlich einem Wochentag zugeordnet. Sie bleiben in den bestehenden Sendungs- und Aufgabenansichten sichtbar.

## Teilabholungen

Die bereits vorgesehene Teilabholung bleibt vollständig auf der Sendungsseite.

Nach einer Teilabholung:

- Status: **Teilweise abgeholt**
- bereits abgeholte Colli werden angezeigt
- offene Rest-Colli werden angezeigt
- die Sendung bleibt in der Abholübersicht offen
- der QR-Abholvorgang bleibt für die Restmenge nutzbar
- jede weitere Teilabholung wird historisch getrennt erfasst

Erst wenn die Restmenge `0` erreicht, gilt die Sendung als vollständig abgeholt und wechselt in den abgeschlossenen Abholstatus.

Eine Teilabholung verändert niemals einen FIX-Stammdatensatz.

## Heute-Übersicht

Die Heute-Übersicht steht oberhalb der Wochenansicht und zeigt nur den aktuellen Kalendertag, sofern dieser Montag bis Freitag ist.

Sie enthält zwei getrennte Gruppen:

- heutige fixe Abholungen
- heutige angemeldete Sendungen

Samstag und Sonntag werden nicht als normale Kalendertage dargestellt. An diesen Tagen kann die Heute-Fläche lediglich darauf hinweisen, dass heute kein regulärer Abholkalendertag ist.

## Wochenansicht

Die Hauptansicht zeigt fünf Spalten oder responsive Tageskacheln:

- Montag
- Dienstag
- Mittwoch
- Donnerstag
- Freitag

Jeder Tag hat intern zwei klar beschriftete Bereiche:

### Fixe Abholungen

Darstellung je Eintrag:

- Badge `FIX`
- Standort/Kunde
- optionaler Hinweis
- Aktivstatus nur dort, wo administrative Bearbeitung angezeigt wird

### Angemeldete Sendungen

Darstellung je Eintrag:

- Badge `SENDUNG`
- Referenz
- Kunde/Empfänger
- Spedition, falls vorhanden
- Colli-Gesamtmenge
- bei Teilabholung: bereits abgeholt / noch offen
- Status

Ein automatisches Matching zwischen FIX und SENDUNG findet nicht statt, auch wenn Kundenname oder Standort gleich sind. So bleibt die fachliche Trennung eindeutig.

## Bearbeitung der fixen Abholungen

Administratoren erhalten in der Abholübersicht einen Verwaltungsbereich für fixe Abholungen.

Unterstützte Aktionen:

- neue fixe Abholung anlegen
- bestehenden Eintrag bearbeiten
- Wochentag ändern
- Hinweis ändern
- deaktivieren
- wieder aktivieren

Normale Mitarbeiter sehen keine schreibenden Bedienelemente.

Die Berechtigungsprüfung darf nicht nur im Frontend stattfinden. Schreibzugriffe müssen serverseitig über die bestehenden Authentifizierungs-, Rollen- und Firmenkontexte abgesichert werden.

## Mandanten- und Umgebungsisolation

Fixe Abholungen müssen genau wie andere ExportHUB-Firmendaten isoliert gespeichert werden.

Ein Datensatz gehört immer zu:

- genau einer Firma/Mandant
- genau einer Umgebung, z. B. Testservice oder Produktion

Ein Benutzer darf keine fixen Abholungen einer anderen Firma lesen oder verändern, sofern seine bestehende Rolle dies nicht ausdrücklich erlaubt.

Testservice-Daten dürfen niemals Produktionsdaten verändern.

## API- und Komponentenstruktur

Für fixe Abholungen wird ein eigener fachlicher Bereich vorgesehen, beispielsweise:

- API für Lesen und administrative Änderungen
- eigenes Store-Modul für Persistenz und Mandanten-/Umgebungsisolation
- Frontend-Komponente für Heute- und Wochenansicht
- Admin-Dialog für Anlage, Änderung und Aktivstatus

Die bestehende Pickup-Logik bleibt für reale Sendungen die Quelle der Wahrheit. Es wird keine zweite Kopie von Pickup-Historie, Restmengen oder Abholstatus angelegt.

## Fehlerverhalten

Die beiden Datenquellen sollen unabhängig voneinander fehlschlagen können.

Wenn fixe Abholungen nicht geladen werden können:

- angemeldete Sendungen bleiben sichtbar
- der FIX-Bereich zeigt eine verständliche Fehlermeldung

Wenn Sendungsdaten nicht geladen werden können:

- fixe Abholungen bleiben sichtbar
- der SENDUNG-Bereich zeigt eine verständliche Fehlermeldung

Bei einem fehlgeschlagenen Admin-Speichervorgang darf kein Erfolg angezeigt werden. Die eingegebenen Werte sollen im Dialog erhalten bleiben, damit der Benutzer nicht erneut alles eingeben muss.

## Startinhalt / Kundendaten

Der Code enthält **keine hart codierten Kunden- oder Standort-Stammdaten**.

Der gewünschte erste fachliche Inhalt ist auf folgende Gruppe begrenzt:

- die vom Benutzer genannten Essentra-Standorte/Länder
- O Hare
- BMP

Es werden ausdrücklich keine weiteren Kunden automatisch ergänzt.

Da die vollständige Essentra-Liste in der aktuellen technischen Arbeitsgrundlage nicht zuverlässig vorliegt, werden keine Namen geraten. Die konkreten Fix-Abholungsdatensätze werden erst mit den exakt freigegebenen Namen über die Admin-Verwaltung eingetragen.

## Nicht im Umfang

Nicht Teil dieses Designs sind:

- Uhrzeiten oder Zeitfenster
- Samstag und Sonntag als Kalendertage
- andere Wiederholungsintervalle als wöchentlich
- automatische Umwandlung FIX ↔ SENDUNG
- automatische Zuordnung eines FIX-Termins zu einer Sendung
- neue Kundenstammdaten außerhalb der ausdrücklich freigegebenen Gruppe
- ein zweiter unabhängiger Pickup-Statusspeicher
- automatische Produktionsveröffentlichung

## Tests und Abnahmekriterien

Die Implementierung wird testgetrieben aufgebaut. Mindestens folgende Verträge müssen geprüft werden:

1. Der Kalender zeigt nur Montag bis Freitag.
2. Für fixe Abholungen existieren keine Uhrzeit- oder Zeitfensterfelder.
3. Aktive fixe Abholungen wiederholen sich wöchentlich am gespeicherten Wochentag.
4. Deaktivierte fixe Abholungen verschwinden aus Heute- und Wochenansicht, bleiben aber administrativ verfügbar.
5. Heute-Ansicht und Wochenansicht trennen FIX und SENDUNG eindeutig.
6. Mitarbeiter können fixe Abholungen lesen, aber nicht verändern.
7. Admins können fixe Abholungen anlegen, ändern, deaktivieren und reaktivieren.
8. Firmen- und Umgebungsisolation verhindert fremde Schreib- und Lesezugriffe.
9. Eine konkrete Sendung wird niemals durch Kalenderlogik in einen FIX-Datensatz umgewandelt.
10. Ein FIX-Datensatz erzeugt niemals automatisch eine Sendung.
11. Teilabholungen bleiben mit korrekter Restmenge offen.
12. Erst Restmenge `0` führt zur vollständigen Abholung.
13. Fehler einer Datenquelle dürfen die andere Datenquelle nicht unbrauchbar machen.
14. Bestehende Aufgaben-, QR-Abholungs-, Pickup-, Diagnose- und Build-Regressionen bleiben grün.

## Rollout-Regel

Die Umsetzung erfolgt zunächst auf einem isolierten Entwicklungszweig und wird vollständig getestet. Produktion wird nicht direkt verändert. Erst nach vollständiger Verifikation und Review darf der Stand über den vorgesehenen Release-Weg weitergegeben werden.
