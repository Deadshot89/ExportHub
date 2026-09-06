package de.exporthub.test;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.print.PrintManager;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.ConnectivityManager.NetworkCallback;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.print.PrintDocumentAdapter;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.OutputStream;
import java.util.Locale;

public class EnvironmentActivity extends Activity {
    public static final String EXTRA_ENVIRONMENT = "exporthub_environment";
    public static final String EXTRA_ROUTE = "exporthub_route";

    private static final String PROD_HOST = "wonderful-forest-0f315e310.7.azurestaticapps.net";
    private static final String TEST_HOST = "wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net";
    private static final String PROD_URL = "https://" + PROD_HOST + "/";
    private static final String TEST_URL = "https://" + TEST_HOST + "/TESTVERSION.html";
    private static final String DEMO_URL = "https://" + TEST_HOST + "/demo.html";
    private static final String PREFS = "exporthub_environment";
    private static final String PREF_ENV = "selected_environment";
    private static final int FILE_CHOOSER_REQUEST = 9011;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 996;

    private WebView webView;
    private ProgressBar progressBar;
    private TextView connectivityBanner;
    private ValueCallback<Uri[]> filePathCallback;
    private ConnectivityManager connectivityManager;
    private NetworkCallback networkCallback;
    private String selectedEnvironment = "testservice";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        selectedEnvironment = normalizeEnvironment(
                getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREF_ENV, "testservice"));
        NotificationHelper.ensureChannels(this);
        buildUi();
        configureWebView();
        monitorConnectivity();
        requestNotificationPermission();

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    this::handleBack);
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            return;
        }

        String requested = getIntent() == null ? null : getIntent().getStringExtra(EXTRA_ENVIRONMENT);
        String route = getIntent() == null ? null : getIntent().getStringExtra(EXTRA_ROUTE);
        if (isEnvironment(requested)) {
            selectEnvironment(requested, route);
        } else {
            chooseEnvironment();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent == null) return;
        String requested = intent.getStringExtra(EXTRA_ENVIRONMENT);
        String route = intent.getStringExtra(EXTRA_ROUTE);
        if (isEnvironment(requested)) {
            selectEnvironment(requested, route);
        }
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFFFFFFFF);

        connectivityBanner = new TextView(this);
        connectivityBanner.setText("Offline – Eingaben erst nach Wiederverbindung absenden");
        connectivityBanner.setTextColor(0xFF7C2D12);
        connectivityBanner.setBackgroundColor(0xFFFFF4E5);
        connectivityBanner.setTextSize(13f);
        connectivityBanner.setGravity(Gravity.CENTER);
        connectivityBanner.setPadding(dp(10), dp(8), dp(10), dp(8));
        connectivityBanner.setVisibility(View.GONE);
        root.addView(connectivityBanner, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        root.addView(progressBar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        FrameLayout webContainer = new FrameLayout(this);
        webView = new WebView(this);
        webContainer.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(webContainer, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        setContentView(root);
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                v.setPadding(0, bars.top, 0, bars.bottom);
                return insets;
            });
            root.requestApplyInsets();
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " ExportHUB-Android/1.0 RC997.1");
        settings.setSafeBrowsingEnabled(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setClickable(true);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus(View.FOCUS_DOWN);

        webView.addJavascriptInterface(new AndroidBridge(), "ExportHUBAndroid");
        webView.setWebViewClient(new ExportHubWebViewClient());
        webView.setWebChromeClient(new ExportHubWebChromeClient());
        webView.setDownloadListener(new ExportHubDownloadListener());
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
        }
    }

    private void chooseEnvironment() {
        runOnUiThread(() -> {
            String[] labels = new String[]{"Produktion", "TESTSERVICE", "Demo"};
            new AlertDialog.Builder(EnvironmentActivity.this)
                    .setTitle("ExportHUB öffnen")
                    .setMessage("Wähle den Bereich. Produktion, TESTSERVICE und Demo bleiben vollständig getrennt.")
                    .setItems(labels, (dialog, which) -> {
                        if (which == 0) selectEnvironment("production", null);
                        else if (which == 1) selectEnvironment("testservice", null);
                        else selectEnvironment("demo", null);
                    })
                    .setCancelable(webView != null && webView.getUrl() != null)
                    .show();
        });
    }

    private void selectEnvironment(String environment) {
        selectEnvironment(environment, null);
    }

    private void selectEnvironment(String environment, String route) {
        String env = normalizeEnvironment(environment);
        selectedEnvironment = env;
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        prefs.edit().putString(PREF_ENV, env).apply();
        ReminderScheduler.schedule(this, env);
        String target = targetUrl(env, route);
        runOnUiThread(() -> webView.loadUrl(target));
    }

    public static String normalizeEnvironment(String environment) {
        String env = environment == null ? "" : environment.trim().toLowerCase(Locale.ROOT);
        if ("production".equals(env) || "testservice".equals(env) || "demo".equals(env)) return env;
        return "testservice";
    }

    private static boolean isEnvironment(String environment) {
        if (environment == null) return false;
        String env = environment.trim().toLowerCase(Locale.ROOT);
        return "production".equals(env) || "testservice".equals(env) || "demo".equals(env);
    }

    private String targetUrl(String environment, String route) {
        String env = normalizeEnvironment(environment);
        String base = "production".equals(env) ? PROD_URL : ("demo".equals(env) ? DEMO_URL : TEST_URL);
        Uri.Builder builder = Uri.parse(base).buildUpon()
                .appendQueryParameter("entry", "android")
                .appendQueryParameter("app", "1")
                .appendQueryParameter("environment", env);
        if (route != null && !route.trim().isEmpty()) builder.appendQueryParameter("ehRoute", route.trim());
        return builder.build().toString();
    }

    private boolean isInternalHost(String host) {
        String normalized = lower(host);
        return PROD_HOST.equals(normalized) || TEST_HOST.equals(normalized);
    }

    private class ExportHubWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleNavigation(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleNavigation(Uri.parse(url));
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            progressBar.setVisibility(View.VISIBLE);
            super.onPageStarted(view, url, favicon);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
            injectAndroidHooks();
            super.onPageFinished(view, url);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                connectivityBanner.setText("ExportHUB konnte nicht geladen werden – Verbindung prüfen");
                connectivityBanner.setVisibility(View.VISIBLE);
            }
            super.onReceivedError(view, request, error);
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
            handler.cancel();
            Toast.makeText(EnvironmentActivity.this,
                    "Sichere Verbindung fehlgeschlagen. Seite wurde blockiert.", Toast.LENGTH_LONG).show();
        }
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) return true;
        String scheme = lower(uri.getScheme());
        String host = lower(uri.getHost());

        if ("https".equals(scheme) && isInternalHost(host)) return false;
        if ("about".equals(scheme) || "data".equals(scheme) || "blob".equals(scheme)) return false;

        try {
            Intent external = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(external);
        } catch (Exception e) {
            Toast.makeText(this, "Link konnte nicht geöffnet werden.", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private class ExportHubWebChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            super.onProgressChanged(view, newProgress);
        }

        @Override
        public boolean onShowFileChooser(WebView webView,
                                         ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (filePathCallback != null) filePathCallback.onReceiveValue(null);
            filePathCallback = callback;

            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(resolveMimeType(params));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
                    params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);

            try {
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                return true;
            } catch (Exception e) {
                filePathCallback = null;
                Toast.makeText(EnvironmentActivity.this,
                        "Dateiauswahl konnte nicht geöffnet werden.", Toast.LENGTH_LONG).show();
                return false;
            }
        }
    }

    private String resolveMimeType(WebChromeClient.FileChooserParams params) {
        if (params == null || params.getAcceptTypes() == null) return "*/*";
        for (String type : params.getAcceptTypes()) {
            if (type != null && !type.trim().isEmpty() && !type.contains(",")) return type.trim();
        }
        return "*/*";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;

        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                result = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) {
                    result[i] = clip.getItemAt(i).getUri();
                    takeReadPermission(result[i]);
                }
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
                takeReadPermission(data.getData());
            }
        }
        filePathCallback.onReceiveValue(result);
        filePathCallback = null;
    }

    private void takeReadPermission(Uri uri) {
        try {
            getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
        }
    }

    private class ExportHubDownloadListener implements DownloadListener {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                    String mimeType, long contentLength) {
            if (url == null) return;
            String fileName = guessFileName(url, contentDisposition, mimeType);
            if (url.startsWith("blob:")) {
                downloadBlob(url, fileName, mimeType);
                return;
            }
            Uri uri = Uri.parse(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !isInternalHost(uri.getHost())) {
                handleNavigation(uri);
                return;
            }
            try {
                DownloadManager.Request request = new DownloadManager.Request(uri);
                request.setMimeType(mimeType);
                request.setTitle(fileName);
                request.setDescription("ExportHUB Download");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) request.addRequestHeader("Cookie", cookie);
                if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                dm.enqueue(request);
                Toast.makeText(EnvironmentActivity.this,
                        "Download gestartet: " + fileName, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(EnvironmentActivity.this,
                        "Download konnte nicht gestartet werden.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void downloadBlob(String blobUrl, String fileName, String mimeType) {
        String safeUrl = jsQuote(blobUrl);
        String safeName = jsQuote(fileName);
        String safeMime = jsQuote(mimeType == null ? "application/octet-stream" : mimeType);
        String script = "(async()=>{try{" +
                "const r=await fetch(" + safeUrl + ");" +
                "const b=await r.blob();" +
                "const fr=new FileReader();" +
                "fr.onloadend=()=>ExportHUBAndroid.saveBase64(" + safeName + "," + safeMime + ",String(fr.result).split(',')[1]||'');" +
                "fr.readAsDataURL(b);" +
                "}catch(e){ExportHUBAndroid.downloadError(String(e&&e.message||e));}})();";
        webView.evaluateJavascript(script, null);
    }

    private void injectAndroidHooks() {
        String script = "(()=>{" +
                "try{document.documentElement.setAttribute('data-exporthub-android-app','1');" +
                "window.__EXPORTHUB_ANDROID_APP__=true;" +
                "window.__EXPORTHUB_ANDROID_ENVIRONMENT__=" + jsQuote(selectedEnvironment) + ";" +
                "window.print=()=>ExportHUBAndroid.printPage();" +
                "window.addEventListener('online',()=>ExportHUBAndroid.networkHint(true));" +
                "window.addEventListener('offline',()=>ExportHUBAndroid.networkHint(false));" +
                "const installMenuFix=()=>{" +
                "try{" +
                "const old=document.getElementById('ehMenuBtn');if(!old)return false;" +
                "if(old.dataset.ehAndroidTapFix==='1')return true;" +
                "const btn=old.cloneNode(true);" +
                "btn.dataset.ehMenuBound='1';btn.dataset.ehAndroidTapFix='1';" +
                "btn.style.touchAction='manipulation';btn.style.pointerEvents='auto';" +
                "old.replaceWith(btn);" +
                "let last=0;" +
                "const toggle=(e)=>{" +
                "const now=Date.now();if(now-last<260)return;last=now;" +
                "if(e){e.preventDefault();e.stopPropagation();}" +
                "btn.dataset.ehSkipClick='1';setTimeout(()=>{if(btn.dataset.ehSkipClick==='1')delete btn.dataset.ehSkipClick;},700);" +
                "const api=window.ExportHUBMobileMenu;" +
                "if(api&&typeof api.isOpen==='function'&&typeof api.open==='function'&&typeof api.close==='function'){api.isOpen()?api.close():api.open();return;}" +
                "const open=document.body.classList.contains('eh-sidebar-open');" +
                "document.body.classList.toggle('eh-sidebar-open',!open);" +
                "btn.setAttribute('aria-expanded',open?'false':'true');" +
                "};" +
                "if(window.PointerEvent){btn.addEventListener('pointerup',toggle,{passive:false});}" +
                "else{btn.addEventListener('touchend',toggle,{passive:false});}" +
                "return true;" +
                "}catch(_){return false;}" +
                "};" +
                "installMenuFix();" +
                "const mo=new MutationObserver(()=>installMenuFix());" +
                "mo.observe(document.documentElement,{childList:true,subtree:true});" +
                "['exporthub:ready','exporthub:rendered','exporthub:viewchange'].forEach(n=>window.addEventListener(n,()=>setTimeout(installMenuFix,0)));" +
                "}catch(e){}})();";
        webView.evaluateJavascript(script, null);
    }

    private class AndroidBridge {
        @JavascriptInterface
        public void chooseEnvironment() {
            EnvironmentActivity.this.chooseEnvironment();
        }

        @JavascriptInterface
        public void selectEnvironment(String environment) {
            EnvironmentActivity.this.selectEnvironment(environment);
        }

        @JavascriptInterface
        public String getEnvironment() {
            return selectedEnvironment;
        }

        @JavascriptInterface
        public void notify(String channel, String key, String title, String body, String route) {
            NotificationHelper.show(
                    EnvironmentActivity.this,
                    selectedEnvironment,
                    channel,
                    key,
                    title,
                    body,
                    route);
        }

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("ExportHUB");
                    printManager.print("ExportHUB", adapter, null);
                } catch (Exception e) {
                    Toast.makeText(EnvironmentActivity.this,
                            "Druck konnte nicht geöffnet werden.", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void saveBase64(String fileName, String mimeType, String base64) {
            new Thread(() -> saveBase64ToDownloads(fileName, mimeType, base64)).start();
        }

        @JavascriptInterface
        public void downloadError(String message) {
            runOnUiThread(() -> Toast.makeText(EnvironmentActivity.this,
                    "Download fehlgeschlagen: " + message, Toast.LENGTH_LONG).show());
        }

        @JavascriptInterface
        public void networkHint(boolean online) {
            runOnUiThread(() -> setConnectivityState(online));
        }
    }

    private void saveBase64ToDownloads(String fileName, String mimeType, String base64) {
        try {
            byte[] bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
            String safeName = sanitizeFileName(fileName);
            android.content.ContentValues values = new android.content.ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
            values.put(MediaStore.Downloads.MIME_TYPE,
                    mimeType == null || mimeType.isEmpty() ? "application/octet-stream" : mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ExportHUB");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri target = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (target == null) throw new IllegalStateException("Kein Download-Ziel verfügbar");
            try (OutputStream out = getContentResolver().openOutputStream(target)) {
                if (out == null) throw new IllegalStateException("Download-Datei konnte nicht geöffnet werden");
                out.write(bytes);
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(target, values, null, null);
            runOnUiThread(() -> Toast.makeText(EnvironmentActivity.this,
                    "Gespeichert in Downloads/ExportHUB: " + safeName, Toast.LENGTH_LONG).show());
        } catch (Exception e) {
            runOnUiThread(() -> Toast.makeText(EnvironmentActivity.this,
                    "Datei konnte nicht gespeichert werden.", Toast.LENGTH_LONG).show());
        }
    }

    private String guessFileName(String url, String contentDisposition, String mimeType) {
        try {
            String guessed = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType);
            if (guessed != null && !guessed.isEmpty()) return sanitizeFileName(guessed);
        } catch (Exception ignored) {
        }
        return "ExportHUB-" + System.currentTimeMillis() + ".bin";
    }

    private String sanitizeFileName(String name) {
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) n = "ExportHUB-" + System.currentTimeMillis() + ".bin";
        n = n.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        if (n.length() > 120) n = n.substring(0, 120);
        return n;
    }

    private String jsQuote(String value) {
        String s = value == null ? "" : value;
        return "'" + s.replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\r", "\\r")
                .replace("\n", "\\n") + "'";
    }

    private void monitorConnectivity() {
        connectivityManager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        networkCallback = new NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                runOnUiThread(() -> setConnectivityState(true));
            }

            @Override
            public void onLost(Network network) {
                runOnUiThread(() -> setConnectivityState(isCurrentlyOnline()));
            }

            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
                boolean online = capabilities != null
                        && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                        && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                runOnUiThread(() -> setConnectivityState(online));
            }
        };
        try {
            connectivityManager.registerDefaultNetworkCallback(networkCallback);
        } catch (Exception ignored) {
        }
        setConnectivityState(isCurrentlyOnline());
    }

    private boolean isCurrentlyOnline() {
        try {
            Network network = connectivityManager.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities c = connectivityManager.getNetworkCapabilities(network);
            return c != null
                    && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Exception e) {
            return true;
        }
    }

    private void setConnectivityState(boolean online) {
        connectivityBanner.setVisibility(online ? View.GONE : View.VISIBLE);
        connectivityBanner.setText(online
                ? "Verbindung wiederhergestellt"
                : "Offline – Eingaben erst nach Wiederverbindung absenden");
    }

    private void handleBack() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else finish();
    }

    @Override
    public void onBackPressed() {
        handleBack();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
            }
        }
        if (webView != null) {
            webView.stopLoading();
            webView.removeJavascriptInterface("ExportHUBAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }
}
