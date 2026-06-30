import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../widgets/message_banner.dart';
import 'home_screen.dart';
import '../theme/app_icons.dart';

class OpenSessionScreen extends StatefulWidget {
  const OpenSessionScreen({super.key, this.embedded = false});

  /// Affiché dans un onglet sans AppBar dédiée.
  final bool embedded;

  @override
  State<OpenSessionScreen> createState() => _OpenSessionScreenState();
}

class _OpenSessionScreenState extends State<OpenSessionScreen> {
  final _openingCtrl = TextEditingController(text: '50000');
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _openingCtrl.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    final amount = int.tryParse(_openingCtrl.text.replaceAll(' ', '')) ?? 0;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<ApiClient>().openCashSession(openingCash: amount);
      if (!mounted) return;
      if (widget.embedded) {
        setState(() => _loading = false);
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted && !widget.embedded) setState(() => _loading = false);
      if (mounted && widget.embedded && _error != null) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pos = context.watch<ApiClient>().activePos;

    final content = Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!widget.embedded) const SizedBox.shrink(),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(AppIcons.lockOpen, color: Colors.white),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ouvrir la caisse',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Comptez le fond initial avant d\'encaisser',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          if (pos != null)
            Card(
              child: ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(AppIcons.store, color: AppColors.primary),
                ),
                title: Text(pos.name),
                subtitle: Text(pos.code),
              ),
            ),
          const SizedBox(height: 20),
          Text(
            'Fond de caisse initial',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _openingCtrl,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(
              suffixText: 'FC',
              hintText: '0',
              prefixIcon: Icon(AppIcons.caisse),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            MessageBanner(
              message: _error!,
              type: MessageBannerType.error,
              onDismiss: () => setState(() => _error = null),
            ),
          ],
          const Spacer(),
          FilledButton.icon(
            onPressed: _loading ? null : _open,
            icon: _loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(AppIcons.lockOpen),
            label: const Text('Ouvrir la session'),
          ),
        ],
      ),
    );

    if (widget.embedded) {
      return content;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Ouvrir la caisse')),
      body: content,
    );
  }
}
