# ExportHUB Mehr-LKW-Sendungen – Design

## Ziel

ExportHUB muss eine Sendung automatisch in mehrere LKW-Ladeeinheiten aufteilen, sobald die erfasste Ladung die zulässige Kapazität eines einzelnen LKW überschreitet. Die Hauptsendung bleibt fachlich und administrativ erhalten. Darunter entstehen automatisch zwei oder mehr Teil-Sendungen/Ladeeinheiten, die getrennt verladen, per QR-Code abgeholt, gedruckt und als POD abgeschlossen werden können.

## Fachlicher Grundsatz

1. Die bestehende 6-stellige ExportHUB-Referenz bleibt die Referenz der Hauptsendung.
2. Teil-LKW erhalten keine neue 6-stellige Hauptreferenz. Sie erhalten eine interne stabile Ladeeinheits-ID und eine sichtbare Bezeichnung wie `ABC123 · LKW 1 von 2`.
3. Ein LKW kann unabhängig von den anderen LKW abgeholt werden.
4. Jeder LKW hat einen eigenen QR-Code, eine eigene Ladeliste, einen eigenen Stauplan und einen eigenen Abhol-/POD-Status.
5. Die Hauptsendung zeigt weiterhin die Gesamtdaten und den Gesamtfortschritt über alle Teil-LKW.
6. Kein Colli darf doppelt zugeordnet oder bei einer automatischen Neuaufteilung verloren gehen.

## Kapazitätsprofil

Die automatische Teilung wird nicht an eine fest im Code verankerte LKW-Größe gekoppelt. ExportHUB erhält ein zentrales LKW-Kapazitätsprofil.

Ein Profil enthält mindestens:

- `id`
- `name`
- `maxLdm`
- `maxWeightKg`
- `active`
- optional spätere Maße oder weitere Restriktionen

Für den ersten Standard wird ein aktives Profil `Standard-LKW` vorgesehen. Seine konkreten betrieblichen Grenzwerte werden als Konfigurationswerte behandelt und dürfen später durch einen Funktionsadmin geändert werden, ohne die Teilungslogik umzubauen.

Die Kapazitätsentscheidung erfolgt immer über beide Grenzen:

- Summe LDM je Ladeeinheit <= `maxLdm`
- Summe Gewicht je Ladeeinheit <= `maxWeightKg`

Sobald mindestens eine Grenze überschritten würde, muss ein weiterer LKW angelegt werden.

## Verwendung bestehender Colli-Berechnung

Die Mehr-LKW-Funktion darf die Bedeutung der vorhandenen Felder `count`, `weight`, `ldm`, Maße und Verpackung nicht neu interpretieren. Sie muss die bereits in ExportHUB verwendete kanonische Colli-/LDM-Berechnung verwenden.

Dafür wird vor der eigentlichen Teilung eine normalisierte Liste physischer Ladeeinheiten erzeugt. Eine Colli-Zeile mit Anzahl größer 1 darf in einzelne physische Einheiten zerlegt werden, damit beispielsweise 20 Paletten auf LKW 1 und 10 Paletten auf LKW 2 verteilt werden können. Nach der Verteilung dürfen identische Einheiten für die Darstellung wieder zu einer Zeile zusammengefasst werden.

Die Summen über alle Teil-LKW müssen exakt den Summen der Hauptsendung entsprechen:

- physische Anzahl
- Gewicht
- LDM
- Verpackungsarten

Rundungsdifferenzen dürfen keine Colli erzeugen oder verlieren. Die letzte Teilmenge übernimmt nötige Restwerte der kanonischen Berechnung.

## Automatischer Split-Algorithmus

Die automatische Verteilung muss deterministisch sein: Gleiche Eingabedaten und gleiches LKW-Profil erzeugen dieselbe Aufteilung.

Ablauf:

1. Aktive Colli der Hauptsendung normalisieren.
2. Physische Einheiten in stabiler Ursprungsreihenfolge verarbeiten.
3. Einheit dem aktuellen LKW zuordnen, wenn LDM und Gewicht danach innerhalb des Profils bleiben.
4. Würde mindestens eine Grenze überschritten, neuen LKW anlegen und die Einheit dort zuordnen.
5. Nach Abschluss Summen und Vollständigkeit prüfen.
6. Teil-LKW durchnummerieren: 1 bis N.

Wenn eine einzelne physische Einheit alleine größer als die zulässige LKW-Kapazität ist, darf ExportHUB keine scheinbar gültige automatische Aufteilung erzeugen. Die Sendung erhält stattdessen einen klaren Fehlerstatus `Manuelle Ladeplanung erforderlich` mit Angabe des betroffenen Colli und der überschrittenen Grenze.

## Neuaufteilung bei Änderungen

