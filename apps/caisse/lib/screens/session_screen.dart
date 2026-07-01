import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../widgets/cashier_bottom_nav_bar.dart';
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

  Future<bool> _confirmClosure(int closingCash, int expectedCash) async {
    final variance = closingCash - expectedCash;
    if (variance == 0) return true;

    final message = variance > 0
        ? 'Vous avez compté ${formatCdf(variance)} FC de plus que les espèces '
            'attendues (${formatCdf(expectedCash)} FC).\n\n'
            'Confirmer la clôture avec cet excédent ?'
        : 'Il manque ${formatCdf(-variance)} FC par rapport aux espèces '
            'attendues (${formatCdf(expectedCash)} FC).\n\n'
            'Confirmer la clôture malgré ce manque ?';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(variance > 0 ? 'Excédent de caisse' : 'Manque en caisse'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Corriger'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirmer'),
          ),
        ],
      ),
    );

    return confirmed ?? false;
  }

  Future<void> _closeSession(CashSession session) async {
    final amount = int.tryParse(_closingCtrl.text.replaceAll(' ', ''));
    if (amount == null) {
      setState(() => _error = 'Montant de clôture invalide');
      return;
    }

    final expectedCash = session.expectedCashInDrawer;
    final confirmed = await _confirmClosure(amount, expectedCash);
    if (!confirmed) return;

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
                  padding: EdgeInsets.fromLTRB(
                    32,
                    32,
                    32,
                    32 + cashierBottomNavHeight(context),
                  ),
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
                      Text(
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

    final expectedCash = session.expectedCashInDrawer;
    final cashCollected = session.cashCollected ?? 0;
    final navInset = cashierBottomNavHeight(context);

    return ColoredBox(
      color: AppColors.background,
      child: Column(
        children: [
          CashierScreenHeader(
            title: 'Session',
            badge: 'Ouverte',
            actions: _headerActions(context),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(top: 20),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
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
                          'Espèces attendues',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.white.withValues(alpha: 0.78),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              'FC',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Colors.white.withValues(alpha: 0.75),
                                letterSpacing: 0.4,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              formatCdf(expectedCash),
                              style: TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                                letterSpacing: -0.5,
                                height: 1,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Fond initial + encaissements espèces',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.white.withValues(alpha: 0.68),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Depuis ${dateFmt.format(session.openedAt.toLocal())}',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withValues(alpha: 0.55),
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
                      color: AppColors.surface,
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
                          label: 'Espèces encaissées',
                          value: '${formatCdf(cashCollected)} FC',
                          highlight: true,
                        ),
                        if (session.totalMobileMoney > 0) ...[
                          const Divider(height: 24),
                          _statTile(
                            icon: AppIcons.smartphone,
                            label: 'Mobile Money',
                            value: '${formatCdf(session.totalMobileMoney)} FC',
                          ),
                        ],
                        const Divider(height: 24),
                        _statTile(
                          icon: AppIcons.receipt,
                          label: 'Ventes totales',
                          value: '${formatCdf(session.totalSales)} FC',
                        ),
                        const Divider(height: 24),
                        _statTile(
                          icon: AppIcons.fileText,
                          label: 'Nombre de factures',
                          value: '${session.invoiceCount}',
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Clôture de caisse',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.text,
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _closingCtrl,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                          ],
                          decoration: InputDecoration(
                            labelText: 'Montant compté en caisse',
                            suffixText: 'FC',
                            prefixIcon: const Icon(AppIcons.calculator),
                            helperText: 'Espèces attendues : ${formatCdf(expectedCash)} FC',
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _notesCtrl,
                          maxLines: 2,
                          decoration: InputDecoration(
                            labelText: 'Notes (optionnel)',
                            prefixIcon: Icon(AppIcons.fileText),
                          ),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          MessageBanner(
                            message: _error!,
                            type: MessageBannerType.error,
                            onDismiss: () => setState(() => _error = null),
                          ),
                        ],
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed:
                              _closing ? null : () => _closeSession(session),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.danger,
                            minimumSize: const Size.fromHeight(52),
                          ),
                          icon: _closing
                              ? SizedBox(
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
                      ],
                    ),
                  ),
                ),
                SizedBox(height: 20 + navInset),
              ],
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
    final navInset = cashierBottomNavHeight(context);

    return ColoredBox(
      color: AppColors.background,
      child: Center(
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + navInset),
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
                    if (summary.expectedCash != null)
                      _summaryRow(
                        'Espèces attendues',
                        '${formatCdf(summary.expectedCash!)} FC',
                      ),
                    if (summary.closingCash != null)
                      _summaryRow(
                        'Espèces comptées',
                        '${formatCdf(summary.closingCash!)} FC',
                      ),
                    _summaryRow('Ventes totales', '${formatCdf(summary.totalSales)} FC'),
                    _summaryRow('Factures', '${summary.invoiceCount}'),
                    if (summary.cashVariance != null && summary.cashVariance != 0)
                      _summaryRow(
                        summary.cashVariance! > 0
                            ? 'Excédent caisse'
                            : 'Manque caisse',
                        '${formatCdf(summary.cashVariance!.abs())} FC',
                        valueColor: summary.cashVariance! > 0
                            ? AppColors.warning
                            : AppColors.danger,
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
