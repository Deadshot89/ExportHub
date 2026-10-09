# ExportHUB360 Packmeldungen – Design Specification

Date: 2026-10-08
Status: Approved concept, implementation pending
Branch: feature/packmeldungen

## 1. Ziel

ExportHUB360 erhält einen neuen Packmeldungs-Prozess für Sonderkunden. Der Prozess ersetzt den physischen Laufweg vom Packtisch ins Büro, ohne D365 zu verändern oder eine D365-API zu benötigen.

Der Packer scannt einen festen QR-Code am Packtisch, erfasst Versanddaten und lädt Lieferscheine hoch. Nach dem Absenden entsteht in ExportHUB360 eine neue Aufgabe samt Benachrichtigung. Der Export-Mitarbeiter kann die Aufgabe öffnen, Daten prüfen, Dokumente herunterladen und daraus direkt eine normale ExportHUB360-Sendung erzeugen. Die hochgeladenen Lieferscheine werden an die Sendung verknüpft und können anschließend auch auf der AVIS-Seite bereitgestellt werden.

## 2. Nicht-Ziele

- Keine D365-API.
- Keine D365-Anpassung.
- Kein Login für Packer.
- Keine separate zweite Versanddatenbank neben ExportHUB360.
- Kein automatisches Erstellen einer Sendung ohne Prüfung durch den Export-Mitarbeiter.

## 3. Benutzerrollen

### Packer
- scannt Packtisch-QR-Code
- benötigt keinen ExportHUB-Login
- sieht ausschließlich seine neu erzeugte Pack-Session
- erfasst Packdaten
- lädt einen oder mehrere Lieferscheine hoch
- sendet die Packmeldung ab

### ExportHUB-Benutzer
- erhält neue Packmeldung als Aufgabe und Benachrichtigung
- kann Packdaten prüfen und bearbeiten
- kann Lieferscheine anzeigen und herunterladen
- kann aus der Packmeldung eine reguläre Sendung erstellen
- kann die verknüpften Lieferscheine später auf der AVIS-Seite freigeben

## 4. QR- und Session-Modell

Jeder Packtisch erhält einen festen QR-Code mit einem nicht erratbaren Packtisch-Token.

Beispiel:
`/pack/<packstation-token>`

Der QR-Code identifiziert nur den Packtisch, nicht den Packer.

Jeder Scan erzeugt serverseitig eine neue eindeutige Pack-Session. Mehrere Scans desselben QR-Codes müssen vollständig unabhängig voneinander sein.

Beispiel:
- Scan A an PT01 -> Session A
- Scan B an PT01 -> Session B
- Scan C an PT01 -> Session C

Keine Session darf Daten einer anderen Session lesen, überschreiben oder weiterverwenden.

## 5. Packmaske

Pflichtfelder:
- Kunde
- Lieferscheinnummer oder Referenz
- Versandart/Packstücktyp
- Anzahl Packstücke
- Gesamtgewicht
- Maße je Packstück: Länge, Breite, Höhe
- mindestens ein Lieferschein-Upload

Optionale Felder:
- Bemerkung
- weitere Lieferscheine

Die Oberfläche wird mobile-first und packtischtauglich umgesetzt: große Eingabefelder, eindeutige Pflichtfeldmarkierung, wenige Schritte, keine ExportHUB-Navigation.

### 5.1 Kundensuche

Das Kundenfeld verwendet denselben bestehenden ExportHUB-Kundenstamm wie die normale Sendungserfassung. Gesucht wird mindestens nach Kundenname und Kundennummer (`name/customerName`, `account/customerNumber`).

Verhalten:
- Treffer werden während der Eingabe angezeigt.
- Ein Treffer kann direkt ausgewählt werden.
- Existiert kein passender Kunde, bleibt Freitext erlaubt.
- Ein nicht im Kundenstamm vorhandener Kunde muss vor dem Absenden explizit bestätigt werden (`Kunde nicht im Stamm gefunden – trotzdem verwenden`).
- Ein Freitextkunde darf nicht stillschweigend einem ähnlich benannten Stammdatensatz zugeordnet werden.

### 5.2 Verpackungsstamm und Maßübernahme

