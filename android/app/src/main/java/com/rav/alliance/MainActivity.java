package com.rav.alliance;

import android.app.Activity;
import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.provider.Settings;
import android.webkit.WebResourceResponse;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

/** RAV Alliance native Android shell. HTTPS-only trusted host; no JS-to-native bridge. */
public final class MainActivity extends Activity {
    private static final String HOME = "https://rav377.netlify.app/";
    private static final String TRUSTED_HOST = "rav377.netlify.app";
    private static final int PICK_FILE = 3107;
    private static final int REQUEST_NOTIFICATION_PERMISSION = 3414;
    private static final String RAV_PUSH_PREFS = "rav_fcm";
    private WebView webView;
    private ProgressBar progress;
    private android.webkit.ValueCallback<Uri[]> fileCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setupNotificationChannel();
        initializeFirebaseIfConfigured();
        getWindow().setStatusBarColor(Color.rgb(16, 20, 25));
        getWindow().setNavigationBarColor(Color.rgb(16, 20, 25));

        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(16, 20, 25));
        webView = new WebView(this);
        frame.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-1, dp(3));
        lp.gravity = android.view.Gravity.TOP;
        frame.addView(progress, lp);
        setContentView(frame);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); // required by the RAV website
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setAllowContentAccess(true); // file picker URIs, only on explicit user choice
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
        WebView.setWebContentsDebuggingEnabled(false);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (isTrustedSite(url)) {
                    view.evaluateJavascript("window.ravNativeAndroid=true;",null);
                    String savedToken=getSharedPreferences(RAV_PUSH_PREFS,MODE_PRIVATE).getString("fcm_token",null);
                    if(savedToken!=null)passPushTokenToSite(savedToken);
                }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame())
                    Toast.makeText(MainActivity.this, "Bağlantı kurulamadı. İnternetini kontrol et.", Toast.LENGTH_LONG).show();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
            @Override public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.setType("image/*");
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(picker, PICK_FILE); }
                catch (ActivityNotFoundException e) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "Dosya seçici bulunamadı", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });
        if (state != null) webView.restoreState(state);
        else webView.loadUrl("alerts".equals(getIntent().getStringExtra("screen"))?HOME+"?screen=alerts":HOME);
    }

    private boolean isTrustedSite(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        return "https".equalsIgnoreCase(uri.getScheme()) && TRUSTED_HOST.equalsIgnoreCase(uri.getHost());
    }

    private void setupNotificationChannel(){
        if(Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager notifications=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if(notifications.getNotificationChannel("rav_urgent")!=null)return;
        NotificationChannel channel=new NotificationChannel(
            "rav_urgent","RAV Acil İttifak Bildirimleri",NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("R4/R5 ve Site Admin'in önemli ittifak uyarıları.");
        channel.enableVibration(true);
        channel.setSound(Settings.System.DEFAULT_NOTIFICATION_URI,
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        notifications.createNotificationChannel(channel);
    }

    private boolean initializeFirebaseIfConfigured(){
        if(BuildConfig.RAV_FIREBASE_APP_ID.isEmpty()||BuildConfig.RAV_FIREBASE_API_KEY.isEmpty()
           ||BuildConfig.RAV_FIREBASE_SENDER_ID.isEmpty()||BuildConfig.RAV_FIREBASE_PROJECT_ID.isEmpty())
            return false;
        if(FirebaseApp.getApps(this).isEmpty()){
            FirebaseOptions options=new FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.RAV_FIREBASE_APP_ID)
                .setApiKey(BuildConfig.RAV_FIREBASE_API_KEY)
                .setGcmSenderId(BuildConfig.RAV_FIREBASE_SENDER_ID)
                .setProjectId(BuildConfig.RAV_FIREBASE_PROJECT_ID).build();
            FirebaseApp.initializeApp(this,options);
        }
        return true;
    }

    private void passPushTokenToSite(String token){
        if(webView==null||!isTrustedSite(webView.getUrl()))return;
        webView.evaluateJavascript(
            "window.ravNativeAndroid=true;"+
            "window.ravNativePushToken="+JSONObject.quote(token)+";"+
            "if(window.ravReceivePushToken)window.ravReceivePushToken("+JSONObject.quote(token)+");",null);
    }

    private void notifySite(boolean permitted,boolean configured){
        if(webView==null||!isTrustedSite(webView.getUrl()))return;
        webView.evaluateJavascript("if(window.ravNotificationPermission)window.ravNotificationPermission("+
            permitted+","+configured+");",null);
    }

    private void enableNotifications(){
        if(!initializeFirebaseIfConfigured()){notifySite(false,false);return;}
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},REQUEST_NOTIFICATION_PERMISSION);
            return;
        }
        FirebaseMessaging.getInstance().setAutoInitEnabled(true);
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{
            if(!task.isSuccessful()){notifySite(false,true);return;}
            String token=task.getResult();
            if(token!=null){
                getSharedPreferences(RAV_PUSH_PREFS,MODE_PRIVATE).edit().putString("fcm_token",token).apply();
                passPushTokenToSite(token);notifySite(true,true);
            }
        });
    }

    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);
        if(requestCode==REQUEST_NOTIFICATION_PERMISSION){
            if(grantResults.length>0&&grantResults[0]==PackageManager.PERMISSION_GRANTED)enableNotifications();
            else notifySite(false,true);
        }
    }

    @Override protected void onNewIntent(Intent intent){
        super.onNewIntent(intent);
        setIntent(intent);
        if("alerts".equals(intent.getStringExtra("screen"))&&webView!=null)webView.loadUrl(HOME+"?screen=alerts");
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme();
        if("ravapp".equalsIgnoreCase(scheme) && "notifications".equalsIgnoreCase(uri.getHost()) &&
           "/enable".equals(uri.getPath())){
            enableNotifications();
            return true;
        }
        String host = uri.getHost();
        if ("https".equalsIgnoreCase(scheme) && TRUSTED_HOST.equalsIgnoreCase(host)) return false;
        if ("about".equalsIgnoreCase(scheme)) return false;
        if ("https".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme) || "tel".equalsIgnoreCase(scheme)) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
            catch (Exception ignored) { Toast.makeText(this, "Bağlantı açılamadı", Toast.LENGTH_SHORT).show(); }
        }
        return true;
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE && fileCallback != null) {
            Uri[] chosen = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = Math.min(data.getClipData().getItemCount(), 8);
                    chosen = new Uri[n];
                    for (int i = 0; i < n; i++) chosen[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) chosen = new Uri[]{data.getData()};
            }
            fileCallback.onReceiveValue(chosen);
            fileCallback = null;
        }
    }
    private int dp(float n) { return (int)(n * getResources().getDisplayMetrics().density + 0.5f); }
    @Override protected void onSaveInstanceState(Bundle state) { webView.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { super.onPause(); if (webView != null) webView.onPause(); }
    @Override protected void onResume() { super.onResume(); if (webView != null) webView.onResume(); }
    @Override @SuppressWarnings("deprecation") public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (webView != null) {
            ((ViewGroup)webView.getParent()).removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
