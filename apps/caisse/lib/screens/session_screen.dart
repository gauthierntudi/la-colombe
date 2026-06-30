import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import 'open_session_screen.dart';

class SessionScreen extends StatefulWidget {
  const SessionScreen({super.key});

  @override
  State<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends State<SessionScreen> {
  final _closingCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _closing = false;
  String? _error;
  CashSession? _closedSummary;

  @override
  void dispose() {
    _closingCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _closeSession(CashSession session) async {
    final amount = int.tryParse(_closingCtrl.text.replaceAll(' ', ''));
    if (amount == null) {
      setState(() => _error = 'Montant de clôture invalide');
      return;
    }

    setState(() {
      _closing = true;
      _error = null;
    });

    try {
      final closed = await context.read<ApiClient>().closeSession(
            sessionId: session.id,
            closingCash: amount,
            notes: _notesCtrl.text.trim(),
          );
      setState(() => _closedSummary = closed);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _closing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiClient>();
    final session = api.openSession;
    final dateFmt = DateFormat('dd/MM/yyyy HH:mm');

    if (_closedSummary != null) {
      final s = _closedSummary!;
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle, size: 64, color: Colors.green.shade600),
              const SizedBox(height: 16),
              Text(
                'Session clôturée',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 16),
              Text('Ventes : ${formatCdf(s.totalSales)} FC'),
              Text('Factures : ${s.invoiceCount}'),
              if (s.cashVariance != null)
                Text(
                  'Écart caisse : ${formatCdf(s.cashVariance!)} FC',
                  style: TextStyle(
                    color: s.cashVariance == 0 ? Colors.green : Colors.orange,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () {
                  setState(() => _closedSummary = null);
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(builder: (_) => const OpenSessionScreen()),
                  );
                },
                child: const Text('Nouvelle session'),
              ),
            ],
          ),
        ),
      );
    }

    if (session == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Aucune session ouverte'),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const OpenSessionScreen()),
                );
              },
              child: const Text('Ouvrir une session'),
            ),
          ],
        ),
      );
    }

    final expected = session.openingCash + session.totalSales;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.lock_open, color: Theme.of(context).colorScheme.primary),
                    const SizedBox(width: 8),
                    Text(
                      'Session ouverte',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _row('Ouverte le', dateFmt.format(session.openedAt.toLocal())),
                _row('Fond initial', '${formatCdf(session.openingCash)} FC'),
                _row('Ventes encaissées', '${formatCdf(session.totalSales)} FC'),
                _row('Nombre de factures', '${session.invoiceCount}'),
                const Divider(height: 24),
                _row(
                  'Caisse attendue (espèces)',
                  '${formatCdf(expected)} FC',
                  bold: true,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'Clôture de caisse',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _closingCtrl,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(
            labelText: 'Montant compté en caisse',
            suffixText: 'FC',
            border: const OutlineInputBorder(),
            helperText: 'Attendu : ${formatCdf(expected)} FC',
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _notesCtrl,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'Notes (optionnel)',
            border: OutlineInputBorder(),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _closing ? null : () => _closeSession(session),
          style: FilledButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
          icon: _closing
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.lock),
          label: const Text('Clôturer la session'),
        ),
      ],
    );
  }

  Widget _row(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(
            value,
            style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal),
          ),
        ],
      ),
    );
  }
}
