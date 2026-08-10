# 🚚 Hamar Bazar Rider App (Background Location & Render Sync)

Official Flutter mobile app for **Hamar Bazar Delivery Riders**. 
Continuously tracks high-accuracy GPS coordinates, vehicle speed, and battery health in the **background (even when the screen is locked/turned off)** and streams updates to the live Render website dispatch map (`https://hamar-bazar-map.onrender.com/api/rider/location`).

---

## ✨ Features

- 📍 **Screen-Off Background Tracking:** Uses `flutter_background_service` and Android Foreground Location Service to ensure unbroken location streaming.
- ⚡ **Real-Time Telemetry:** Sends latitude, longitude, speed (km/h), and battery percentage every 5 seconds.
- 🌐 **Render Backend Pre-configured:** Connected by default to `https://hamar-bazar-map.onrender.com`.
- 🔐 **Background Location Guided Flow:** Prompts riders for `"Allow all the time"` location permission with step-by-step UI setup.
- 👤 **Rider Profile Selector:** Switch between registered riders or register new delivery riders directly from the app.
- 🎨 **Modern Dark Theme:** Premium, low-battery UI designed for delivery drivers.

---

## 🛠️ Requirements & Setup

### Prerequisites
- [Flutter SDK](https://flutter.dev/docs/get-started/install) (v3.0.0 or higher)
- Android 7.0+ (API Level 24+) device or emulator
- Android Studio / VS Code / Antigravity with Flutter extension

### Build & Run Instructions

```bash
# 1. Navigate to the app directory
cd flutter_rider_app

# 2. Get Flutter dependencies
flutter pub get

# 3. Connect your Android phone via USB (with USB Debugging enabled) or start an emulator
flutter devices

# 4. Run the application
flutter run
```

### Building APK for Delivery Riders

```bash
flutter build apk --release
```
The compiled APK will be located at:
`flutter_rider_app/build/app/outputs/flutter-apk/app-release.apk`

---

## 🔒 Permission Guide for Riders

1. Launch app $\rightarrow$ Click **"1. Location Access"** $\rightarrow$ Select **"While using the app"**.
2. Click **"2. Background Location"** $\rightarrow$ Select **"Allow all the time"**.
3. Click **"3. Foreground Notification"** $\rightarrow$ Select **"Allow"**.
4. Turn on the **"ONLINE - LIVE TRACKING"** switch.
5. You can now lock your phone or turn off the screen; location updates will continue streaming to your website map in real time!
