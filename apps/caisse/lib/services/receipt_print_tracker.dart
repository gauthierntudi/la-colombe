import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Factures payées dont le bon de sortie a été imprimé (persistance locale).
class ReceiptPrintTracker extends ChangeNotifier {
  ReceiptPrintTracker();

  static const _storageKey = 'ges-printed-invoice-ids';

  final Set<String> _printedIds = {};
  bool _ready = false;

  bool get isReady => _ready;

  bool isPrinted(String invoiceId) => _printedIds.contains(invoiceId);

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _printedIds
      ..clear()
      ..addAll(prefs.getStringList(_storageKey) ?? const []);
    _ready = true;
    notifyListeners();
  }

  Future<void> markPrinted(String invoiceId) async {
    if (_printedIds.contains(invoiceId)) return;
    _printedIds.add(invoiceId);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_storageKey, _printedIds.toList());
  }
}
