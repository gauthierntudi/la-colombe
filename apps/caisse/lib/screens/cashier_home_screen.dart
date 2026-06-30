import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/app_loading.dart';
import '../widgets/cashier_transaction_tile.dart';
import '../widgets/nav_count_badge.dart';
import '../widgets/user_avatar.dart';
import 'invoice_detail_screen.dart';
import '../theme/app_icons.dart';

/// Tableau de bord caissier.
class CashierHomeScreen extends StatefulWidget {
  const CashierHomeScreen({
    super.key,
    required this.onEncaisser,
    required this.onSession,
    required this.onChangePos,
    required this.onVoirHistorique,
  });

  final VoidCallback onEncaisser;
  final VoidCallback onSession;
  final VoidCallback onChangePos;
  final VoidCallback onVoirHistorique;

  @override
  State<CashierHomeScreen> createState() => _CashierHomeScreenState();
}

class _CashierHomeScreenState extends State<CashierHomeScreen> {
  static const _statusBarStyle = AppTheme.statusBarLight;

  static const _historyPreviewLimit = 3;

  bool _loading = true;
  bool _hideBalance = false;
  int _pendingCount = 0;
  List<InvoiceSummary> _recentPaid = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = context.read<ApiClient>();
      final results = await Future.wait([
        api.searchPendingInvoices(''),
        api.listInvoices(status: 'PAID', from: DateTime.now()),
      ]);
      if (!mounted) return;
      setState(() {
        _pendingCount = results[0].length;
        _recentPaid = results[1];
      });
    } catch (_) {
      // KPIs optionnels
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiClient>();
    final user = api.user;
    final session = api.openSession;

    if (user == null) {
      return const AppLoading();
    }

    final dateFmt = DateFormat('dd/MM · HH:mm');
    final preview = _recentPaid.take(_historyPreviewLimit).toList();
    final hasMore = _recentPaid.length > _historyPreviewLimit;
    final topPadding = _pendingCount > 0 ? 20.0 : 24.0;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: _statusBarStyle,
      child: ColoredBox(
        color: AppColors.background,
        child: RefreshIndicator(
          onRefresh: _load,
          color: AppColors.primary,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _DashboardHeader(
                  userName: user.name,
                  avatarUrl: user.avatarUrl,
                  session: session,
                  salesTotal: session?.totalSales ?? 0,
                  hideBalance: _hideBalance,
                  pendingCount: _pendingCount,
                  onToggleBalance: () =>
                      setState(() => _hideBalance = !_hideBalance),
                  onEncaisser: widget.onEncaisser,
                  onSession: widget.onSession,
                  onChangePos: widget.onChangePos,
                ),
              ),
              if (_pendingCount > 0)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                    child: _UpgradeBanner(
                      count: _pendingCount,
                      onTap: widget.onEncaisser,
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(20, topPadding, 20, 0),
                  child: _HistoryPreviewSection(
                    loading: _loading,
                    invoices: preview,
                    totalCount: _recentPaid.length,
                    hasMore: hasMore,
                    dateFmt: dateFmt,
                    onVoirTout: widget.onVoirHistorique,
                    onInvoiceTap: (id) {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => InvoiceDetailScreen(invoiceId: id),
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 28)),
            ],
          ),
        ),
      ),
    );
  }
}

class _HistoryPreviewSection extends StatelessWidget {
  const _HistoryPreviewSection({
    required this.loading,
    required this.invoices,
    required this.totalCount,
    required this.hasMore,
    required this.dateFmt,
    required this.onVoirTout,
    required this.onInvoiceTap,
  });

