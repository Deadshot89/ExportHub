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

            // A scheduled reminder is not a reason to invent a task. Without a valid,
            // user-scoped snapshot there is nothing actionable to notify about.
            if (root == null || !env.equals(snapshotEnv) || userId.isEmpty() || tasks == null || tasks.length() == 0) {
                return;
            }

            int validTaskCount = 0;
            String highestPriority = "P4";

            for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.optJSONObject(i);
                if (task == null) continue;

                String taskId = task.optString("id", "").trim();
                String priority = normalizePriority(task.optString("priority", "P4"));
                String title = task.optString("title", "").trim();
                String sourceRef = task.optString("sourceRef", "").trim();
                String dueBucket = task.optString("dueBucket", "none").trim();
                String route = task.optString("route", "tasks").trim();
                if (taskId.isEmpty() || title.isEmpty()) continue;

                validTaskCount++;
                highestPriority = higherPriority(highestPriority, priority);

                String key = taskId + "|" + day + "|" + hour + "|" + env + "|" + userId;
                String dueText = dueLabel(dueBucket);
                String body = title
                        + (sourceRef.isEmpty() ? "" : " · " + sourceRef)
                        + " · " + dueText;
                String directRoute = route.isEmpty() || "tasks".equalsIgnoreCase(route)
                        ? "tasks:" + taskId
                        : route;

                NotificationHelper.show(
                        context,
                        env,
                        "notification",
                        key,
                        "ExportHUB Aufgabe · " + priority,
                        body,
                        directRoute);
            }

            if (validTaskCount > 1) {
                String summaryKey = "task-summary|" + day + "|" + hour + "|" + env + "|" + userId;
                NotificationHelper.showTaskSummary(
                        context,
                        env,
                        summaryKey,
                        validTaskCount,
                        highestPriority);
            }
        } catch (Exception ignored) {
            // Corrupt/stale snapshots must fail closed. The next successful website
            // sync replaces the snapshot; no generic or misleading task is shown.
        }
    }

    private static String normalizePriority(String value) {
        String priority = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if ("P0".equals(priority)
                || "P1".equals(priority)
                || "P2".equals(priority)
                || "P3".equals(priority)
                || "P4".equals(priority)) {
            return priority;
        }
        return "P4";
    }

    private static String higherPriority(String current, String candidate) {
        return priorityRank(candidate) < priorityRank(current) ? candidate : current;
    }

    private static int priorityRank(String priority) {
        if ("P0".equalsIgnoreCase(priority)) return 0;
        if ("P1".equalsIgnoreCase(priority)) return 1;
        if ("P2".equalsIgnoreCase(priority)) return 2;
        if ("P3".equalsIgnoreCase(priority)) return 3;
        return 4;
    }

    private static String dueLabel(String bucket) {
        if ("overdue".equalsIgnoreCase(bucket)) return "Überfällig";
        if ("today".equalsIgnoreCase(bucket)) return "Heute fällig";
        if ("future".equalsIgnoreCase(bucket)) return "Zukünftig";
        return "Ohne Termin";
    }
}
