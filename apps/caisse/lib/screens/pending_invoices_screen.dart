import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import 'invoice_detail_screen.dart';

class PendingInvoicesScreen extends StatefulWidget {
  const PendingInvoicesScreen({super.key});

  @override
  State<PendingInvoicesScreen> createState() => _PendingInvoicesScreenState();
}

class _PendingInvoicesScreenState extends State<PendingInvoicesScreen> {
  final _searchCtrl = TextEditingController();
  List<InvoiceSummary> _invoices = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await context
          .read<ApiClient>()
          .searchPendingInvoices(_searchCtrl.text);
      setState(() => _invoices = list);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('dd/MM HH:mm');
    final api = context.watch<ApiClient>();

    return Column(
      children: [
        if (api.user?.role == 'CAISSIER' && !api.hasOpenSession)
          MaterialBanner(
            content: const Text('Ouvrez une session pour encaisser'),
            leading: const Icon(Icons.warning_amber),
            backgroundColor: Colors.orange.shade50,
            actions: [
              TextButton(onPressed: _load, child: const Text('Actualiser')),
            ],
          ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchCtrl,
                  decoration: const InputDecoration(
                    labelText: 'N°, client, téléphone',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.search),
                    isDense: true,
                  ),
                  onSubmitted: (_) => _load(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: _loading ? null : _load,
                icon: const Icon(Icons.search),
              ),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text(_error!))
                  : _invoices.isEmpty
                      ? const Center(child: Text('Aucune facture en attente'))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.separated(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: _invoices.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final inv = _invoices[index];
                              return Card(
                                child: ListTile(
                                  title: Text(
                                    inv.number,
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                  subtitle: Text(
                                    '${inv.customerName ?? 'Client anonyme'}'
                                    '${inv.customerPhone != null ? ' · ${inv.customerPhone}' : ''}\n'
                                    '${dateFmt.format(inv.createdAt.toLocal())}',
                                  ),
                                  isThreeLine: true,
                                  trailing: Text(
                                    '${formatCdf(inv.totalTtc)} FC',
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                  onTap: () async {
                                    final paid = await Navigator.of(context).push<bool>(
                                      MaterialPageRoute(
                                        builder: (_) =>
                                            InvoiceDetailScreen(invoiceId: inv.id),
                                      ),
                                    );
                                    if (paid == true) _load();
                                  },
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
