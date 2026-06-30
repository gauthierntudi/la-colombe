import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';

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
    final dateFmt = DateFormat('dd/MM HH:mm');

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
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text(_error!))
                  : _invoices.isEmpty
                      ? const Center(child: Text('Aucune facture'))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _invoices.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final inv = _invoices[index];
                              return Card(
                                child: ListTile(
                                  title: Text(inv.number),
                                  subtitle: Text(
                                    '${invoiceStatusLabels[inv.status] ?? inv.status}'
                                    '${inv.customerName != null ? ' · ${inv.customerName}' : ''}\n'
                                    '${dateFmt.format(inv.createdAt.toLocal())}',
                                  ),
                                  isThreeLine: true,
                                  trailing: Text(
                                    '${formatCdf(inv.totalTtc)} FC',
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
        ),
      ],
    );
  }
}
