package de.exporthub.test;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

public final class NotificationHelper {
    public static final String CHANNEL_TASKS = "exporthub_tasks";
    public static final String CHANNEL_WARNINGS = "exporthub_warnings";
    public static final String CHANNEL_DIAGNOSTICS = "exporthub_diagnostics";
    private static final String PREFS = "exporthub_native_notifications";
    private static final String TASK_SNAPSHOT_PREFIX = "task_snapshot_";
    private static final String TASK_GROUP_PREFIX = "exporthub_tasks_group_";
    private static final int MAX_TASK_SNAPSHOT = 128 * 1024;
    private static final int MAX_TASKS_EXTRA = 48 * 1024;

    private NotificationHelper() {}

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        NotificationChannel tasks = new NotificationChannel(
                CHANNEL_TASKS,
                "ExportHUB Aufgaben",
                NotificationManager.IMPORTANCE_DEFAULT);
        tasks.setDescription("Persönliche ExportHUB Aufgaben und Erinnerungen");

        NotificationChannel warnings = new NotificationChannel(
                CHANNEL_WARNINGS,
                "ExportHUB Warncenter",
                NotificationManager.IMPORTANCE_HIGH);
        warnings.setDescription("Operative ExportHUB Sendungswarnungen");

        NotificationChannel diagnostics = new NotificationChannel(
                CHANNEL_DIAGNOSTICS,
                "ExportHUB Fehlerdiagnose",
                NotificationManager.IMPORTANCE_HIGH);
        diagnostics.setDescription("Technische ExportHUB Fehler und Diagnosewarnungen für globale Administratoren");

