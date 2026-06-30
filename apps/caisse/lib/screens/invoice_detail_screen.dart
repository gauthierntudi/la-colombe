import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/receipt_print_service.dart';

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
  final _cashCtrl = TextEditingController();
  final _mmCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  String _provider = 'ORANGE';
  String? _pendingPaymentId;
  String? _pendingMessage;
  bool _isMockMm = false;
  Timer? _pollTimer;

  @override
  void dispose() {
    _pollTimer?.cancel();
    _cashCtrl.dispose();
    _mmCtrl.dispose();
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
        _cashCtrl.text = inv.totalTtc.toString();
        _mmCtrl.text = inv.totalTtc.toString();
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
        icon: const Icon(Icons.check_circle, color: Colors.green, size: 48),
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
                style: const TextStyle(fontWeight: FontWeight.bold),
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

    final amount = int.tryParse(_cashCtrl.text.replaceAll(' ', ''));
    if (amount == null || amount < inv.totalTtc) {
      setState(() => _error = 'Montant insuffisant (min. ${formatCdf(inv.totalTtc)} FC)');
      return;
    }

    setState(() {
      _processing = true;
      _error = null;
    });

    try {
      await context.read<ApiClient>().payCash(invoiceId: inv.id, amount: amount);
      await _onPaymentSuccess(changeAmount: amount - inv.totalTtc);
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

      if (_mode == PayMode.mixed) {
        final inv = _invoice!;
        final cash = int.tryParse(_cashCtrl.text.replaceAll(' ', '')) ?? 0;
        final mm = int.tryParse(_mmCtrl.text.replaceAll(' ', '')) ?? 0;
        await api.payPayments(
          invoiceId: inv.id,
          payments: [
            {'method': 'CASH', 'amount': cash},
            {'method': 'MOBILE_MONEY', 'amount': mm, 'paymentId': _pendingPaymentId},
          ],
        );
      }

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
          if (_mode == PayMode.mixed) {
            if (!mounted) return;
            setState(() => _processing = true);
            try {
              final inv = _invoice!;
              final cash = int.tryParse(_cashCtrl.text.replaceAll(' ', '')) ?? 0;
              final mm = int.tryParse(_mmCtrl.text.replaceAll(' ', '')) ?? 0;
              await context.read<ApiClient>().payPayments(
                    invoiceId: inv.id,
                    payments: [
                      {'method': 'CASH', 'amount': cash},
                      {'method': 'MOBILE_MONEY', 'amount': mm, 'paymentId': paymentId},
                    ],
                  );
              if (mounted) {
                setState(() {
                  _pendingPaymentId = null;
                  _pendingMessage = null;
                });
                await _onPaymentSuccess();
              }
            } on ApiException catch (e) {
              if (mounted) setState(() => _error = e.message);
            } finally {
              if (mounted) setState(() => _processing = false);
            }
          } else {
            if (mounted) {
              setState(() {
                _pendingPaymentId = null;
                _pendingMessage = null;
                _processing = false;
              });
              await _onPaymentSuccess();
            }
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

      final mm = int.tryParse(_mmCtrl.text.replaceAll(' ', '')) ?? 0;
      final phone = _phoneCtrl.text.trim();
      if (mm <= 0 || phone.isEmpty) {
        throw ApiException('Montant et téléphone Mobile Money requis');
      }

      if (_mode == PayMode.mixed) {
        final cash = int.tryParse(_cashCtrl.text.replaceAll(' ', '')) ?? 0;
        if (cash + mm < inv.totalTtc) {
          throw ApiException(
            'Total insuffisant (${formatCdf(cash + mm)} sur ${formatCdf(inv.totalTtc)} FC)',
          );
        }
      } else if (mm < inv.totalTtc) {
        throw ApiException('Montant MM insuffisant');
      }

      final api = context.read<ApiClient>();
      final mmRes = await api.initiateMobileMoney(
        invoiceId: inv.id,
        amount: mm,
        phone: phone,
        provider: _provider,
      );

      setState(() {
        _pendingPaymentId = mmRes.paymentId;
        _pendingMessage = mmRes.message;
        _isMockMm = mmRes.mock;
        _processing = mmRes.mock && _mode == PayMode.mixed;
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
    final dateFmt = DateFormat('dd/MM/yyyy HH:mm');

    return Scaffold(
      appBar: AppBar(title: Text(_invoice?.number ?? 'Facture')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _invoice == null
              ? Center(child: Text(_error!))
              : _invoice == null
                  ? const SizedBox.shrink()
                  : _buildContent(_invoice!, dateFmt),
    );
  }

  Widget _buildContent(InvoiceDetail inv, DateFormat dateFmt) {
    final api = context.watch<ApiClient>();
    final canPay = inv.status == 'PENDING_PAYMENT' &&
        (api.user?.role != 'CAISSIER' || api.hasOpenSession);
    final waitingMm = _pendingPaymentId != null;

    return Column(
      children: [
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
                        inv.number,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      Text(
                        invoiceStatusLabels[inv.status] ?? inv.status,
                        style: TextStyle(
                          color: inv.status == 'PENDING_PAYMENT'
                              ? Colors.orange.shade800
                              : Colors.grey,
                        ),
                      ),
                      if (inv.customerName != null) Text('Client : ${inv.customerName}'),
                      if (inv.customerPhone != null) Text('Tél. : ${inv.customerPhone}'),
                      Text('Créée : ${dateFmt.format(inv.createdAt.toLocal())}'),
                      if (inv.expiresAt != null)
                        Text(
                          'Expire : ${dateFmt.format(inv.expiresAt!.toLocal())}',
                          style: TextStyle(color: Colors.red.shade700),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              ...inv.lines.map(
                (l) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l.productName),
                  subtitle: Text('${l.quantity} × ${formatCdf(l.unitPrice)} FC'),
                  trailing: Text('${formatCdf(l.lineTotalTtc)} FC'),
                ),
              ),
              const Divider(height: 32),
              _totalRow('Total TTC', inv.totalTtc, bold: true),
            ],
          ),
        ),
        if (canPay && !waitingMm)
          SafeArea(child: _buildPaymentForm(inv))
        else if (waitingMm)
          SafeArea(child: _buildMmWaiting())
        else if (inv.status == 'PAID')
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: FilledButton.icon(
                onPressed: _processing ? null : _printReceipt,
                icon: const Icon(Icons.print_outlined),
                label: Text(
                  _posConfig?.yocoPrintEnabled == true
                      ? 'Imprimer bon de sortie (Yoco)'
                      : 'Imprimer bon de sortie',
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildMmWaiting() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            color: Theme.of(context).colorScheme.primaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'En attente Mobile Money',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(_pendingMessage ?? 'Confirmation en cours...'),
                  if (!_isMockMm)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text(
                        'Vérification automatique du statut...',
                        style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic),
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          const SizedBox(height: 12),
          if (_isMockMm)
            FilledButton.icon(
              onPressed: _processing ? null : _simulateMm,
              icon: const Icon(Icons.check),
              label: const Text('Confirmer (mode démo)'),
            )
          else
            const Center(child: CircularProgressIndicator()),
        ],
      ),
    );
  }

  Widget _buildPaymentForm(InvoiceDetail inv) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Total : ${formatCdf(inv.totalTtc)} FC',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          SegmentedButton<PayMode>(
            segments: const [
              ButtonSegment(
                value: PayMode.cash,
                icon: Icon(Icons.payments_outlined),
                label: Text('Espèces'),
              ),
              ButtonSegment(
                value: PayMode.mobileMoney,
                icon: Icon(Icons.smartphone),
                label: Text('MM'),
              ),
              ButtonSegment(
                value: PayMode.mixed,
                icon: Icon(Icons.sync_alt),
                label: Text('Mixte'),
              ),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => setState(() => _mode = s.first),
          ),
          const SizedBox(height: 16),
          if (_mode == PayMode.cash || _mode == PayMode.mixed)
            TextField(
              controller: _cashCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                labelText: _mode == PayMode.mixed ? 'Montant espèces' : 'Montant reçu',
                suffixText: 'FC',
                border: const OutlineInputBorder(),
              ),
            ),
          if (_mode == PayMode.mobileMoney || _mode == PayMode.mixed) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _mmCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: 'Montant Mobile Money',
                suffixText: 'FC',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Téléphone Mobile Money',
                border: OutlineInputBorder(),
                hintText: '+243812345678',
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _provider,
              decoration: const InputDecoration(
                labelText: 'Opérateur',
                border: OutlineInputBorder(),
              ),
              items: mmProviders
                  .map((p) => DropdownMenuItem(value: p.value, child: Text(p.label)))
                  .toList(),
              onChanged: (v) {
                if (v != null) setState(() => _provider = v);
              },
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _processing ? null : _submitPayment,
            icon: _processing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(_mode == PayMode.cash ? Icons.payments_outlined : Icons.smartphone),
            label: Text(_mode == PayMode.cash ? 'Encaisser espèces' : 'Lancer paiement'),
          ),
        ],
      ),
    );
  }

  Widget _totalRow(String label, int amount, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(
            '${formatCdf(amount)} FC',
            style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal),
          ),
        ],
      ),
    );
  }
}
