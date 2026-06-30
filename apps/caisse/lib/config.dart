import 'dart:io';

String get defaultApiBaseUrl {
  if (Platform.isAndroid) {
    return 'http://10.0.2.2:3000/api/v1';
  }
  return 'http://localhost:3000/api/v1';
}

const apiBaseUrlOverride = String.fromEnvironment('API_BASE_URL');

String get apiBaseUrl =>
    apiBaseUrlOverride.isNotEmpty ? apiBaseUrlOverride : defaultApiBaseUrl;

/// URL admin pour bon de sortie (sans /api/v1).
String get adminWebBaseUrl {
  final base = apiBaseUrl.replaceFirst('/api/v1', '');
  return base;
}

/// URL absolue pour images renvoyées par l'API (/api/v1/assets/...).
String? resolveApiAssetUrl(String? url) {
  if (url == null || url.trim().isEmpty) return null;
  final value = url.trim();
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  final origin = apiBaseUrl.replaceFirst(RegExp(r'/api/v1/?$'), '');
  return value.startsWith('/') ? '$origin$value' : '$origin/$value';
}
