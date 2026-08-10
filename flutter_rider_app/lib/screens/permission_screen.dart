import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

class PermissionScreen extends StatefulWidget {
  final VoidCallback onPermissionsGranted;

  const PermissionScreen({Key? key, required this.onPermissionsGranted}) : super(key: key);

  @override
  State<PermissionScreen> createState() => _PermissionScreenState();
}

class _PermissionScreenState extends State<PermissionScreen> {
  bool _isLocationGranted = false;
  bool _isBackgroundLocationGranted = false;
  bool _isNotificationGranted = false;

  @override
  void initState() {
    super.initState();
    _checkCurrentPermissions();
  }

  Future<void> _checkCurrentPermissions() async {
    final locStatus = await Permission.locationWhenInUse.status;
    final bgStatus = await Permission.locationAlways.status;
    final notifStatus = await Permission.notification.status;

    setState(() {
      _isLocationGranted = locStatus.isGranted;
      _isBackgroundLocationGranted = bgStatus.isGranted;
      _isNotificationGranted = notifStatus.isGranted;
    });

    if (_isLocationGranted && _isBackgroundLocationGranted) {
      widget.onPermissionsGranted();
    }
  }

  Future<void> _requestLocationPermission() async {
    final status = await Permission.locationWhenInUse.request();
    if (status.isGranted) {
      setState(() => _isLocationGranted = true);
      _requestBackgroundLocationPermission();
    }
  }

  Future<void> _requestBackgroundLocationPermission() async {
    final status = await Permission.locationAlways.request();
    if (status.isGranted) {
      setState(() => _isBackgroundLocationGranted = true);
    }
    _requestNotificationPermission();
  }

  Future<void> _requestNotificationPermission() async {
    final status = await Permission.notification.request();
    if (status.isGranted) {
      setState(() => _isNotificationGranted = true);
    }
    await Permission.ignoreBatteryOptimizations.request();
    _checkCurrentPermissions();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 30),
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.amber.shade400.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.location_on_rounded, size: 48, color: Colors.amber.shade400),
              ),
              const SizedBox(height: 24),
              const Text(
                'Location Permission Required',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'To display your live delivery progress on the Hamar Bazar customer map, we need background location access even when your phone screen is off.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade300, fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 36),

              _buildPermissionTile(
                title: '1. Location Access',
                subtitle: 'Allow GPS tracking while using the app',
                isGranted: _isLocationGranted,
                onTap: _requestLocationPermission,
              ),

              const SizedBox(height: 16),

              _buildPermissionTile(
                title: '2. Background Location ("Allow all the time")',
                subtitle: 'Enables GPS location sending when screen is OFF',
                isGranted: _isBackgroundLocationGranted,
                onTap: _requestBackgroundLocationPermission,
              ),

              const SizedBox(height: 16),

              _buildPermissionTile(
                title: '3. Foreground Notification',
                subtitle: 'Shows persistent status bar icon for active tracking',
                isGranted: _isNotificationGranted,
                onTap: _requestNotificationPermission,
              ),

              const Spacer(),

              ElevatedButton(
                onPressed: () async {
                  await _requestLocationPermission();
                  if (_isLocationGranted && _isBackgroundLocationGranted) {
                    widget.onPermissionsGranted();
                  } else {
                    openAppSettings();
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.amber.shade500,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(
                  (_isLocationGranted && _isBackgroundLocationGranted)
                      ? 'Continue to Rider App'
                      : 'Grant Permissions in Settings',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPermissionTile({
    required String title,
    required String subtitle,
    required bool isGranted,
    required VoidCallback onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isGranted ? Colors.greenAccent : Colors.grey.shade700,
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onTap,
            icon: Icon(
              isGranted ? Icons.check_circle_rounded : Icons.arrow_circle_right_rounded,
              color: isGranted ? Colors.greenAccent : Colors.amber.shade400,
              size: 28,
            ),
          )
        ],
      ),
    );
  }
}
