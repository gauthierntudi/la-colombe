import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
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
  const PendingInvoicesScreen({super.key});

  @override
  State<PendingInvoicesScreen> createState() => _PendingInvoicesScreenState();
}

class _PendingInvoicesScreenState extends State<PendingInvoicesScreen> {
  final _searchCtrl = TextEditingController();
  final _searchLauncher = FullscreenSearchController();
  List<InvoiceSummary> _invoices = [];
  bool _loading = true;
  bool _searching = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load(initial: true);
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
      final list = await context
          .read<ApiClient>()
          .searchPendingInvoices(_searchCtrl.text);
      if (!mounted) return;
      setState(() => _invoices = list);
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
    if (_invoices.isEmpty) {
      return const AppEmptyState(
        icon: AppIcons.receipt,
        title: 'Aucune facture en attente',
        subtitle: 'Les factures validées apparaîtront ici.',
      );
    }
    return RefreshIndicator(
      onRefresh: () => _load(initial: true),
      color: AppColors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _invoices.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final inv = _invoices[index];
          return InvoiceListTile(
            invoice: inv,
            showStatus: false,
            onTap: () async {
              final paid = await Navigator.of(context).push<bool>(
                MaterialPageRoute(
                  builder: (_) => InvoiceDetailScreen(invoiceId: inv.id),
                ),
              );
              if (paid == true) _load();
            },
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiClient>();

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
              badge: _loading ? null : '${_invoices.length}',
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
