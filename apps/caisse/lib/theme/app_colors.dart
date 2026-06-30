import 'package:flutter/material.dart';

import 'app_palette.dart';

/// Palette sémantique — valeurs mises à jour via [bind] à chaque rebuild thème.
abstract final class AppColors {
  static Color background = AppPalette.light.background;
  static Color backgroundSubtle = AppPalette.light.backgroundSubtle;
  static Color surface = AppPalette.light.surface;
  static Color surfaceMuted = AppPalette.light.surfaceMuted;
  static Color text = AppPalette.light.text;
  static Color textSecondary = AppPalette.light.textSecondary;
  static Color muted = AppPalette.light.muted;
  static Color border = AppPalette.light.border;
  static Color borderLight = AppPalette.light.borderLight;
  static Color primarySoft = AppPalette.light.primarySoft;
  static Color successSoft = AppPalette.light.successSoft;
  static Color warningSoft = AppPalette.light.warningSoft;
  static Color dangerSoft = AppPalette.light.dangerSoft;
  static Color infoSoft = AppPalette.light.infoSoft;
  static Color navBar = AppPalette.light.navBar;
  static Color tileBackground = AppPalette.light.tileBackground;
  static Color amount = AppPalette.light.amount;
  static Color get inputFill => tileBackground;

  static void bind(AppPalette palette) {
    background = palette.background;
    backgroundSubtle = palette.backgroundSubtle;
    surface = palette.surface;
    surfaceMuted = palette.surfaceMuted;
    text = palette.text;
    textSecondary = palette.textSecondary;
    muted = palette.muted;
    border = palette.border;
    borderLight = palette.borderLight;
    primarySoft = palette.primarySoft;
    successSoft = palette.successSoft;
    warningSoft = palette.warningSoft;
    dangerSoft = palette.dangerSoft;
    infoSoft = palette.infoSoft;
    navBar = palette.navBar;
    tileBackground = palette.tileBackground;
    amount = palette.amount;
  }

  static const primary = Color(0xFF0D30F5);
  static const primaryDark = Color(0xFF0A26C4);

  static const success = Color(0xFF059669);
  static const warning = Color(0xFFD97706);
  static const danger = Color(0xFFDC2626);
  static const info = Color(0xFF0284C7);

  static Color statusColor(String status) {
    switch (status) {
      case 'PAID':
        return success;
      case 'PENDING_PAYMENT':
        return warning;
      case 'CANCELLED':
      case 'EXPIRED':
        return danger;
      case 'DRAFT':
        return muted;
      default:
        return info;
    }
  }

  static Color statusBackground(String status) {
    switch (status) {
      case 'PAID':
        return successSoft;
      case 'PENDING_PAYMENT':
        return warningSoft;
      case 'CANCELLED':
      case 'EXPIRED':
        return dangerSoft;
      case 'DRAFT':
        return borderLight;
      default:
        return infoSoft;
    }
  }
}