Die Packmeldung verwendet denselben Verpackungsstamm bzw. dieselbe kanonische Verpackungslogik wie die normale Sendungserfassung. Eine parallele hart codierte Packmeldungs-Liste ist nicht zulässig.

Bei Auswahl einer Verpackungsart werden hinterlegte Standardmaße automatisch in die Packstückzeilen übernommen. Bestehende Grundmaße wie Euro-/Einwegpalette 120×80, Industriepalette 120×100, Düsseldorfer Palette 80×60, Kunststoffpalette 122×116 oder Palettengestell 120×90 werden aus der vorhandenen ExportHUB-Logik wiederverwendet.

Regeln:
- Anzahl Packstücke erzeugt die entsprechende Anzahl Maßzeilen.
- Für gleichartige Packstücke werden die Standardmaße vorbelegt.
- Maße bleiben sichtbar und können für den konkreten Versandfall korrigiert werden.
- Fehlende Höhenwerte werden nicht erfunden.
- Bei Mischsendungen kann jedes Packstück eine eigene Verpackungsart erhalten.

## 6. Datei-Uploads

Mehrere Lieferscheine pro Packmeldung sind erlaubt.

Unterstützte Dokumente in der ersten Version:
- PDF
- JPG/JPEG
- PNG

Dateien werden serverseitig geprüft. Dateityp und Dateigröße werden begrenzt. Dateinamen werden nicht als vertrauenswürdige Identität verwendet.

Nach Absenden bleiben die Dokumente mit der Packmeldung verknüpft. Beim Erstellen einer Sendung werden die vorhandenen Dokumentreferenzen übernommen; die Dateien sollen nicht unnötig physisch dupliziert werden.

### 6.1 Zentrale DNC-/SIDE-Erkennung und automatische PDF-Umbenennung

Die DNC-/SIDE-Erkennung ist keine Packmeldungs-Sonderfunktion, sondern eine gemeinsame ExportHUB-Funktion für alle PDF-Uploads auf der Website.

Ziel:
- PDF-Inhalt auswerten.
- Eindeutige DNC- oder SIDE-Referenz erkennen.
- Nur bei eindeutigem Treffer den gespeicherten/angezeigten PDF-Dateinamen normalisieren.

Namensregeln:
- erkannte DNC -> `DNC<Nummer>.pdf`
- erkannte SIDE -> `SIDE<Nummer>.pdf`
- weder DNC noch SIDE erkannt -> Originaldateiname unverändert
- widersprüchliche oder mehrere nicht eindeutig auflösbare Treffer -> Originaldateiname unverändert

Beispiele:
- `scan_001.pdf` mit eindeutig erkanntem `DNC3019222063` -> `DNC3019222063.pdf`
- `Dokument.pdf` mit eindeutig erkanntem `SIDE250071282` -> `SIDE250071282.pdf`
- `Lieferschein.pdf` ohne eindeutige DNC-/SIDE-Referenz -> bleibt `Lieferschein.pdf`

Weitere Regeln:
- Mehrere hochgeladene PDFs werden einzeln ausgewertet.
- Bereits korrekt benannte PDFs werden nicht unnötig umbenannt.
- Der PDF-Inhalt selbst wird nicht verändert; nur der gespeicherte/angezeigte Dateiname.
- Die Erkennung darf keine Nummer erfinden oder aus unsicheren Treffern raten.
- Normale textbasierte PDFs werden direkt analysiert.
- Reine Scan-/Bild-PDFs werden ohne zuverlässige Texterkennung nicht blind umbenannt; eine spätere OCR-Erweiterung ist separat möglich.
- Die zentrale Funktion wird von Packmeldung, normaler Sendungserfassung, Anhängen und allen weiteren PDF-Uploadpfaden wiederverwendet.

### 6.2 Druckdarstellung von DNC/SIDE

Auf Deckblatt und Ladeliste werden erkannte bzw. normalisierte DNC-/SIDE-Dokumente ohne Dateiendung dargestellt:
- `DNC3019222063.pdf` -> `DNC3019222063`
- `SIDE250071282.pdf` -> `SIDE250071282`

Die tatsächliche gespeicherte Datei behält die Endung `.pdf`; nur die Druckdarstellung blendet die Erweiterung aus.

