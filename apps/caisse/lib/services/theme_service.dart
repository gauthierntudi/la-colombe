import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persistance du thème — clé alignée sur le dashboard admin (`ges-theme`).
class ThemeService extends ChangeNotifier {
  ThemeService();

  static const storageKey = 'ges-theme';

  ThemeMode _mode = ThemeMode.light;
  bool _ready = false;

  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;
  bool get isReady => _ready;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(storageKey);
    _mode = stored == 'dark' ? ThemeMode.dark : ThemeMode.light;
    _ready = true;
    notifyListeners();
  }

  Future<void> setDark(bool dark) async {
    await setMode(dark ? ThemeMode.dark : ThemeMode.light);
  }

  Future<void> setMode(ThemeMode mode) async {
    if (_mode == mode) return;
    _mode = mode;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      storageKey,
      mode == ThemeMode.dark ? 'dark' : 'light',
    );
  }

  Future<void> toggle() => setDark(!isDark);
}
