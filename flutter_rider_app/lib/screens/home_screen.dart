import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isTracking = false;
  int _riderId = 1;
  String _riderName = 'Ramesh Delivery Rider';
  String _serverUrl = ApiService.defaultBaseUrl;
  double? _currentLat;
  double? _currentLng;
  double _currentSpeed = 0.0;
  int _currentBattery = 100;
  DateTime? _lastSyncTime;
  bool _lastSyncSuccess = false;
  List<Map<String, dynamic>> _ridersList = [];

  StreamSubscription? _locationSubscription;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
    _checkTrackingStatus();
    _listenToBackgroundService();
    _fetchRiders();
  }

  @override
  void dispose() {
    _locationSubscription?.cancel();
    super.dispose();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _riderId = prefs.getInt('rider_id') ?? 1;
      _riderName = prefs.getString('rider_name') ?? 'Ramesh Delivery Rider';
      _serverUrl = prefs.getString('server_url') ?? ApiService.defaultBaseUrl;
    });
  }

  Future<void> _checkTrackingStatus() async {
    final isRunning = await LocationService.isTrackingRunning();
    setState(() => _isTracking = isRunning);
  }

  void _listenToBackgroundService() {
    _locationSubscription = FlutterBackgroundService().on('update_location').listen((event) {
      if (event != null && mounted) {
        setState(() {
          _currentLat = event['latitude'];
          _currentLng = event['longitude'];
          _currentSpeed = (event['speed'] as num).toDouble();
          _currentBattery = event['battery'] ?? 100;
          _lastSyncTime = DateTime.now();
          _lastSyncSuccess = event['sync_success'] ?? false;
        });
      }
    });
  }

  Future<void> _fetchRiders() async {
    final riders = await ApiService.fetchRiders();
    if (riders.isNotEmpty && mounted) {
      setState(() => _ridersList = riders);
    }
  }

  Future<void> _toggleTracking(bool value) async {
    if (value) {
      final success = await LocationService.startTracking();
      setState(() => _isTracking = success);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Background location tracking started!')),
        );
      }
    } else {
      LocationService.stopTracking();
      setState(() => _isTracking = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tracking stopped.')),
      );
    }
  }

  Future<void> _showServerUrlDialog() async {
    final controller = TextEditingController(text: _serverUrl);
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Render Server URL', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: controller,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'https://hamar-bazar-map.onrender.com',
            hintStyle: TextStyle(color: Colors.white38),
            enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.amber)),
            focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.amberAccent)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            onPressed: () async {
              final newUrl = controller.text.trim();
              if (newUrl.isNotEmpty) {
                await ApiService.setBaseUrl(newUrl);
                setState(() => _serverUrl = newUrl);
              }
              Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.amber.shade500),
            child: const Text('Save', style: TextStyle(color: Colors.black)),
          )
        ],
      ),
    );
  }

  Future<void> _showSelectRiderDialog() async {
    await _fetchRiders();
    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Select Delivery Rider Profile',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add_circle, color: Colors.amber),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _showAddRiderDialog();
                    },
                  )
                ],
              ),
              const SizedBox(height: 12),
              if (_ridersList.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text('No riders found on backend. Add one!', style: TextStyle(color: Colors.white54)),
                )
              else
                Flexible(
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: _ridersList.length,
                    itemBuilder: (context, index) {
                      final r = _ridersList[index];
                      final isSelected = r['id'] == _riderId;
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isSelected ? Colors.amber : Colors.blueGrey.shade700,
                          child: Icon(Icons.delivery_dining, color: isSelected ? Colors.black : Colors.white),
                        ),
                        title: Text(r['name'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                        subtitle: Text('Mobile: ${r['mobile']} | Vehicle: ${r['vehicle_number'] ?? 'N/A'}',
                            style: const TextStyle(color: Colors.white54, fontSize: 12)),
                        onTap: () async {
                          final prefs = await SharedPreferences.getInstance();
                          await prefs.setInt('rider_id', r['id']);
                          await prefs.setString('rider_name', r['name']);
                          setState(() {
                            _riderId = r['id'];
                            _riderName = r['name'];
                          });
                          Navigator.pop(ctx);
                        },
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showAddRiderDialog() async {
    final nameCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    final vehicleCtrl = TextEditingController();

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Add New Delivery Rider', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Rider Name', labelStyle: TextStyle(color: Colors.white70)),
            ),
            TextField(
              controller: mobileCtrl,
              keyboardType: TextInputType.phone,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Mobile Number', labelStyle: TextStyle(color: Colors.white70)),
            ),
            TextField(
              controller: vehicleCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Vehicle Number', labelStyle: TextStyle(color: Colors.white70)),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.trim().isNotEmpty && mobileCtrl.text.trim().isNotEmpty) {
                final result = await ApiService.registerRider(
                  name: nameCtrl.text.trim(),
                  mobile: mobileCtrl.text.trim(),
                  vehicleNumber: vehicleCtrl.text.trim(),
                );
                if (result != null && result['status'] == 'success') {
                  final newId = result['rider_id'];
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.setInt('rider_id', newId);
                  await prefs.setString('rider_name', nameCtrl.text.trim());
                  setState(() {
                    _riderId = newId;
                    _riderName = nameCtrl.text.trim();
                  });
                  _fetchRiders();
                }
              }
              Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.amber),
            child: const Text('Add Rider', style: TextStyle(color: Colors.black)),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Hamar Bazar Delivery', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Colors.amber),
            onPressed: _showServerUrlDialog,
            tooltip: 'Server Config',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Rider Profile Card
            GestureDetector(
              onTap: _showSelectRiderDialog,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.blueGrey.shade700),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: Colors.amber.shade400,
                      child: const Icon(Icons.delivery_dining, color: Colors.black, size: 30),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _riderName,
                            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Rider ID: #$_riderId • Tap to change',
                            style: const TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.swap_horiz_rounded, color: Colors.white54),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Live Tracking Toggle Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: _isTracking
                      ? [const Color(0xFF065F46), const Color(0xFF047857)]
                      : [const Color(0xFF334155), const Color(0xFF1E293B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: _isTracking
                    ? [BoxShadow(color: Colors.greenAccent.withOpacity(0.4), blurRadius: 16, spreadRadius: 2)]
                    : [],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _isTracking ? 'ONLINE - LIVE TRACKING' : 'OFFLINE',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.8,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _isTracking
                                ? 'GPS streaming to Render backend...'
                                : 'Background tracking is paused',
                            style: TextStyle(
                              color: _isTracking ? Colors.green.shade100 : Colors.grey.shade400,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                      Switch(
                        value: _isTracking,
                        activeThumbColor: Colors.amber,
                        activeTrackColor: Colors.green.shade900,
                        onChanged: _toggleTracking,
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Telemetry & Status Grid
            const Text(
              'Real-Time Telemetry',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(
                  child: _buildMetricTile(
                    icon: Icons.speed_rounded,
                    title: 'Speed',
                    value: '${_currentSpeed.toStringAsFixed(1)} km/h',
                    color: Colors.blueAccent,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMetricTile(
                    icon: Icons.battery_charging_full_rounded,
                    title: 'Battery',
                    value: '$_currentBattery%',
                    color: _currentBattery > 20 ? Colors.greenAccent : Colors.redAccent,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.blueGrey.shade800),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Icon(Icons.my_location_rounded, color: Colors.amber, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _currentLat != null && _currentLng != null
                              ? 'Lat: ${_currentLat!.toStringAsFixed(5)}, Lng: ${_currentLng!.toStringAsFixed(5)}'
                              : 'Location: Waiting for GPS fix...',
                          style: const TextStyle(color: Colors.white, fontSize: 14, fontFamily: 'monospace'),
                        ),
                      ),
                    ],
                  ),
                  Divider(color: Colors.blueGrey.shade700, height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            _lastSyncSuccess ? Icons.cloud_done_rounded : Icons.cloud_off_rounded,
                            color: _lastSyncSuccess ? Colors.greenAccent : Colors.redAccent,
                            size: 18,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _lastSyncSuccess ? 'Render Backend Synced' : 'Sync Pending',
                            style: TextStyle(
                              color: _lastSyncSuccess ? Colors.greenAccent : Colors.redAccent.shade100,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        _lastSyncTime != null
                            ? '${_lastSyncTime!.hour.toString().padLeft(2, '0')}:${_lastSyncTime!.minute.toString().padLeft(2, '0')}:${_lastSyncTime!.second.toString().padLeft(2, '0')}'
                            : 'Never',
                        style: const TextStyle(color: Colors.white38, fontSize: 12),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Connected Endpoint Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.grey.shade900,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.dns_rounded, color: Colors.grey.shade400, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Endpoint: $_serverUrl',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.grey.shade300, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricTile({
    required IconData icon,
    required String title,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.blueGrey.shade800),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Colors.white54, fontSize: 12)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }
}
