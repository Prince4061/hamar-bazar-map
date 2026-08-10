package com.hamarbazar.rider;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView myWebView;
    private static final int PERMISSION_REQUEST_CODE = 1234;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        myWebView = new WebView(this);
        setContentView(myWebView);

        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setGeolocationEnabled(true);
        webSettings.setAllowFileAccess(true);

        myWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        myWebView.setWebViewClient(new WebViewClient());

        // Add JS Interface for web app to control native foreground tracking service
        myWebView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");

        // Request all necessary background tracking permissions
        requestRiderPermissions();

        myWebView.loadUrl("https://hamar-bazar-map.onrender.com/rider");
    }

    private void requestRiderPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                String[] permissions = new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.POST_NOTIFICATIONS
                };
                requestPermissions(permissions, PERMISSION_REQUEST_CODE);
            } else {
                String[] permissions = new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                };
                requestPermissions(permissions, PERMISSION_REQUEST_CODE);
            }
        }
    }

    // JavaScript Bridge class accessible in window.AndroidBridge
    public class WebAppInterface {
        @JavascriptInterface
        public void startRiderService(String riderId, String serverUrl) {
            Intent serviceIntent = new Intent(MainActivity.this, RiderLocationService.class);
            serviceIntent.putExtra("rider_id", riderId);
            if (serverUrl != null && !serverUrl.isEmpty()) {
                serviceIntent.putExtra("server_url", serverUrl);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }

            runOnUiThread(() -> Toast.makeText(MainActivity.this, "🔒 24/7 Background Tracking Started! Screen lock hone par bhi location share hogi.", Toast.LENGTH_LONG).show());
        }

        @JavascriptInterface
        public void stopRiderService() {
            Intent serviceIntent = new Intent(MainActivity.this, RiderLocationService.class);
            stopService(serviceIntent);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Duty Ended. Location Tracking Stopped.", Toast.LENGTH_SHORT).show());
        }
    }
}
