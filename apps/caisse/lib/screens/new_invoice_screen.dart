import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../widgets/app_empty_state.dart';
import '../widgets/app_loading.dart';
import '../widgets/cashier_bottom_nav_bar.dart';
import '../widgets/cashier_screen_header.dart';
import '../widgets/expandable_fullscreen_search.dart';
import '../widgets/message_banner.dart';
import '../widgets/pending_invoices_alert.dart';
import '../widgets/product_image.dart';
import 'pos_select_screen.dart';
import '../theme/app_icons.dart';

class NewInvoiceScreen extends StatefulWidget {
  const NewInvoiceScreen({
    super.key,
    this.isActive = false,
    this.onCartNotEmptyChanged,
    this.onViewPending,
  });

  final bool isActive;
  final ValueChanged<bool>? onCartNotEmptyChanged;
  final VoidCallback? onViewPending;

  @override
  State<NewInvoiceScreen> createState() => _NewInvoiceScreenState();
}

class _NewInvoiceScreenState extends State<NewInvoiceScreen> {
  final _searchCtrl = TextEditingController();
  final _searchLauncher = FullscreenSearchController();
  final _customerCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _lines = <CartLine>[];
  List<Product> _results = [];
  bool _searching = false;
  bool _submitting = false;
  String? _message;
  bool _success = false;
  int _pendingPaymentCount = 0;

  @override
  void initState() {
    super.initState();
    if (widget.isActive) _loadPendingCount();
  }

