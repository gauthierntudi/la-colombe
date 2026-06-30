import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ges_caisse/main.dart';
import 'package:ges_caisse/services/theme_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('App démarre', (WidgetTester tester) async {
    final themeService = ThemeService();
    await themeService.init();

    await tester.pumpWidget(GesBoutiqueApp(themeService: themeService));
    await tester.pump();
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
