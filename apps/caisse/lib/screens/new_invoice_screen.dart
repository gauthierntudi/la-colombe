import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../widgets/amount_label.dart';
import '../widgets/message_banner.dart';
import '../widgets/product_image.dart';
import '../widgets/search_field.dart';
import '../theme/app_icons.dart';

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

  Set<String> get _cartProductIds =>
      _lines.map((l) => l.product.id).toSet();

  List<Product> get _selectableResults =>
      _results.where((p) => !_cartProductIds.contains(p.id)).toList();

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
          MessageBanner(
            message: _message!,
            type: _success ? MessageBannerType.success : MessageBannerType.error,
            onDismiss: () => setState(() => _message = null),
          ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Client',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _customerCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Nom (optionnel)',
                          prefixIcon: Icon(AppIcons.user),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _phoneCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Téléphone (optionnel)',
                          prefixIcon: Icon(AppIcons.phone),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SearchField(
                controller: _searchCtrl,
                hint: 'Rechercher un produit',
                loading: _searching,
                onSearch: _search,
                onSubmitted: (_) => _search(),
              ),
              const SizedBox(height: 12),
              if (_results.isNotEmpty) ...[
                if (_selectableResults.isEmpty)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        'Tous les produits trouvés sont déjà dans le panier.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  )
                else
                  Card(
                    child: Column(
                      children: _selectableResults.map((p) {
                        final inStock = (p.availableStock ?? 0) > 0;
                        return ListTile(
                          leading: ProductImage(
                            name: p.name,
                            imageUrl: p.imageUrl,
                            size: 40,
                          ),
                          title: Text(
                            p.name,
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            '${p.sku} · ${formatCdf(p.unitPrice)} FC · Stock ${p.availableStock ?? 0}',
                          ),
                          trailing: IconButton.filled(
                            style: IconButton.styleFrom(
                              backgroundColor: inStock
                                  ? AppColors.primary
                                  : AppColors.border,
                            ),
                            icon: const Icon(AppIcons.plus, size: 20),
                            onPressed: inStock ? () => _addProduct(p) : null,
                          ),
                        );
                      }).toList(),
                    ),
                  ),
              ],
              if (_lines.isNotEmpty) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Text(
                      'Panier',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const Spacer(),
                    Text(
                      '${_lines.length} article(s)',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Card(
                  child: Column(
                    children: _lines.map((l) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        child: Row(
                          children: [
                            ProductImage(
                              name: l.product.name,
                              imageUrl: l.product.imageUrl,
                              size: 40,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    l.product.name,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    '${formatCdf(l.product.unitPrice)} FC',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            _QtyControl(
                              quantity: l.quantity,
                              onDecrement: () {
                                setState(() {
                                  if (l.quantity > 1) {
                                    l.quantity--;
                                  } else {
                                    _lines.remove(l);
                                  }
                                });
                              },
                              onIncrement: () {
                                final max = l.product.availableStock ?? 0;
                                if (l.quantity < max) {
                                  setState(() => l.quantity++);
                                }
                              },
                            ),
                            const SizedBox(width: 8),
                            AmountLabel(
                              amount: l.lineTotalTtc,
                              compact: true,
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.15),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total TTC',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      AmountLabelLarge(amount: _totalTtc),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _submitting ? null : _validate,
                  icon: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(AppIcons.circleCheck),
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

class _QtyControl extends StatelessWidget {
  const _QtyControl({
    required this.quantity,
    required this.onDecrement,
    required this.onIncrement,
  });

  final int quantity;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(AppIcons.minus, size: 18),
            onPressed: onDecrement,
          ),
          Text(
            '$quantity',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(AppIcons.plus, size: 18),
            onPressed: onIncrement,
          ),
        ],
      ),
    );
  }
}
