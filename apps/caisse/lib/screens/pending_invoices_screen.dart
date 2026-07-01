import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/receipt_print_tracker.dart';
import '../theme/app_colors.dart';
import '../widgets/app_empty_state.dart';
import '../widgets/app_error_state.dart';
import '../widgets/app_loading.dart';
import '../widgets/cashier_screen_header.dart';
import '../widgets/expandable_fullscreen_search.dart';
import '../widgets/invoice_list_tile.dart';
import '../widgets/message_banner.dart';
import 'invoice_detail_screen.dart';
import 'pos_select_screen.dart';
import '../theme/app_icons.dart';

class PendingInvoicesScreen extends StatefulWidget {
  const PendingInvoicesScreen({super.key, this.isActive = false});

  final bool isActive;

  @override
  State<PendingInvoicesScreen> createState() => _PendingInvoicesScreenState();
}

class _PendingInvoicesScreenState extends State<PendingInvoicesScreen> {
  final _searchCtrl = TextEditingController();
  final _searchLauncher = FullscreenSearchController();
  List<InvoiceSummary> _pending = [];
  List<InvoiceSummary> _toPrint = [];
  bool _loading = true;
  bool _searching = false;
  String? _error;

  int get _totalCount => _pending.length + _toPrint.length;

  @override
  void initState() {
    super.initState();
    if (widget.isActive) _load(initial: true);
  }

  @override
  void didUpdateWidget(PendingInvoicesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _load(initial: true);
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({bool initial = false}) async {
    setState(() {
      if (initial) {
        _loading = true;
      } else {
        _searching = true;
      }
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final tracker = context.read<ReceiptPrintTracker>();
      final search = _searchCtrl.text;

      final pending = await api.searchPendingInvoices(search);

      List<InvoiceSummary> toPrint = [];
      if (search.trim().isEmpty) {
        final paidToday = await api.listInvoices(
          status: 'PAID',
          from: DateTime.now(),
        );
        toPrint = paidToday
            .where((inv) => !tracker.isPrinted(inv.id))
            .toList();
      }

      if (!mounted) return;
      setState(() {
        _pending = pending;
        _toPrint = toPrint;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _searching = false;
        });
      }
    }
  }

  Future<void> _openInvoice(InvoiceSummary inv) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => InvoiceDetailScreen(invoiceId: inv.id),
      ),
    );
    if (mounted) _load();
  }

  List<Widget> _headerActions(BuildContext context) {
    return [
      IconButton(
        onPressed: _searchLauncher.open,
        icon: Icon(
          AppIcons.search,
          color: Colors.white.withValues(alpha: 0.9),
        ),
        tooltip: 'Rechercher',
      ),
      IconButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const PosSelectScreen(fromSettings: true),
            ),
          );
        },
        icon: Icon(
          AppIcons.store,
          color: Colors.white.withValues(alpha: 0.9),
        ),
        tooltip: 'Changer de site',
      ),
    ];
  }

  Widget _buildResults() {
    if (_loading) return const AppLoading();
    if (_error != null) {
      return AppErrorState(message: _error!, onRetry: _load);
    }
    if (_totalCount == 0) {
      return const AppEmptyState(
        icon: AppIcons.receipt,
        title: 'Aucune facture en attente',
        subtitle: 'Les factures validées apparaîtront ici.',
      );
    }

    return RefreshIndicator(
      onRefresh: () => _load(initial: true),
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_toPrint.isNotEmpty) ...[
            Text(
              'Bon à imprimer',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.muted,
              ),
            ),
            const SizedBox(height: 10),
            ..._toPrint.map(
              (inv) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: InvoiceListTile(
                  invoice: inv,
                  showStatus: true,
                  needsReceiptPrint: true,
                  onTap: () => _openInvoice(inv),
                ),
              ),
            ),
            if (_pending.isNotEmpty) const SizedBox(height: 8),
          ],
          if (_pending.isNotEmpty) ...[
            if (_toPrint.isNotEmpty)
              Text(
                'En attente de paiement',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.muted,
                ),
              ),
            if (_toPrint.isNotEmpty) const SizedBox(height: 10),
            ..._pending.map(
              (inv) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: InvoiceListTile(
                  invoice: inv,
                  showStatus: false,
                  onTap: () => _openInvoice(inv),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiClient>();
    context.watch<ReceiptPrintTracker>();

    return ColoredBox(
      color: AppColors.background,
      child: ExpandableFullscreenSearch(
        launcher: _searchLauncher,
        textController: _searchCtrl,
        hint: 'N°, client, téléphone',
        loading: _searching,
        onSearch: () => _load(),
        results: _buildResults(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CashierScreenHeader(
              title: 'Encaisser',
              badge: _loading ? null : '$_totalCount',
              actions: _headerActions(context),
            ),
            if (api.user?.role == 'CAISSIER' && !api.hasOpenSession)
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: MessageBanner(
                  message: 'Ouvrez une session pour encaisser',
                  type: MessageBannerType.warning,
                ),
              ),
            Expanded(child: _buildResults()),
          ],
        ),
      ),
    );
  }
}
