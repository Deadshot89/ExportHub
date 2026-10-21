# RC1603 – POD-Status bei identischem Sendungszeitstempel schützen

**Betroffene P0-Vorfälle:** #895 / #899

## Konkreter reproduzierter Fehler
Der bisherige Code in \`api/shared/merge.js\` bevorzugte bei \`incomingTs >= serverTs\` die eingehende Browserkopie. Nach einer separaten serverseitigen Statuskorrektur konnte ein Browser mit dem alten, gleichen \`_syncUpdatedAt\` erneut „POD vorhanden“ einschreiben. Auch die umgekehrte ungewollte Rückstufung von „POD vorhanden“ zu „Abgeholt“ war so möglich.

## Eng begrenzte Änderung
Nur wenn **beide** Sendungsversionen den gleichen effektiven Zeitstempel haben und ihre konsistenten Status genau zwischen \`Abgeholt\` und \`POD vorhanden\` widersprechen, wird der bereits gespeicherte Serverstatus beibehalten. Das ist bewusst **kein automatisches Beweisen** eines PODs und keine Status-Rangliste.

- Ein tatsächlich **neuerer** eingehender Datensatz behält die bestehende Priorität.
- Alle anderen Statusübergänge, dokumentierten Abholprozesse, Avis-Antworten, Dokumentarrays und Mehrfahrzeug-Regeln bleiben unverändert.
- \`shipments\` und \`savedShipments\` erhalten dieselbe Kollisionsbehandlung.
- Der Sonderfall mit intern widersprüchlichen \`status\`/\`processStatus\`-Feldern wird nicht blind „repariert“.

## Regression und Abnahme
\`test/rc1603-pod-status-merge-tie.test.mjs\` deckt beide Kollisionsrichtungen, neuere legitime Änderungen, andere Statusfälle, Dateierhaltung und beide Sendungslisten ab. Der frühere reproduzierende Test \`test/rc1599-pod-state-forensics.test.mjs\` muss jetzt zeigen, dass die Wiederkehr verhindert wird.

**Kein bestehender Produktionsdatensatz wird mit diesem Merge-Patch aktualisiert.** Die RC1598-Sperre für den destruktiven Massenstatusaudit bleibt bestehen. Für #899 fehlen weiterhin die vertraulichen tatsächlichen Backup-Snapshots und die Authentizitätsprüfung der 89 Original-PODs. Erst nach erfolgreich durchlaufener Gesamtregression, TESTSERVICE-Browser-Abnahme und getrenntem Production Release gilt dieser neue Merge-Guard produktiv. P0 #895/#899 sind dadurch nicht automatisch fachlich abgeschlossen.