Für nicht normalisierte Dateien wird der vorhandene Dateiname in der Druckdarstellung nicht inhaltlich umgeschrieben.

## 7. Absenden und Idempotenz

Beim Klick auf `An ExportHUB senden`:
1. Pflichtfelder validieren.
2. Uploads verifizieren.
3. Packmeldung atomar erzeugen.
4. ExportHUB-Aufgabe erzeugen.
5. Benachrichtigung erzeugen.
6. Session als `submitted` sperren.

Doppelklick, Reload oder wiederholter Submit derselben Session darf niemals zwei Aufgaben erzeugen. Hierfür wird ein eindeutiger Session-/Idempotency-Key verwendet.

Nach erfolgreichem Absenden zeigt die Seite eine Bestätigung mit Packmeldungsreferenz. Die übermittelte Meldung ist auf der öffentlichen Packseite nicht mehr editierbar.

## 8. Statusmodell

Öffentliche Pack-Session:
- new
- editing
- submitted
- expired

Interne Packmeldung/Aufgabe:
- new
- in_review
- shipment_created
- registration_in_progress
- registered
- ready_for_dispatch
- completed
- cancelled

Eine Packmeldung ist fachlich noch keine Sendung. Erst `Sendung erstellen` erzeugt/öffnet den normalen ExportHUB-Sendungsprozess.

## 9. ExportHUB-Aufgabe

Eine neue Packmeldung erscheint im bestehenden Aufgabenbereich als eigener Typ `pack_notification` / `Packmeldung`.

Die Aufgabe zeigt mindestens:
- Packmeldungsreferenz
- Kunde
- Packtisch
- Erstellzeit
- Lieferscheinnummer/Referenz
- Anzahl Packstücke
- Gesamtgewicht
- Maße je Packstück
- Bemerkung
- Liste aller hochgeladenen Lieferscheine

Aktionen:
- Öffnen/Ansehen
- Daten bearbeiten
- Dokument anzeigen
- Dokument herunterladen
- Sendung erstellen
- Aufgabe abbrechen/stornieren

## 10. Benachrichtigungen

Beim erfolgreichen Erzeugen einer Packmeldung wird sofort eine ExportHUB-Benachrichtigung erzeugt.

Anzeigeinhalt:
- `Neue Packmeldung`
- Kunde
- Packstücke
- Gewicht
- Packtisch
- Uhrzeit
- Anzahl Lieferscheine

Ein Klick auf die Benachrichtigung öffnet direkt die zugehörige Packmeldung.

Zusätzlich erhält der Aufgabenbereich einen Badge-Zähler für ungelesene/neue Packmeldungen.

Die Meldung bleibt `neu`, bis sie geöffnet oder explizit als gelesen markiert wurde.

Optional vorhandene Browser-/Push-Benachrichtigungswege können denselben Event später verwenden; die In-App-Benachrichtigung ist verpflichtend.

## 11. Sendung aus Aufgabe erstellen

Der Button `Sendung erstellen` öffnet den bestehenden Sendungsdialog mit vorbefüllten Daten aus der Packmeldung.

Zu übernehmen sind mindestens:
- Kunde
- Lieferscheinnummer/Referenz
- Anzahl Packstücke
- Gewicht
- Maße
- Bemerkung, soweit passend
- Dokumentreferenzen der Lieferscheine
- Herkunftsreferenz zur Packmeldung

Der Benutzer bleibt im normalen ExportHUB360-Sendungsprozess und kann sämtliche bestehenden Felder ergänzen oder korrigieren.

Nach erfolgreicher Erstellung:
- Packmeldung -> `shipment_created`
- Packmeldung speichert die Sendungs-ID
- Sendung speichert die Packmeldungs-ID
- erneutes Klicken darf keine zweite Sendung aus derselben Packmeldung erzeugen; stattdessen wird die bestehende Sendung geöffnet

## 12. AVIS-Dokumente

Die aus der Packmeldung übernommenen Lieferscheine sind in der Sendung als Dokumente sichtbar.

Der ExportHUB-Benutzer kann festlegen, welche dieser Dokumente auf der AVIS-Seite für den Kunden freigegeben werden.