  @override
  void didUpdateWidget(NewInvoiceScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _loadPendingCount();
    }
  }

  Future<void> _loadPendingCount() async {
    try {
      final pending =
          await context.read<ApiClient>().searchPendingInvoices('');
      if (!mounted) return;
      setState(() => _pendingPaymentCount = pending.length);
    } catch (_) {}
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _customerCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  int get _totalTtc => _lines.fold(0, (s, l) => s + l.lineTotalTtc);

  int get _totalUnits => _lines.fold(0, (s, l) => s + l.quantity);

  int get _subtotalHt => _lines.fold(
        0,
        (sum, l) => sum + l.product.unitPrice * l.quantity,
      );

  int get _totalTax => _lines.fold(0, (sum, l) {
        final ht = l.product.unitPrice * l.quantity;
        return sum + (ht * l.product.taxRate / 100).round();
      });

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

  void _syncCartNavVisibility() {
    widget.onCartNotEmptyChanged?.call(_lines.isNotEmpty);
  }

  void _addProduct(Product p) {
    final existing = _lines.where((l) => l.product.id == p.id).firstOrNull;
    if (existing != null) {
      setState(() => existing.quantity++);
    } else {
      setState(() => _lines.add(CartLine(product: p, quantity: 1)));
    }
    _syncCartNavVisibility();
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
      _syncCartNavVisibility();
      _loadPendingCount();
    } on ApiException catch (e) {
      setState(() {
        _message = e.message;
        _success = false;
      });
    } finally {
      setState(() => _submitting = false);
    }
  }

  void _openSearch() {
    _searchLauncher.open();
    if (_results.isEmpty && !_searching) _search();
  }

  void _removeLine(CartLine line) {
    setState(() => _lines.remove(line));
    _syncCartNavVisibility();
  }

  void _updateLineQuantity(CartLine line, VoidCallback update) {
    setState(update);
    _syncCartNavVisibility();
  }

  List<Widget> _headerActions(BuildContext context) {
    return [
      IconButton(
        onPressed: _openSearch,
        icon: Icon(
          AppIcons.search,
          color: Colors.white.withValues(alpha: 0.9),
        ),
        tooltip: 'Rechercher un produit',
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

  Widget _buildProductResults() {
    if (_searching && _results.isEmpty) {
      return const AppLoading();
    }
    if (_results.isEmpty) {
      return AppEmptyState(
        icon: AppIcons.search,
        title: _searchCtrl.text.trim().isEmpty
            ? 'Rechercher un produit'
            : 'Aucun produit',
        subtitle: _searchCtrl.text.trim().isEmpty
            ? 'Saisissez un nom, SKU ou code-barres.'
            : 'Essayez un autre terme de recherche.',
      );
    }
    if (_selectableResults.isEmpty) {
      return const AppEmptyState(
        icon: AppIcons.shoppingCart,
        title: 'Panier à jour',
        subtitle: 'Tous les produits trouvés sont déjà dans le panier.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _selectableResults.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final p = _selectableResults[index];
        final inStock = (p.availableStock ?? 0) > 0;
        return _SurfaceCard(
          child: ListTile(
            leading: ProductImage(
              name: p.name,
              imageUrl: p.imageUrl,
              size: 40,
            ),
            title: Text(
              p.name,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: AppColors.text,
              ),
            ),
            subtitle: Text(
              '${p.sku} · ${formatCdf(p.unitPrice)} FC · Stock ${p.availableStock ?? 0}',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.muted,
              ),
            ),
            trailing: IconButton.filled(
              style: IconButton.styleFrom(
                backgroundColor:
                    inStock ? AppColors.primary : AppColors.border,
              ),
              icon: const Icon(AppIcons.plus, size: 20),
              onPressed: inStock ? () => _addProduct(p) : null,
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = _lines.isNotEmpty
        ? MediaQuery.paddingOf(context).bottom
        : cashierBottomNavHeight(context);

    return ColoredBox(
      color: AppColors.background,
      child: ExpandableFullscreenSearch(
        launcher: _searchLauncher,
        textController: _searchCtrl,
        hint: 'Nom, SKU, code-barres',
        loading: _searching,
        onSearch: _search,
        results: _buildProductResults(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CashierScreenHeader(
              title: 'Nouvelle facture',
              subtitle: _lines.isEmpty
                  ? 'Recherchez et ajoutez des produits'
                  : '$_totalUnits unité(s) · ${formatCdf(_totalTtc)} FC',
              actions: _headerActions(context),
            ),
            if (_message != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: MessageBanner(
                  message: _message!,
                  type: _success
                      ? MessageBannerType.success
                      : MessageBannerType.error,
                  onDismiss: () => setState(() => _message = null),
                ),
              ),
            Expanded(
              child: ListView(
                padding: EdgeInsets.fromLTRB(
                  20,
                  20,
                  20,
                  _lines.isEmpty ? 20 + bottomInset : 0,
                ),
                children: [
                  if (_lines.isEmpty) ...[
                    if (_pendingPaymentCount > 0) ...[
                      PendingInvoicesAlert(
                        count: _pendingPaymentCount,
                        pendingCount: _pendingPaymentCount,
                        variant: PendingInvoicesAlertVariant.invoicing,
                        onTap: widget.onViewPending ?? () {},
                      ),
                      const SizedBox(height: 16),
                    ],
                    _ClientInfoCard(
                      customerCtrl: _customerCtrl,
                      phoneCtrl: _phoneCtrl,
                    ),
                    const SizedBox(height: 16),
                    _AddProductsEmptyCard(onSearch: _openSearch),
                    const SizedBox(height: 16),
                  ] else ...[
                    _ClientInfoCard(
                      customerCtrl: _customerCtrl,
                      phoneCtrl: _phoneCtrl,
                    ),
                    const SizedBox(height: 12),
                    ..._lines.asMap().entries.map(
                      (entry) => Padding(
                        padding: EdgeInsets.only(
                          bottom: entry.key < _lines.length - 1 ? 12 : 0,
                        ),
                        child: _CartLineTile(
                          line: entry.value,
                          onRemove: () => _removeLine(entry.value),
                          onDecrement: () {
                            _updateLineQuantity(entry.value, () {
                              if (entry.value.quantity > 1) {
                                entry.value.quantity--;
                              } else {
                                _lines.remove(entry.value);
                              }
                            });
                          },
                          onIncrement: () {
                            final max =
                                entry.value.product.availableStock ?? 0;
                            if (entry.value.quantity < max) {
                              _updateLineQuantity(
                                entry.value,
                                () => entry.value.quantity++,
                              );
                            }
                          },
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (_lines.isNotEmpty)
              _CartBottomSheet(
                subtotalHt: _subtotalHt,
                totalTax: _totalTax,
                totalTtc: _totalTtc,
                submitting: _submitting,
                bottomInset: bottomInset,
                onValidate: _validate,
              ),
          ],
        ),
      ),
    );
  }
}

class _SurfaceCard extends StatelessWidget {
  const _SurfaceCard({required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

class _AddProductsEmptyCard extends StatelessWidget {
  const _AddProductsEmptyCard({required this.onSearch});

  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
        child: Column(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    AppIcons.shoppingCart,
                    size: 32,
                    color: AppColors.primary,
                  ),
                ),
                Positioned(
                  right: -4,
                  bottom: -4,
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.surface, width: 2),
                    ),
                    child: const Icon(
                      AppIcons.plus,
                      size: 16,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text(
              'Ajouter des produits',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: AppColors.text,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Votre panier est vide. Lancez une recherche pour commencer la facture.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: AppColors.muted,
              ),
            ),
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              child: Material(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(32),
                elevation: 3,
                shadowColor: AppColors.primary.withValues(alpha: 0.3),
                child: InkWell(
                  onTap: onSearch,
                  borderRadius: BorderRadius.circular(32),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(AppIcons.search, color: Colors.white, size: 20),
                        SizedBox(width: 10),
                        Text(
                          'Rechercher un produit',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClientInfoCard extends StatefulWidget {
  const _ClientInfoCard({
    required this.customerCtrl,
    required this.phoneCtrl,
  });

  final TextEditingController customerCtrl;
  final TextEditingController phoneCtrl;

  @override
  State<_ClientInfoCard> createState() => _ClientInfoCardState();
}

class _ClientInfoCardState extends State<_ClientInfoCard> {
  @override
  void initState() {
    super.initState();
    widget.customerCtrl.addListener(_onFieldChanged);
    widget.phoneCtrl.addListener(_onFieldChanged);
  }

  @override
  void dispose() {
    widget.customerCtrl.removeListener(_onFieldChanged);
    widget.phoneCtrl.removeListener(_onFieldChanged);
    super.dispose();
  }

  void _onFieldChanged() => setState(() {});

  Future<void> _editClient() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: false,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
        child: _ClientEditSheet(
          customerCtrl: widget.customerCtrl,
          phoneCtrl: widget.phoneCtrl,
          onSaved: () => setState(() {}),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.customerCtrl.text.trim();
    final phone = widget.phoneCtrl.text.trim();
    final hasInfo = name.isNotEmpty || phone.isNotEmpty;

    return _SurfaceCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                'Informations client',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.text,
                ),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: _editClient,
                icon: Icon(
                  AppIcons.pencil,
                  size: 16,
                  color: AppColors.primary,
                ),
                label: Text(
                  'Modifier',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  AppIcons.user,
                  size: 28,
                  color: AppColors.muted,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hasInfo ? 'Facturation à' : 'Client',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (name.isNotEmpty)
                      Text(
                        'Nom : $name',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    if (phone.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        'Tél. : $phone',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                    if (!hasInfo)
                      Text(
                        'Aucune information — optionnel',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.muted,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ClientEditSheet extends StatelessWidget {
  const _ClientEditSheet({
    required this.customerCtrl,
    required this.phoneCtrl,
    required this.onSaved,
  });

  final TextEditingController customerCtrl;
  final TextEditingController phoneCtrl;
  final VoidCallback onSaved;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(24, 12, 24, 24 + bottom),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Informations client',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: customerCtrl,
            decoration: const InputDecoration(
              labelText: 'Nom (optionnel)',
              prefixIcon: Icon(AppIcons.user),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: phoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Téléphone (optionnel)',
              prefixIcon: Icon(AppIcons.phone),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () {
              onSaved();
              Navigator.of(context).pop();
            },
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: const Text('Enregistrer'),
          ),
        ],
      ),
    );
  }
}

class _CartBottomSheet extends StatelessWidget {
  const _CartBottomSheet({
    required this.subtotalHt,
    required this.totalTax,
    required this.totalTtc,
    required this.submitting,
    required this.bottomInset,
    required this.onValidate,
  });

  final int subtotalHt;
  final int totalTax;
  final int totalTtc;
  final bool submitting;
  final double bottomInset;
  final VoidCallback onValidate;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(20, 20, 20, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SummaryRow(label: 'Sous-total', amount: subtotalHt),
          const SizedBox(height: 10),
          _SummaryRow(label: 'TVA', amount: totalTax),
          const SizedBox(height: 14),
          const _DashedDivider(),
          const SizedBox(height: 14),
          Row(
            children: [
              Text(
                'Total',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.text,
                ),
              ),
              const Spacer(),
              Text(
                '${formatCdf(totalTtc)} FC',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.text,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Material(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(32),
            elevation: 4,
            shadowColor: AppColors.primary.withValues(alpha: 0.35),
            child: InkWell(
              onTap: submitting ? null : onValidate,
              borderRadius: BorderRadius.circular(32),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 16,
                ),
                child: submitting
                    ? const Center(
                        child: SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        ),
                      )
                    : Row(
                        children: [
                          const Text(
                            'Valider la facture',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${formatCdf(totalTtc)} FC',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedDivider extends StatelessWidget {
  const _DashedDivider();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(
        24,
        (index) => Expanded(
          child: Container(
            height: 1,
            margin: const EdgeInsets.symmetric(horizontal: 3),
            color: index.isEven ? AppColors.border : Colors.transparent,
          ),
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.amount});

  final String label;
  final int amount;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            color: AppColors.muted,
          ),
        ),
        const Spacer(),
        Text(
          '${formatCdf(amount)} FC',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.text,
          ),
        ),
      ],
    );
  }
}

class _CartLineTile extends StatelessWidget {
  const _CartLineTile({
    required this.line,
    required this.onRemove,
    required this.onDecrement,
    required this.onIncrement,
  });

  final CartLine line;
  final VoidCallback onRemove;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  @override
  Widget build(BuildContext context) {
    final maxStock = line.product.availableStock ?? 0;
    final atMax = maxStock > 0 && line.quantity >= maxStock;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: ProductImage(
              name: line.product.name,
              imageUrl: line.product.imageUrl,
              size: 80,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            line.product.name,
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              height: 1.15,
                              color: AppColors.text,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            line.product.sku,
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.1,
                              color: AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(
                        minWidth: 32,
                        minHeight: 32,
                      ),
                      onPressed: onRemove,
                      icon: const Icon(
                        AppIcons.trash,
                        size: 18,
                        color: AppColors.danger,
                      ),
                      tooltip: 'Retirer',
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      '${formatCdf(line.product.unitPrice)} FC',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.text,
                      ),
                    ),
                    const Spacer(),
                    _QtyControl(
                      quantity: line.quantity,
                      canIncrement: !atMax,
                      onDecrement: onDecrement,
                      onIncrement: onIncrement,
                    ),
                  ],
                ),
                if (atMax) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(
                        AppIcons.warning,
                        size: 13,
                        color: AppColors.warning,
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          'Stock max. ($maxStock)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.warning,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QtyControl extends StatelessWidget {
  const _QtyControl({
    required this.quantity,
    required this.onDecrement,
    required this.onIncrement,
    this.canIncrement = true,
  });

  final int quantity;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;
  final bool canIncrement;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _QtySquareButton(
          icon: AppIcons.minus,
          onPressed: onDecrement,
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            '$quantity',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: AppColors.text,
            ),
          ),
        ),
        _QtySquareButton(
          icon: AppIcons.plus,
          filled: true,
          onPressed: canIncrement ? onIncrement : null,
        ),
      ],
    );
  }
}

class _QtySquareButton extends StatelessWidget {
  const _QtySquareButton({
    required this.icon,
    required this.onPressed,
    this.filled = false,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    final bg = filled
        ? (enabled ? AppColors.primary : AppColors.border)
        : AppColors.surfaceMuted;
    final iconColor = filled
        ? (enabled ? Colors.white : AppColors.muted)
        : (enabled ? AppColors.text : AppColors.muted);

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: 32,
          height: 32,
          child: Icon(icon, size: 16, color: iconColor),
        ),
      ),
    );
  }
}