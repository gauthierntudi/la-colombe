import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import 'home_screen.dart';

class OpenSessionScreen extends StatefulWidget {
  const OpenSessionScreen({super.key});

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
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pos = context.watch<ApiClient>().activePos;

    return Scaffold(
      appBar: AppBar(title: const Text('Ouvrir la caisse')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (pos != null)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.store),
                  title: Text(pos.name),
                  subtitle: Text(pos.code),
                ),
              ),
            const SizedBox(height: 24),
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
                border: OutlineInputBorder(),
                hintText: '0',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const Spacer(),
            FilledButton.icon(
              onPressed: _loading ? null : _open,
              icon: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.lock_open),
              label: const Text('Ouvrir la session'),
            ),
          ],
        ),
      ),
    );
  }
}
