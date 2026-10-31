package de.exporthub.test;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class NotificationDetailActivity extends Activity {
    public static final String EXTRA_NOTIFICATION_TITLE = "exporthub_notification_title";
    public static final String EXTRA_NOTIFICATION_BODY = "exporthub_notification_body";
    public static final String EXTRA_NOTIFICATION_CHANNEL = "exporthub_notification_channel";
    public static final String EXTRA_NOTIFICATION_ROUTE = "exporthub_notification_route";
    public static final String EXTRA_NOTIFICATION_TASKS = "exporthub_notification_tasks";
    public static final String EXTRA_AUTOFIX_TICKET = "exporthub_autofix_ticket";

    private static final int COLOR_PAGE = 0xFFF1F5F9;
    private static final int COLOR_CARD = 0xFFFFFFFF;
    private static final int COLOR_BORDER = 0xFFE2E8F0;
    private static final int COLOR_TEXT = 0xFF0F172A;
    private static final int COLOR_BODY = 0xFF334155;
    private static final int COLOR_MUTED = 0xFF64748B;
    private static final int COLOR_BRAND = 0xFF0F766E;
    private static final int COLOR_RED = 0xFFB91C1C;
    private static final int COLOR_RED_BG = 0xFFFEE2E2;
    private static final int COLOR_AMBER = 0xFFB45309;
    private static final int COLOR_AMBER_BG = 0xFFFEF3C7;
    private static final int COLOR_GREEN = 0xFF15803D;
    private static final int COLOR_GREEN_BG = 0xFFDCFCE7;
    private static final int COLOR_GREY_BG = 0xFFE2E8F0;

    private static final String[] DUE_LABELS = new String[]{"Überfällig", "Heute fällig", "Zukünftig", "Ohne Termin"};

    private String environment = "production";
    private String route = "notifications";
    private String autofixTicket = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent source = getIntent();
        environment = EnvironmentActivity.normalizeEnvironment(
                source == null ? null : source.getStringExtra(EnvironmentActivity.EXTRA_ENVIRONMENT));
        route = safe(source == null ? null : source.getStringExtra(EXTRA_NOTIFICATION_ROUTE), "notifications");
        String channel = safe(source == null ? null : source.getStringExtra(EXTRA_NOTIFICATION_CHANNEL), "notification");
        String title = safe(source == null ? null : source.getStringExtra(EXTRA_NOTIFICATION_TITLE), defaultTitle(channel));
        String body = safeLong(source == null ? null : source.getStringExtra(EXTRA_NOTIFICATION_BODY), "ExportHUB hat einen neuen Hinweis.");
        String tasksJson = source == null ? null : source.getStringExtra(EXTRA_NOTIFICATION_TASKS);
        autofixTicket = safe(source == null ? null : source.getStringExtra(EXTRA_AUTOFIX_TICKET), "");

        setTitle(defaultTitle(channel));
        setContentView(buildContent(channel, title, body, tasksJson));
    }

    private ScrollView buildContent(String channel, String title, String body, String tasksJson) {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(COLOR_PAGE);

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(page, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));
        page.addView(header(channel, body), margins(0, 0, 0, 0));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), dp(4), dp(16), dp(24));
        root.setGravity(Gravity.TOP);
        page.addView(root, margins(0, 0, 0, 0));

        boolean diagnostic = "diagnostic".equalsIgnoreCase(channel);
        if (diagnostic) {
            renderDiagnostic(root, body);
        } else if ("warning".equalsIgnoreCase(channel)) {
            renderWarnings(root, title, body);
        } else {
            renderTasks(root, title, body, tasksJson);
        }

        TextView privacy = text(
                "Diese Ansicht zeigt nur den Inhalt dieser Handy-Benachrichtigung. Der geschützte ExportHUB-Arbeitsbereich wird dadurch nicht freigegeben.",
                12f,
                COLOR_MUTED,
                false);
        root.addView(privacy, margins(4, 20, 4, 0));

        // Every phone notification is read-only: the user only reads it here and nothing opens the
        // protected workspace (which would need a login and showed "nicht freigegeben" without one).
        Button close = new Button(this);
        close.setText("Schließen");
        styleButton(close, false);
        close.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams closeParams = matchWrap();
        closeParams.topMargin = dp(16);
        root.addView(close, closeParams);

        return scroll;
    }

    // ---- Fehlerdiagnose ----

    private void renderDiagnostic(LinearLayout root, String body) {
        Map<String, String> fields = parseDiagnosticBody(body);
        String[] structured = new String[]{"Fehlercode", "Benutzer", "Firma", "Bedeutung", "Wahrscheinliche Ursache", "Nächster Schritt"};
        boolean hasStructure = false;
        for (String label : structured) {
            String value = fields.get(label);
            if (value != null && !value.trim().isEmpty()) hasStructure = true;
        }

        PlainDiagnostic plain = PlainDiagnostic.from(body);
        LinearLayout card = accentCard(root, plain.urgencyColor(), 16);

        LinearLayout badges = row();
        badges.addView(badge(plain.urgencyLabel(), plain.urgencyColor(), plain.urgencyBackground()));
        if (plain.count > 1) {
            LinearLayout.LayoutParams p = wrapContent();
            p.leftMargin = dp(8);
            badges.addView(badge(plain.count + " Meldungen", COLOR_MUTED, COLOR_GREY_BG), p);
        }
        card.addView(badges);

        card.addView(text(plain.title, 19f, COLOR_TEXT, true), margins(0, 12, 0, 0));
        if (!plain.when.isEmpty()) {
            card.addView(text(plain.when + (plain.area.isEmpty() ? "" : "  ·  Bereich " + plain.area), 13f, COLOR_MUTED, false),
                    margins(0, 4, 0, 0));
        } else if (!plain.area.isEmpty()) {
            card.addView(text("Bereich " + plain.area, 13f, COLOR_MUTED, false), margins(0, 4, 0, 0));
        }

        if (hasStructure) {
            for (String label : structured) {
                String value = fields.get(label);
                if (value == null || value.trim().isEmpty()) continue;
                addSection(card, label, value, "Fehlercode".equals(label));
            }
        } else {
            addSection(card, "Was bedeutet das?", plain.what, false);
            addSection(card, "Was ist zu tun?", plain.todo, false);
        }

        String technical = fields.get("Technische Meldung");
        if (technical == null || technical.trim().isEmpty()) technical = plain.technical;
        LinearLayout tech = card();
        tech.setBackground(rounded(0xFFF8FAFC, COLOR_BORDER));
        root.addView(tech, margins(0, 12, 0, 0));
        tech.addView(text("Technische Meldung", 12f, COLOR_MUTED, true));
        TextView techText = text(technical, 13f, COLOR_BODY, false);
        techText.setTypeface(Typeface.MONOSPACE);
        techText.setTextIsSelectable(true);
        tech.addView(techText, margins(0, 4, 0, 0));

        if (autofixTicket.startsWith("ehaf1.") && !"demo".equals(environment)) addAutofixButton(root);
    }

    // 2026-10-30 (Tobias): send this error to the KI right from the phone, without a login. The website put a
    // signed single-use ticket into the notification; the server checks it and starts the usual autofix (PR only).
    private void addAutofixButton(LinearLayout root) {
        Button send = new Button(this);
        send.setText("An KI senden");
        styleButton(send, true);
        TextView status = text("Die KI sucht die Ursache, testet eine Korrektur und legt einen Pull Request an. Nichts geht direkt live.",
                12f, COLOR_MUTED, false);
        send.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("An KI senden?")
                .setMessage("Diese Fehlermeldung wird an die KI-Fehlerbehebung gesendet.")
                .setNegativeButton("Abbrechen", null)
                .setPositiveButton("Senden", (d, w) -> sendToAutofix(send, status))
                .show());
        LinearLayout.LayoutParams p = matchWrap();
        p.topMargin = dp(12);
        root.addView(send, p);
        root.addView(status, margins(4, 6, 4, 0));
    }

    private void sendToAutofix(Button send, TextView status) {
        send.setEnabled(false);
        status.setText("Wird gesendet …");
        final String ticket = autofixTicket;
        final String env = "production".equals(environment) ? "production" : "testservice";
        new Thread(() -> {
            String message;
            boolean ok = false;
            try {
                JSONObject payload = new JSONObject();
                payload.put("action", "request-phone");
                payload.put("environment", env);
                payload.put("ticket", ticket);
                byte[] raw = payload.toString().getBytes(StandardCharsets.UTF_8);
                HttpURLConnection c = (HttpURLConnection) new URL(EnvironmentActivity.apiBase(env) + "/api/diagnostic-autofix").openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                c.setRequestProperty("Accept", "application/json");
                c.setRequestProperty("Accept-Language", "de");
                try (OutputStream out = c.getOutputStream()) { out.write(raw); }
                int code = c.getResponseCode();
                InputStream in = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                if (in != null) {
                    byte[] chunk = new byte[4096];
                    int n;
                    while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
                    in.close();
                }
                JSONObject res = new JSONObject(buf.size() > 0 ? buf.toString("UTF-8") : "{}");
                ok = code >= 200 && code < 300 && res.optBoolean("ok", false);
                message = ok
                        ? "Gemeldet. Claude arbeitet jetzt an Auftrag " + res.optString("jobId", "") + ". Das Ergebnis siehst du in ExportHUB unter Fehlerdiagnose → Meine KI-Aufträge."
                        : "Nicht gesendet: " + res.optString("message", "HTTP " + code);
            } catch (Exception e) {
                message = "Nicht gesendet: keine Verbindung zu ExportHUB.";
            }
            final String text = message;
            final boolean done = ok;
            runOnUiThread(() -> {
                status.setText(text);
                status.setTextColor(done ? COLOR_GREEN : COLOR_RED);
                send.setEnabled(!done);
            });
        }).start();
    }

    private void addSection(LinearLayout parent, String label, String value, boolean code) {
        LinearLayout labelRow = row();
        View dot = new View(this);
        GradientDrawable dotShape = new GradientDrawable();
        dotShape.setColor(code ? COLOR_RED : COLOR_BRAND);
        dotShape.setCornerRadius(dp(4));
        dot.setBackground(dotShape);
        LinearLayout.LayoutParams dotParams = new LinearLayout.LayoutParams(dp(7), dp(7));
        dotParams.rightMargin = dp(7);
        labelRow.addView(dot, dotParams);
        labelRow.addView(text(label.toUpperCase(Locale.GERMANY), 11f, COLOR_MUTED, true));
        parent.addView(labelRow, margins(0, 16, 0, 0));
        TextView valueView = text(value, code ? 17f : 16f, code ? COLOR_RED : COLOR_BODY, code);
        valueView.setTextIsSelectable(true);
        valueView.setLineSpacing(0f, 1.15f);
        parent.addView(valueView, margins(0, 3, 0, 0));
    }

    static Map<String, String> parseDiagnosticBody(String body) {
        LinkedHashMap<String, String> fields = new LinkedHashMap<>();
        if (body == null) return fields;
        String[] lines = body.split("\\r?\\n");
        String currentLabel = null;
        for (String raw : lines) {
            String line = raw == null ? "" : raw.trim();
            if (line.isEmpty()) continue;
            int colon = line.indexOf(':');
            if (colon > 0) {
                String label = line.substring(0, colon).trim();
                String value = line.substring(colon + 1).trim();
                if (isDiagnosticLabel(label)) {
                    fields.put(label, value);
                    currentLabel = label;
                    continue;
                }
            }
            if (currentLabel != null) {
                String previous = fields.get(currentLabel);
                fields.put(currentLabel, (previous == null || previous.isEmpty()) ? line : previous + " " + line);
            }
        }
        return fields;
    }

    private static boolean isDiagnosticLabel(String label) {
        return "Fehlercode".equals(label)
                || "Benutzer".equals(label)
                || "Firma".equals(label)
                || "Bedeutung".equals(label)
                || "Wahrscheinliche Ursache".equals(label)
                || "Nächster Schritt".equals(label)
                || "Technische Meldung".equals(label);
    }

    /**
     * Turns the short technical push text ("area: message\nZeitpunkt: ISO") into plain words,
     * with the same wording as the Fehlerdiagnose page (RC1650).
     */
    static final class PlainDiagnostic {
        String title = "Unbekannter Fehler";
        String what = "Für diese Meldung gibt es noch keine Erklärung. Die technische Meldung steht darunter.";
        String todo = "Wenn Benutzer ein Problem melden, am PC in der Fehlerdiagnose eine KI-Korrektur anstoßen.";
        String urgency = "watch";
        String area = "";
        String when = "";
        String technical = "";
        int count = 1;

        private static final Pattern EVENTS = Pattern.compile("^(\\d+) neue Diagnoseereignisse\\. Zuletzt (.*)$");
        private static final Pattern HTTP = Pattern.compile("HTTP (\\d{3}) bei [A-Z]+ (\\S+)");
        private static final Pattern NETWORK = Pattern.compile("Netzwerkfehler bei [A-Z]+ (\\S+)");
        private static final Pattern SLOW = Pattern.compile("Langsamer (?:API|XHR)-Aufruf: [A-Z]+ (\\S+)");

        static PlainDiagnostic from(String body) {
            PlainDiagnostic d = new PlainDiagnostic();
            String text = body == null ? "" : body.trim();
            String first = text;
            int newline = text.indexOf('\n');
            if (newline >= 0) first = text.substring(0, newline).trim();
            for (String line : text.split("\\r?\\n")) {
                String l = line.trim();
                if (l.startsWith("Zeitpunkt:")) d.when = formatTime(l.substring("Zeitpunkt:".length()).trim());
                else if (l.startsWith("Technische Meldung:")) first = l.substring("Technische Meldung:".length()).trim();
            }
            Matcher events = EVENTS.matcher(first);
            if (events.find()) {
                try { d.count = Integer.parseInt(events.group(1)); } catch (NumberFormatException ignored) {}
                first = events.group(2).trim();
            }
            String message = first;
            int colon = first.indexOf(": ");
            if (colon > 0 && colon < 60 && !first.substring(0, colon).contains(" bei ")) {
                d.area = first.substring(0, colon).trim();
                message = first.substring(colon + 2).trim();
            }
            d.technical = first.isEmpty() ? text : first;
            d.classify(message);
            return d;
        }

        private void classify(String message) {
            String lower = message.toLowerCase(Locale.ROOT);
            Matcher m;
            if ((m = NETWORK.matcher(message)).find()) {
                set("Verbindung zum Server unterbrochen (" + thingOf(m.group(1)) + ")",
                        "Der Browser hat den Server nicht erreicht. Meist war kurz das Internet oder WLAN weg, oder der Server wurde neu gestartet, zum Beispiel bei einem Update.",
                        "Nichts tun, solange danach alles normal lädt. Tritt es bei mehreren Benutzern gleichzeitig auf, die Internetverbindung vor Ort prüfen.",
                        "low");
            } else if ((m = HTTP.matcher(message)).find()) {
                int status = Integer.parseInt(m.group(1));
                String thing = thingOf(m.group(2));
                if (status == 401 || status == 403) {
                    set("Anmeldung abgelaufen oder keine Berechtigung (" + thing + ")",
                            "Der Server hat die Anfrage abgelehnt, weil die Anmeldung abgelaufen ist oder dem Benutzer das Recht dafür fehlt.",
                            "Den Benutzer neu anmelden lassen. Kommt es danach wieder, die Rechte unter „Benutzer & Rechte“ prüfen.",
                            "watch");
                } else if (status == 404 || status == 410) {
                    set(thing + " nicht gefunden",
                            "Der Server kennt diese Adresse oder Datei nicht. Das passiert oft direkt nach einem Update, wenn der Browser noch alte Dateien verwendet.",
                            "Seite neu laden. Bleibt die Meldung, am PC eine KI-Korrektur anstoßen.",
                            "watch");
                } else if (status == 409 || status == 412) {
                    set("Gleichzeitige Änderung (" + thing + ")",
                            "Zwei Personen oder zwei offene Tabs haben dieselben Daten fast gleichzeitig gespeichert. Der Server hat die ältere Version abgelehnt, damit nichts überschrieben wird.",
                            "Meist klappt es beim nächsten Speichern von selbst. Erst handeln, wenn es sich häuft.",
                            "low");
                } else if (status == 429) {
                    set("Zu viele Anfragen (" + thing + ")",
                            "Die Seite hat in kurzer Zeit sehr viele Anfragen geschickt, deshalb hat der Server kurz gebremst.",
                            "Nichts tun, wenn es selten ist. Häuft es sich, am PC eine KI-Korrektur anstoßen.",
                            "watch");
                } else if (status == 502 || status == 503 || status == 504) {
                    set("Server nicht erreichbar oder überlastet (" + thing + ")",
                            "Der Server war kurz nicht verfügbar, zum Beispiel während eines Neustarts oder bei hoher Last.",
                            "Tritt es nur kurz auf, nichts tun. Hält es an, den Stand im Release-Center prüfen.",
                            "watch");
                } else if (status >= 500) {
                    set("Fehler auf dem Server (" + thing + ")",
                            "Auf dem Server ist bei der Bearbeitung etwas schiefgelaufen. Die Aktion hat wahrscheinlich nicht geklappt.",
                            "Prüfen, ob die betroffene Aktion nachgeholt werden muss, und am PC eine KI-Korrektur anstoßen.",
                            "high");
                } else {
                    set("Server hat eine Anfrage abgelehnt (" + thing + ")",
                            "Die Seite hat Daten geschickt, die der Server so nicht annimmt, zum Beispiel unvollständige Angaben.",
                            "Wenn dabei eine Aktion nicht geklappt hat, am PC eine KI-Korrektur anstoßen. Sonst reicht Beobachten.",
                            "watch");
                }
            } else if ((m = SLOW.matcher(message)).find()) {
                set(thingOf(m.group(1)) + " hat lange gedauert",
                        "Der Server hat länger als üblich gebraucht. Die Aktion hat trotzdem funktioniert.",
                        "Nichts tun. Nur ansehen, wenn sich Benutzer über Wartezeiten beschweren.",
                        "low");
            } else if (lower.contains("long task") || lower.contains("hänger")) {
                set("Seite war kurz eingefroren",
                        "Der Browser war einen Moment mit Rechnen beschäftigt, zum Beispiel mit einer großen Liste.",
                        "Nichts tun.",
                        "low");
            } else if (lower.contains("render")) {
                set("Seite wurde neu aufgebaut",
                        "Ein großer Teil der Seite wurde neu gezeichnet. Das ist normal und nur zur Information.",
                        "Nichts tun.",
                        "low");
            } else if (lower.contains("ressource konnte nicht geladen")) {
                set("Datei der Seite konnte nicht geladen werden",
                        "Ein Teil der Seite (Programmdatei, Bild oder Design) fehlte. Meist passiert das direkt nach einem Update.",
                        "Seite neu laden. Betrifft es mehrere Benutzer, am PC eine KI-Korrektur anstoßen.",
                        "watch");
            } else if (lower.contains("azure") || lower.contains("nicht dauerhaft") || lower.contains("speicherfehler") || lower.contains("blob")) {
                set("Speichern in der Cloud hat nicht geklappt",
                        "Daten konnten nicht dauerhaft in Azure gespeichert werden. Bis zum nächsten erfolgreichen Speichern liegen sie nur im Browser.",
                        "Den betroffenen Benutzer bitten, erneut zu speichern. Bleibt es, am PC eine KI-Korrektur anstoßen.",
                        "high");
            } else if (lower.contains("failed to fetch") || lower.contains("networkerror") || lower.contains("load failed") || lower.contains("timeout")) {
                set("Verbindung zum Server unterbrochen",
                        "Der Browser hat den Server nicht erreicht. Meist war kurz das Internet oder WLAN weg.",
                        "Nichts tun, solange danach alles normal lädt.",
                        "low");
            } else if (lower.matches(".*(type|reference|syntax|range)error.*") || lower.contains("is not a function")
                    || lower.contains("is not defined") || lower.contains("cannot read propert")) {
                set("Programmfehler in der Seite",
                        "Ein Teil der Seite ist auf einen Fehler im Programmcode gelaufen. Je nach Stelle funktioniert eine Schaltfläche oder Anzeige nicht richtig.",
                        "Am PC in der Fehlerdiagnose eine KI-Korrektur anstoßen. Sie sucht die Ursache und legt einen getesteten Pull Request an.",
                        "high");
            }
        }

        private void set(String title, String what, String todo, String urgency) {
            this.title = title;
            this.what = what;
            this.todo = todo;
            this.urgency = urgency;
        }

        String urgencyLabel() {
            if ("high".equals(urgency)) return "Wichtig";
            if ("watch".equals(urgency)) return "Beobachten";
            return "Harmlos";
        }

        int urgencyColor() {
            if ("high".equals(urgency)) return COLOR_RED;
            if ("watch".equals(urgency)) return COLOR_AMBER;
            return COLOR_GREEN;
        }

        int urgencyBackground() {
            if ("high".equals(urgency)) return COLOR_RED_BG;
            if ("watch".equals(urgency)) return COLOR_AMBER_BG;
            return COLOR_GREEN_BG;
        }

        static String thingOf(String path) {
            String p = path == null ? "" : path.toLowerCase(Locale.ROOT);
            if (p.contains("/api/exporthub-state")) {
                if (p.contains("mode=save") || p.contains("mode=write") || p.contains("mode=patch")) return "Speichern";
                if (p.contains("mode=read") || p.contains("mode=load")) return "Laden der Daten";
                return "Datenabgleich";
            }
            if (p.contains("/api/pickup-status")) return "Abholstatus";
            if (p.contains("/api/pickup-pod") || p.contains("/api/pod-") || p.contains("/api/official-pod")) return "POD";
            if (p.contains("/api/pickup") || p.contains("/api/manual-pickup") || p.contains("/api/fixed-pickups")) return "Abholung";
            if (p.contains("/api/exporthub-auth") || p.contains("/api/customer-portal-credentials")) return "Anmeldung";
            if (p.contains("/api/customer-avis") || p.contains("/api/avis-") || p.contains("/api/av-check")) return "Kunden-Avis";
            if (p.contains("/api/exporthub-document") || p.contains("/api/container-document")
                    || p.contains("/api/pickup-container-document") || p.contains("/api/reference-files")) return "Dokumente";
            if (p.contains("version")) return "Versionsprüfung";
            if (p.contains("/api/exporthub-release") || p.contains("release-assets")) return "Release-Informationen";
            if (p.contains("/api/exporthub-health") || p.contains("/api/pickup-health")) return "Serverstatus";
            if (p.contains("/api/customs-ai")) return "Zoll-KI";
            if (p.contains("/api/packaging")) return "Verpackungen";
            if (p.contains("/api/pack-notification") || p.contains("/api/pack-stations")) return "Packmeldungen";
            if (p.contains("/api/location-booking")) return "Standort-Buchung";
            if (p.contains("/api/abd-")) return "ABD-Prüfung";
            if (p.contains("/api/web-push") || p.contains("/api/push")) return "Benachrichtigungen";
            return "Serverdienst";
        }

        static String formatTime(String iso) {
            String value = iso == null ? "" : iso.trim();
            if (value.isEmpty()) return "";
            String[] patterns = new String[]{"yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'"};
            for (String pattern : patterns) {
                try {
                    SimpleDateFormat parser = new SimpleDateFormat(pattern, Locale.ROOT);
                    parser.setTimeZone(TimeZone.getTimeZone("UTC"));
                    Date date = parser.parse(value);
                    if (date != null) {
                        return new SimpleDateFormat("dd.MM.yyyy, HH:mm 'Uhr'", Locale.GERMANY).format(date);
                    }
                } catch (Exception ignored) {
                    // try the next pattern
                }
            }
            return value;
        }
    }

    // ---- Aufgaben ----

    private void renderTasks(LinearLayout root, String title, String body, String tasksJson) {
        List<TaskItem> tasks = parseTasks(title, body, tasksJson);
        if (tasks.isEmpty()) {
            renderMessage(root, title, body);
            return;
        }
        String summary = tasks.size() == 1 ? "1 offene Aufgabe" : tasks.size() + " offene Aufgaben";
        root.addView(text(summary, 15f, COLOR_TEXT, true), margins(2, 16, 0, 0));
        for (TaskItem task : tasks) {
            LinearLayout card = accentCard(root, priorityColor(task.priority), 10);

            LinearLayout badges = row();
            badges.addView(badge(task.priority + " · " + priorityLabel(task.priority),
                    priorityColor(task.priority), priorityBackground(task.priority)));
            if (!task.due.isEmpty()) {
                LinearLayout.LayoutParams p = wrapContent();
                p.leftMargin = dp(8);
                boolean overdue = "Überfällig".equals(task.due);
                boolean today = "Heute fällig".equals(task.due);
                badges.addView(badge(task.due,
                        overdue ? COLOR_RED : (today ? COLOR_AMBER : COLOR_MUTED),
                        overdue ? COLOR_RED_BG : (today ? COLOR_AMBER_BG : COLOR_GREY_BG)), p);
            }
            card.addView(badges);

            TextView taskTitle = text(task.title, 17f, COLOR_TEXT, true);
            taskTitle.setTextIsSelectable(true);
            taskTitle.setLineSpacing(0f, 1.12f);
            card.addView(taskTitle, margins(0, 10, 0, 0));
            if (!task.ref.isEmpty()) {
                TextView ref = text("Referenz: " + task.ref, 14f, COLOR_MUTED, false);
                ref.setTextIsSelectable(true);
                card.addView(ref, margins(0, 4, 0, 0));
            }
        }
    }

    static final class TaskItem {
        String priority = "P4";
        String title = "";
        String ref = "";
        String due = "";
    }

    static List<TaskItem> parseTasks(String title, String body, String tasksJson) {
        List<TaskItem> out = new ArrayList<>();
        if (tasksJson != null && !tasksJson.trim().isEmpty()) {
            try {
                JSONArray array = new JSONArray(tasksJson);
                for (int i = 0; i < array.length(); i++) {
                    JSONObject o = array.optJSONObject(i);
                    if (o == null) continue;
                    TaskItem t = new TaskItem();
                    t.priority = o.optString("priority", "P4").trim();
                    t.title = o.optString("title", "").trim();
                    t.ref = o.optString("sourceRef", "").trim();
                    t.due = o.optString("due", "").trim();
                    if (!t.title.isEmpty()) out.add(t);
                }
                if (!out.isEmpty()) return out;
            } catch (Exception ignored) {
                // fall back to the text of the notification
            }
        }
        String text = body == null ? "" : body.trim();
        if (text.contains("\n• ")) {
            for (String line : text.split("\\r?\\n")) {
                String l = line.trim();
                if (!l.startsWith("• ")) continue;
                TaskItem t = parseTaskLine(l.substring(2), null);
                if (t != null) out.add(t);
            }
            return out;
        }
        // Single task: title "ExportHUB Aufgabe · P1", body "Titel · Referenz · Fälligkeit".
        String priority = null;
        if (title != null && title.startsWith("ExportHUB Aufgabe · ")) priority = title.substring("ExportHUB Aufgabe · ".length()).trim();
        if (priority == null || !priority.matches("P[0-4]")) return out;
        TaskItem t = parseTaskLine(text, priority);
        if (t != null) out.add(t);
        return out;
    }

    private static TaskItem parseTaskLine(String line, String knownPriority) {
        List<String> parts = new ArrayList<>();
        for (String part : line.split(" · ")) parts.add(part.trim());
        TaskItem t = new TaskItem();
        if (knownPriority != null) {
            t.priority = knownPriority;
        } else if (!parts.isEmpty() && parts.get(0).matches("P[0-4]")) {
            t.priority = parts.remove(0);
        }
        if (!parts.isEmpty() && isDueLabel(parts.get(parts.size() - 1))) t.due = parts.remove(parts.size() - 1);
        if (parts.size() >= 2) t.ref = parts.remove(parts.size() - 1);
        t.title = join(parts);
        return t.title.isEmpty() ? null : t;
    }

    private static boolean isDueLabel(String value) {
        for (String label : DUE_LABELS) if (label.equals(value)) return true;
        return false;
    }

    private static String join(List<String> parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append(p);
        }
        return sb.toString();
    }

    private static String priorityLabel(String priority) {
        if ("P0".equals(priority)) return "Sofort";
        if ("P1".equals(priority)) return "Hoch";
        if ("P2".equals(priority)) return "Mittel";
        if ("P3".equals(priority)) return "Niedrig";
        return "Info";
    }

    private static int priorityColor(String priority) {
        if ("P0".equals(priority) || "P1".equals(priority)) return COLOR_RED;
        if ("P2".equals(priority)) return COLOR_AMBER;
        return COLOR_MUTED;
    }

    private static int priorityBackground(String priority) {
        if ("P0".equals(priority) || "P1".equals(priority)) return COLOR_RED_BG;
        if ("P2".equals(priority)) return COLOR_AMBER_BG;
        return COLOR_GREY_BG;
    }

    // ---- Warncenter ----

    static final class WarningGroup {
        String label = "";
        int count;
        final List<String> items = new ArrayList<>();
    }

    private static final Pattern WARNING_GROUP = Pattern.compile("^(.{1,80}): (\\d+)$");

    /** Body: "183 operative Sendungswarnungen offen." then per group "Label: N" and "• Sendung" lines. */
    static List<WarningGroup> parseWarnings(String body) {
        List<WarningGroup> groups = new ArrayList<>();
        if (body == null) return groups;
        WarningGroup current = null;
        for (String raw : body.split("\\r?\\n")) {
            String line = raw.trim();
            if (line.isEmpty()) continue;
            Matcher m = WARNING_GROUP.matcher(line);
            if (m.matches()) {
                current = new WarningGroup();
                current.label = m.group(1).trim();
                try { current.count = Integer.parseInt(m.group(2)); } catch (NumberFormatException ignored) {}
                groups.add(current);
            } else if (line.startsWith("• ") && current != null) {
                current.items.add(line.substring(2).trim());
            }
        }
        return groups;
    }

    private void renderWarnings(LinearLayout root, String title, String body) {
        List<WarningGroup> groups = parseWarnings(body);
        if (groups.isEmpty()) {
            renderMessage(root, title, body);
            return;
        }
        String headline = body.split("\\r?\\n")[0].trim();
        root.addView(text(headline, 15f, COLOR_TEXT, true), margins(2, 16, 0, 0));
        for (WarningGroup group : groups) {
            LinearLayout card = accentCard(root, COLOR_AMBER, 10);

            LinearLayout head = row();
            TextView label = text(group.label, 17f, COLOR_TEXT, true);
            head.addView(label, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            head.addView(badge(String.valueOf(group.count), COLOR_RED, COLOR_RED_BG));
            card.addView(head);

            for (String item : group.items) {
                TextView itemView = text("›  " + item, 15f, COLOR_BODY, false);
                itemView.setTextIsSelectable(true);
                card.addView(itemView, margins(0, 8, 0, 0));
            }
            int more = group.count - group.items.size();
            if (more > 0) {
                card.addView(text("und " + more + " weitere", 13f, COLOR_MUTED, false), margins(0, 8, 0, 0));
            }
        }
    }

    // ---- sonstige Hinweise ----

    private void renderMessage(LinearLayout root, String title, String body) {
        LinearLayout card = accentCard(root, COLOR_BRAND, 16);
        card.addView(text(title, 18f, COLOR_TEXT, true));
        TextView bodyView = text(body, 16f, COLOR_BODY, false);
        bodyView.setLineSpacing(0f, 1.18f);
        bodyView.setTextIsSelectable(true);
        card.addView(bodyView, margins(0, 8, 0, 0));
    }

    // ---- view helpers ----

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(14), dp(16), dp(16));
        card.setBackground(rounded(COLOR_CARD, COLOR_BORDER));
        return card;
    }

    /** White card with a coloured stripe on the left; returns the inner column to fill. */
    private LinearLayout accentCard(LinearLayout parent, int accent, int topMargin) {
        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.HORIZONTAL);
        wrapper.setBackground(rounded(COLOR_CARD, COLOR_BORDER));
        wrapper.setClipToOutline(true);
        wrapper.setElevation(dp(2));
        View stripe = new View(this);
        stripe.setBackgroundColor(accent);
        wrapper.addView(stripe, new LinearLayout.LayoutParams(dp(5), ViewGroup.LayoutParams.MATCH_PARENT));
        LinearLayout inner = new LinearLayout(this);
        inner.setOrientation(LinearLayout.VERTICAL);
        inner.setPadding(dp(14), dp(14), dp(16), dp(16));
        wrapper.addView(inner, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        parent.addView(wrapper, margins(0, topMargin, 0, 0));
        return inner;
    }

    /** Coloured header band: icon, app/environment, heading and the time the notification was opened. */
    private LinearLayout header(String channel, String body) {
        int[] colors;
        String glyph;
        if ("diagnostic".equalsIgnoreCase(channel)) {
            String urgency = PlainDiagnostic.from(body).urgency;
            colors = "high".equals(urgency) ? new int[]{0xFF991B1B, 0xFFDC2626}
                    : ("watch".equals(urgency) ? new int[]{0xFF92400E, 0xFFD97706} : new int[]{0xFF115E59, 0xFF0D9488});
            glyph = "!";
        } else if ("warning".equalsIgnoreCase(channel)) {
            colors = new int[]{0xFF92400E, 0xFFD97706};
            glyph = "!";
        } else {
            colors = new int[]{0xFF0F766E, 0xFF14B8A6};
            glyph = "✓";
        }
        LinearLayout band = new LinearLayout(this);
        band.setOrientation(LinearLayout.HORIZONTAL);
        band.setGravity(Gravity.CENTER_VERTICAL);
        band.setPadding(dp(20), dp(26), dp(20), dp(24));
        band.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors));

        TextView icon = text(glyph, 22f, 0xFFFFFFFF, true);
        icon.setGravity(Gravity.CENTER);
        GradientDrawable circle = new GradientDrawable();
        circle.setColor(0x33FFFFFF);
        circle.setCornerRadius(dp(26));
        icon.setBackground(circle);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(52), dp(52));
        iconParams.rightMargin = dp(14);
        band.addView(icon, iconParams);

        LinearLayout texts = new LinearLayout(this);
        texts.setOrientation(LinearLayout.VERTICAL);
        texts.addView(text("ExportHUB · " + labelForEnvironment(environment), 13f, 0xD9FFFFFF, true));
        texts.addView(text(headingForChannel(channel), 24f, 0xFFFFFFFF, true));
        texts.addView(text(nowLabel(), 13f, 0xCCFFFFFF, false));
        band.addView(texts, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        return band;
    }

    private void styleButton(Button button, boolean primary) {
        button.setAllCaps(false);
        button.setTextSize(15f);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setStateListAnimator(null);
        button.setTextColor(primary ? 0xFFFFFFFF : COLOR_BODY);
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(primary ? COLOR_BRAND : COLOR_CARD);
        shape.setCornerRadius(dp(12));
        if (!primary) shape.setStroke(Math.max(1, dp(1)), 0xFFCBD5E1);
        button.setBackground(shape);
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        return row;
    }

    private TextView badge(String label, int color, int background) {
        TextView view = text(label, 12f, color, true);
        view.setPadding(dp(10), dp(4), dp(10), dp(4));
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(background);
        shape.setCornerRadius(dp(999));
        view.setBackground(shape);
        return view;
    }

    private GradientDrawable rounded(int fill, int stroke) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(fill);
        shape.setCornerRadius(dp(14));
        shape.setStroke(Math.max(1, dp(1)), stroke);
        return shape;
    }

    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private LinearLayout.LayoutParams margins(int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return params;
    }

    private LinearLayout.LayoutParams wrapContent() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(52));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static String nowLabel() {
        return DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, Locale.GERMANY).format(new Date());
    }

    private static String defaultTitle(String channel) {
        if ("diagnostic".equalsIgnoreCase(channel)) return "ExportHUB Fehlerdiagnose";
        if ("warning".equalsIgnoreCase(channel)) return "ExportHUB Warncenter";
        return "ExportHUB Aufgabe";
    }

    private static String headingForChannel(String channel) {
        if ("diagnostic".equalsIgnoreCase(channel)) return "Fehlerdiagnose";
        if ("warning".equalsIgnoreCase(channel)) return "Warncenter";
        return "Aufgabe";
    }

    private static String labelForEnvironment(String environment) {
        if ("testservice".equals(environment)) return "TESTSERVICE";
        if ("demo".equals(environment)) return "Demo";
        return "Produktion";
    }

    private static String safe(String value, String fallback) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.isEmpty()) return fallback;
        return cleaned.length() > 800 ? cleaned.substring(0, 800) : cleaned;
    }

    private static String safeLong(String value, String fallback) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.isEmpty()) return fallback;
        return cleaned.length() > 6000 ? cleaned.substring(0, 6000) : cleaned;
    }
}
