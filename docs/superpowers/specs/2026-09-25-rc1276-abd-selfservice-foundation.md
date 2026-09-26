# RC1276 – ABD Self-Service Foundation (isoliert, nicht produktiv verdrahtet)

## Ziel

Die bestehende ABD-Mailanfrage bleibt vorerst unverändert produktiv nutzbar. Parallel wird eine neue, isolierte Grundlage vorbereitet, damit ExportHUB später eine Ausfuhranmeldung positionsweise vorbereiten kann.

Die neue Strecke soll Lieferschein, Rechnung und strukturierte Excel-Daten einlesen, daraus eine nachvollziehbare Positionsauswertung erzeugen und die Daten so aufbereiten, dass sie anschließend kontrolliert in IAA-PLUS / ATLAS oder ein anderes zugelassenes Zollportal übernommen werden können.

Die Foundation wird zunächst **nicht** in `index.html`, `TESTVERSION.html`, `demo.html` oder den Produktions-Build eingebunden.

## Bestehende Funktionen haben Vorrang

- bestehende ABD-Mailanfrage bleibt aktiv
- bestehende ABD-Sperre bleibt unverändert
- bestehende Dokumentablage wird wiederverwendet
- vorhandene `deliveryFiles`, `invoiceFiles`, `abdFiles` und der bestehende Blob-Store bleiben kanonisch
- bestehende QR-, Avis-, POD-, Druck-, Mail- und Statuslogik wird nicht verändert

## Zielprozess

1. Sendung auswählen.
2. Lieferschein(e), Rechnung(en) oder Excel hochladen.
3. Dateien sicher speichern und prüfen.
4. Inhalte extrahieren.
5. Quelldaten positionsweise zusammenführen.
6. Plausibilitätsprüfung ausführen.
7. Unklare oder widersprüchliche Angaben gezielt markieren.
8. Benutzer bestätigt Warennummer, Ursprung und genehmigungs-/unterlagenbezogene Codierungen.
9. Fertige Positionsliste als Portal-Arbeitsansicht bereitstellen.
10. Nach externer Anmeldung MRN / ABD wieder an der Sendung hinterlegen.

Eine spätere direkte ATLAS-Anbindung ist eine eigene Projektphase und setzt die technischen, organisatorischen und zollrechtlichen Voraussetzungen des Unternehmens voraus.

## Datenmodell Kopf

Vorgesehene Felder:

- reference / shipmentId
- exporterName
- exporterEori
- declarant / representative
- consignee
- destinationCountry
- exportCountry
- officeOfExport
- officeOfExit
- goodsLocation
- invoiceNumber
- invoiceDate
- invoiceCurrency
- invoiceTotal
- incoterm
- transportMode
- transportIdentity
- transportNationality
- containerIndicator
- lrn / ucr
- transportDocument
- createdAt / updatedAt
- sourceDocuments[]

## Datenmodell Position

Jede ABD-Position bekommt eine eigene stabile ID und Evidenzquelle.

Pflicht-/Prüffelder:

- positionNo
- articleNumber
- goodsDescription
- hsCode6
- commodityCode8
- originCountry
- destinationCountry
- invoiceValue
- currency
- statisticalValueEur
- netMassKg
- grossMassKg
- packageTypeCode
- packageCount
- packageMarks
- natureOfTransaction
- requestedProcedure
- previousProcedure
- additionalProcedures[]
- supplementaryUnit
- taricAdditionalCodes[]
- nationalAdditionalCodes[]
- supportingDocuments[]
- otherReferences[]
- yCodes[]
- sourceEvidence[]
- confidence
- reviewRequired

## Wichtige fachliche Regel

HS-Code, Warennummer, Ursprung, Y-Codes sowie Genehmigungs-/Unterlagencodes dürfen nicht ohne prüfbare Grundlage automatisch als endgültige Zollangabe gesetzt werden.

ExportHUB darf:
- Daten aus vorhandenen Dokumenten übernehmen,
- bekannte Stammdaten vorschlagen,
- aktuelle Codelisten abgleichen,
- Widersprüche melden,
- Vollständigkeit prüfen.

ExportHUB darf in der Foundation nicht:
- unbekannte Warennummern als sicher erfinden,
- einen Ursprung ohne Nachweis festlegen,
- Y-/Genehmigungscodes ohne fachliche Bestätigung final setzen,
- eine Anmeldung ohne ausdrückliche Benutzeraktion absenden.

## Excel-Import

Empfohlene Spalten der Importvorlage:

