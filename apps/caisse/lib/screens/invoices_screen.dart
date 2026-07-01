import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../widgets/app_empty_state.dart';
import '../widgets/app_error_state.dart';
import '../widgets/app_loading.dart';
import '../widgets/cashier_bottom_nav_bar.dart';
import '../widgets/cashier_screen_header.dart';
import '../widgets/expandable_fullscreen_search.dart';
import '../widgets/invoice_list_tile.dart';
import '../widgets/pending_invoices_alert.dart';
import 'invoice_detail_screen.dart';
import 'pos_select_screen.dart';
import '../theme/app_icons.dart';

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({
    super.key,
    this.isActive = false,
    this.focusFilter,
    this.onFocusFilterHandled,
  });

  final bool isActive;
  final String? focusFilter;
  final VoidCallback? onFocusFilterHandled;

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _FilterData {
  List<InvoiceSummary> invoices = [];
  bool loading = false;
  bool loaded = false;
  String? error;
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  static const _filters = ['today', 'pending', 'all'];

  final _searchCtrl = TextEditingController();
  final _searchLauncher = FullscreenSearchController();
  final _pageController = PageController();
  final _tabData = {
    for (final f in _filters) f: _FilterData(),
  };

  bool _searching = false;
  String _filter = 'today';
  int _pendingPaymentCount = 0;

  _FilterData get _current => _tabData[_filter]!;

  @override
  void initState() {
    super.initState();
    if (widget.isActive) {
      _bootstrap();
    }
  }

  void _scheduleFocusFilter(String filter) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _applyFocusFilter(filter);
      widget.onFocusFilterHandled?.call();
    });
  }

  @override
  void didUpdateWidget(InvoicesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _bootstrap(force: true);
      if (widget.focusFilter != null) {
        _scheduleFocusFilter(widget.focusFilter!);
      }
    } else if (widget.focusFilter != null &&
        widget.focusFilter != oldWidget.focusFilter) {
      _scheduleFocusFilter(widget.focusFilter!);
    }
  }

  Future<void> _bootstrap({bool force = false}) async {
    await Future.wait([
      _loadFilter(_filter, initial: true, force: force),
      _loadFilter('pending', initial: true, force: force),
      _loadPendingCount(),
    ]);
  }

  Future<void> _loadPendingCount() async {
    try {
      final pending =
          await context.read<ApiClient>().searchPendingInvoices('');
      if (!mounted) return;
      setState(() => _pendingPaymentCount = pending.length);
    } catch (_) {}
  }

  void _applyFocusFilter(String filter) {
    final index = _filters.indexOf(filter);
    if (index < 0) return;
    if (_filter != filter) {
      setState(() => _filter = filter);
      _loadFilter(filter, initial: !_tabData[filter]!.loaded);
    }
    if (_pageController.hasClients) {
      _pageController.jumpToPage(index);
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadFilter(
    String filter, {
    bool initial = false,
    bool force = false,
  }) async {
    final data = _tabData[filter]!;
    if (data.loading) return;
    if (data.loaded && !force && !initial) return;

    setState(() {
      data.loading = true;
      if (initial) data.error = null;
      if (_filter == filter) _searching = !initial;
    });

    try {
      final api = context.read<ApiClient>();
      final from = filter == 'today' ? DateTime.now() : null;
      final status = filter == 'pending' ? 'PENDING_PAYMENT' : null;
      final list = await api.listInvoices(
        status: status,
        from: from,
        search: _searchCtrl.text,
      );
      if (!mounted) return;
      setState(() {
        data.invoices = list;
        data.error = null;
        data.loaded = true;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => data.error = e.message);
    } finally {
      if (mounted) {
        setState(() {
          data.loading = false;
          if (_filter == filter) _searching = false;
        });
      }
    }
  }

  void _onFilterSelected(int index) {
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  void _onPageChanged(int index) {
    final next = _filters[index];
    if (_filter == next) return;
    setState(() => _filter = next);
    _loadFilter(next, initial: !_tabData[next]!.loaded);
  }

  String get _filterLabel {
    switch (_filter) {
      case 'today':
        return "Aujourd'hui";
      case 'pending':
        return 'En attente';
      default:
        return 'Toutes';
    }
  }

  List<Widget> _headerActions(BuildContext context) {
    return [
      IconButton(
        onPressed: () {
          _searchLauncher.open();
          if (_searchCtrl.text.isEmpty && !_current.loading) {
            _loadFilter(_filter, force: true);
          }
        },
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

  Widget _buildResultsFor(String filter) {
    final data = _tabData[filter]!;

    if (!data.loaded) {
      if (!data.loading) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _loadFilter(filter, initial: true);
        });
      }
      return const AppLoading();
    }

    final isSearch = filter == _filter && _searchCtrl.text.trim().isNotEmpty;
    if (data.error != null) {
      return AppErrorState(
        message: data.error!,
        onRetry: () => _loadFilter(filter, initial: true, force: true),
      );
    }
    if (data.invoices.isEmpty) {
      if (filter == 'today' && _pendingPaymentCount > 0) {
        return RefreshIndicator(
          onRefresh: () async {
            await Future.wait([
              _loadFilter(filter, initial: true, force: true),
              _loadPendingCount(),
            ]);
          },
          color: AppColors.primary,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            children: [
              PendingInvoicesAlert(
                count: _pendingPaymentCount,
                pendingCount: _pendingPaymentCount,
                variant: PendingInvoicesAlertVariant.invoicing,
                onTap: () => _applyFocusFilter('pending'),
              ),
              const SizedBox(height: 24),
              AppEmptyState(
                icon: AppIcons.receipt,
                title: isSearch ? 'Aucun résultat' : 'Aucune facture',
                subtitle: isSearch
                    ? 'Essayez un autre terme de recherche.'
                    : 'Aucune facture créée aujourd\'hui.',
              ),
            ],
          ),
        );
      }
      return AppEmptyState(
        icon: AppIcons.receipt,
        title: isSearch ? 'Aucun résultat' : 'Aucune facture',
        subtitle: isSearch
            ? 'Essayez un autre terme de recherche.'
            : 'Aucun résultat pour ce filtre.',
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([
          _loadFilter(filter, initial: true, force: true),
          if (filter == 'today') _loadPendingCount(),
        ]);
      },
      color: AppColors.primary,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        itemCount: data.invoices.length + (filter == 'today' && _pendingPaymentCount > 0 ? 1 : 0),
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          if (filter == 'today' && _pendingPaymentCount > 0 && index == 0) {
            return PendingInvoicesAlert(
              count: _pendingPaymentCount,
              pendingCount: _pendingPaymentCount,
              variant: PendingInvoicesAlertVariant.invoicing,
              onTap: () => _applyFocusFilter('pending'),
            );
          }
          final invoiceIndex =
              filter == 'today' && _pendingPaymentCount > 0 ? index - 1 : index;
          final invoice = data.invoices[invoiceIndex];
          return InvoiceListTile(
            invoice: invoice,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => InvoiceDetailScreen(invoiceId: invoice.id),
                ),
              );
            },
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final navInset = cashierBottomNavHeight(context);

    return ColoredBox(
      color: AppColors.background,
      child: ExpandableFullscreenSearch(
        launcher: _searchLauncher,
        textController: _searchCtrl,
        hint: 'N°, client, téléphone',
        loading: _searching,
        onSearch: () => _loadFilter(_filter, force: true),
        results: _buildResultsFor(_filter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CashierScreenHeader(
              title: 'Factures',
              subtitle: _filterLabel,
              badge: _current.loading && !_current.loaded
                  ? null
                  : '${_current.invoices.length}',
              actions: _headerActions(context),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: _InvoiceFilterTabs(
                selected: _filter,
                onChanged: (value) {
                  final index = _filters.indexOf(value);
                  if (index >= 0) _onFilterSelected(index);
                },
              ),
            ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: navInset),
                child: PageView(
                  controller: _pageController,
                  onPageChanged: _onPageChanged,
                  children: _filters
                      .map((filter) => _buildResultsFor(filter))
                      .toList(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InvoiceFilterTabs extends StatelessWidget {
  const _InvoiceFilterTabs({
    required this.selected,
    required this.onChanged,
  });

  final String selected;
  final ValueChanged<String> onChanged;

  static const _options = <({String value, String label, IconData icon})>[
    (value: 'today', label: "Aujourd'hui", icon: AppIcons.clock),
    (value: 'pending', label: 'En attente', icon: AppIcons.timer),
    (value: 'all', label: 'Toutes', icon: AppIcons.receipt),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: _options.map((opt) {
          final isSelected = selected == opt.value;
          return Expanded(
            child: _InvoiceFilterTab(
              label: opt.label,
              icon: opt.icon,
              selected: isSelected,
              onTap: () => onChanged(opt.value),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _InvoiceFilterTab extends StatelessWidget {
  const _InvoiceFilterTab({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            color: selected ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.22),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 18,
                color: selected ? Colors.white : AppColors.muted,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  height: 1.1,
                  color: selected ? Colors.white : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
