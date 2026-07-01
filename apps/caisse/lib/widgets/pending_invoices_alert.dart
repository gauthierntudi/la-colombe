import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_icons.dart';
import 'nav_count_badge.dart';

/// Bandeau d'alerte pour factures en attente (caisse ou facturation).
class PendingInvoicesAlert extends StatelessWidget {
  const PendingInvoicesAlert({
    super.key,
    required this.count,
    required this.pendingCount,
    required this.onTap,
    this.toPrintCount = 0,
    this.variant = PendingInvoicesAlertVariant.cashier,
  });

  final int count;
  final int pendingCount;
  final int toPrintCount;
  final VoidCallback onTap;
  final PendingInvoicesAlertVariant variant;

  String get _title {
    if (pendingCount > 0 && toPrintCount == 0) {
      return pendingCount == 1
          ? '1 facture en attente'
          : '$pendingCount factures en attente';
    }
    if (toPrintCount > 0 && pendingCount == 0) {
      return toPrintCount == 1
          ? '1 bon à imprimer'
          : '$toPrintCount bons à imprimer';
    }
    return count == 1 ? '1 action requise' : '$count actions requises';
  }

  String get _eyebrow {
    if (variant == PendingInvoicesAlertVariant.invoicing) {
      return 'Suivi facturation';
    }
    if (pendingCount > 0 && toPrintCount == 0) return 'À encaisser';
    if (toPrintCount > 0 && pendingCount == 0) return 'Impression';
    return 'Action requise';
  }

  String get _actionLabel {
    if (variant == PendingInvoicesAlertVariant.invoicing) return 'Voir';
    return pendingCount > 0 ? 'Encaisser' : 'Voir';
  }

  String get _subtitle {
    if (variant == PendingInvoicesAlertVariant.invoicing) {
      return 'En attente de paiement à la caisse';
    }
    if (pendingCount > 0 && toPrintCount > 0) {
      return '$pendingCount à encaisser · $toPrintCount à imprimer';
    }
    if (pendingCount > 0) {
      return 'Encaisser avant expiration';
    }
    return 'Imprimer le bon de sortie';
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: AppColors.warning.withValues(alpha: 0.35),
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.warning.withValues(alpha: 0.1),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.warningSoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(
                      AppIcons.receipt,
                      color: AppColors.warning,
                      size: 22,
                    ),
                    Positioned(
                      right: -2,
                      top: -2,
                      child: NavCountBadge(
                        count: count,
                        color: AppColors.warning,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _eyebrow,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                        color: AppColors.warning,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _title,
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: AppColors.text,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.muted,
                        height: 1.2,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.warning,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _actionLabel,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 2),
                    const Icon(
                      AppIcons.chevronRight,
                      color: Colors.white,
                      size: 16,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum PendingInvoicesAlertVariant { cashier, invoicing }
