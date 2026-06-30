import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ges_caisse/main.dart';

void main() {
  testWidgets('App démarre', (WidgetTester tester) async {
    await tester.pumpWidget(const GesBoutiqueApp());
    await tester.pump();
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
