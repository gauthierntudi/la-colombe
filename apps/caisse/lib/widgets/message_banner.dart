import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_icons.dart';

enum MessageBannerType { success, error, warning, info }

class MessageBanner extends StatelessWidget {
  const MessageBanner({
    super.key,
    required this.message,
    required this.type,
    this.onDismiss,
  });

  final String message;
  final MessageBannerType type;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, IconData icon) = switch (type) {
      MessageBannerType.success => (AppColors.successSoft, AppColors.success, AppIcons.circleCheck),
      MessageBannerType.error => (AppColors.dangerSoft, AppColors.danger, AppIcons.error),
      MessageBannerType.warning => (AppColors.warningSoft, AppColors.warning, AppIcons.warning),
      MessageBannerType.info => (AppColors.infoSoft, AppColors.info, AppIcons.info),
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: fg.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: fg,
                height: 1.35,
              ),
            ),
          ),
          if (onDismiss != null)
            InkWell(
              onTap: onDismiss,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Icon(AppIcons.close, size: 18, color: fg),
              ),
            ),
        ],
      ),
    );
  }
}
