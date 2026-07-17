ExportHUB Clean RC504 – stabiler Low-Memory-Start

Behoben:
- Alte Intervall-Timer laufen während des Ladens nicht mehr an.
- Intervalle starten erst nach vollständigem Laden und zeitlich versetzt, maximal ein Job pro Sekunde.
- Kurzzeitige Alt-Patches/Render-Timer unter 4 Sekunden werden während des Starts blockiert.
- MutationObserver bleiben während des Starts vollständig pausiert.
- Legacy-Gruppen und Einzelmodule werden ohne zusätzliche Script-DOM-Knoten speicherschonend ausgewertet.
- Geladene Modultexte werden anschließend freigegeben.
- Der problematische Altblock RC374–RC393 bleibt weiterhin ausgeschlossen.

Unverändert:
- Bereiche, Funktionen, Layouts und Azure-Teamdatenspeicherung.
- Microsoft-Anmeldung und interner ExportHUB-Login.
- Browser-Speicherung für ExportHUB bleibt deaktiviert; Teamdaten liegen weiterhin serverseitig in Azure.
