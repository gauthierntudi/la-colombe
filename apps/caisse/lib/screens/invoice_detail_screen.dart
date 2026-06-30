import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/receipt_print_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/amount_label.dart';
import '../widgets/app_loading.dart';
import '../widgets/message_banner.dart';
import '../widgets/product_image.dart';
import '../widgets/status_badge.dart';
import '../widgets/user_avatar.dart';
import '../theme/app_icons.dart';

class InvoiceDetailScreen extends StatefulWidget {
  const InvoiceDetailScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  State<InvoiceDetailScreen> createState() => _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends State<InvoiceDetailScreen> {
  InvoiceDetail? _invoice;
  PosConfig? _posConfig;
  bool _loading = true;
  bool _processing = false;
  String? _error;
  PayMode _mode = PayMode.cash;
  final _phoneCtrl = TextEditingController();
  String _provider = 'ORANGE';
  String? _pendingPaymentId;
  String? _pendingMessage;
  bool _isMockMm = false;
  Timer? _pollTimer;

  @override
  void dispose() {
    _pollTimer?.cancel();
    _phoneCtrl.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  String _mmProviderLabel(String value) {
    for (final p in mmProviders) {
      if (p.value == value) return p.label;
    }
    return value;
  }

  Future<void> _openMobileMoneySheet() async {
    final result = await showModalBottomSheet<_MobileMoneyResult>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      useSafeArea: false,
      builder: (ctx) => _MobileMoneySheet(
        initialPhone: _phoneCtrl.text,
        initialProvider: _provider,
      ),
    );
    if (result != null && mounted) {
      setState(() {
        _mode = PayMode.mobileMoney;
        _phoneCtrl.text = result.phone;
        _provider = result.provider;
        _error = null;
      });
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final inv = await api.getInvoice(widget.invoiceId);
      final posConfig = await api.getPosConfig();
      setState(() {
        _invoice = inv;
        _posConfig = posConfig;
        _phoneCtrl.text = inv.customerPhone ?? '';
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _printReceipt() async {
    final inv = _invoice;
    if (inv == null || inv.status != 'PAID') return;
    setState(() => _processing = true);
    try {
      final api = context.read<ApiClient>();
      final shop = await api.getShopSettings();
      await ReceiptPrintService.printInvoice(
        invoice: inv,
        shop: shop,
        posConfig: _posConfig,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Impression impossible : $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _onPaymentSuccess({int? changeAmount}) async {
    final inv = _invoice;
    if (inv == null) return;

    await _load();
    if (!mounted) return;

    final updated = _invoice;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(AppIcons.circleCheck, color: Colors.green, size: 48),
        title: const Text('Encaissement réussi'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Facture ${updated?.number ?? inv.number}'),
            Text('${formatCdf(updated?.totalTtc ?? inv.totalTtc)} FC — Payée'),
            if (changeAmount != null && changeAmount > 0)
              Text(
                'Monnaie : ${formatCdf(changeAmount)} FC',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
          ],
        ),
        actions: [
          if (updated?.status == 'PAID')
            TextButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                _printReceipt();
              },
              child: const Text('Imprimer bon'),
            ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );

    if (mounted) Navigator.of(context).pop(true);
  }

  Future<void> _payCash() async {
    final inv = _invoice;
    if (inv == null) return;

    setState(() {
      _processing = true;
      _error = null;
    });

    try {
      await context.read<ApiClient>().payCash(
            invoiceId: inv.id,
            amount: inv.totalTtc,
          );
      await _onPaymentSuccess();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _simulateMm() async {
    if (_pendingPaymentId == null) return;
    setState(() {
      _processing = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      await api.simulateMobileMoney(_pendingPaymentId!);

      _stopPolling();
      setState(() {
        _pendingPaymentId = null;
        _pendingMessage = null;
      });
      await _onPaymentSuccess();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  void _startPolling(String paymentId) {
    _stopPolling();
    _pollTimer = Timer.periodic(const Duration(milliseconds: 2500), (_) async {
      try {
        final status = await context.read<ApiClient>().getPaymentStatus(paymentId);
        if (status.status == 'COMPLETED') {
          _stopPolling();
          if (mounted) {
            setState(() {
              _pendingPaymentId = null;
              _pendingMessage = null;
              _processing = false;
            });
            await _onPaymentSuccess();
          }
        } else if (status.status == 'FAILED') {
          _stopPolling();
          if (mounted) {
            setState(() {
              _error = 'Paiement Mobile Money refusé';
              _pendingPaymentId = null;
              _processing = false;
            });
          }
        }
      } catch (_) {
        // continue polling
      }
    });
  }

  Future<void> _submitPayment() async {
    final inv = _invoice;
    if (inv == null) return;

    setState(() {
      _processing = true;
      _error = null;
    });
    _stopPolling();

    try {
      if (_mode == PayMode.cash) {
        await _payCash();
        return;
      }

      final phone = _phoneCtrl.text.trim();
      if (phone.isEmpty) {
        setState(() => _processing = false);
        await _openMobileMoneySheet();
        return;
      }

      final api = context.read<ApiClient>();
      final mmRes = await api.initiateMobileMoney(
        invoiceId: inv.id,
        amount: inv.totalTtc,
        phone: phone,
        provider: _provider,
      );

      setState(() {
        _pendingPaymentId = mmRes.paymentId;
        _pendingMessage = mmRes.message;
        _isMockMm = mmRes.mock;
        _processing = false;
      });

      if (mmRes.mock) {
        return;
      }

      _startPolling(mmRes.paymentId);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted && _pendingPaymentId == null) {
        setState(() => _processing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('dd/MM/yyyy · HH:mm');

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: AppTheme.statusBarLight,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: _loading
            ? const AppLoading()
            : _error != null && _invoice == null
                ? _ErrorView(message: _error!, onRetry: _load)
                : _invoice == null
                    ? const SizedBox.shrink()
                    : _buildContent(_invoice!, dateFmt),
      ),
    );
  }

  Widget _buildContent(InvoiceDetail inv, DateFormat dateFmt) {
    final api = context.watch<ApiClient>();
    final canPay = inv.status == 'PENDING_PAYMENT' &&
        (api.user?.role != 'CAISSIER' || api.hasOpenSession);
    final waitingMm = _pendingPaymentId != null;

    return Column(
      children: [
        _InvoiceDetailHeader(
          invoice: inv,
          dateFmt: dateFmt,
          onBack: () => Navigator.of(context).pop(),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            children: [
              if (inv.customerName != null || inv.customerPhone != null)
                _CustomerCard(invoice: inv),
              if (inv.customerName != null || inv.customerPhone != null)
                const SizedBox(height: 12),
              _LinesCard(lines: inv.lines),
              const SizedBox(height: 12),
              _TotalsCard(
                subtotalHt: inv.subtotalHt,
                taxAmount: inv.taxAmount,
                totalTtc: inv.totalTtc,
              ),
              if (inv.payments.isNotEmpty) ...[
                const SizedBox(height: 12),
                _PaymentsCard(payments: inv.payments, dateFmt: dateFmt),
              ],
              if (inv.expiresAt != null && inv.status == 'PENDING_PAYMENT') ...[
                const SizedBox(height: 12),
                MessageBanner(
                  message:
                      'Expire le ${dateFmt.format(inv.expiresAt!.toLocal())}',
                  type: MessageBannerType.warning,
                ),
              ],
              if (canPay && !waitingMm) ...[
                const SizedBox(height: 16),
                _buildPaymentFields(inv),
              ],
              if (waitingMm) ...[
                const SizedBox(height: 16),
                _buildMmWaitingContent(),
              ],
            ],
          ),
        ),
        if (canPay && !waitingMm)
          _BottomBar(
            child: FilledButton.icon(
              onPressed: _processing ? null : _submitPayment,
              icon: _processing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Icon(
                      _mode == PayMode.cash
                          ? AppIcons.caisse
                          : AppIcons.smartphone,
                    ),
              label: Text(
                _mode == PayMode.cash
                    ? 'Encaisser ${formatCdf(inv.totalTtc)} FC'
                    : 'Lancer paiement MM',
              ),
            ),
          )
        else if (waitingMm)
          _BottomBar(
            child: _isMockMm
                ? FilledButton.icon(
                    onPressed: _processing ? null : _simulateMm,
                    icon: const Icon(AppIcons.check),
                    label: const Text('Confirmer (mode démo)'),
                  )
                : const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 4),
                      child: CircularProgressIndicator(),
                    ),
                  ),
          )
        else if (inv.status == 'PAID')
          _BottomBar(
            child: FilledButton.icon(
              onPressed: _processing ? null : _printReceipt,
              icon: const Icon(AppIcons.printer),
              label: Text(
                _posConfig?.yocoPrintEnabled == true
                    ? 'Imprimer bon de sortie (Yoco)'
                    : 'Imprimer bon de sortie',
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildMmWaitingContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.infoSoft,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(AppIcons.smartphone, color: AppColors.info, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'En attente Mobile Money',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.text,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                _pendingMessage ?? 'Confirmation en cours...',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
              if (!_isMockMm)
                Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'Vérification automatique du statut...',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.muted,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          MessageBanner(
            message: _error!,
            type: MessageBannerType.error,
            onDismiss: () => setState(() => _error = null),
          ),
        ],
      ],
    );
  }

  Widget _buildPaymentFields(InvoiceDetail inv) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Mode de paiement',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.muted,
          ),
        ),
        const SizedBox(height: 10),
        _PaymentModeSwitch(
          mode: _mode,
          onCashSelected: () => setState(() => _mode = PayMode.cash),
          onMobileMoneyTap: _openMobileMoneySheet,
        ),
        const SizedBox(height: 14),
        _FixedAmountBanner(amount: inv.totalTtc),
        if (_mode == PayMode.mobileMoney) ...[
          const SizedBox(height: 14),
          _MobileMoneySummary(
            phone: _phoneCtrl.text,
            providerLabel: _mmProviderLabel(_provider),
            onTap: _openMobileMoneySheet,
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 10),
          MessageBanner(
            message: _error!,
            type: MessageBannerType.error,
            onDismiss: () => setState(() => _error = null),
          ),
        ],
      ],
    );
  }
}

class _PaymentModeSwitch extends StatelessWidget {
  const _PaymentModeSwitch({
    required this.mode,
    required this.onCashSelected,
    required this.onMobileMoneyTap,
  });

  final PayMode mode;
  final VoidCallback onCashSelected;
  final VoidCallback onMobileMoneyTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _PaymentModeOption(
            label: 'Espèces',
            icon: AppIcons.payments,
            selected: mode == PayMode.cash,
            onTap: onCashSelected,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _PaymentModeOption(
            label: 'Mobile Money',
            icon: AppIcons.smartphone,
            selected: mode == PayMode.mobileMoney,
            onTap: onMobileMoneyTap,
          ),
        ),
      ],
    );
  }
}

class _PaymentModeOption extends StatelessWidget {
  const _PaymentModeOption({
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
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 22,
              color: selected ? Colors.white : AppColors.primary,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: selected ? Colors.white : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MobileMoneyResult {
  const _MobileMoneyResult({required this.phone, required this.provider});

  final String phone;
  final String provider;
}

class _MobileMoneySummary extends StatelessWidget {
  const _MobileMoneySummary({
    required this.phone,
    required this.providerLabel,
    required this.onTap,
  });

  final String phone;
  final String providerLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasPhone = phone.trim().isNotEmpty;

    return Material(
      color: AppColors.tileBackground,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  AppIcons.smartphone,
                  color: AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      providerLabel,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hasPhone ? phone : 'Appuyez pour configurer',
                      style: TextStyle(
                        fontSize: 13,
                        color: hasPhone ? AppColors.textSecondary : AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(AppIcons.chevronRight, size: 20, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

class _MobileMoneySheet extends StatefulWidget {
  const _MobileMoneySheet({
    required this.initialPhone,
    required this.initialProvider,
  });

  final String initialPhone;
  final String initialProvider;

  @override
  State<_MobileMoneySheet> createState() => _MobileMoneySheetState();
}

class _MobileMoneySheetState extends State<_MobileMoneySheet> {
  late final TextEditingController _phoneCtrl;
  late String _provider;
  String? _error;

  @override
  void initState() {
    super.initState();
    _phoneCtrl = TextEditingController(text: widget.initialPhone);
    _provider = widget.initialProvider;
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  void _confirm() {
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      setState(() => _error = 'Indiquez le numéro Mobile Money');
      return;
    }
    Navigator.pop(
      context,
      _MobileMoneyResult(phone: phone, provider: _provider),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final inset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: Container(
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
              'Mobile Money',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.text,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Choisissez l\'opérateur et le numéro à débiter',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              autofocus: widget.initialPhone.trim().isEmpty,
              decoration: const InputDecoration(
                labelText: 'Téléphone Mobile Money',
                hintText: '+243812345678',
                prefixIcon: Icon(AppIcons.phone),
              ),
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
            ),
            const SizedBox(height: 16),
            Text(
              'Opérateur',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.muted,
              ),
            ),
            const SizedBox(height: 8),
            ...mmProviders.map((p) {
              final selected = _provider == p.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: selected
                      ? AppColors.primarySoft
                      : AppColors.tileBackground,
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    onTap: () => setState(() => _provider = p.value),
                    borderRadius: BorderRadius.circular(14),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      child: Row(
                        children: [
                          Icon(
                            AppIcons.smartphone,
                            size: 20,
                            color: selected
                                ? AppColors.primary
                                : AppColors.muted,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              p.label,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppColors.text,
                              ),
                            ),
                          ),
                          if (selected)
                            const Icon(
                              AppIcons.circleCheck,
                              color: AppColors.primary,
                              size: 20,
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
            if (_error != null) ...[
              const SizedBox(height: 4),
              Text(
                _error!,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.danger,
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _confirm,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text(
                'Confirmer',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FixedAmountBanner extends StatelessWidget {
  const _FixedAmountBanner({required this.amount});

  final int amount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          Icon(AppIcons.lock, size: 18, color: AppColors.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Montant à encaisser',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.text,
              ),
            ),
          ),
          Text(
            '${formatCdf(amount)} FC',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.amount,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(AppIcons.error, color: AppColors.danger, size: 48),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 20),
            FilledButton(onPressed: onRetry, child: const Text('Réessayer')),
          ],
        ),
      ),
    );
  }
}

class _InvoiceDetailHeader extends StatelessWidget {
  const _InvoiceDetailHeader({
    required this.invoice,
    required this.dateFmt,
    required this.onBack,
  });

  final InvoiceDetail invoice;
  final DateFormat dateFmt;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    final isPending = invoice.status == 'PENDING_PAYMENT';

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(8, topInset + 8, 20, 24),
      decoration: const BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconButton(
                onPressed: onBack,
                icon: const Icon(AppIcons.arrowLeft, color: Colors.white),
                tooltip: 'Retour',
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            invoice.number,
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        StatusBadge(status: invoice.status),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      dateFmt.format(invoice.createdAt.toLocal()),
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.white.withValues(alpha: 0.78),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            isPending ? 'À encaisser' : 'Montant',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: Colors.white.withValues(alpha: 0.78),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${formatCdf(invoice.totalTtc)} FC',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 34,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -1,
            ),
          ),
        ],
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({required this.invoice});

  final InvoiceDetail invoice;

  @override
  Widget build(BuildContext context) {
    final displayName = invoice.customerName?.trim();
    final hasName = displayName != null && displayName.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          UserAvatarLight(
            name: hasName ? displayName : '?',
            radius: 24,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasName)
                  Text(
                    displayName,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text,
                    ),
                  ),
                if (invoice.customerPhone != null) ...[
                  if (hasName) const SizedBox(height: 4),
                  Text(
                    invoice.customerPhone!,
                    style: TextStyle(
                      fontSize: hasName ? 14 : 16,
                      fontWeight: hasName ? FontWeight.w500 : FontWeight.w700,
                      color: hasName ? AppColors.textSecondary : AppColors.text,
                    ),
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

class _LinesCard extends StatelessWidget {
  const _LinesCard({required this.lines});

  final List<InvoiceLine> lines;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Text(
              'Articles (${lines.length})',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.text,
              ),
            ),
          ),
          Divider(height: 1, color: AppColors.border),
          ...lines.asMap().entries.map((entry) {
            final i = entry.key;
            final line = entry.value;
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ProductImage(
                        name: line.productName,
                        imageUrl: line.imageUrl,
                        size: 48,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              line.productName,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: AppColors.text,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${line.quantity} × ${formatCdf(line.unitPrice)} FC',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      AmountLabel(amount: line.lineTotalTtc, compact: true),
                    ],
                  ),
                ),
                if (i < lines.length - 1)
                  Divider(height: 1, color: AppColors.borderLight),
              ],
            );
          }),
        ],
      ),
    );
  }
}

class _TotalsCard extends StatelessWidget {
  const _TotalsCard({
    required this.subtotalHt,
    required this.taxAmount,
    required this.totalTtc,
  });

  final int subtotalHt;
  final int taxAmount;
  final int totalTtc;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _TotalRow(
            label: 'Sous-total HT',
            value: '${formatCdf(subtotalHt)} FC',
          ),
          const SizedBox(height: 8),
          _TotalRow(label: 'TVA', value: '${formatCdf(taxAmount)} FC'),
          Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: AppColors.border),
          ),
          _TotalRow(
            label: 'Total TTC',
            value: '${formatCdf(totalTtc)} FC',
            emphasized: true,
          ),
        ],
      ),
    );
  }
}

class _PaymentsCard extends StatelessWidget {
  const _PaymentsCard({
    required this.payments,
    required this.dateFmt,
  });

  final List<InvoicePayment> payments;
  final DateFormat dateFmt;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.successSoft,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(AppIcons.circleCheck, color: AppColors.success, size: 18),
              SizedBox(width: 8),
              Text(
                'Paiements reçus',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.success,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...payments.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      paymentMethodLabels[p.method] ?? p.method,
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.text,
                      ),
                    ),
                  ),
                  Text(
                    '${formatCdf(p.amount)} FC',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.text,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        12 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border.withValues(alpha: 0.6))),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: emphasized ? 15 : 14,
              fontWeight: emphasized ? FontWeight.w700 : FontWeight.w500,
              color: emphasized ? AppColors.text : AppColors.textSecondary,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: emphasized ? 18 : 14,
            fontWeight: FontWeight.w700,
            color: emphasized ? AppColors.amount : AppColors.text,
          ),
        ),
      ],
    );
  }
}
