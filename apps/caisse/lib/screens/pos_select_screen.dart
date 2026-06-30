import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../widgets/app_empty_state.dart';
import 'home_screen.dart';
import '../theme/app_icons.dart';

class PosSelectScreen extends StatelessWidget {
  const PosSelectScreen({super.key, this.fromSettings = false});

  final bool fromSettings;

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiClient>();
    final stores = api.user?.storePoints ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Point de vente'),
        automaticallyImplyLeading: fromSettings,
      ),
      body: stores.isEmpty
          ? const AppEmptyState(
              icon: AppIcons.store,
              title: 'Aucun magasin assigné',
              subtitle: 'Contactez un administrateur pour obtenir l\'accès.',
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: stores.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
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
      child: InkWell(
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
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryDark],
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: Text(
                    pos.code.length >= 2
                        ? pos.code.substring(0, 2).toUpperCase()
                        : pos.code.toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pos.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      pos.code,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Icon(
                AppIcons.chevronRight,
                size: 16,
                color: AppColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