Solange kein Teil-LKW den Status `Abgeholt` oder höher erreicht hat, wird die Aufteilung automatisch neu berechnet, wenn sich kapazitätsrelevante Daten ändern, insbesondere:

- Colli hinzufügen oder entfernen
- Anzahl ändern
- Gewicht ändern
- LDM ändern
- Maße/Verpackung ändern, wenn daraus LDM berechnet wird
- LKW-Profil ändern

Ab dem ersten abgeholten Teil-LKW ist die automatische Gesamt-Neuaufteilung gesperrt. Bereits abgeholte Ladeeinheiten dürfen nie durch spätere Änderungen verändert werden. Änderungen an noch offenen Restmengen müssen ausschließlich auf noch nicht abgeholte Ladeeinheiten wirken.

## Datenmodell der Hauptsendung

Die Hauptsendung bleibt im bestehenden `shipments`-Bestand und behält ihre bisherige Identität über `id` und `ref`.

Neu vorgesehen:

- `multiTruck.enabled`: Boolean
- `multiTruck.profileId`: verwendetes Kapazitätsprofil
- `multiTruck.splitVersion`: Versionsnummer der Aufteilung
- `multiTruck.calculatedAt`: Zeitpunkt der letzten Berechnung
- `multiTruck.loadUnits`: Array der Teil-LKW

Jede Ladeeinheit enthält mindestens:

- `id`: stabile eindeutige ID
- `sequence`: 1..N
- `total`: N
- `displayLabel`: z. B. `ABC123 · LKW 1 von 2`
- `sourceAssignments`: stabile Zuordnung zu den ursprünglichen Colli/physischer Anzahl
- `rows`: nur die diesem LKW zugeordneten Colli
- `totalCount`
- `totalWeightKg`
- `totalLdm`
- `status`
- `createdAt`
- `updatedAt`
- `pickup`
- `pod`
- `generatedDocuments`
- `stowPlan`

Öffentliche QR-/Avis-Tokens dürfen weiterhin nicht ungeschützt im normalen Team-State persistiert werden. Die bestehende Public-Access-Sicherheitslogik bleibt verpflichtend.

## Statuslogik

Jeder Teil-LKW verwendet die bestehende Statuskette eigenständig, soweit sie für die Verladung relevant ist:

`Entwurf -> Erstellt -> Bereit zur Abholung -> Abgeholt -> POD vorhanden -> Abgeschlossen -> Archiviert`

`Storniert` und `Nachbearbeitung` bleiben Sonderzustände.

Die Hauptsendung zeigt einen abgeleiteten Gesamtfortschritt:

- vor Abholung: `0/N abgeholt`
- teilweise abgeholt: `X/N abgeholt`
- alle abgeholt, aber POD noch nicht vollständig: `N/N abgeholt · X/N POD`
- alle POD vorhanden: `N/N POD vorhanden`

Der bestehende Hauptstatus darf erst auf `Abgeholt` wechseln, wenn alle aktiven Teil-LKW mindestens `Abgeholt` sind. Er darf erst auf `POD vorhanden` wechseln, wenn alle aktiven Teil-LKW mindestens `POD vorhanden` sind. Dadurch bleibt bestehende Logik, die mit dem Hauptstatus arbeitet, konsistent.

## QR-Code und Abholseite

Jeder Teil-LKW erhält einen eigenen Public-Access-/Pickup-Datensatz und damit einen eigenen QR-Code.

Der QR-Code für LKW 1 darf ausschließlich LKW 1 öffnen. Die Abholseite zeigt:

- Hauptreferenz
- `LKW 1 von N`
- nur die für diesen LKW vorgesehenen Colli
- Anzahl, Gewicht und LDM dieses LKW
- die für diesen LKW gültige Ladeliste
- vorhandene PIN-/Abholprüfung

Eine erfolgreiche Abholung von LKW 1 darf den Status von LKW 2..N nicht verändern.

Ein QR-Code bleibt an seine stabile `loadUnit.id` gebunden. Eine Neuaufteilung vor Abholung muss veraltete QR-Zugänge sicher invalidieren und neue QR-Zugänge für die neue Split-Version erzeugen, damit ein alter Ausdruck nicht auf eine falsche Colli-Zuordnung verweisen kann.

## Ladelisten und Gesamtdruck

Jede Ladeeinheit erhält eine eigene Ladeliste.

Die Ladeliste enthält mindestens:

- Hauptreferenz
- eindeutige Kennzeichnung `LKW X von N`
- Kunde/Empfänger
- nur die Colli des betreffenden LKW
- Teil-Summe Anzahl
- Teil-Summe Gewicht
- Teil-Summe LDM
- zugehörigen Stauplan
- bisherige verpflichtende Ladelisteninformationen

