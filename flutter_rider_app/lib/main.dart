import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'screens/home_screen.dart';
import 'screens/permission_screen.dart';
import 'services/location_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LocationService.initializeService();
  runApp(const HamarBazarRiderApp());
}

class HamarBazarRiderApp extends StatefulWidget {
  const HamarBazarRiderApp({Key? key}) : super(key: key);

  @override
  State<HamarBazarRiderApp> createState() => _HamarBazarRiderAppState();
}

class _HamarBazarRiderAppState extends State<HamarBazarRiderApp> {
  bool _hasPermissions = false;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _checkInitialPermissions();
  }

  Future<void> _checkInitialPermissions() async {
    final locStatus = await Permission.locationWhenInUse.status;
    final bgStatus = await Permission.locationAlways.status;

    setState(() {
      _hasPermissions = locStatus.isGranted && bgStatus.isGranted;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hamar Bazar Rider',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        colorScheme: ColorScheme.dark(
          primary: Colors.amber.shade400,
          secondary: Colors.greenAccent,
          surface: const Color(0xFF1E293B),
        ),
      ),
      home: _isLoading
          ? const Scaffold(
              backgroundColor: Color(0xFF0F172A),
              body: Center(
                child: CircularProgressIndicator(color: Colors.amber),
              ),
            )
          : _hasPermissions
              ? const HomeScreen()
              : PermissionScreen(
                  onPermissionsGranted: () {
                    setState(() {
                      _hasPermissions = true;
                    });
                  },
                ),
    );
  }
}
