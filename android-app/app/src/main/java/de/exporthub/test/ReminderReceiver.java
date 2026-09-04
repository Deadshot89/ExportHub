package de.exporthub.test;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

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
        String key = "scheduled-task-check:" + day + ":" + hour;
        NotificationHelper.show(
                context,
                env,
                "notification",
                key,
                "ExportHUB Aufgaben prüfen",
                "Prüfe deine persönlichen offenen Aufgaben in ExportHUB.",
                "notifications");
    }
}
