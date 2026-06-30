import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/pos_select_screen.dart';
import 'services/api_client.dart';
import 'theme/app_theme.dart';
import 'widgets/app_loading.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const GesBoutiqueApp());
}

class GesBoutiqueApp extends StatefulWidget {
  const GesBoutiqueApp({super.key});

  @override
  State<GesBoutiqueApp> createState() => _GesBoutiqueAppState();
}

class _GesBoutiqueAppState extends State<GesBoutiqueApp> {
  late final ApiClient _api;

  @override
  void initState() {
    super.initState();
    _api = ApiClient()..init();
  }

  @override
  void dispose() {
    _api.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _api,
      child: MaterialApp(
        title: 'La Colombe',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: ListenableBuilder(
          listenable: _api,
          builder: (context, _) {
            if (!_api.isReady) {
              return const Scaffold(
                body: AppLoading(message: 'Chargement...'),
              );
            }
            if (!_api.isAuthenticated) {
              return const LoginScreen();
            }
            if (_api.activePos == null) {
              return const PosSelectScreen();
            }
            return const HomeScreen();
          },
        ),
      ),
    );
  }
}
