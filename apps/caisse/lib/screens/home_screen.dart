import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/app_empty_state.dart';
import '../widgets/app_home_app_bar.dart';
import '../widgets/app_loading.dart';
import '../widgets/cashier_bottom_nav_bar.dart';
import 'cashier_profile_screen.dart';
import 'cashier_history_screen.dart';
import 'cashier_home_screen.dart';
import 'invoices_screen.dart';
import 'new_invoice_screen.dart';
import 'open_session_screen.dart';
import 'pending_invoices_screen.dart';
import 'pos_select_screen.dart';
import 'session_screen.dart';
import '../services/yoco_print_channel.dart';
import '../theme/app_icons.dart';

enum _HomeTab {
  dashboard,
  newInvoice,
  invoices,
  history,
  pending,
  session,
  profile,
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _tab = 0;
  bool _yocoInitAttempted = false;
  int _pendingBadge = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initYoco();
      _refreshPendingBadge();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      context.read<ApiClient>().ensureSession();
      _refreshPendingBadge();
    }
  }

  List<_HomeTab> _tabsForUser(AppUser user) {
    final tabs = <_HomeTab>[];
    if (user.canCashier) {
      tabs.addAll([
        _HomeTab.dashboard,
        _HomeTab.history,
        _HomeTab.pending,
        _HomeTab.session,
        _HomeTab.profile,
      ]);
    }
    if (user.canInvoice) {
      tabs.insertAll(0, [_HomeTab.newInvoice, _HomeTab.invoices]);
    }
    return tabs;
  }

  int _tabIndex(_HomeTab tab, List<_HomeTab> tabs) => tabs.indexOf(tab);

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

  Future<void> _refreshPendingBadge() async {
    final api = context.read<ApiClient>();
    if (api.user?.canCashier != true) return;
    try {
      final list = await api.searchPendingInvoices('');
      if (!mounted) return;
      setState(() => _pendingBadge = list.length);
    } catch (_) {}
  }

  void _goToTab(_HomeTab tab, List<_HomeTab> tabs) {
    final index = _tabIndex(tab, tabs);
    if (index >= 0) setState(() => _tab = index);
  }

  Widget _bodyForTab(_HomeTab tab, ApiClient api, List<_HomeTab> tabs) {
    switch (tab) {
      case _HomeTab.dashboard:
        return CashierHomeScreen(
          onEncaisser: () => _goToTab(_HomeTab.pending, tabs),
          onSession: () => _goToTab(_HomeTab.session, tabs),
          onVoirHistorique: () => _goToTab(_HomeTab.history, tabs),
          onChangePos: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const PosSelectScreen(fromSettings: true),
              ),
            );
          },
        );
      case _HomeTab.newInvoice:
        return const NewInvoiceScreen();
      case _HomeTab.invoices:
        return const InvoicesScreen();
      case _HomeTab.pending:
        if (api.user?.role == 'CAISSIER' && api.openSession == null) {
          return const OpenSessionScreen(embedded: true);
        }
        return const PendingInvoicesScreen();
      case _HomeTab.history:
        return const CashierHistoryScreen();
      case _HomeTab.session:
        if (api.user?.role == 'CAISSIER' && api.openSession == null) {
          return const OpenSessionScreen(embedded: true);
        }
        return const SessionScreen();
      case _HomeTab.profile:
        return const CashierProfileScreen();
    }
  }

  CashierNavItem? _cashierNavItemForTab(_HomeTab tab) {
    switch (tab) {
      case _HomeTab.dashboard:
        return const CashierNavItem(
          icon: AppIcons.home,
          selectedIcon: AppIcons.home,
          label: 'Accueil',
        );
      case _HomeTab.pending:
        return CashierNavItem(
          icon: AppIcons.caisse,
          selectedIcon: AppIcons.caisse,
          label: 'Encaisser',
          badge: _pendingBadge > 0 ? _pendingBadge : null,
          isCenter: true,
        );
      case _HomeTab.history:
        return const CashierNavItem(
          icon: AppIcons.history,
          selectedIcon: AppIcons.history,
          label: 'Historique',
        );
      case _HomeTab.session:
        return const CashierNavItem(
          icon: AppIcons.wallet,
          selectedIcon: AppIcons.wallet,
          label: 'Session',
        );
      case _HomeTab.profile:
        return const CashierNavItem(
          icon: AppIcons.user,
          selectedIcon: AppIcons.user,
          label: 'Profil',
        );
      default:
        return null;
    }
  }

  NavigationDestination _destinationForTab(_HomeTab tab) {
    switch (tab) {
      case _HomeTab.newInvoice:
        return const NavigationDestination(
          icon: Icon(AppIcons.shoppingCart),
          selectedIcon: Icon(AppIcons.shoppingCart),
          label: 'Nouvelle',
        );
      case _HomeTab.invoices:
        return const NavigationDestination(
          icon: Icon(AppIcons.receipt),
          selectedIcon: Icon(AppIcons.receipt),
          label: 'Factures',
        );
      default:
        return const NavigationDestination(
          icon: Icon(AppIcons.circle),
          label: '—',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiClient>();
    final user = api.user;
    final pos = api.activePos;
    final session = api.openSession;

    if (user == null) {
      return const Scaffold(body: AppLoading());
    }

    final tabs = _tabsForUser(user);
    if (tabs.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('La Colombe')),
        body: const AppEmptyState(
          icon: AppIcons.lock,
          title: 'Accès non autorisé',
          subtitle:
              'Votre compte n\'a pas les permissions nécessaires.\nContactez un administrateur.',
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

    final currentTab = tabs[selectedTab];
    final isCashierTab = currentTab == _HomeTab.dashboard ||
        currentTab == _HomeTab.pending ||
        currentTab == _HomeTab.history ||
        currentTab == _HomeTab.session ||
        currentTab == _HomeTab.profile;
    final showAppBar = !isCashierTab &&
        (currentTab == _HomeTab.newInvoice ||
            currentTab == _HomeTab.invoices);

    final cashierNavItems = tabs
        .map(_cashierNavItemForTab)
        .whereType<CashierNavItem>()
        .toList();
    final useCashierNav = user.canCashier && cashierNavItems.length == tabs.length;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: useCashierNav
          ? AppTheme.statusBarLight
          : SystemUiOverlayStyle.dark,
      child: Scaffold(
      extendBody: useCashierNav,
      appBar: showAppBar
          ? AppHomeAppBar(
              user: user,
              pos: pos,
              session: session,
              onChangePos: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const PosSelectScreen(fromSettings: true),
                  ),
                );
              },
              onLogout: api.logout,
            )
          : null,
      body: Stack(
        fit: StackFit.expand,
        children: [
          IndexedStack(
            index: selectedTab,
            children: tabs.map((t) => _bodyForTab(t, api, tabs)).toList(),
          ),
          if (useCashierNav)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: CashierBottomNavBar(
                items: cashierNavItems,
                selectedIndex: selectedTab,
                onSelected: (i) {
                  setState(() => _tab = i);
                  _refreshPendingBadge();
                },
              ),
            ),
        ],
      ),
      bottomNavigationBar: useCashierNav
          ? null
          : Container(
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: NavigationBar(
                selectedIndex: selectedTab,
                onDestinationSelected: (i) => setState(() => _tab = i),
                destinations: tabs.map(_destinationForTab).toList(),
              ),
            ),
    ),
    );
  }
}