- POSITION
- ARTIKELNUMMER
- WARENBESCHREIBUNG
- HS_CODE
- WARENNUMMER_8
- HERKUNFTSLAND
- BESTIMMUNGSLAND
- WARENWERT
- WAEHRUNG
- STATISTISCHER_WERT_EUR
- EIGENMASSE_KG
- ROHMASSE_KG
- PACKSTUECKART
- PACKSTUECKE
- PACKSTUECK_ZEICHEN
- TARIC_ZUSATZCODE
- NATIONALER_ZUSATZCODE
- Y_CODE
- UNTERLAGEN_CODE
- UNTERLAGEN_REFERENZ
- ZUSATZVERFAHREN

Die Importlogik muss alternative Schreibweisen auf definierte kanonische Felder mappen können.

## Plausibilitätsprüfungen

Mindestens:

- Warenbeschreibung vorhanden
- Warennummer für die Ausfuhr vollständig (8 Stellen, soweit erforderlich)
- Ursprungsland als gültiger Ländercode
- Warenwert > 0
- Eigenmasse > 0
- Rohmasse darf nicht kleiner als Eigenmasse sein
- Packstückanzahl / Packstückart plausibel
- Summenabgleich Positionen gegen Rechnung
- Währung vorhanden
- Dubletten erkennen
- fehlende Quellen markieren
- Y-/Unterlagencode als review-pflichtig behandeln
- dynamische Codelisten niemals als dauerhaft feste Wahrheit im Frontend speichern

## Statusmodell der neuen Vorbereitung

- draft
- files_uploaded
- extraction_pending
- extracted
- mapping_required
- validation_required
- ready_for_review
- ready_for_portal
- externally_submitted
- mrn_received
- abd_received
- completed

Fehlerzustände werden getrennt geführt und überschreiben nicht den fachlichen Status.

## Verpackungsstammdaten

ExportHUB unterstützt bereits kundenspezifische/benutzerdefinierte Verpackungen über `state.colliTypes`. Die bisher fest priorisierten E0–E6 bleiben aus Bestandsschutzgründen unverändert.

Geplante Verwaltungsmaske:

- neue Verpackung anlegen
- Name
- Gruppe: Pakete / Paletten / Sonstiges
- Länge / Breite / Höhe
- Standard-LDM
- aktiv / inaktiv
- benutzerdefinierte Verpackung bearbeiten
- benutzerdefinierte Verpackung deaktivieren
- Änderungen versionieren
- bestehende Sendungen behalten ihre gespeicherten Maße

Eine spätere Änderung der fest hinterlegten E0–E6 darf nur über einen kontrollierten Admin-Stammdatenpfad erfolgen und darf alte Sendungen nicht rückwirkend verändern.

## Einführungsphasen

### Phase 0 – bestehende Funktionen
- ABD-Anfragen: neueste Anfrage zuerst
- Verpackungsverwaltung fachlich vorbereiten
- keine Regression in bestehende Prozesse

### Phase 1 – Upload & Import
- Lieferschein / Rechnung / Excel
- sichere Dokumentablage
- Excel-Mapping
- Positionsraster

### Phase 2 – Analyse & Validierung
- Dokumentextraktion
- Summen- und Feldprüfung
- Evidenz je Position
- Review-Workflow

### Phase 3 – Zollcodierungen
- aktuelle ATLAS-Codelisten anbinden
- Unterlagen-/Y-Codes
- VuB-/Genehmigungsprüfung als kontrollierte Prüfschicht
- keine blind gespeicherten statischen Codelisten

### Phase 4 – Portal-Unterstützung
- kopierfertige positionsweise Ansicht
- definierte Reihenfolge analog zum Zielportal
- Exportformat / Arbeitsliste

### Phase 5 – mögliche direkte Übermittlung
Nur nach separater Prüfung von ATLAS-Teilnahme, Schnittstelle, Zertifikaten, Rollen, Berechtigungen, Protokollierung und fachlicher Freigabe.

## Quellenbasis (Stand 25.09.2026)

Primär zu berücksichtigen:
- Unionszollkodex, insbesondere Ausfuhrverfahren
- deutsche Außenwirtschaftsverordnung
- Zoll.de: ATLAS-Ausfuhr / IAA-PLUS
- Merkblatt zu Zollanmeldungen
- ATLAS-Codelisten und Handbücher zu Genehmigungs-/Unterlagencodierungen
- Warenverzeichnis für die Außenhandelsstatistik / EZT
- einschlägige Verbote und Beschränkungen sowie BAFA-Regelungen

Die Codelisten sind dynamisch und müssen versions-/datumsbezogen behandelt werden.
