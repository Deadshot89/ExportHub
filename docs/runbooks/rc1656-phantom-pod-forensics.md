# RC1656 – P0 #987: Vier Phantom-POD-Fälle zunächst ausschließlich lesend untersuchen

**Ziel:** Bereits von berechtigten Administratoren gesicherte Produktions-Team-State-Snapshots
in einer **geschützten lokalen Umgebung** auf verdächtige POD-Statuswerte, widersprüchliche
Kopien in `shipments` / `savedShipments` und wiederverwendete interne Editor-IDs prüfen.

Dies **ist kein Produktionsreparaturwerkzeug** und stellt keine Verbindung zu Azure, GitHub,
anderen Diensten oder der produktiven API her. Das Skript verändert niemals die Eingabedatei.

## Sicherer Ablauf

1. Nur im vorgesehenen berechtigten Azure-Recovery-Verfahren einen unveränderten,
   zugriffsgeschützten Team-State-Snapshot einschließlich Blob-ETag, Snapshot-Zeitpunkt und
   Umgebungskennung **intern** sichern. Keine produktiven Team-States in GitHub, CI,
   öffentliche Issues oder Chats kopieren.
2. In einer geschützten Admin-Umgebung mit Node.js 20+ ausführen:

   ~~~bash
   node scripts/rc1656-phantom-pod-forensics.mjs --input /secure/team-state.json
   ~~~

3. Standardausgabe enthält **nur Summen**, Hinweise und den SHA-256-Fingerabdruck des
   unveränderten Inputs. Referenzen, Kundennamen, Blobnamen, Storage-Pfade und IDs
   werden nicht ausgegeben.
4. Nur für die intern zugriffsberechtigte Fallprüfung:

   ~~~bash
   node scripts/rc1656-phantom-pod-forensics.mjs --input /secure/team-state.json --show-refs > /secure/private-pod-review.json
   ~~~

   Diese JSON-Ausgabe enthält vertrauliche Sendungsreferenzen und darf **nicht** in
   öffentlichen Issue-Kommentaren oder Logs veröffentlicht werden.

## Was die Zähler aussagen – und was nicht

- `podStatusWithoutSignedPickupClaim`: Die Team-State-Kopie meldet „POD vorhanden“,
  aber enthält keinen im Team-State erkennbaren, datierten Signaturnachweis.
  **Das beweist nicht**, dass auf dem Pickup-Server oder im Archiv kein echtes Original vorliegt.
- `podStatusWithManualOnlyClaim`: Manuell bestätigte Abholung dokumentiert,
  aber im Team-State keine verknüpfte Signatur erkennbar; kein automatischer Status-Reset.
- `podStatusWithDurablePointersButNoSignedPickupClaim`: Speicherverweis vorhanden,
  jedoch ohne zugehörigen signierten Pickup-Hinweis im Team-State. Verweis ist
  **kein Nachweis einer gültigen, lesbaren POD-PDF**.
- `crossCollectionPodVsPrePickup`: Eine Referenz liegt in den beiden
  Sammlungen mit widersprüchlichen Zustandsstufen vor. Die originale Historie
  zuerst prüfen; niemals per Mehrheitsentscheid überschreiben.
- `recycledIdAcrossDifferentReferences`: Dieselbe interne ID wird für
  verschiedene REFs verwendet. Dieser Konflikt kann den in RC1655 reparierten
  Identitätsfehler in früheren Daten erklären, beweist aber nicht dessen
  tatsächlichen Ablauf bei den vier gemeldeten Vorgängen.
- `podStatusWithSignedPickupClaim`: Ein datierter Unterschriftenhinweis
  ist im Team-State vorhanden. Auch hier muss das **authentische Original**
  separat aus dem berechtigten Pickup-/POD-Speicher geprüft werden.

## Freigabe vor Einzelkorrektur

Für jeden der vier Fälle zuerst den tatsächlichen Pickup-Datensatz, QR-Subject,
Statushistorie, Unterschriftsoriginal, POD-Archiv, Bearbeiter, Team-State-ETag
und die Integrität des Snapshots read-only abgleichen. Anschließend nur eine
explizit autorisierte, sendungsspezifische, ETag-geschützte Reparatur vornehmen
und Speicherung, QR-Reset, erneutes Öffnen und Reload produktiv nachweisen.

**Nie** alle vier oder die 89 historischen Fälle (#899) pauschal zurücksetzen.
Der Audit erstellt weder Ersatzsignaturen noch neue PODs.

Tests: `node --test test/rc1656-phantom-pod-forensics.test.mjs`.