        manager.createNotificationChannel(tasks);
        manager.createNotificationChannel(warnings);
        manager.createNotificationChannel(diagnostics);
    }

    public static boolean storeTaskSnapshot(Context context, String environment, String payload) {
        if (context == null) return false;
        String env = EnvironmentActivity.normalizeEnvironment(environment);
        String value = payload == null ? "" : payload.trim();
        if (value.length() > MAX_TASK_SNAPSHOT) return false;
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(TASK_SNAPSHOT_PREFIX + env, value).apply();
        return true;
    }

    public static String readTaskSnapshot(Context context, String environment) {
        if (context == null) return "";
        String env = EnvironmentActivity.normalizeEnvironment(environment);
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(TASK_SNAPSHOT_PREFIX + env, "");
    }

    public static boolean show(Context context,
                               String environment,
                               String channel,
                               String key,
                               String title,
                               String body,
                               String route) {
        return show(context, environment, channel, key, title, body, route, null);
    }

    public static boolean show(Context context,
                               String environment,
                               String channel,
                               String key,
                               String title,
                               String body,
                               String route,
                               String autofixTicket) {
        String env = EnvironmentActivity.normalizeEnvironment(environment);
        if ("task_snapshot".equalsIgnoreCase(channel)) {
            return storeTaskSnapshot(context, env, body);
        }

        ensureChannels(context);
        if (!notificationsAllowed(context)) return false;

        String normalizedChannel;
        if ("warning".equalsIgnoreCase(channel)) normalizedChannel = "warning";
        else if ("diagnostic".equalsIgnoreCase(channel)) normalizedChannel = "diagnostic";
        else normalizedChannel = "notification";
        String channelId = "warning".equals(normalizedChannel)
                ? CHANNEL_WARNINGS
                : ("diagnostic".equals(normalizedChannel) ? CHANNEL_DIAGNOSTICS : CHANNEL_TASKS);
        String safeKey = safe(key, "notice");
        String safeTitle = safe(title, "ExportHUB");
        String safeBody = safe(body, "ExportHUB hat einen neuen Hinweis.");
        String safeRoute = safe(route, normalizedChannel);
        // Performance hints (slow API call, long task, large render) are not actionable on the phone.
        // The website stops sending them too, but the app filters them as well so an older website
        // release cannot flood the notification shade again.
        if ("diagnostic".equals(normalizedChannel) && isPerformanceHint(safeBody)) return false;
        // A generic task-check reminder carries no actionable task details.
        // Do not interrupt users with it; real task notifications remain unchanged.
        if ("notification".equals(normalizedChannel)
                && "ExportHUB Aufgaben prüfen".equals(safeTitle)
                && "Prüfe deine persönlichen offenen Aufgaben in ExportHUB.".equals(safeBody)) {
            return false;
        }
        String signature = safeKey + "|" + safeBody;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String dedupeKey = "last:" + env + ":" + normalizedChannel
                + ("notification".equals(normalizedChannel) ? ":" + safeKey : "");
        if (signature.equals(prefs.getString(dedupeKey, ""))) return false;
        prefs.edit().putString(dedupeKey, signature).apply();

        Intent intent = notificationIntent(context, env, normalizedChannel, safeKey, safeTitle, safeBody, safeRoute, null);
        if ("diagnostic".equals(normalizedChannel) && autofixTicket != null && autofixTicket.startsWith("ehaf1.") && autofixTicket.length() < 4000) {
            intent.putExtra(NotificationDetailActivity.EXTRA_AUTOFIX_TICKET, autofixTicket);
        }
        int notificationId = Math.abs((env + ":" + normalizedChannel + ":" + safeKey).hashCode());
        int pendingIntentRequestCode = Math.abs(("native-detail-v2:" + env + ":" + normalizedChannel + ":" + safeKey).hashCode());
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                pendingIntentRequestCode,
                intent,
                PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int smallIcon = context.getApplicationInfo().icon;
        android.app.Notification.Builder builder = new android.app.Notification.Builder(context, channelId)
                .setSmallIcon(smallIcon)
                .setContentTitle(safeTitle)
                .setContentText(safeBody)
                .setStyle(new android.app.Notification.BigTextStyle().bigText(safeBody))
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);
        if ("notification".equals(normalizedChannel)) builder.setGroup(taskGroup(env));

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return false;
        manager.notify(notificationId, builder.build());
        return true;
    }

    public static boolean showTaskSummary(Context context,
                                          String environment,
                                          String key,
                                          int count,
                                          String highestPriority,
                                          String taskLines,
                                          String tasksJson) {
        if (context == null || count < 2) return false;
        String env = EnvironmentActivity.normalizeEnvironment(environment);
        ensureChannels(context);
        if (!notificationsAllowed(context)) return false;

        String safeKey = safe(key, "task-summary");
        String priority = safe(highestPriority, "P4");
        String title = "ExportHUB Aufgaben";
        String body = count + " offene Aufgaben · höchste Priorität " + priority;
        // The summary lists every task, so the whole content is readable in the notification itself.
        String lines = taskLines == null ? "" : taskLines.trim();
        if (lines.length() > 4000) lines = lines.substring(0, 4000) + "\n…";
        String fullBody = lines.isEmpty() ? body : body + "\n" + lines;
        String signature = safeKey + "|" + fullBody;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String dedupeKey = "last:" + env + ":notification:summary:" + safeKey;
        if (signature.equals(prefs.getString(dedupeKey, ""))) return false;
        prefs.edit().putString(dedupeKey, signature).apply();

        Intent intent = notificationIntent(context, env, "notification", safeKey, title, fullBody, "tasks", tasksJson);
        int requestCode = Math.abs(("native-summary-v1:" + env + ":" + safeKey).hashCode());
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        android.app.Notification notification = new android.app.Notification.Builder(context, CHANNEL_TASKS)
                .setSmallIcon(context.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new android.app.Notification.BigTextStyle().bigText(fullBody))
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setGroup(taskGroup(env))
                .setGroupSummary(true)
                .build();

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return false;
        int notificationId = Math.abs((env + ":task-summary:" + safeKey).hashCode());
        manager.notify(notificationId, notification);
        return true;
    }

    private static Intent notificationIntent(Context context,
                                             String environment,
                                             String channel,
                                             String key,
                                             String title,
                                             String body,
                                             String route,
                                             String tasksJson) {
        Intent intent = new Intent(context, NotificationDetailActivity.class);
        intent.setAction("de.exporthub.OPEN_NOTIFICATION.NATIVE_DETAIL_V2." + environment + "." + channel + "." + key);
        intent.putExtra(EnvironmentActivity.EXTRA_ENVIRONMENT, environment);
        intent.putExtra(NotificationDetailActivity.EXTRA_NOTIFICATION_TITLE, title);
        intent.putExtra(NotificationDetailActivity.EXTRA_NOTIFICATION_BODY, body);
        intent.putExtra(NotificationDetailActivity.EXTRA_NOTIFICATION_CHANNEL, channel);
        intent.putExtra(NotificationDetailActivity.EXTRA_NOTIFICATION_ROUTE, route);
        if (tasksJson != null && !tasksJson.isEmpty() && tasksJson.length() <= MAX_TASKS_EXTRA) {
            intent.putExtra(NotificationDetailActivity.EXTRA_NOTIFICATION_TASKS, tasksJson);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return intent;
    }

    private static boolean notificationsAllowed(Context context) {
        return Build.VERSION.SDK_INT < 33
                || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean isPerformanceHint(String body) {
        String text = body == null ? "" : body;
        return text.contains("Langsamer API-Aufruf")
                || text.contains("Langsamer XHR-Aufruf")
                || text.contains("Browser-Hänger")
                || text.contains("Long Task")
                || text.contains("Großer Render-Vorgang")
                || text.contains("Häufiges Neu-Rendern");
    }

    private static String taskGroup(String environment) {
        return TASK_GROUP_PREFIX + environment;
    }

    private static String safe(String value, String fallback) {
        String v = value == null ? "" : value.trim();
        if (v.isEmpty()) return fallback;
        return v.length() > 400 ? v.substring(0, 400) : v;
    }
}
