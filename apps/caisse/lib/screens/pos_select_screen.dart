import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import 'home_screen.dart';

class PosSelectScreen extends StatelessWidget {
  const PosSelectScreen({super.key, this.fromSettings = false});

  final bool fromSettings;

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiClient>();
    final stores = api.user?.storePoints ?? [];

    return Scaffold(
      appBar: AppBar(title: const Text('Point de vente')),
      body: stores.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Aucun magasin assigné à votre compte.\nContactez un administrateur.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: stores.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                return _PosTile(
                  pos: stores[index],
                  fromSettings: fromSettings,
                );
              },
            ),
    );
  }
}

class _PosTile extends StatelessWidget {
  const _PosTile({required this.pos, required this.fromSettings});

  final PointOfSale pos;
  final bool fromSettings;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          child: Text(pos.code.substring(0, pos.code.length.clamp(0, 2))),
        ),
        title: Text(pos.name),
        subtitle: Text(pos.code),
        trailing: const Icon(Icons.chevron_right),
        onTap: () async {
          final api = context.read<ApiClient>();
          await api.setActivePos(pos);
          if (!context.mounted) return;
          if (fromSettings) {
            Navigator.of(context).pop();
          } else {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const HomeScreen()),
            );
          }
        },
      ),
    );
  }
}