Die Dateien müssen weiterhin intern aus der Packmeldung und aus der Sendung manuell heruntergeladen werden können.

## 13. Sicherheit

Der Packbereich ist loginfrei, aber nicht ungeschützt.

Pflichtmaßnahmen:
- langer zufälliger Packtisch-Token
- keine fortlaufend erratbaren Session-IDs
- serverseitige Session-Isolation
- Rate Limiting
- Upload-Größenlimit
- MIME-/Dateitypprüfung
- sichere Dateinamenbehandlung
- keine Ausgabe interner ExportHUB-Daten auf der öffentlichen Seite
- keine globale Aufgaben- oder Sendungssuche im Packbereich
- CSRF-/Replay-Schutz passend zur Architektur
- Logging sicherheitsrelevanter Fehler ohne sensible Dokumentinhalte

Packtisch-Token müssen administrativ deaktivierbar/rotierbar sein.

## 14. Datenmodell

### pack_stations
- id
- name
- token_hash
- active
- created_at
- updated_at

### pack_sessions
- id
- pack_station_id
- status
- idempotency_key
- created_at
- submitted_at
- expires_at

### pack_notifications
- id
- reference
- pack_session_id
- pack_station_id
- customer
- customer_id nullable
- customer_account nullable
- customer_is_custom boolean
- delivery_note_reference
- package_type
- package_count
- total_weight
- note
- status
- shipment_id nullable
- created_at
- updated_at

### pack_notification_packages
- id
- pack_notification_id
- package_no
- packaging_type
- length
- width
- height
- unit

### pack_notification_documents
- id
- pack_notification_id
- document_id
- original_name
- normalized_name nullable
- detected_reference_type nullable (`DNC`/`SIDE`)
- detected_reference nullable
- customer_visible default false
- created_at

Bestehende ExportHUB-Dokument-, Aufgaben-, Kunden-, Verpackungs- und Benachrichtigungsmodelle sind wiederzuverwenden, wo dies ohne Datenkopien und Sonderpfade möglich ist.

## 15. Parallelität

Die Architektur muss explizit folgenden Fall unterstützen:

- Zwei Packer scannen gleichzeitig denselben QR-Code.
- Beide erhalten getrennte Sessions.
- Beide laden unterschiedliche Dokumente hoch.
- Beide senden nahezu gleichzeitig.
- Es entstehen exakt zwei unterschiedliche Packmeldungen und zwei unterschiedliche Aufgaben.
- Kein Feld und kein Dokument überschreibt Daten der jeweils anderen Session.

## 16. Fehlerfälle

- Upload schlägt fehl -> Meldung bleibt ungesendet und kann erneut versucht werden.
- DNC/SIDE nicht eindeutig erkannt -> Datei bleibt unter Originalname erhalten; kein automatisches Raten.
- Kundenstamm ohne Treffer -> Freitext ist erst nach expliziter Bestätigung zulässig.
- Aufgabe konnte nicht erzeugt werden -> Packmeldung darf nicht fälschlich als vollständig übermittelt gelten.
- Benachrichtigung schlägt fehl -> Packmeldung/Aufgabe bleibt bestehen; Fehler wird protokolliert und Benachrichtigung kann nacherzeugt werden.
- Sendungserstellung schlägt fehl -> Packmeldung bleibt `in_review`; kein shipment_created ohne reale Sendungs-ID.
- Browser schließt vor Submit -> keine echte Aufgabe; Session läuft später ab.

## 17. UI in ExportHUB360

Aufgaben-Navigation erhält einen klaren Packmeldungsindikator, beispielsweise:
`Packmeldungen 3`

Die Detailansicht priorisiert:
1. Kunde und Status
2. Packstücke/Gewicht/Maße
3. Lieferscheine
4. Bemerkung/Packtisch/Zeit
5. Primäraktion `Sendung erstellen`

Die bestehende ExportHUB-Designsprache bleibt erhalten.

## 18. Tests / Abnahmekriterien

Mindestens folgende Tests müssen vor Freigabe bestehen:

