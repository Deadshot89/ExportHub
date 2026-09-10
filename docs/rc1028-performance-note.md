# RC1028 – Sendungsübersicht Performance

Root Cause: `overviewReorderExistingCards()` hat bei jedem ruhigen Overview-Patch alle vorhandenen Karten erneut per `appendChild()` in den DOM verschoben, auch wenn die Reihenfolge bereits korrekt war. Das erzeugte bei großen Sendungsbeständen unnötige DOM-Mutationen.

Fix: Die aktuelle Kartenreihenfolge wird einmal erfasst, auf einer Kopie sortiert und mit dem bestehenden DOM verglichen. Ist die Reihenfolge bereits korrekt, endet die Gruppe ohne DOM-Schreibzugriff. Nur bei einer echten Sortieränderung werden Karten verschoben.

Verifikation: RED-Test vor Fix bestätigt; Zieltest und vollständige Node-Regression nach Fix erfolgreich.