Der Gesamtdruck der Hauptsendung erzeugt bei Mehr-LKW-Sendungen eine klar getrennte Reihenfolge:

1. QR-Code LKW 1
2. Ladeliste LKW 1
3. zugehörige LKW-1-Dokumentseiten
4. QR-Code LKW 2
5. Ladeliste LKW 2
6. zugehörige LKW-2-Dokumentseiten
7. usw.

Die bestehende Regel, dass ein PDF nicht versehentlich zusätzliche QR-Codes erhält, bleibt erhalten. QR-Seiten werden bewusst und eindeutig je Teil-LKW erzeugt.

## Stauplan

Der bestehende Stauplan wird je Ladeeinheit berechnet und gespeichert. Er darf nur die Colli des betreffenden LKW verwenden.

In der Hauptsendung gibt es eine Übersicht mit Tabs oder Karten:

- `LKW 1 von N`
- `LKW 2 von N`
- usw.

Jeder Bereich zeigt Kapazitätsauslastung in LDM und Gewicht sowie den eigenen Stauplan.

## Dokumente, ABD und Lieferscheine

Kunden-, Liefer- und Zolldokumente bleiben grundsätzlich Dokumente der Hauptsendung. Sie werden nicht unnötig physisch dupliziert.

Teil-LKW dürfen diese Dokumente referenzieren. Erzeugte Ladeeinheitsdokumente wie QR-Code, Ladeliste, Stauplan und POD sind dagegen eindeutig an `loadUnit.id` gebunden.

ABD-Pflicht und `Wartet auf ABD` bleiben eine Sperre der Hauptsendung. Solange die Hauptsendung aufgrund fehlendem ABD nicht versandbereit ist, darf kein Teil-LKW auf `Bereit zur Abholung` gesetzt oder per QR abgeholt werden.

## POD

Jeder Teil-LKW erhält seinen eigenen POD-Nachweis. Ein POD muss eindeutig `shipment.id` und `loadUnit.id` zugeordnet werden.

Der Hauptstatus `POD vorhanden` darf erst erreicht werden, wenn für alle aktiven Teil-LKW ein gültiger POD vorhanden ist.

In Kundenordner und Archiv wird die Zuordnung sichtbar, zum Beispiel:

- `POD · LKW 1 von 2`
- `POD · LKW 2 von 2`

## Benutzeroberfläche

Im Bereich `Colli / LDM` erscheint nach jeder relevanten Änderung eine kompakte Kapazitätsanzeige.

Bei einem LKW:

`1 LKW · 9,8 LDM / Profilgrenze · 8.420 kg / Profilgrenze`

Bei mehreren LKW:

`2 LKW erforderlich`

Darunter werden die Ladeeinheiten mit ihren Teilsummen dargestellt.

In der Sendungsübersicht bleibt jede Hauptsendung genau eine Zeile/Karte. Mehr-LKW-Sendungen erhalten einen Zusatz wie:

`2 LKW · 1/2 abgeholt`

Beim Öffnen der Hauptsendung sind die Teil-LKW vollständig einsehbar.

## Manuelle Anpassung

Die automatische Aufteilung ist der Standard. Vor der ersten Abholung darf ein berechtigter Benutzer Colli zwischen noch offenen LKW verschieben, sofern danach beide Kapazitätsgrenzen eingehalten werden.

Eine manuelle Änderung setzt `multiTruck.manualAdjusted = true`. Anschließend darf eine normale UI-Aktualisierung die manuelle Zuordnung nicht still überschreiben. Eine bewusste Aktion `Automatisch neu verteilen` darf die manuelle Zuordnung zurücksetzen und den Split neu berechnen.

Nach Abholung eines Teil-LKW sind dessen Zuordnungen gesperrt.

## Zusammenführung

Wenn eine zuvor zu große Sendung vor der Abholung so reduziert wird, dass sie wieder in einen LKW passt, wird automatisch auf eine Ladeeinheit zurückgeführt. Veraltete QR-Zugänge der entfernten Ladeeinheiten werden invalidiert.

Nach erfolgter Abholung darf keine automatische Zusammenführung mehr stattfinden.

## Persistenz und Merge-Schutz

Die bestehende verlustschützende Sendungs-Merge-Logik muss um `multiTruck.loadUnits` erweitert werden.

Anforderungen:

- eine leere oder veraltete Client-Kopie darf vorhandene Teil-LKW nicht löschen
- Statusfortschritt einzelner Teil-LKW darf durch ältere Daten nicht zurückgesetzt werden
- POD-, Pickup- und generierte Dokumentdaten müssen je `loadUnit.id` zusammengeführt werden
- eine explizite, neuere Split-Version darf alte noch nicht abgeholte Ladeeinheiten ersetzen
- abgeholte oder weiter fortgeschrittene Ladeeinheiten dürfen nicht durch eine Neuaufteilung verschwinden

