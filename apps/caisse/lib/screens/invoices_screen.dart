import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../widgets/app_empty_state.dart';
import '../widgets/app_error_state.dart';
import '../widgets/app_loading.dart';
import '../widgets/invoice_list_tile.dart';
import '../theme/app_icons.dart';

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  List<InvoiceSummary> _invoices = [];
  bool _loading = true;
  String? _error;
  String _filter = 'today';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final from = _filter == 'today' ? DateTime.now() : null;
      final status = _filter == 'pending' ? 'PENDING_PAYMENT' : null;
      final list = await api.listInvoices(status: status, from: from);
      setState(() => _invoices = list);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'today', label: Text("Aujourd'hui")),
              ButtonSegment(value: 'pending', label: Text('En attente')),
              ButtonSegment(value: 'all', label: Text('Toutes')),
            ],
            selected: {_filter},
            onSelectionChanged: (s) {
              setState(() => _filter = s.first);
              _load();
            },
          ),
        ),
        Expanded(
          child: _loading
              ? const AppLoading()
              : _error != null
                  ? AppErrorState(message: _error!, onRetry: _load)
                  : _invoices.isEmpty
                      ? const AppEmptyState(
                          icon: AppIcons.receipt,
                          title: 'Aucune facture',
                          subtitle: 'Aucun résultat pour ce filtre.',
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: AppColors.primary,
                          child: ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _invoices.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              return InvoiceListTile(
                                invoice: _invoices[index],
                              );
                            },
                          ),
                        ),
        ),
      ],
    );
  }
}
