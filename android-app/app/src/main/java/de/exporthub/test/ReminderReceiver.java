package de.exporthub.test;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String env = EnvironmentActivity.normalizeEnvironment(
                intent == null ? null : intent.getStringExtra(EnvironmentActivity.EXTRA_ENVIRONMENT));
        int hour = intent == null ? 0 : intent.getIntExtra("hour", 0);
        String day = new SimpleDateFormat("yyyyMMdd", Locale.ROOT).format(new Date());
        String snapshot = NotificationHelper.readTaskSnapshot(context, env);

        try {
            JSONObject root = snapshot == null || snapshot.trim().isEmpty()
                    ? null
                    : new JSONObject(snapshot);
            String snapshotEnv = root == null ? "" : EnvironmentActivity.normalizeEnvironment(root.optString("environment", env));
            String userId = root == null ? "" : root.optString("userId", "").trim();
            JSONArray tasks = root == null ? null : root.optJSONArray("tasks");

            if (root == null || !env.equals(snapshotEnv) || userId.isEmpty() || tasks == null || tasks.length() == 0) {
                String key = "scheduled-task-sync|" + day + "|" + hour + "|" + env;
                NotificationHelper.show(
                        context,
                        env,
                        "notification",
                        key,
                        "ExportHUB Aufgaben",
                        "Öffne ExportHUB, um deine aktuellen persönlichen Aufgaben zu synchronisieren.",
                        "tasks");
                return;
            }

            JSONObject task = tasks.optJSONObject(0);
            if (task == null) return;
            String taskId = task.optString("id", "task").trim();
            String priority = task.optString("priority", "P4").trim();
            String title = task.optString("title", "Offene Aufgabe").trim();
            String sourceRef = task.optString("sourceRef", "").trim();
            String dueBucket = task.optString("dueBucket", "none").trim();
            String route = task.optString("route", "tasks").trim();
            String key = taskId + "|" + day + "|" + hour + "|" + env + "|" + userId;
            String dueText = dueLabel(dueBucket);
            String body = title
                    + (sourceRef.isEmpty() ? "" : " · " + sourceRef)
                    + " · " + dueText;

            NotificationHelper.show(
                    context,
                    env,
                    "notification",
                    key,
                    "ExportHUB Aufgabe · " + priority,
                    body,
                    route.isEmpty() ? "tasks" : route);
        } catch (Exception ignored) {
            String key = "scheduled-task-sync-error|" + day + "|" + hour + "|" + env;
            NotificationHelper.show(
                    context,
                    env,
                    "notification",
                    key,
                    "ExportHUB Aufgaben",
                    "Aufgabenstand konnte nicht gelesen werden. Öffne ExportHUB zur Aktualisierung.",
                    "tasks");
        }
    }

    private static String dueLabel(String bucket) {
        if ("overdue".equalsIgnoreCase(bucket)) return "Überfällig";
        if ("today".equalsIgnoreCase(bucket)) return "Heute fällig";
        if ("future".equalsIgnoreCase(bucket)) return "Zukünftig";
        return "Ohne Termin";
    }
}
