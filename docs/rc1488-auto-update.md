# RC1488 – automatische ExportHUB360-Updates

RC1488 ergänzt die bestehende RC1112-Releasepipeline um einen deploymentgenauen Update-Marker.

- `exporthub-update.json` enthält Commit-Build-ID, sichtbare Produktversion, technischen Build und Build-Zeitpunkt.
- `index.html` und `TESTVERSION.html` laden `assets/rc1488-auto-update.js`; Demo bleibt bewusst ohne automatisches Reload.
- Die Runtime prüft beim Start, alle fünf Minuten, bei Fokus, Online-Rückkehr und erneuter Sichtbarkeit.
- `ExportHUBClean.runtime.changeGeneration`, `lastSavedGeneration` und `saving` schützen ungespeicherte Änderungen vor Auto-Reload.
- Bei sauberem Zustand lädt eine neue Build-ID automatisch neu.
- Bei Dirty-State erscheint ein Update-Hinweis mit `Jetzt aktualisieren`; der Button lädt erst nach sauberem Speicherzustand neu.
- Ein `sessionStorage`-Reload-Lock verhindert Endlosschleifen bei partiellen/stalen Deployments.
- Azure Static Web Apps liefert `/exporthub-update.json` explizit mit `Cache-Control: no-store, no-cache, must-revalidate` aus.
- Standard-Finalgate und Packmeldungen-Build verwenden denselben idempotenten Finalizer.
