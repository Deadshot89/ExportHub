# Abholseite: Container-Dokumentation zuletzt

## Ziel

Nach Colli-Prüfung folgen Fahrer/Fahrzeug, Fahrerunterschrift und Verlader-PIN. Die optionale bzw. bei Seefracht verpflichtende Siegel- und Drei-Foto-Dokumentation steht unmittelbar vor den Buttons zum Abschluss.

## Bestehende Architektur

`pickup.html` lädt das QR-Token, zählt Colli blind, lädt jedes Foto einzeln über `pickup-container-document` hoch und bestätigt die Abholung über `pickup-confirm-v2`. `container-document-store` legt die Bilddaten in Azure Blob sowie per Microsoft Graph im echten Ref-Ordner ab. `rc1014-shipment-overview.js` stellt geschützte Foto-Vorschauen in der Sendungsansicht bereit.

## Ansatz und Abwägung

- **Gewählt:** Vorhandene Abschnitte und die Bestands-APIs beibehalten, die Reihenfolge und Freigabelogik gezielt ändern. Geringes Risiko für bestehende QR-Links und Speicherung.
- **Nicht gewählt:** Vollständiger Wizard-Neubau. Höheres Risiko für Teilabholung, Unterschrift, PIN und QR-Wiederherstellung ohne Mehrwert für den Wunsch.

## Regeln

- Colli-Prüfung zuerst; die drei Foto-Felder nach Fahrer und Bestätigung.
- Nach korrekter Colli-Zahl werden Fahrerformular und Fotobereich freigegeben, auch wenn noch keine Fotos vorliegen.
- Bei verpflichtender Seefracht-Dokumentation bleibt der finale Abschluss ohne Siegel und alle drei erfolgreich gespeicherten Bilder gesperrt.
- Teilabholung bleibt ohne Fotos möglich; andere Transportarten behalten freiwillige Dokumentation.
- Foto-Upload gilt erst als erfolgreich, wenn Blob, Ref-Ordner und Team-Sendungsverknüpfung erfolgreich waren. Bestehende geschützte Vorschau und Download bleiben erhalten.
- Bereits ausgegebene QR-Links sowie POD- und Versandstatus-Logik bleiben unverändert.

## Verifikation

Regressionstest für HTML-Reihenfolge und die Freigabe der Fahrerdaten bei noch fehlenden Fotos; vorhandene Upload-, Ref-Ordner-, Bildvorschau- und Server-Abschlusstests; Syntax-, Build- und Gesamtprüfung.
