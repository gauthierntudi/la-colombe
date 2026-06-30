import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/yoco_print_channel.dart';
import 'invoices_screen.dart';
import 'new_invoice_screen.dart';
import 'open_session_screen.dart';
import 'pending_invoices_screen.dart';
import 'pos_select_screen.dart';
import 'session_screen.dart';

enum _HomeTab { newInvoice, invoices, pending, session }

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  bool _yocoInitAttempted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initYoco());
  }

  List<_HomeTab> _tabsForUser(AppUser user) {
    final tabs = <_HomeTab>[];
    if (user.canInvoice) {
      tabs.addAll([_HomeTab.newInvoice, _HomeTab.invoices]);
    }
    if (user.canCashier) {
      tabs.addAll([_HomeTab.pending, _HomeTab.session]);
    }
    return tabs;
  }

  Future<void> _initYoco() async {
    if (_yocoInitAttempted) return;
    _yocoInitAttempted = true;
    final api = context.read<ApiClient>();
    if (api.user?.canCashier != true) return;
    try {
      final posConfig = await api.getPosConfig();
      if (!posConfig.yocoPrintEnabled) return;
      final yocoConfig = await api.getYocoSdkConfig();
      if (yocoConfig != null) {
        await YocoPrintChannel.configure(yocoConfig);
      }
    } catch (_) {
      // Repli PDF si Yoco indisponible
    }
  }

  Widget _bodyForTab(_HomeTab tab, ApiClient api) {
    switch (tab) {
      case _HomeTab.newInvoice:
        return const NewInvoiceScreen();
      case _HomeTab.invoices:
        return const InvoicesScreen();
      case _HomeTab.pending:
        if (api.user?.role == 'CAISSIER' && api.openSession == null) {
          return const OpenSessionScreen();
        }
        return const PendingInvoicesScreen();
      case _HomeTab.session:
        if (api.user?.role == 'CAISSIER' && api.openSession == null) {
          return const OpenSessionScreen();
        }
        return const SessionScreen();
    }
  }

  NavigationDestination _destinationForTab(_HomeTab tab) {
    switch (tab) {
      case _HomeTab.newInvoice:
        return const NavigationDestination(
          icon: Icon(Icons.add_shopping_cart_outlined),
          selectedIcon: Icon(Icons.add_shopping_cart),
          label: 'Nouvelle',
        );
      case _HomeTab.invoices:
        return const NavigationDestination(
          icon: Icon(Icons.receipt_outlined),
          selectedIcon: Icon(Icons.receipt),
          label: 'Factures',
        );
      case _HomeTab.pending:
        return const NavigationDestination(
          icon: Icon(Icons.receipt_long_outlined),
          selectedIcon: Icon(Icons.receipt_long),
          label: 'En attente',
        );
      case _HomeTab.session:
        return const NavigationDestination(
          icon: Icon(Icons.account_balance_wallet_outlined),
          selectedIcon: Icon(Icons.account_balance_wallet),
          label: 'Session',
        );
    }
  }

  String _roleLabel(AppUser user) {
    if (user.canInvoice && user.canCashier) return 'Facturation & caisse';
    if (user.canInvoice) return 'Facturation';
    return 'Caisse';
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiClient>();
    final user = api.user;
    final pos = api.activePos;
    final session = api.openSession;

    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final tabs = _tabsForUser(user);
    if (tabs.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('La Colombe')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Votre compte n\'a pas les permissions nécessaires.\nContactez un administrateur.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final selectedTab = _tab.clamp(0, tabs.length - 1);
    if (selectedTab != _tab) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _tab = selectedTab);
      });
    }

    final isCashierOnly = user.canCashier && !user.canInvoice;
    if (isCashierOnly && session == null) {
      return const OpenSessionScreen();
    }

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('La Colombe', style: TextStyle(fontSize: 16)),
            Text(
              '${_roleLabel(user)}${pos != null ? ' · ${pos.name}' : ''}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        actions: [
          if (session != null && user.canCashier)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Chip(
                avatar: const Icon(Icons.lock_open, size: 16),
                label: Text('${session.invoiceCount} ventes'),
              ),
            ),
          IconButton(
            tooltip: 'Changer de site',
            icon: const Icon(Icons.store_outlined),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const PosSelectScreen(fromSettings: true),
                ),
              );
            },
          ),
          IconButton(
            tooltip: 'Déconnexion',
            icon: const Icon(Icons.logout),
            onPressed: () => api.logout(),
          ),
        ],
      ),
      body: IndexedStack(
        index: selectedTab,
        children: tabs.map((t) => _bodyForTab(t, api)).toList(),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedTab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: tabs.map(_destinationForTab).toList(),
      ),
    );
  }
}
