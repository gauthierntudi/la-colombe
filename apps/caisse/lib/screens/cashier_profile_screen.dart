import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/theme_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_icons.dart';
import '../widgets/cashier_bottom_nav_bar.dart';
import '../widgets/user_avatar.dart';
import '../widgets/theme_toggle.dart';
import 'pos_select_screen.dart';

/// Profil caissier — compte, site et déconnexion.
class CashierProfileScreen extends StatelessWidget {
  const CashierProfileScreen({super.key});

  String _roleLabel(String role) {
    switch (role) {
      case 'CAISSIER':
        return 'Caissier';
      case 'FACTURANT':
        return 'Facturant';
      case 'ADMIN':
        return 'Administrateur';
      case 'MANAGER':
        return 'Manager';
      default:
        return role;
    }
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      useSafeArea: false,
      builder: (ctx) => const _LogoutConfirmSheet(),
    );
    if (confirmed == true && context.mounted) {
      await context.read<ApiClient>().logout();
      if (!context.mounted) return;
      final navigator = Navigator.of(context);
      if (navigator.canPop()) {
        navigator.popUntil((route) => route.isFirst);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<ThemeService>();
    final api = context.watch<ApiClient>();
    final user = api.user;
    final pos = api.activePos;
    final navInset = cashierBottomNavHeight(context);

    if (user == null) {
      return ColoredBox(color: AppColors.background);
    }

    final roleLabel = _roleLabel(user.role);

    return ColoredBox(
      color: AppColors.background,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: _ProfileHeroHeader(user: user, roleLabel: roleLabel),
          ),
          SliverToBoxAdapter(
            child: ColoredBox(
              color: AppColors.surface,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: Column(
                  children: [
                    _ProfileInfoTile(
                      icon: AppIcons.user,
                      value: user.name,
                      label: 'Nom d\'utilisateur',
                    ),
                    const SizedBox(height: 12),
                    _ProfileInfoTile(
                      icon: AppIcons.mail,
                      value: user.email,
                      label: 'Adresse e-mail',
                    ),
                    const SizedBox(height: 12),
                    _ProfileInfoTile(
                      icon: AppIcons.settings,
                      value: roleLabel,
                      label: 'Rôle utilisateur',
                    ),
                    const SizedBox(height: 12),
                    const ThemeToggleTile(),
                    if (pos != null) ...[
                      const SizedBox(height: 12),
                      _ProfileInfoTile(
                        icon: AppIcons.store,
                        value: pos.name,
                        label: 'Point de vente',
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) =>
                                  const PosSelectScreen(fromSettings: true),
                            ),
                          );
                        },
                      ),
                    ],
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: () => _confirmLogout(context),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF111827),
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: const Text(
                        'Se déconnecter',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    SizedBox(height: 16 + navInset),
                  ],
                ),
              ),
            ),
          ),
          SliverFillRemaining(
            hasScrollBody: false,
            child: ColoredBox(color: AppColors.surface),
          ),
        ],
      ),
    );
  }
}

class _ProfileHeroHeader extends StatelessWidget {
  const _ProfileHeroHeader({
    required this.user,
    required this.roleLabel,
  });

  final AppUser user;
  final String roleLabel;

  static const _blueBodyHeight = 96.0;
  static const _avatarOverlap = 44.0;
  static const _avatarRadius = 42.0;
  static const _whiteSheetLift = 24.0;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    final nameStyle = Theme.of(context).textTheme.titleLarge?.copyWith(
          decoration: TextDecoration.none,
          decorationColor: Colors.transparent,
        );
    final roleStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          decoration: TextDecoration.none,
          decorationColor: Colors.transparent,
        );

    return SizedBox(
      height: topInset + _blueBodyHeight + _avatarOverlap + 28,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: topInset + _blueBodyHeight + _avatarOverlap,
            child: ColoredBox(color: AppColors.primary),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: topInset + _blueBodyHeight - _whiteSheetLift,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(28),
                  topRight: Radius.circular(28),
                ),
              ),
            ),
          ),
          Positioned(
            left: 24,
            right: 24,
            top: topInset + _blueBodyHeight - _avatarOverlap,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                UserAvatarLight(
                  name: user.name,
                  imageUrl: user.avatarUrl,
                  radius: _avatarRadius,
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 18),
                        child: Text(
                          user.name,
                          style: nameStyle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        roleLabel,
                        style: roleStyle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileInfoTile extends StatelessWidget {
  const _ProfileInfoTile({
    required this.icon,
    required this.value,
    required this.label,
    this.onTap,
  });

  final IconData icon;
  final String value;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.tileBackground,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      value,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                AppIcons.chevronRight,
                size: 20,
                color: AppColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LogoutConfirmSheet extends StatelessWidget {
  const _LogoutConfirmSheet();

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(24, 12, 24, 24 + bottom),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.dangerSoft,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                AppIcons.logOut,
                color: AppColors.danger,
                size: 28,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Déconnexion',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.text,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Voulez-vous vraiment vous déconnecter ?',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, false),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(50),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      side: BorderSide(color: AppColors.border),
                    ),
                    child: const Text('Annuler'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context, true),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.danger,
                      minimumSize: const Size.fromHeight(50),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text('Se déconnecter'),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
  }
}
