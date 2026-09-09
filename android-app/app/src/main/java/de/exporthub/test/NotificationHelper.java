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
    private static final int MAX_TASK_SNAPSHOT = 128 * 1024;

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
        String env = EnvironmentActivity.normalizeEnvironment(environment);
        if ("task_snapshot".equalsIgnoreCase(channel)) {
            return storeTaskSnapshot(context, env, body);
        }

        ensureChannels(context);
        if (Build.VERSION.SDK_INT >= 33
                && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }

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
        String signature = safeKey + "|" + safeBody;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String dedupeKey = "last:" + env + ":" + normalizedChannel;
        if (signature.equals(prefs.getString(dedupeKey, ""))) return false;
        prefs.edit().putString(dedupeKey, signature).apply();

        Intent intent = new Intent(context, NotificationDetailActivity.class);
        intent.setAction("de.exporthub.OPEN_NOTIFICATION.NATIVE_DETAIL_V2." + env + "." + normalizedChannel + "." + safeKey);
        intent.putExtra(EnvironmentActivity.EXTRA_ENVIRONMENT, env);
        intent.putExtra(NotificationDetailActivity.EXTRA_NOTIFICATION_TITLE, safeTitle);
        intent.putExtra(NotificationDetailActivity.EXTRA_NOTIFICATION_BODY, safeBody);
        intent.putExtra(NotificationDetailActivity.EXTRA_NOTIFICATION_CHANNEL, normalizedChannel);
        intent.putExtra(NotificationDetailActivity.EXTRA_NOTIFICATION_ROUTE, safeRoute);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int notificationId = Math.abs((env + ":" + normalizedChannel + ":" + safeKey).hashCode());
        int pendingIntentRequestCode = Math.abs(("native-detail-v2:" + env + ":" + normalizedChannel + ":" + safeKey).hashCode());
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                pendingIntentRequestCode,
                intent,
                PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int smallIcon = context.getApplicationInfo().icon;
        android.app.Notification notification = new android.app.Notification.Builder(context, channelId)
                .setSmallIcon(smallIcon)
                .setContentTitle(safeTitle)
                .setContentText(safeBody)
                .setStyle(new android.app.Notification.BigTextStyle().bigText(safeBody))
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build();

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return false;
        manager.notify(notificationId, notification);
        return true;
    }

    private static String safe(String value, String fallback) {
        String v = value == null ? "" : value.trim();
        if (v.isEmpty()) return fallback;
        return v.length() > 400 ? v.substring(0, 400) : v;
    }
}
