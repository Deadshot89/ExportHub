# Exportexperte Upgrade – Spec Self-Review

Die technische Spezifikation wurde nach der ersten Fassung auf folgende Punkte geprüft:

- keine TBD/TODO-Platzhalter
- keine Ablösung des manuellen ABD-Prozesses
- keine Ablösung von „Aus Sendung erstellen“
- Rechnungsanalyse bleibt optional
- HS-Code + Ursprungsland bleibt der einzige Gruppierungsschlüssel
- unterschiedliche Währungen dürfen nicht still zusammengerechnet werden
- ungeklärte Positionen dürfen nicht automatisch gruppiert werden
- Rechnungswertkontrolle muss bekannte Werte ungeklärter Positionen separat berücksichtigen
- vollständiger fachlicher Status erfordert zusätzlich zur Wertkontrolle, dass keine ungeklärten Positionen verbleiben
- `abdRequests` wird nur rückwärtskompatibel erweitert
- AV-Aufgaben benötigen einen idempotenten Schlüssel
- UI/PDF/Excel müssen denselben Gruppierungsdatensatz verwenden
- KI darf ausschließlich beratend und lesend arbeiten
- JPG/PNG bleiben Teil des verbindlichen Zielumfangs
- Bestandsschutz-Regressionen und Release-Gates sind verpflichtend

Diese Punkte sind verbindliche Präzisierungen für den anschließenden Implementierungsplan. Die Produktimplementierung beginnt erst nach Freigabe der Designspezifikation durch den Benutzer.