  final bool loading;
  final List<InvoiceSummary> invoices;
  final int totalCount;
  final bool hasMore;
  final DateFormat dateFmt;
  final VoidCallback onVoirTout;
  final void Function(String invoiceId) onInvoiceTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(
              'Historique récent',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.text,
              ),
            ),
            const Spacer(),
            if (!loading && totalCount > 0)
              TextButton(
                onPressed: onVoirTout,
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text(
                  'Voir tout',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: AppLoading()),
          )
        else if (invoices.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Icon(AppIcons.receipt, color: AppColors.muted),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Aucun encaissement aujourd\'hui',
                    style: TextStyle(color: AppColors.muted, fontSize: 13),
                  ),
                ),
              ],
            ),
          )
        else ...[
          ...invoices.map(
            (inv) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: CashierTransactionTile(
                invoice: inv,
                dateFmt: dateFmt,
                onTap: () => onInvoiceTap(inv.id),
              ),
            ),
          ),
          if (hasMore)
            OutlinedButton.icon(
              onPressed: onVoirTout,
              icon: const Icon(AppIcons.history, size: 18),
              label: Text(
                'Voir les $totalCount encaissements',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: BorderSide(color: AppColors.border),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

class _DashboardHeader extends StatelessWidget {
  const _DashboardHeader({
    required this.userName,
    required this.avatarUrl,
    required this.session,
    required this.salesTotal,
    required this.hideBalance,
    required this.pendingCount,
    required this.onToggleBalance,
    required this.onEncaisser,
    required this.onSession,
    required this.onChangePos,
  });

  final String userName;
  final String? avatarUrl;
  final CashSession? session;
  final int salesTotal;
  final bool hideBalance;
  final int pendingCount;
  final VoidCallback onToggleBalance;
  final VoidCallback onEncaisser;
  final VoidCallback onSession;
  final VoidCallback onChangePos;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;

    return ClipRRect(
      borderRadius: const BorderRadius.only(
        bottomLeft: Radius.circular(32),
        bottomRight: Radius.circular(32),
      ),
      child: ColoredBox(
        color: AppColors.primary,
        child: Padding(
          padding: EdgeInsets.fromLTRB(20, topInset + 14, 20, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  UserAvatar(
                    name: userName,
                    imageUrl: avatarUrl,
                    radius: 24,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Bonne journée !',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.white.withValues(alpha: 0.82),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        Text(
                          userName,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            height: 1.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  _NotificationBell(
                    pendingCount: pendingCount,
                    onTap: onEncaisser,
                  ),
                ],
              ),
              const SizedBox(height: 24),
              _DashboardBalance(
                session: session,
                salesTotal: salesTotal,
                hideBalance: hideBalance,
                onToggleBalance: onToggleBalance,
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _HeaderCircleButton(
                    icon: AppIcons.caisse,
                    tooltip: 'Encaisser',
                    onTap: onEncaisser,
                  ),
                  _HeaderCircleButton(
                    icon: AppIcons.receipt,
                    tooltip: 'En attente',
                    onTap: onEncaisser,
                    badge: pendingCount > 0 ? pendingCount : null,
                  ),
                  _HeaderCircleButton(
                    icon: AppIcons.wallet,
                    tooltip: 'Session',
                    onTap: onSession,
                  ),
                  _HeaderCircleButton(
                    icon: AppIcons.store,
                    tooltip: 'Site',
                    onTap: onChangePos,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashboardBalance extends StatelessWidget {
  const _DashboardBalance({
    required this.session,
    required this.salesTotal,
    required this.hideBalance,
    required this.onToggleBalance,
  });

  final CashSession? session;
  final int salesTotal;
  final bool hideBalance;
  final VoidCallback onToggleBalance;

  @override
  Widget build(BuildContext context) {
    final label = session != null ? 'Ventes du jour' : 'Caisse fermée';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: Colors.white.withValues(alpha: 0.78),
                fontWeight: FontWeight.w500,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: onToggleBalance,
              child: Icon(
                hideBalance
                    ? AppIcons.eyeOff
                    : AppIcons.eye,
                size: 18,
                color: Colors.white.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              'FC',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Colors.white.withValues(alpha: 0.82),
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              hideBalance ? '••• ••• •••' : formatCdf(salesTotal),
              style: TextStyle(
                fontSize: 42,
                fontWeight: FontWeight.w800,
                color: Colors.white,
                letterSpacing: -1,
                height: 1,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _HeaderCircleButton extends StatelessWidget {
  const _HeaderCircleButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.white.withValues(alpha: 0.18),
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 52,
            height: 52,
            child: Stack(
              alignment: Alignment.center,
              clipBehavior: Clip.none,
              children: [
                Icon(icon, color: Colors.white, size: 24),
                if (badge != null && badge! > 0)
                  Positioned(
                    right: 0,
                    top: 0,
                    child: NavCountBadge(count: badge!),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationBell extends StatelessWidget {
  const _NotificationBell({
    required this.pendingCount,
    required this.onTap,
  });

  final int pendingCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              Icon(
                AppIcons.bell,
                color: AppColors.text,
                size: 22,
              ),
              if (pendingCount > 0)
                Positioned(
                  right: 4,
                  top: 4,
                  child: NavCountBadge(
                    count: pendingCount,
                    color: const Color(0xFFEF4444),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UpgradeBanner extends StatelessWidget {
  const _UpgradeBanner({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.warningSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  AppIcons.warning,
                  color: AppColors.warning,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$count facture(s) en attente',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: AppColors.text,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Encaisser avant expiration',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.muted.withValues(alpha: 0.95),
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                AppIcons.chevronRight,
                color: AppColors.muted,
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
