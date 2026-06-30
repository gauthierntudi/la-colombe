import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';

class NewInvoiceScreen extends StatefulWidget {
  const NewInvoiceScreen({super.key});

  @override
  State<NewInvoiceScreen> createState() => _NewInvoiceScreenState();
}

class _NewInvoiceScreenState extends State<NewInvoiceScreen> {
  final _searchCtrl = TextEditingController();
  final _customerCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _lines = <CartLine>[];
  List<Product> _results = [];
  bool _searching = false;
  bool _submitting = false;
  String? _message;
  bool _success = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    _customerCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  int get _totalTtc => _lines.fold(0, (s, l) => s + l.lineTotalTtc);

  Future<void> _search() async {
    setState(() {
      _searching = true;
      _message = null;
    });
    try {
      final api = context.read<ApiClient>();
      final products = await api.searchProducts(_searchCtrl.text);
      setState(() => _results = products);
    } on ApiException catch (e) {
      setState(() => _message = e.message);
    } finally {
      setState(() => _searching = false);
    }
  }

  void _addProduct(Product p) {
    final existing = _lines.where((l) => l.product.id == p.id).firstOrNull;
    if (existing != null) {
      setState(() => existing.quantity++);
    } else {
      setState(() => _lines.add(CartLine(product: p, quantity: 1)));
    }
  }

  Future<void> _validate() async {
    if (_lines.isEmpty) {
      setState(() {
        _message = 'Ajoutez au moins un produit';
        _success = false;
      });
      return;
    }
    setState(() {
      _submitting = true;
      _message = null;
    });
    try {
      final api = context.read<ApiClient>();
      final invoice = await api.createAndValidateInvoice(
        lines: _lines,
        customerName: _customerCtrl.text.trim(),
        customerPhone: _phoneCtrl.text.trim(),
      );
      setState(() {
        _lines.clear();
        _results.clear();
        _searchCtrl.clear();
        _customerCtrl.clear();
        _phoneCtrl.clear();
        _message = 'Facture ${invoice.number} validée — en attente de paiement';
        _success = true;
      });
    } on ApiException catch (e) {
      setState(() {
        _message = e.message;
        _success = false;
      });
    } finally {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_message != null)
          MaterialBanner(
            content: Text(_message!),
            backgroundColor: _success
                ? Colors.green.shade50
                : Theme.of(context).colorScheme.errorContainer,
            actions: [
              TextButton(
                onPressed: () => setState(() => _message = null),
                child: const Text('OK'),
              ),
            ],
          ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextField(
                controller: _customerCtrl,
                decoration: const InputDecoration(
                  labelText: 'Client (optionnel)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Téléphone (optionnel)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _searchCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Rechercher produit',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.search),
                      ),
                      onSubmitted: (_) => _search(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _searching ? null : _search,
                    icon: _searching
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.search),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ..._results.map(
                (p) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(p.name),
                  subtitle: Text(
                    '${p.sku} · ${formatCdf(p.unitPrice)} FC · Stock: ${p.availableStock ?? 0}',
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.add_circle_outline),
                    onPressed: (p.availableStock ?? 0) > 0 ? () => _addProduct(p) : null,
                  ),
                ),
              ),
              if (_lines.isNotEmpty) ...[
                const Divider(height: 32),
                Text(
                  'Panier',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 8),
                ..._lines.map(
                  (l) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l.product.name),
                    subtitle: Text('${formatCdf(l.product.unitPrice)} FC × ${l.quantity}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline),
                          onPressed: () {
                            setState(() {
                              if (l.quantity > 1) {
                                l.quantity--;
                              } else {
                                _lines.remove(l);
                              }
                            });
                          },
                        ),
                        Text('${l.quantity}'),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline),
                          onPressed: () {
                            final max = l.product.availableStock ?? 0;
                            if (l.quantity < max) {
                              setState(() => l.quantity++);
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Total TTC : ${formatCdf(_totalTtc)} FC',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _submitting ? null : _validate,
                  icon: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check_circle_outline),
                  label: const Text('Valider la facture'),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
