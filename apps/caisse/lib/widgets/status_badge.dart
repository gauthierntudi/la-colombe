import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.status,
    this.compact = false,
  });

  final String status;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final label = invoiceStatusLabels[status] ?? status;
    final color = AppColors.statusColor(status);
    final bg = AppColors.statusBackground(status);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 7 : 10,
        vertical: compact ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(compact ? 6 : 20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: compact ? 10 : 11,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.2,
          height: 1.1,
        ),
      ),
    );
  }
}
