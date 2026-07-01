import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/receipt_print_tracker.dart';
import '../services/theme_service.dart';
import '../theme/app_palette.dart';
import '../widgets/app_empty_state.dart';
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
  int _invoicePendingBadge = 0;
  bool _invoiceCartHasItems = false;
  String? _invoicesFocusFilter;

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
    if (user.canInvoice && !user.canCashier) {
      tabs.add(_HomeTab.profile);
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
    final canCashier = api.user?.canCashier == true;
    final canInvoice = api.user?.canInvoice == true;
    if (!canCashier && !canInvoice) return;
    try {
      final pending = await api.searchPendingInvoices('');
      var cashierBadge = pending.length;
      if (canCashier) {
        final tracker = context.read<ReceiptPrintTracker>();
        final paidToday = await api.listPaidInvoicesToday();
        final toPrint =
            paidToday.where((inv) => !tracker.isPrinted(inv.id)).length;
        cashierBadge = pending.length + toPrint;
      }
      if (!mounted) return;
      setState(() {
        _invoicePendingBadge = pending.length;
        _pendingBadge = cashierBadge;
      });
    } catch (_) {}
  }

  void _openPendingInvoices(List<_HomeTab> tabs) {
    setState(() => _invoicesFocusFilter = 'pending');
    _goToTab(_HomeTab.invoices, tabs);
  }

  void _goToTab(_HomeTab tab, List<_HomeTab> tabs) {
    final index = _tabIndex(tab, tabs);
    if (index >= 0) setState(() => _tab = index);
  }

  Widget _bodyForTab(
    _HomeTab tab,
    ApiClient api,
    List<_HomeTab> tabs,
    _HomeTab currentTab,
  ) {
    switch (tab) {
      case _HomeTab.dashboard:
        return CashierHomeScreen(
          isActive: currentTab == _HomeTab.dashboard,
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
        return NewInvoiceScreen(
          isActive: currentTab == _HomeTab.newInvoice,
          onCartNotEmptyChanged: (hasItems) {
            if (_invoiceCartHasItems != hasItems) {
              setState(() => _invoiceCartHasItems = hasItems);
            }
          },
          onViewPending: () => _openPendingInvoices(tabs),
        );
      case _HomeTab.invoices:
        return InvoicesScreen(
          isActive: currentTab == _HomeTab.invoices,
          focusFilter: _invoicesFocusFilter,
          onFocusFilterHandled: () {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted || _invoicesFocusFilter == null) return;
              setState(() => _invoicesFocusFilter = null);
            });
          },
        );
      case _HomeTab.pending:
        if (api.user?.role == 'CAISSIER' && api.openSession == null) {
          return OpenSessionScreen(embedded: true);
        }
        return PendingInvoicesScreen(
          isActive: currentTab == _HomeTab.pending,
        );
      case _HomeTab.history:
        return CashierHistoryScreen(
          isActive: currentTab == _HomeTab.history,
        );
      case _HomeTab.session:
        if (api.user?.role == 'CAISSIER' && api.openSession == null) {
          return OpenSessionScreen(embedded: true);
        }
        return SessionScreen();
      case _HomeTab.profile:
        return CashierProfileScreen();
    }
  }

  CashierNavItem _cashierNavItemForTab(_HomeTab tab) {
    switch (tab) {
      case _HomeTab.newInvoice:
        return const CashierNavItem(
          icon: AppIcons.shoppingCart,
          selectedIcon: AppIcons.shoppingCart,
          label: 'Nouvelle',
        );
      case _HomeTab.invoices:
        return CashierNavItem(
          icon: AppIcons.receipt,
          selectedIcon: AppIcons.receipt,
          label: 'Factures',
          badge: _invoicePendingBadge > 0 ? _invoicePendingBadge : null,
        );
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
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<ThemeService>();
    final api = context.watch<ApiClient>();
    final user = api.user;
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
      return AnnotatedRegion<SystemUiOverlayStyle>(
        value: context.palette.statusBarStyle,
        child: const OpenSessionScreen(),
      );
    }

    final currentTab = tabs[selectedTab];

    final navItems = tabs.map(_cashierNavItemForTab).toList();
    final useCashierNav = navItems.length == tabs.length;
    final hideBottomNav = _invoiceCartHasItems &&
        currentTab == _HomeTab.newInvoice;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: context.palette.statusBarStyle,
      child: Scaffold(
      extendBody: useCashierNav && !hideBottomNav,
      body: Stack(
        fit: StackFit.expand,
        children: [
          IndexedStack(
            index: selectedTab,
            children: tabs
                .map(
                  (t) => KeyedSubtree(
                    key: ValueKey(t),
                    child: _bodyForTab(t, api, tabs, currentTab),
                  ),
                )
                .toList(),
          ),
          if (useCashierNav && !hideBottomNav)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: CashierBottomNavBar(
                items: navItems,
                selectedIndex: selectedTab,
                onSelected: (i) {
                  setState(() => _tab = i);
                  _refreshPendingBadge();
                },
              ),
            ),
        ],
      ),
    ),
    );
  }
}
