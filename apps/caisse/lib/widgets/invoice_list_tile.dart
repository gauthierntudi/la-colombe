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
    final customer = invoice.customerName?.trim();
    final showCustomer = customer != null && customer.isNotEmpty;

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: isPending
                      ? AppColors.warningSoft
                      : AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  AppIcons.receipt,
                  color: isPending ? AppColors.warning : AppColors.primary,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
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
                              fontSize: 14,
                              color: AppColors.text,
                              height: 1.1,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${formatCdf(invoice.totalTtc)} FC',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: AppColors.amount,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                    if (showCustomer) ...[
                      const SizedBox(height: 2),
                      Text(
                        customer,
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                          height: 1.1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _metaLine(dateFmt),
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.muted,
                              height: 1.1,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (needsReceiptPrint)
                          Container(
                            margin: const EdgeInsets.only(left: 6),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.infoSoft,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'À imprimer',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: AppColors.info,
                              ),
                            ),
                          )
                        else if (showStatus)
                          Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: StatusBadge(
                              status: invoice.status,
                              compact: true,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              if (onTap != null) ...[
                const SizedBox(width: 4),
                Icon(
                  AppIcons.chevronRight,
                  color: AppColors.muted,
                  size: 16,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _metaLine(DateFormat dateFmt) {
    final at = invoice.status == 'PAID'
        ? invoice.paidOrCreatedAt
        : invoice.createdAt;
    final date = dateFmt.format(at.toLocal());
    final phone = invoice.customerPhone?.trim();
    if (phone != null && phone.isNotEmpty) {
      return '$date · $phone';
    }
    return date;
  }
}
