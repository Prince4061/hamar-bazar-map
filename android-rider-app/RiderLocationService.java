package com.hamarbazar.rider;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class RiderLocationService extends Service implements LocationListener {

    private static final String TAG = "HB_RiderService";
    private static final String CHANNEL_ID = "HamarBazarRiderChannel";
    private static final int NOTIFICATION_ID = 1001;

    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;
    private ExecutorService networkExecutor;

    private String riderId = "1";
    private String serverUrl = "https://hamar-bazar-map.onrender.com/api/rider/location";
    private int currentBattery = 100;
    private BroadcastReceiver batteryReceiver;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Rider Location Service Created");

        networkExecutor = Executors.newSingleThreadExecutor();

        // 1. Partial WakeLock keeps CPU active when screen is locked/OFF
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HamarBazarRider::LocationWakeLock");
            wakeLock.acquire();
        }

        // 2. Register Battery Receiver
        batteryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                int level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                if (level >= 0 && scale > 0) {
                    currentBattery = Math.round((level / (float) scale) * 100);
                }
            }
        };
        registerReceiver(batteryReceiver, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));

        // 3. Location Manager Setup
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            if ("STOP".equals(intent.getAction())) {
                stopSelf();
                return START_NOT_STICKY;
            }
            if (intent.hasExtra("rider_id")) {
                riderId = intent.getStringExtra("rider_id");
            }
            if (intent.hasExtra("server_url")) {
                serverUrl = intent.getStringExtra("server_url");
            }
        }

        createNotificationChannel();
        Notification notification = buildForegroundNotification();
        startForeground(NOTIFICATION_ID, notification);

        startLocationUpdates();

        return START_STICKY;
    }

    private void startLocationUpdates() {
        try {
            if (locationManager != null) {
                // Request GPS location updates every 5 seconds or 5 meters
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5000, 3, this);
                }
                // Backup provider: Network provider
                if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 8000, 5, this);
                }
            }
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission missing", e);
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;

        final double lat = location.getLatitude();
        final double lng = location.getLongitude();
        final float speedKmh = location.hasSpeed() ? (location.getSpeed() * 3.6f) : 0f;

        Log.d(TAG, "GPS Update (Screen OFF active): " + lat + ", " + lng + " Speed: " + speedKmh);

        // Send to server in background thread
        networkExecutor.execute(() -> sendLocationToServer(lat, lng, speedKmh));
    }

    private void sendLocationToServer(double lat, double lng, float speed) {
        try {
            URL url = new URL(serverUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            String jsonInputString = String.format(
                "{\"rider_id\":\"%s\",\"latitude\":%.6f,\"longitude\":%.6f,\"speed\":%.1f,\"battery\":%d,\"status\":\"online\"}",
                riderId, lat, lng, speed, currentBattery
            );

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonInputString.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            Log.d(TAG, "Location sent to server. Response code: " + code);
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "Failed to send background location", e);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Hamar Bazar Rider GPS Channel",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background location tracking for delivery riders");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildForegroundNotification() {
        Intent stopIntent = new Intent(this, RiderLocationService.class);
        stopIntent.setAction("STOP");
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        return builder
            .setContentTitle("🛵 Hamar Bazar Rider Active")
            .setContentText("Screen Locked hai — 24/7 Live Location Track Ho Rahi Hai ✅")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_media_pause, "STOP DUTY", stopPendingIntent)
            .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Rider Service Destroyed");
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        if (batteryReceiver != null) {
            unregisterReceiver(batteryReceiver);
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        if (networkExecutor != null) {
            networkExecutor.shutdown();
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onProviderEnabled(String provider) {}
    @Override
    public void onProviderDisabled(String provider) {}
    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}
}