## Sicherheitsanforderungen

1. Jeder Pickup-QR wird serverseitig an `shipment.id`, `loadUnit.id` und `splitVersion` gebunden.
2. Ein Token für LKW 1 darf niemals Daten oder Aktionen von LKW 2 öffnen.
3. Veraltete Split-Versionen werden bei öffentlichem Zugriff abgewiesen.
4. Bestehende PIN-, Lockout-, Token-Hash- und Public-Access-Regeln bleiben bestehen.
5. Normale Team-State-Daten enthalten keine Klartext-Pickup-Tokens.

## Fehlerfälle

ExportHUB muss verständlich blockieren statt Daten still falsch aufzuteilen, wenn:

- kein aktives LKW-Profil verfügbar ist
- eine einzelne physische Einheit größer als die LKW-Kapazität ist
- Colli-Daten keine belastbare LDM-/Gewichtsberechnung zulassen
- eine Neuaufteilung abgeholte Teil-LKW verändern würde
- ein gespeicherter Split unvollständig oder widersprüchlich ist

Bei einem fehlerhaften Split bleibt die Hauptsendung erhalten und bearbeitbar, solange ihre normale Statussperre dies erlaubt.

## Rückwärtskompatibilität

Bestehende Sendungen ohne `multiTruck` bleiben gültig und verhalten sich wie bisher als Ein-LKW-Sendung.

Beim Öffnen oder Bearbeiten kann die Kapazitätsprüfung berechnen, ob eine bestehende noch nicht abgeholte Sendung künftig einen Mehr-LKW-Split benötigt. Bereits abgeholte, abgeschlossene oder archivierte Alt-Sendungen werden nicht rückwirkend umgebaut.

Die 6-stellige Referenzprüfung, Kundenlogik, ABD-Regeln, bestehende Statuskette, Dokumentpflichten, QR-Sicherheit und Sperrregel ab `Abgeholt` bleiben erhalten.

## Testvertrag

Die Umsetzung muss mindestens folgende Fälle automatisiert absichern:

1. Sendung innerhalb der Kapazität -> exakt eine Ladeeinheit.
2. Überschreitung LDM -> zwei Ladeeinheiten.
3. Überschreitung Gewicht -> zwei Ladeeinheiten.
4. Drei oder mehr LKW werden korrekt erzeugt.
5. Gesamtanzahl, Gesamtgewicht und Gesamt-LDM bleiben nach Split identisch.
6. Eine Colli-Zeile mit Anzahl > 1 kann physisch über mehrere LKW aufgeteilt werden.
7. Eine einzelne zu große physische Einheit blockiert automatisch mit manueller Ladeplanung.
8. Jeder LKW hat eine eigene stabile ID und einen eigenen QR-Zugang.
9. QR von LKW 1 kann LKW 2 weder anzeigen noch abholen.
10. Abholung LKW 1 ändert LKW 2 nicht.
11. Hauptstatus wird erst `Abgeholt`, wenn alle LKW abgeholt sind.
12. Hauptstatus wird erst `POD vorhanden`, wenn alle LKW POD besitzen.
13. Ladeliste LKW 1 enthält ausschließlich Colli von LKW 1.
14. Ladeliste LKW 2 enthält ausschließlich Colli von LKW 2.
15. Stauplan wird je Teil-LKW separat erzeugt.
16. Änderung vor Abholung löst deterministische Neuaufteilung aus.
17. Alte QR-Tokens werden nach Neuaufteilung ungültig.
18. Abgeholte Ladeeinheit wird durch spätere Änderung nicht verändert.
19. Manuelle Zuordnung bleibt erhalten, bis bewusst automatisch neu verteilt wird.
20. Bestehende Ein-LKW-Sendungen bleiben ohne Datenmigration nutzbar.
21. Merge eines älteren Clients löscht keine Teil-LKW, Pickup- oder POD-Daten.
22. ABD-Sperre blockiert weiterhin alle Teil-LKW.
23. Gesamtdruck enthält je LKW genau den vorgesehenen QR- und Ladelistenblock.
24. Bestehende RC997-Sendungs-, Druck- und QR-Verträge bleiben grün.

## Abnahmekriterien

Die Funktion gilt als fachlich fertig, wenn eine zu große Sendung ohne manuelles Anlegen zusätzlicher Hauptsendungen automatisch in die erforderliche Anzahl LKW aufgeteilt wird und jeder LKW unabhängig mit eigenem QR-Code, eigener Ladeliste, eigenem Stauplan, eigener Abholung und eigenem POD verarbeitet werden kann, während ExportHUB die Hauptsendung weiterhin als eine zusammenhängende Kunden-/Export-Sendung verwaltet.
