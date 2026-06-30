import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'nav_count_badge.dart';

/// Hauteur approximative de la barre (pour padding contenu).
double cashierBottomNavHeight(BuildContext context) {
  final bottom = MediaQuery.paddingOf(context).bottom;
  return 12 + bottom + 64;
}

class CashierNavItem {
  const CashierNavItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    this.badge,
    this.isCenter = false,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final int? badge;
  final bool isCenter;
}

/// Barre de navigation flottante — pilule blanche, caisse au centre.
class CashierBottomNavBar extends StatelessWidget {
  const CashierBottomNavBar({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<CashierNavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final width = MediaQuery.sizeOf(context).width;
    final compact = width < 380;
    final iconPad = compact ? 10.0 : 15.0;
    final outerV = compact ? 8.0 : 10.0;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, bottom + 12),
      child: Container(
        decoration: ShapeDecoration(
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(74),
          ),
          shadows: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: List.generate(items.length, (index) {
            return Expanded(
              child: _NavButton(
                item: items[index],
                selected: index == selectedIndex,
                iconPadding: iconPad,
                outerVertical: outerV,
                onTap: () => onSelected(index),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.selected,
    required this.iconPadding,
    required this.outerVertical,
    required this.onTap,
  });

  final CashierNavItem item;
  final bool selected;
  final double iconPadding;
  final double outerVertical;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final iconColor = item.isCenter
        ? Colors.white
        : selected
            ? AppColors.primary
            : const Color(0xFF9DB2CE);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(71),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: outerVertical),
          child: Center(
            child: Container(
              padding: EdgeInsets.all(iconPadding),
              decoration: item.isCenter
                  ? BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(54),
                    )
                  : null,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(
                    selected ? item.selectedIcon : item.icon,
                    size: 24,
                    color: iconColor,
                  ),
                  if (item.badge != null && item.badge! > 0)
                    Positioned(
                      right: item.isCenter ? -6 : -8,
                      top: item.isCenter ? -14 : -8,
                      child: NavCountBadge(
                        count: item.badge!,
                        color: item.isCenter
                            ? AppColors.danger
                            : const Color(0xFF03B6EA),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
