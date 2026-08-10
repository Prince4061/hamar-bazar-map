import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String defaultBaseUrl = 'https://hamar-bazar-map.onrender.com';

  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('server_url') ?? defaultBaseUrl;
  }

  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', url.replaceAll(RegExp(r'/$'), ''));
  }

  static Future<List<Map<String, dynamic>>> fetchRiders() async {
    try {
      final baseUrl = await getBaseUrl();
      final response = await http.get(Uri.parse('$baseUrl/api/riders'))
          .timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final List list = jsonDecode(response.body);
        return list.cast<Map<String, dynamic>>();
      }
    } catch (e) {
      print('Error fetching riders: $e');
    }
    return [];
  }

  static Future<Map<String, dynamic>?> registerRider({
    required String name,
    required String mobile,
    required String vehicleNumber,
  }) async {
    try {
      final baseUrl = await getBaseUrl();
      final response = await http.post(
        Uri.parse('$baseUrl/api/riders'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'name': name,
          'mobile': mobile,
          'vehicle_number': vehicleNumber,
        }),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('Error registering rider: $e');
    }
    return null;
  }

  static Future<bool> updateLocation({
    required int riderId,
    required double latitude,
    required double longitude,
    required double speed,
    required int battery,
    required String status,
    String? customBaseUrl,
  }) async {
    try {
      final baseUrl = customBaseUrl ?? await getBaseUrl();
      final url = '$baseUrl/api/rider/location';
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'rider_id': riderId,
          'latitude': latitude,
          'longitude': longitude,
          'speed': double.parse(speed.toStringAsFixed(1)),
          'battery': battery,
          'status': status,
        }),
      ).timeout(const Duration(seconds: 10));

      return response.statusCode == 200;
    } catch (e) {
      print('Error sending location to Render API: $e');
      return false;
    }
  }
}
