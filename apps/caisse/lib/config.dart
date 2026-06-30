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
