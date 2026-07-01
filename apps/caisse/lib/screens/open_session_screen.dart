import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/cashier_bottom_nav_bar.dart';
import '../widgets/cashier_screen_header.dart';
import '../widgets/message_banner.dart';
import '../widgets/user_avatar.dart';
import 'cashier_profile_screen.dart';
import 'pos_select_screen.dart';
import '../theme/app_icons.dart';

class OpenSessionScreen extends StatefulWidget {
  const OpenSessionScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<OpenSessionScreen> createState() => _OpenSessionScreenState();
}

class _OpenSessionScreenState extends State<OpenSessionScreen> {
  final _openingCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _openingCtrl.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    final amount = int.tryParse(_openingCtrl.text.replaceAll(' ', '')) ?? 0;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<ApiClient>().openCashSession(openingCash: amount);
      if (!mounted) return;
      if (widget.embedded) {
        setState(() => _loading = false);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted && !widget.embedded) setState(() => _loading = false);
      if (mounted && widget.embedded && _error != null) {
        setState(() => _loading = false);
      }
    }
  }

  void _changeSite() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const PosSelectScreen(fromSettings: true),
      ),
    );
  }

  void _openProfile() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const CashierProfileScreen()),
    );
  }

  List<Widget> _headerActions() {
    return [
      IconButton(
        onPressed: _openProfile,
        icon: Icon(AppIcons.user, color: Colors.white.withValues(alpha: 0.9)),
        tooltip: 'Mon profil',
      ),
      IconButton(
        onPressed: _changeSite,
        icon: Icon(AppIcons.store, color: Colors.white.withValues(alpha: 0.9)),
        tooltip: 'Changer de site',
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiClient>();
    final pos = api.activePos;
    final userName = api.user?.name;
    final navInset = widget.embedded ? cashierBottomNavHeight(context) : 0.0;

    final body = ListView(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + navInset),
      children: [
        _IntroCard(
          userName: userName,
          avatarUrl: api.user?.avatarUrl,
          onTap: _openProfile,
        ),
        const SizedBox(height: 18),
        const _StepsRow(),
        const SizedBox(height: 18),
        if (pos != null)
          _SiteCard(pos: pos)
        else ...[
          MessageBanner(
            message: 'Sélectionnez un magasin pour continuer.',
            type: MessageBannerType.warning,
            onDismiss: null,
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _changeSite,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            icon: const Icon(AppIcons.store, size: 18),
            label: const Text('Choisir un site'),
          ),
        ],
        const SizedBox(height: 22),
        Text(
          'Fond initial',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.text,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Espèces présentes dans le tiroir.',
          style: TextStyle(fontSize: 13, color: AppColors.muted),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _openingCtrl,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.3,
          ),
          decoration: InputDecoration(
            hintText: '0',
            suffixText: 'FC',
            prefixIcon: const Icon(AppIcons.piggyBank),
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 16),
          MessageBanner(
            message: _error!,
            type: MessageBannerType.error,
            onDismiss: () => setState(() => _error = null),
          ),
        ],
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: _loading || pos == null ? null : _open,
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          icon: _loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(AppIcons.lockOpen),
          label: Text(_loading ? 'Ouverture…' : 'Ouvrir la session'),
        ),
      ],
    );

    if (widget.embedded) {
      return ColoredBox(
        color: AppColors.background,
        child: Column(
          children: [
            CashierScreenHeader(
              title: 'Ouvrir la caisse',
              subtitle: pos != null ? '${pos.name} · ${pos.code}' : null,
              actions: _headerActions(),
            ),
            Expanded(child: body),
          ],
        ),
      );
    }

    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: AppTheme.statusBarLight,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: Column(
          children: [
            Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(20, topInset + 18, 20, 24),
            decoration: const BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(24),
                bottomRight: Radius.circular(24),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ouvrir la caisse',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          letterSpacing: -0.3,
                        ),
                      ),
                      if (pos != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          '${pos.name} · ${pos.code}',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.white.withValues(alpha: 0.78),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                ..._headerActions(),
              ],
            ),
          ),
          Expanded(child: body),
        ],
      ),
      ),
    );
  }
}

class _IntroCard extends StatelessWidget {
  const _IntroCard({
    this.userName,
    this.avatarUrl,
    this.onTap,
  });

  final String? userName;
  final String? avatarUrl;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final displayName = userName?.trim();
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.12)),
          ),
          child: Row(
            children: [
              if (displayName != null && displayName.isNotEmpty)
                UserAvatarLight(
                  name: displayName,
                  imageUrl: avatarUrl,
                  radius: 26,
                )
              else
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    AppIcons.lockOpen,
                    color: Colors.white,
                    size: 26,
                  ),
                ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName != null && displayName.isNotEmpty
                          ? 'Bonjour, $displayName'
                          : 'Nouvelle session',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.text,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Comptez le fond avant d\'encaisser.',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    if (onTap != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Mon profil',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                            ),
                          ),
                          Icon(
                            AppIcons.chevronRight,
                            size: 16,
                            color: AppColors.primary,
                          ),
                        ],
                      ),
                    ],
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

class _StepsRow extends StatelessWidget {
  const _StepsRow();

  @override
  Widget build(BuildContext context) {
    const steps = [
      (icon: AppIcons.store, label: 'Site'),
      (icon: AppIcons.piggyBank, label: 'Fond'),
      (icon: AppIcons.lockOpen, label: 'Ouvrir'),
    ];

    return Row(
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          if (i > 0)
            Expanded(
              child: Container(
                height: 1,
                margin: const EdgeInsets.only(bottom: 20),
                color: AppColors.border,
              ),
            ),
          Expanded(
            child: Column(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Icon(steps[i].icon, size: 18, color: AppColors.primary),
                ),
                const SizedBox(height: 6),
                Text(
                  steps[i].label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _SiteCard extends StatelessWidget {
  const _SiteCard({required this.pos});

  final PointOfSale pos;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(AppIcons.store, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Magasin',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.muted,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  pos.name,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text,
                  ),
                ),
                Text(
                  pos.code,
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          Icon(AppIcons.circleCheck, size: 18, color: AppColors.success),
        ],
      ),
    );
  }
}
