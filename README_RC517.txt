ExportHUB CLEAN RC517 – KONSOLIDIERTER STABILSTART
==================================================

Dieses Azure-Paket wurde aus dem vollständigen RC503-Paket neu konsolidiert.
Geladen werden der vollständige Anwendungskern und die einzeln geprüften
Korrekturen RC394–RC406. Historische Zwischenpatches, die dieselben Funktionen
mehrfach über Render-, Timer-, Observer- und Speicher-Wrapper überschreiben,
werden beim Start nicht mehr ausgeführt.

Wichtige Stabilitätsänderungen
- Keine Azure-Schreibvorgänge während des Starts.
- Keine automatische Vollspeicherung beim Wechsel zwischen Bereichen.
- Echte Änderungen werden zentral gebündelt und verzögert gespeichert.
- Alte Start-Timer, Observer und Reparaturintervalle werden verworfen.
- ExportHUB-Daten werden nicht dauerhaft im Browser-Speicher abgelegt.
- HTML-Struktur bereinigt; kein sichtbarer JavaScript-Quelltext.

Bereitstellung
Den gesamten Inhalt dieses Ordners hochladen, einschließlich assets, api,
pickup.html und staticwebapp.config.json. Nicht nur index.html ersetzen.
Nach dem Deployment einmal Strg+F5 ausführen.
