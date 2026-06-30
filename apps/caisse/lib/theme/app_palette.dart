import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Tokens couleur alignés sur le dashboard admin (globals.css light / .dark).
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.background,
    required this.backgroundSubtle,
    required this.surface,
    required this.surfaceMuted,
    required this.text,
    required this.textSecondary,
    required this.muted,
    required this.border,
    required this.borderLight,
    required this.primarySoft,
    required this.successSoft,
    required this.warningSoft,
    required this.dangerSoft,
    required this.infoSoft,
    required this.navBar,
    required this.tileBackground,
    required this.statusBarStyle,
    required this.statusBarOnSurfaceStyle,
  });

  final Color background;
  final Color backgroundSubtle;
  final Color surface;
  final Color surfaceMuted;
  final Color text;
  final Color textSecondary;
  final Color muted;
  final Color border;
  final Color borderLight;
  final Color primarySoft;
  final Color successSoft;
  final Color warningSoft;
  final Color dangerSoft;
  final Color infoSoft;
  final Color navBar;
  final Color tileBackground;
  final SystemUiOverlayStyle statusBarStyle;
  final SystemUiOverlayStyle statusBarOnSurfaceStyle;

  /// Fond des champs de formulaire — dérivé de [tileBackground].
  Color get inputFill => tileBackground;

  static final light = AppPalette(
    background: Color(0xFFF0F4FA),
    backgroundSubtle: Color(0xFFE8EDF5),
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFF8FAFC),
    text: Color(0xFF111827),
    textSecondary: Color(0xFF4B5563),
    muted: Color(0xFF9CA3AF),
    border: Color(0xFFE4E9F2),
    borderLight: Color(0xFFF0F3F8),
    primarySoft: Color(0xFFE8ECFE),
    successSoft: Color(0xFFD1FAE5),
    warningSoft: Color(0xFFFEF3C7),
    dangerSoft: Color(0xFFFEE2E2),
    infoSoft: Color(0xFFE0F2FE),
    navBar: Color(0xFFFFFFFF),
    tileBackground: Color(0xFFF3F4F6),
    statusBarStyle: SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
    ),
    statusBarOnSurfaceStyle: SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

  static final dark = AppPalette(
    background: Color(0xFF0E1317),
    backgroundSubtle: Color(0xFF141B22),
    surface: Color(0xFF161D26),
    surfaceMuted: Color(0xFF1C2530),
    text: Color(0xFFEEF2F7),
    textSecondary: Color(0xFF94A3B8),
    muted: Color(0xFF64748B),
    border: Color(0xFF2A3544),
    borderLight: Color(0xFF212933),
    primarySoft: Color(0x381030F5),
    successSoft: Color(0x2910B981),
    warningSoft: Color(0x29F59E0B),
    dangerSoft: Color(0x29EF4444),
    infoSoft: Color(0x290284C7),
    navBar: Color(0xFF161D26),
    tileBackground: Color(0xFF1C2530),
    statusBarStyle: SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: Color(0xFF0E1317),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
    statusBarOnSurfaceStyle: SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: Color(0xFF161D26),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  @override
  AppPalette copyWith({
    Color? background,
    Color? backgroundSubtle,
    Color? surface,
    Color? surfaceMuted,
    Color? text,
    Color? textSecondary,
    Color? muted,
    Color? border,
    Color? borderLight,
    Color? primarySoft,
    Color? successSoft,
    Color? warningSoft,
    Color? dangerSoft,
    Color? infoSoft,
    Color? navBar,
    Color? tileBackground,
    SystemUiOverlayStyle? statusBarStyle,
    SystemUiOverlayStyle? statusBarOnSurfaceStyle,
  }) {
    return AppPalette(
      background: background ?? this.background,
      backgroundSubtle: backgroundSubtle ?? this.backgroundSubtle,
      surface: surface ?? this.surface,
      surfaceMuted: surfaceMuted ?? this.surfaceMuted,
      text: text ?? this.text,
      textSecondary: textSecondary ?? this.textSecondary,
      muted: muted ?? this.muted,
      border: border ?? this.border,
      borderLight: borderLight ?? this.borderLight,
      primarySoft: primarySoft ?? this.primarySoft,
      successSoft: successSoft ?? this.successSoft,
      warningSoft: warningSoft ?? this.warningSoft,
      dangerSoft: dangerSoft ?? this.dangerSoft,
      infoSoft: infoSoft ?? this.infoSoft,
      navBar: navBar ?? this.navBar,
      tileBackground: tileBackground ?? this.tileBackground,
      statusBarStyle: statusBarStyle ?? this.statusBarStyle,
      statusBarOnSurfaceStyle:
          statusBarOnSurfaceStyle ?? this.statusBarOnSurfaceStyle,
    );
  }

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return t < 0.5 ? this : other;
  }
}

extension AppPaletteContext on BuildContext {
  AppPalette get palette =>
      Theme.of(this).extension<AppPalette>() ?? AppPalette.light;
}
