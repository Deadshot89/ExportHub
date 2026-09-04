package de.exporthub.test;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import java.util.Calendar;

public final class ReminderScheduler {
    private static final int[] HOURS = new int[]{9, 12, 15};
    private static final String PREFS = "exporthub_environment";
    private static final String KEY_ENV = "selected_environment";

    private ReminderScheduler() {}

    public static void schedule(Context context, String environment) {
        String env = EnvironmentActivity.normalizeEnvironment(environment);
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_ENV, env).apply();

        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;

        for (int hour : HOURS) {
            Intent intent = new Intent(context, ReminderReceiver.class);
            intent.setAction("de.exporthub.REMINDER." + hour);
            intent.putExtra(EnvironmentActivity.EXTRA_ENVIRONMENT, env);
            intent.putExtra("hour", hour);
            PendingIntent pending = PendingIntent.getBroadcast(
                    context,
                    99600 + hour,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Calendar next = Calendar.getInstance();
            next.set(Calendar.HOUR_OF_DAY, hour);
            next.set(Calendar.MINUTE, 0);
            next.set(Calendar.SECOND, 0);
            next.set(Calendar.MILLISECOND, 0);
            if (next.getTimeInMillis() <= System.currentTimeMillis()) {
                next.add(Calendar.DAY_OF_YEAR, 1);
            }

            alarms.setInexactRepeating(
                    AlarmManager.RTC_WAKEUP,
                    next.getTimeInMillis(),
                    AlarmManager.INTERVAL_DAY,
                    pending);
        }
    }

    public static String savedEnvironment(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return EnvironmentActivity.normalizeEnvironment(prefs.getString(KEY_ENV, "testservice"));
    }
}
