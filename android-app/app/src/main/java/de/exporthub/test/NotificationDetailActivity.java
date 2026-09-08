package de.exporthub.test;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.text.DateFormat;
import java.util.Date;
import java.util.Locale;

public final class NotificationDetailActivity extends Activity {
    public static final String EXTRA_NOTIFICATION_TITLE = "exporthub_notification_title";
    public static final String EXTRA_NOTIFICATION_BODY = "exporthub_notification_body";
    public static final String EXTRA_NOTIFICATION_CHANNEL = "exporthub_notification_channel";
    public static final String EXTRA_NOTIFICATION_ROUTE = "exporthub_notification_route";

    private String environment = "production";
    private String route = "notifications";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent source = getIntent();
        environment = EnvironmentActivity.normalizeEnvironment(
                source == null ? null : source.getStringExtra(EnvironmentActivity.EXTRA_ENVIRONMENT));
        route = safe(source == null ? null : source.getStringExtra(EXTRA_NOTIFICATION_ROUTE), "notifications");
        String channel = safe(source == null ? null : source.getStringExtra(EXTRA_NOTIFICATION_CHANNEL), "notification");
        String title = safe(source == null ? null : source.getStringExtra(EXTRA_NOTIFICATION_TITLE), defaultTitle(channel));
        String body = safe(source == null ? null : source.getStringExtra(EXTRA_NOTIFICATION_BODY), "ExportHUB hat einen neuen Hinweis.");

        setTitle(defaultTitle(channel));
        setContentView(buildContent(channel, title, body));
    }

    private ScrollView buildContent(String channel, String title, String body) {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(0xFFF8FAFC);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(28), dp(22), dp(28));
        root.setGravity(Gravity.TOP);
        scroll.addView(root, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView app = text("ExportHUB", 15f, 0xFF0F766E, true);
        root.addView(app);

        TextView heading = text(defaultTitle(channel), 25f, 0xFF0F172A, true);
        LinearLayout.LayoutParams headingParams = wrap();
        headingParams.topMargin = dp(8);
        root.addView(heading, headingParams);

        TextView meta = text(
                labelForChannel(channel) + "  ·  " + labelForEnvironment(environment) + "  ·  "
                        + DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, Locale.getDefault()).format(new Date()),
                13f,
                0xFF64748B,
                false);
        LinearLayout.LayoutParams metaParams = wrap();
        metaParams.topMargin = dp(8);
        root.addView(meta, metaParams);

        TextView titleView = text(title, 19f, 0xFF0F172A, true);
        LinearLayout.LayoutParams titleParams = wrap();
        titleParams.topMargin = dp(28);
        root.addView(titleView, titleParams);

        TextView bodyView = text(body, 17f, 0xFF334155, false);
        bodyView.setLineSpacing(0f, 1.18f);
        bodyView.setTextIsSelectable(true);
        LinearLayout.LayoutParams bodyParams = wrap();
        bodyParams.topMargin = dp(12);
        root.addView(bodyView, bodyParams);

        TextView privacy = text(
                "Diese Ansicht zeigt nur den Inhalt dieser Handy-Benachrichtigung. Der geschützte ExportHUB-Arbeitsbereich wird dadurch nicht freigegeben.",
                13f,
                0xFF64748B,
                false);
        LinearLayout.LayoutParams privacyParams = wrap();
        privacyParams.topMargin = dp(26);
        root.addView(privacy, privacyParams);

        Button open = new Button(this);
        open.setText("In ExportHUB öffnen");
        open.setAllCaps(false);
        open.setTextSize(16f);
        open.setOnClickListener(v -> openExportHub());
        LinearLayout.LayoutParams openParams = matchWrap();
        openParams.topMargin = dp(28);
        root.addView(open, openParams);

        Button close = new Button(this);
        close.setText("Schließen");
        close.setAllCaps(false);
        close.setTextSize(15f);
        close.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams closeParams = matchWrap();
        closeParams.topMargin = dp(8);
        root.addView(close, closeParams);

        return scroll;
    }

    private void openExportHub() {
        Intent intent = new Intent(this, EnvironmentActivity.class);
        intent.putExtra(EnvironmentActivity.EXTRA_ENVIRONMENT, environment);
        intent.putExtra(EnvironmentActivity.EXTRA_ROUTE, route);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
    }

    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
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

    private static String defaultTitle(String channel) {
        if ("diagnostic".equalsIgnoreCase(channel)) return "ExportHUB Fehlerdiagnose";
        if ("warning".equalsIgnoreCase(channel)) return "ExportHUB Warncenter";
        return "ExportHUB Benachrichtigung";
    }

    private static String labelForChannel(String channel) {
        if ("diagnostic".equalsIgnoreCase(channel)) return "Fehlerdiagnose";
        if ("warning".equalsIgnoreCase(channel)) return "Warnung";
        return "Benachrichtigung";
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
}
