# Exportexperte Upgrade – Self-Review Addendum

Datum: 12.10.2026
Status: mit der Designfreigabe verbindlich

Dieses Addendum präzisiert die freigegebene Variante B und ändert den Bestandsschutz nicht.

## Verbindliche Präzisierungen

1. **Mehrwährung:** Warenwerte werden niemals stillschweigend zwischen Währungen umgerechnet. Eine Kontrollsumme ist nur innerhalb derselben Währung fachlich gültig. Treffen mehrere Währungen aufeinander, wird das Ergebnis als prüfpflichtig markiert.
2. **Ungeklärte Positionen:** Positionen mit fehlendem oder unbestätigtem HS-Code, Ursprungsland oder Warenwert bleiben in `unassigned` und werden nicht in geprüfte ABD-Gruppen eingerechnet.
3. **Eine Rechenquelle:** UI, PDF, Excel und die Übergabe in den bestehenden ABD-Prozess verwenden dieselbe Gruppierungs- und Summenlogik. Es gibt keine parallelen Berechnungen im Frontend oder Exportcode.
4. **Kontrollsumme:** `difference = invoiceTotal - groupedTotal` wird nach jeder fachlich relevanten Änderung neu berechnet. Eine Abweichung verhindert den Status „vollständig geprüft“.
5. **AV-Aufgabe:** Die Aufgabe für einen fehlenden Ausgangsvermerk wird idempotent über `missing-av:<abdRequestId>` erzeugt. Wiederholte Prüfungen dürfen keine zweite offene Aufgabe erzeugen.
6. **AV-Abschluss:** Sobald ein gültiger AV hinterlegt ist, wird die zugehörige offene Missing-AV-Aufgabe automatisch abgeschlossen. Das Entfernen oder Ungültigmachen eines AV darf den Status nicht fälschlich als vorhanden belassen.
7. **Bestandsschutz:** Manuell erstellte ABD-Anfragen und aus Sendungen erzeugte ABD-Anfragen bleiben technisch und fachlich in ihrem bestehenden Ablauf. Die neue Startauswahl ist ausschließlich Routing; neue Analysefunktionen dürfen die alten Wege nicht voraussetzen.
8. **Rückwärtskompatibilität:** Bestehende `abdRequests` ohne neue Analyse-, AV- oder Customs-Felder bleiben vollständig lesbar und bearbeitbar.

Diese Punkte sind in allen Implementierungsplänen und Release-Gates mitzunehmen.