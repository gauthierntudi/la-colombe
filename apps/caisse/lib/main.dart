import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/pos_select_screen.dart';
import 'services/api_client.dart';
import 'services/receipt_print_tracker.dart';
import 'services/theme_service.dart';
import 'theme/app_colors.dart';
import 'theme/app_palette.dart';
import 'theme/app_theme.dart';
import 'widgets/app_loading.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);
  final themeService = ThemeService();
  await themeService.init();
  runApp(GesBoutiqueApp(themeService: themeService));
}

class GesBoutiqueApp extends StatefulWidget {
  const GesBoutiqueApp({super.key, required this.themeService});

  final ThemeService themeService;

  @override
  State<GesBoutiqueApp> createState() => _GesBoutiqueAppState();
}

class _GesBoutiqueAppState extends State<GesBoutiqueApp> {
  late final ApiClient _api;
  late final ReceiptPrintTracker _printTracker;

  @override
  void initState() {
    super.initState();
    _api = ApiClient()..init();
    _printTracker = ReceiptPrintTracker()..init();
  }

  @override
  void dispose() {
    _api.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: widget.themeService),
        ChangeNotifierProvider.value(value: _printTracker),
        ChangeNotifierProvider.value(value: _api),
      ],
      child: Consumer<ThemeService>(
        builder: (context, themeService, _) {
          return MaterialApp(
            title: 'La Colombe',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: themeService.mode,
            builder: (context, child) {
              AppColors.bind(
                Theme.of(context).extension<AppPalette>() ?? AppPalette.light,
              );
              return child ?? const SizedBox.shrink();
            },
            home: ListenableBuilder(
              listenable: Listenable.merge([_api, widget.themeService]),
              builder: (context, _) {
                if (!_api.isReady) {
                  return const Scaffold(
                    body: AppLoading(message: 'Chargement...'),
                  );
                }
                if (!_api.isAuthenticated) {
                  return LoginScreen();
                }
                if (_api.activePos == null) {
                  return PosSelectScreen();
                }
                return HomeScreen();
              },
            ),
          );
        },
      ),
    );
  }
}
