import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/models.dart';
import '../theme/app_colors.dart';
import 'status_badge.dart';
import '../theme/app_icons.dart';

class InvoiceListTile extends StatelessWidget {
  const InvoiceListTile({
    super.key,
    required this.invoice,
    this.onTap,
    this.showStatus = true,
    this.needsReceiptPrint = false,
  });

  final InvoiceSummary invoice;
  final VoidCallback? onTap;
  final bool showStatus;
  final bool needsReceiptPrint;

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('dd/MM · HH:mm');
    final isPending = invoice.status == 'PENDING_PAYMENT';
    final borderColor = needsReceiptPrint
        ? AppColors.info.withValues(alpha: 0.35)
        : isPending
            ? AppColors.warning.withValues(alpha: 0.25)
            : AppColors.border;

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isPending
                      ? AppColors.warningSoft
                      : AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  AppIcons.receipt,
                  color: isPending ? AppColors.warning : AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            invoice.number,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: AppColors.text,
                              height: 1.1,
                            ),
                          ),
                        ),
                        if (showStatus) StatusBadge(status: invoice.status),
                        if (needsReceiptPrint) ...[
                          if (showStatus) const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.infoSoft,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'À imprimer',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.info,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 1),
                    Text(
                      invoice.customerName ?? 'Client anonyme',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.1,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Text(
                          dateFmt.format(invoice.createdAt.toLocal()),
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.muted,
                          ),
                        ),
                        if (invoice.customerPhone != null) ...[
                          Text(
                            ' · ',
                            style: TextStyle(color: AppColors.muted),
                          ),
                          Flexible(
                            child: Text(
                              invoice.customerPhone!,
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.muted,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${formatCdf(invoice.totalTtc)} FC',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: AppColors.amount,
                    ),
                  ),
                  if (onTap != null) ...[
                    const SizedBox(height: 6),
                    Icon(
                      AppIcons.chevronRight,
                      color: AppColors.muted,
                      size: 20,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
