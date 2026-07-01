import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../widgets/app_empty_state.dart';
import '../widgets/app_error_state.dart';
import '../widgets/app_loading.dart';
import '../widgets/cashier_screen_header.dart';
import '../widgets/invoice_list_tile.dart';
import 'invoice_detail_screen.dart';
import 'pos_select_screen.dart';
import '../theme/app_icons.dart';

/// Historique caissier — encaissements du jour.
class CashierHistoryScreen extends StatefulWidget {
  const CashierHistoryScreen({super.key, this.isActive = false});

  final bool isActive;

  @override
  State<CashierHistoryScreen> createState() => _CashierHistoryScreenState();
}

class _CashierHistoryScreenState extends State<CashierHistoryScreen> {
  bool _loading = false;
  List<InvoiceSummary> _paidToday = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.isActive) _load();
  }

  @override
  void didUpdateWidget(CashierHistoryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final paid = await context.read<ApiClient>().listPaidInvoicesToday();
      if (!mounted) return;
      setState(() => _paidToday = paid);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Impossible de charger l\'historique');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Widget> _headerActions(BuildContext context) {
    return [
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

  @override
  Widget build(BuildContext context) {
    final todayFmt = DateFormat('dd/MM/yyyy');
    final totalSales = _paidToday.fold<int>(
      0,
      (sum, inv) => sum + inv.totalTtc,
    );

    return ColoredBox(
      color: AppColors.background,
      child: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: CashierScreenHeader(
                title: 'Historique',
                subtitle: 'Aujourd\'hui · ${todayFmt.format(DateTime.now())}',
                actions: _headerActions(context),
              ),
            ),
            if (!_loading && _paidToday.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          AppIcons.caisse,
                          color: AppColors.primary,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${_paidToday.length} encaissement(s) aujourd\'hui',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: AppColors.text,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        Text(
                          '${formatCdf(totalSales)} FC',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AppColors.amount,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
                child: Text(
                  'Encaissements du jour',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: AppLoading()),
              )
            else if (_error != null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: AppErrorState(message: _error!, onRetry: _load),
              )
            else if (_paidToday.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: AppEmptyState(
                  icon: AppIcons.receipt,
                  title: 'Aucun encaissement',
                  subtitle:
                      'Les factures payées aujourd\'hui\napparaîtront ici.',
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
                sliver: SliverList.separated(
                  itemCount: _paidToday.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final inv = _paidToday[index];
                    return InvoiceListTile(
                      invoice: inv,
                      showStatus: false,
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) =>
                                InvoiceDetailScreen(invoiceId: inv.id),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
