import 'dart:io';

import 'package:flutter/services.dart';

import '../models/models.dart';

/// Pont Flutter ↔ SDK Yoco Android (impression bon de sortie).
class YocoPrintChannel {
  static const _channel = MethodChannel('com.ges.boutique/yoco_print');

  static bool _configured = false;

  static Future<void> configure(YocoSdkConfig config) async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod<void>('configure', {
        'secret': config.integrationSecret,
        'sandbox': config.sandbox,
      });
      _configured = true;
    } on PlatformException catch (e) {
      _configured = false;
      throw Exception(e.message ?? 'Configuration Yoco impossible');
    }
  }

  static Future<bool> printReceipt({
    required String text,
    String? html,
    String jobName = 'Bon de sortie GES',
  }) async {
    if (!Platform.isAndroid) return false;
    try {
      await _channel.invokeMethod<void>('printReceipt', {
        'text': text,
        if (html != null) 'html': html,
        'jobName': jobName,
      });
      return true;
    } on PlatformException {
      return false;
    }
  }
}
