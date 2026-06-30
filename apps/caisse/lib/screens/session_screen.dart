import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../widgets/cashier_screen_header.dart';
import '../widgets/message_banner.dart';
import 'open_session_screen.dart';
import 'pos_select_screen.dart';
import '../theme/app_icons.dart';

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
        icon: Icon(AppIcons.store,
            color: Colors.white.withValues(alpha: 0.9)),
        tooltip: 'Changer de site',
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiClient>();
    final session = api.openSession;
    final dateFmt = DateFormat('dd/MM/yyyy HH:mm');

    if (_closedSummary != null) {
      return _ClosedSummaryView(
        summary: _closedSummary!,
        onNewSession: () {
          setState(() => _closedSummary = null);
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const OpenSessionScreen()),
          );
        },
      );
    }

    if (session == null) {
      return ColoredBox(
        color: AppColors.background,
        child: Column(
          children: [
            CashierScreenHeader(
              title: 'Session',
              actions: _headerActions(context),
            ),
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(
                          AppIcons.wallet,
                          size: 36,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Aucune session ouverte',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Ouvrez une session pour commencer à encaisser.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted),
                      ),
                      const SizedBox(height: 24),
                      FilledButton.icon(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const OpenSessionScreen(),
                            ),
                          );
                        },
                        icon: const Icon(AppIcons.lockOpen),
                        label: const Text('Ouvrir une session'),
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

    final expected = session.openingCash + session.totalSales;

    return ColoredBox(
      color: AppColors.background,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          CashierScreenHeader(
            title: 'Session',
            badge: 'Ouverte',
            actions: _headerActions(context),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  Text(
                    'Caisse attendue',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.white.withValues(alpha: 0.78),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${formatCdf(expected)} FC',
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Depuis ${dateFmt.format(session.openedAt.toLocal())}',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white.withValues(alpha: 0.68),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  _statTile(
                    icon: AppIcons.piggyBank,
                    label: 'Fond initial',
                    value: '${formatCdf(session.openingCash)} FC',
                  ),
                  const Divider(height: 24),
                  _statTile(
                    icon: AppIcons.caisse,
                    label: 'Ventes encaissées',
                    value: '${formatCdf(session.totalSales)} FC',
                    highlight: true,
                  ),
                  const Divider(height: 24),
                  _statTile(
                    icon: AppIcons.receipt,
                    label: 'Nombre de factures',
                    value: '${session.invoiceCount}',
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(
              'Clôture de caisse',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _closingCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                labelText: 'Montant compté en caisse',
                suffixText: 'FC',
                prefixIcon: const Icon(AppIcons.calculator),
                helperText: 'Attendu : ${formatCdf(expected)} FC',
                filled: true,
                fillColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _notesCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Notes (optionnel)',
                prefixIcon: Icon(AppIcons.fileText),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: MessageBanner(
                message: _error!,
                type: MessageBannerType.error,
                onDismiss: () => setState(() => _error = null),
              ),
            ),
          ],
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
            child: FilledButton.icon(
              onPressed: _closing ? null : () => _closeSession(session),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.danger,
                minimumSize: const Size.fromHeight(52),
              ),
              icon: _closing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(AppIcons.lock),
              label: const Text('Clôturer la session'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statTile({
    required IconData icon,
    required String label,
    required String value,
    bool highlight = false,
  }) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: highlight ? AppColors.primarySoft : AppColors.borderLight,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            icon,
            size: 20,
            color: highlight ? AppColors.primary : AppColors.muted,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: highlight ? 15 : 14,
            color: highlight ? AppColors.primary : AppColors.text,
          ),
        ),
      ],
    );
  }
}

class _ClosedSummaryView extends StatelessWidget {
  const _ClosedSummaryView({
    required this.summary,
    required this.onNewSession,
  });

  final CashSession summary;
  final VoidCallback onNewSession;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.background,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.successSoft,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(
                  AppIcons.circleCheck,
                  size: 40,
                  color: AppColors.success,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Session clôturée',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    _summaryRow('Ventes', '${formatCdf(summary.totalSales)} FC'),
                    _summaryRow('Factures', '${summary.invoiceCount}'),
                    if (summary.cashVariance != null)
                      _summaryRow(
                        'Écart caisse',
                        '${formatCdf(summary.cashVariance!)} FC',
                        valueColor: summary.cashVariance == 0
                            ? AppColors.success
                            : AppColors.warning,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: onNewSession,
                child: const Text('Nouvelle session'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _summaryRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: valueColor ?? AppColors.text,
            ),
          ),
        ],
      ),
    );
  }
}