1. QR öffnet loginfreie Packseite mit gültigem Token.
2. Ungültiger/deaktivierter Token wird abgewiesen.
3. Zwei gleichzeitige Scans desselben QR-Codes erzeugen unabhängige Sessions.
4. Pflichtfelder verhindern unvollständigen Submit.
5. Mehrere Lieferscheine können hochgeladen werden.
6. Doppelklick auf Submit erzeugt nur eine Packmeldung/Aufgabe.
7. Nach Submit erscheint die Packmeldung als neue ExportHUB-Aufgabe.
8. Sofortige In-App-Benachrichtigung wird erzeugt.
9. Klick auf Benachrichtigung öffnet die korrekte Packmeldung.
10. Dokumente lassen sich aus der Aufgabe öffnen und herunterladen.
11. `Sendung erstellen` übernimmt Packdaten und Dokumente.
12. Zweiter Klick auf `Sendung erstellen` öffnet dieselbe Sendung und erzeugt keine Dublette.
13. Übernommene Lieferscheine können in der Sendung für AVIS freigegeben werden.
14. AVIS zeigt nur explizit freigegebene Dokumente.
15. Mobile Darstellung funktioniert ohne horizontales Scrollen oder überlappende Bedienelemente.
16. Bestehende Aufgaben-, Sendungs-, Druck- und AVIS-Funktionen bleiben regressionsfrei.
17. Kundensuche findet bestehende Kunden über Name und Kundennummer.
18. Freitextkunde ist nur nach expliziter Bestätigung zulässig.
19. Verpackungsauswahl übernimmt bestehende Standardmaße in die Packstückzeilen.
20. Mischsendungen erlauben unterschiedliche Verpackungstypen je Packstück.
21. Eindeutige DNC im PDF-Inhalt benennt die Datei in `DNC<Nummer>.pdf` um.
22. Eindeutige SIDE im PDF-Inhalt benennt die Datei in `SIDE<Nummer>.pdf` um.
23. Ohne DNC/SIDE bleibt der Originaldateiname unverändert.
24. Mehrdeutige Treffer führen zu keiner Umbenennung.
25. Mehrere PDFs werden unabhängig voneinander erkannt und normalisiert.
26. Die zentrale DNC/SIDE-Erkennung greift in allen unterstützten PDF-Uploadpfaden.
27. Deckblatt und Ladeliste zeigen normalisierte DNC/SIDE-Namen ohne `.pdf`.
28. Download/Dokumentablage behalten technisch den vollständigen `.pdf`-Dateinamen.

## 19. Rollout

Empfohlener Rollout:
1. Testumgebung mit einem Packtisch-Token.
2. E2E mit zwei parallelen mobilen Sessions.
3. Test einer realistischen BSH-Packmeldung mit mehreren Lieferscheinen.
4. Test der Kundensuche inklusive Freitext-Fallback.
5. Test Verpackungsstamm -> automatische Maßübernahme.
6. Test DNC/SIDE-Erkennung mit echten textbasierten Beispieldokumenten.
7. Prüfung Aufgabe -> Sendung -> AVIS.
8. Prüfung Deckblatt/Ladeliste ohne `.pdf` bei DNC/SIDE.
9. Prüfung Benachrichtigung/Badge.
10. Regression bestehender Sendungs-, Dokument-, Druck- und AVIS-Prozesse.
11. Erst danach Produktion und QR-Code-Druck für alle Packtische.

## 20. Definition of Done

Die Funktion gilt erst als fertig, wenn ein Packer ohne Login per QR eine unabhängige Packmeldung inklusive Lieferscheinen absenden kann, Kunden aus dem bestehenden Kundenstamm suchen oder einen fehlenden Kunden explizit bestätigen kann, Verpackungen aus der bestehenden ExportHUB-Logik inklusive Maßvorbelegung verwenden kann, PDF-Uploads zentral und zuverlässig auf DNC/SIDE geprüft und nur bei eindeutigem Treffer korrekt umbenannt werden, Deckblatt/Ladeliste DNC/SIDE ohne `.pdf` anzeigen, die Packmeldung sofort als Aufgabe und Benachrichtigung in ExportHUB360 erscheint, daraus ohne doppelte Datenerfassung eine reguläre Sendung erzeugt werden kann und dieselben Lieferscheine intern downloadbar sowie gezielt auf der AVIS-Seite freigebbar sind.