import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_colors.dart';
import '../theme/app_icons.dart';

class AppHomeAppBar extends StatelessWidget implements PreferredSizeWidget {
  const AppHomeAppBar({
    super.key,
    required this.user,
    required this.pos,
    required this.session,
    required this.onChangePos,
    required this.onLogout,
  });

  final AppUser user;
  final PointOfSale? pos;
  final CashSession? session;
  final VoidCallback onChangePos;
  final VoidCallback onLogout;

  String _roleLabel() {
    if (user.canInvoice && user.canCashier) return 'Facturation & caisse';
    if (user.canInvoice) return 'Facturation';
    return 'Caisse';
  }

  @override
  Size get preferredSize => const Size.fromHeight(72);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      toolbarHeight: 72,
      titleSpacing: 16,
      title: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.asset(
              'assets/img/icon-app.png',
              width: 40,
              height: 40,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('La Colombe'),
                Text(
                  '${_roleLabel()}${pos != null ? ' · ${pos!.name}' : ''}',
                  style: Theme.of(context).textTheme.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        if (session != null && user.canCashier)
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.successSoft,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.success.withValues(alpha: 0.25)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(AppIcons.lockOpen, size: 14, color: AppColors.success),
                  const SizedBox(width: 4),
                  Text(
                    '${session!.invoiceCount}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.success,
                    ),
                  ),
                ],
              ),
            ),
          ),
        IconButton(
          tooltip: 'Changer de site',
          icon: const Icon(AppIcons.store),
          onPressed: onChangePos,
        ),
        IconButton(
          tooltip: 'Déconnexion',
          icon: const Icon(AppIcons.logOut),
          onPressed: onLogout,
        ),
        const SizedBox(width: 4),
      ],
    );
  }
}
