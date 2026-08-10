import 'dart:async';
import 'dart:ui';
import 'package:battery_plus/battery_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

const String notificationChannelId = 'rider_location_channel';
const int notificationId = 888;

class LocationService {
  static final FlutterBackgroundService _service = FlutterBackgroundService();

  static Future<void> initializeService() async {
    final flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      notificationChannelId,
      'Hamar Bazar Rider Tracking Service',
      description: 'Continuous background location updates for live dispatch map.',
      importance: Importance.high,
    );

    await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    await _service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: notificationChannelId,
        initialNotificationTitle: 'Hamar Bazar Rider Tracking',
        initialNotificationContent: 'Initializing background GPS location tracker...',
        foregroundServiceNotificationId: notificationId,
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );
  }

  static Future<bool> startTracking() async {
    return await _service.startService();
  }

  static void stopTracking() {
    _service.invoke('stopService');
  }

  static Future<bool> isTrackingRunning() async {
    return await _service.isRunning();
  }
}

@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  return true;
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();
  WidgetsFlutterBinding.ensureInitialized();

  final flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();
  final battery = Battery();

  if (service is AndroidServiceInstance) {
    service.on('setAsForeground').listen((event) {
      service.setAsForegroundService();
    });

    service.on('setAsBackground').listen((event) {
      service.setAsBackgroundService();
    });
  }

  service.on('stopService').listen((event) {
    service.stopSelf();
  });

  // Background Location Loop (Executes every 5 seconds even when screen is off)
  Timer.periodic(const Duration(seconds: 5), (timer) async {
    if (service is AndroidServiceInstance) {
      if (!(await service.isForegroundService())) {
        return;
      }
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final riderId = prefs.getInt('rider_id') ?? 1;
      final baseUrl = prefs.getString('server_url') ?? ApiService.defaultBaseUrl;
      final status = prefs.getString('rider_status') ?? 'online';

      // Ensure permission is granted
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        print('Location permission missing in background worker');
        return;
      }

      // Fetch Current High Accuracy Position
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 4),
      );

      // Convert speed from m/s to km/h
      final double speedKmH = (position.speed < 0 ? 0 : position.speed) * 3.6;

      // Battery level
      int batteryLevel = 100;
      try {
        batteryLevel = await battery.batteryLevel;
      } catch (_) {}

      // Push to Render API
      final success = await ApiService.updateLocation(
        riderId: riderId,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: speedKmH,
        battery: batteryLevel,
        status: status,
        customBaseUrl: baseUrl,
      );

      // Update Foreground Notification
      if (service is AndroidServiceInstance) {
        flutterLocalNotificationsPlugin.show(
          notificationId,
          'Hamar Bazar Delivery Tracker (Active)',
          'Lat: ${position.latitude.toStringAsFixed(4)}, Lng: ${position.longitude.toStringAsFixed(4)} | Speed: ${speedKmH.toStringAsFixed(1)} km/h | Bat: $batteryLevel%',
          const NotificationDetails(
            android: AndroidNotificationDetails(
              notificationChannelId,
              'Hamar Bazar Rider Tracking Service',
              icon: 'ic_bg_service_small',
              ongoing: true,
            ),
          ),
        );
      }

      // Broadcast payload to open Flutter UI screens
      service.invoke(
        'update_location',
        {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'speed': speedKmH,
          'battery': batteryLevel,
          'timestamp': DateTime.now().toIso8601String(),
          'sync_success': success,
        },
      );
    } catch (e) {
      print('Background location tick error: $e');
    }
  });
}
