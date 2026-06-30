import 'package:flutter/material.dart';

/// Palette alignée sur le dashboard admin La Colombe.
abstract final class AppColors {
  static const primary = Color(0xFF0D30F5);
  static const primaryDark = Color(0xFF0A26C4);
  static const primarySoft = Color(0xFFE8ECFE);

  static const background = Color(0xFFF4F6FB);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF8FAFC);

  static const text = Color(0xFF0F172A);
  static const textSecondary = Color(0xFF475569);
  static const muted = Color(0xFF94A3B8);
  static const border = Color(0xFFE2E8F0);
  static const borderLight = Color(0xFFF1F5F9);

  static const success = Color(0xFF059669);
  static const successSoft = Color(0xFFD1FAE5);
  static const warning = Color(0xFFD97706);
  static const warningSoft = Color(0xFFFEF3C7);
  static const danger = Color(0xFFDC2626);
  static const dangerSoft = Color(0xFFFEE2E2);
  static const info = Color(0xFF0284C7);
  static const infoSoft = Color(0xFFE0F2FE);

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
