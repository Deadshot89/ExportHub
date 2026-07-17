ExportHUB Clean RC505 – Kein Speichern während des Starts

Kritischer Stabilitätsfix:
- Alte Module dürfen während des Ladens keine vollständige Azure-Speicherung mehr auslösen.
- Dadurch werden beim Start keine mehrfachen JSON-Kopien des gesamten Teamstands erzeugt.
- ExportHUB-Daten werden nicht in localStorage oder IndexedDB gehalten. Alte Browser-Speicheraufrufe werden verworfen.
- Erst nach 100 % und nur nach einer echten Benutzeränderung wird wieder in Azure gespeichert.
- Timer, Intervalle und MutationObserver bleiben während des Starts pausiert.

Unverändert:
- Alle 15 Anwendungspakete bleiben enthalten.
- Bereiche, Funktionen, Layouts, Microsoft-Anmeldung und Azure-Teamdaten bleiben erhalten.
