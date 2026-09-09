# RC1017 – Abholkalender Visual Addendum

## Ziel

Der bestehende Abholkalender behält seine fachliche Trennung zwischen fixen Abholungen und konkreten Sendungen, erhält aber eine eindeutige visuelle Codierung.

## Freigegebene Regeln

1. **Konkrete Sendungen / Avis-bestätigte Abholungen werden blau dargestellt.**
2. **Der Kundenname muss auf jeder Sendungskarte sichtbar stehen.**
3. **Fixe Abholungen werden grün dargestellt.**
4. Die bestehende Trennung `FIX` und `SENDUNG` bleibt erhalten.
5. Die Farben gelten sowohl in der Heute-Ansicht als auch in der Wochenansicht.
6. Die Änderung betrifft nur Darstellung und Kundenbezeichnung; Termin-, Status-, Pickup-, Avis-, Rechte- und Persistenzlogik werden nicht verändert.
7. Falls mehrere mögliche Kundenfelder vorhanden sind, wird der fachlich beste vorhandene Name verwendet. Die Auflösung soll mindestens `customerName`, `customer`, `recipientCustomerName`, `recipient`, `locationName` berücksichtigen.
8. Wenn kein Kundenname vorhanden ist, wird weiterhin ein verständlicher Fallback angezeigt; die Karte darf nicht leer oder kaputt rendern.

## Technische Umsetzung

Der vorhandene Kalender trennt die Kartentypen bereits über die Klassen `pickup-item-fix` und `pickup-item-shipment`. Diese bestehenden Klassen werden für die Farbgebung verwendet. Es wird keine zweite Kalenderkomponente eingeführt.

`renderShipmentCard()` zeigt den Kundenname explizit als beschriftete Information, z. B. `Kunde: <Name>`. Die bestehende Funktion `shipmentCustomer()` wird nur so erweitert, dass die realen Kundenfelder zuverlässig abgedeckt werden.

## Tests

Mindestens folgende Verträge sind testgetrieben abzusichern:

1. `pickup-item-fix` besitzt eine grüne Karten-/Badge-Darstellung.
2. `pickup-item-shipment` besitzt eine blaue Karten-/Badge-Darstellung.
3. Sendungskarten enthalten sichtbar `Kunde:` plus aufgelösten Kundennamen.
4. `recipientCustomerName` wird als Kundenname erkannt.
5. Heute- und Wochenansicht verwenden denselben Renderer und damit dieselbe Farb-/Kundenregel.
6. Keine Änderung an Datumsermittlung, Status, Colli-Restmenge, Bearbeitungsrechten oder Pickup-Aufrufen.

## Bestandsschutz

Der bestehende Abholkalender-Entwurf `docs/superpowers/specs/2026-09-08-abholkalender-design.md` bleibt vollständig gültig. Dieses Dokument ergänzt ausschließlich die freigegebene Farb- und Kundenanzeigeregel.