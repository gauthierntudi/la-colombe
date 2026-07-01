import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/models.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient extends ChangeNotifier {
  ApiClient({http.Client? httpClient, FlutterSecureStorage? storage})
      : _http = httpClient ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();

  final http.Client _http;
  final FlutterSecureStorage _storage;

  static const _tokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _posKey = 'active_pos_id';

  String? _accessToken;
  String? _refreshToken;
  AppUser? _user;
  PointOfSale? _activePos;
  CashSession? _session;
  bool _ready = false;

  AppUser? get user => _user;
  PointOfSale? get activePos => _activePos;
  CashSession? get openSession => _session;
  bool get isAuthenticated => _accessToken != null && _user != null;
  bool get isReady => _ready;
  bool get hasOpenSession => _session?.isOpen == true;

  Future<void> init() async {
    _accessToken = await _storage.read(key: _tokenKey);
    _refreshToken = await _storage.read(key: _refreshTokenKey);
    final posId = await _storage.read(key: _posKey);
    if (_accessToken != null) {
      final restored = await _restoreSession(posId);
      if (!restored) await logout();
    }
    _ready = true;
    notifyListeners();
  }

  Future<bool> _restoreSession(String? posId) async {
    try {
      await _loadUserAndPos(posId);
      return true;
    } catch (_) {
      final refreshed = await _refreshAccessToken();
      if (!refreshed) return false;
      try {
        await _loadUserAndPos(posId);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  Future<void> _loadUserAndPos(String? posId) async {
    final me = await _getMe();
    _user = me;
    if (posId != null) {
      try {
        _activePos = me.storePoints.firstWhere((p) => p.id == posId);
        await refreshOpenSession();
      } catch (_) {
        _activePos = null;
        _session = null;
      }
    }
  }

  /// Rafraîchit le profil et la session caisse (ex. retour au premier plan).
  Future<void> ensureSession() async {
    if (_accessToken == null) return;
    try {
      await _loadUserAndPos(await _storage.read(key: _posKey));
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        final refreshed = await _refreshAccessToken();
        if (refreshed) {
          await _loadUserAndPos(await _storage.read(key: _posKey));
        } else {
          await logout();
        }
      }
    } catch (_) {
      // réseau — conserver la session locale
    }
    notifyListeners();
  }

  Future<bool> _refreshAccessToken() async {
    final refresh = _refreshToken ?? await _storage.read(key: _refreshTokenKey);
    if (refresh == null || refresh.isEmpty) return false;

    try {
      final uri = Uri.parse('$apiBaseUrl/auth/refresh');
      final response = await _http.post(
        uri,
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refresh}),
      );

      if (response.statusCode >= 400) return false;

      final json = jsonDecode(response.body) as Map<String, dynamic>;
      _accessToken = json['accessToken'] as String;
      _refreshToken = json['refreshToken'] as String;
      _user = AppUser.fromJson(json['user'] as Map<String, dynamic>);
      await _storage.write(key: _tokenKey, value: _accessToken);
      await _storage.write(key: _refreshTokenKey, value: _refreshToken);
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  void dispose() {
    _http.close();
    super.dispose();
  }

  Future<AppUser> _getMe() async {
    final json = await _request('GET', '/auth/me') as Map<String, dynamic>;
    return AppUser.fromJson(json['user'] as Map<String, dynamic>);
  }

  Future<void> login(String email, String password) async {
    final json = await _request(
      'POST',
      '/auth/login',
      body: {'email': email, 'password': password},
      auth: false,
    ) as Map<String, dynamic>;

    final user = AppUser.fromJson(json['user'] as Map<String, dynamic>);
    if (!user.canUseMobileApp) {
      throw ApiException('Ce compte n\'a pas accès à l\'application mobile');
    }

    _accessToken = json['accessToken'] as String;
    _refreshToken = json['refreshToken'] as String?;
    _user = user;
    await _storage.write(key: _tokenKey, value: _accessToken);
    if (_refreshToken != null) {
      await _storage.write(key: _refreshTokenKey, value: _refreshToken);
    }

    final stores = _user!.storePoints;
    if (stores.length == 1) {
      await setActivePos(stores.first);
    } else {
      _activePos = null;
      _session = null;
      await _storage.delete(key: _posKey);
    }
    notifyListeners();
  }

  Future<void> logout() async {
    _accessToken = null;
    _refreshToken = null;
    _user = null;
    _activePos = null;
    _session = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _posKey);
    notifyListeners();
  }

  Future<void> setActivePos(PointOfSale pos) async {
    _activePos = pos;
    await _storage.write(key: _posKey, value: pos.id);
    await refreshOpenSession();
    notifyListeners();
  }

  Future<void> refreshOpenSession() async {
    final pos = _activePos;
    if (pos == null) {
      _session = null;
      return;
    }

    final json = await _request(
      'GET',
      '/cash-sessions?mine=true&pointOfSaleId=${pos.id}',
    ) as Map<String, dynamic>;

    final data = json['data'];
    _session = data != null
        ? CashSession.fromJson(data as Map<String, dynamic>)
        : null;
  }

  Future<CashSession> openCashSession({int openingCash = 0}) async {
    final pos = _activePos;
    if (pos == null) throw ApiException('Sélectionnez un point de vente');

    final json = await _request(
      'POST',
      '/cash-sessions',
      body: {
        'pointOfSaleId': pos.id,
        'openingCash': openingCash,
      },
    ) as Map<String, dynamic>;

    _session = CashSession.fromJson(json);
    notifyListeners();
    return _session!;
  }

  Future<CashSession> closeSession({
    required String sessionId,
    required int closingCash,
    String? notes,
  }) async {
    final json = await _request(
      'POST',
      '/cash-sessions/$sessionId/close',
      body: {
        'closingCash': closingCash,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
    ) as Map<String, dynamic>;

    _session = null;
    notifyListeners();
    return CashSession.fromJson(json);
  }

  Future<List<Product>> searchProducts(String query) async {
    final pos = _activePos;
    if (pos == null) throw ApiException('Sélectionnez un point de vente');

    final q = query.trim();
    final path = q.isEmpty
        ? '/products?limit=50'
        : '/products?search=${Uri.encodeComponent(q)}&limit=50';

    final productsRes = await _request('GET', path) as Map<String, dynamic>;
    final inventoryRes = await _request(
      'GET',
      '/inventory?pointOfSaleId=${pos.id}',
    ) as Map<String, dynamic>;

    final stockMap = <String, int>{};
    for (final row in inventoryRes['data'] as List<dynamic>) {
      stockMap[row['productId'] as String] =
          (row['availableStock'] as num).toInt();
    }

    return (productsRes['data'] as List<dynamic>)
        .map((e) => Product.fromJson(e as Map<String, dynamic>))
        .map((p) {
      p.availableStock = stockMap[p.id] ?? 0;
      return p;
    }).toList();
  }

  Future<List<InvoiceSummary>> listInvoices({
    String? status,
    DateTime? from,
  }) async {
    final pos = _activePos;
    if (pos == null) throw ApiException('Sélectionnez un point de vente');

    final params = <String, String>{
      'pointOfSaleId': pos.id,
      'limit': '50',
    };
    if (status != null) params['status'] = status;
    if (from != null) {
      final day = _localDateParam(from);
      params['from'] = day;
      params['to'] = day;
    }

    final query = params.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');
    final json = await _request('GET', '/invoices?$query') as Map<String, dynamic>;
    return (json['data'] as List<dynamic>)
        .map((e) => InvoiceSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<InvoiceSummary> createAndValidateInvoice({
    required List<CartLine> lines,
    String? customerName,
    String? customerPhone,
    String? notes,
  }) async {
    final pos = _activePos;
    if (pos == null) throw ApiException('Sélectionnez un point de vente');
    if (lines.isEmpty) throw ApiException('Ajoutez au moins un produit');

    final draft = await _request(
      'POST',
      '/invoices',
      body: {
        'pointOfSaleId': pos.id,
        if (customerName != null && customerName.isNotEmpty)
          'customerName': customerName,
        if (customerPhone != null && customerPhone.isNotEmpty)
          'customerPhone': customerPhone,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        'lines': lines
            .map(
              (l) => {
                'productId': l.product.id,
                'quantity': l.quantity,
                'unitPrice': l.product.unitPrice,
                'discountPercent': 0,
              },
            )
            .toList(),
      },
    ) as Map<String, dynamic>;

    final id = draft['id'] as String;
    final validated =
        await _request('POST', '/invoices/$id/validate') as Map<String, dynamic>;
    return InvoiceSummary.fromJson(validated);
  }

  Future<List<InvoiceSummary>> searchPendingInvoices(String search) async {
    final pos = _activePos;
    if (pos == null) throw ApiException('Sélectionnez un point de vente');

    final params = <String, String>{
      'pointOfSaleId': pos.id,
      'status': 'PENDING_PAYMENT',
      'limit': '50',
    };
    if (search.trim().isNotEmpty) {
      params['search'] = search.trim();
    }

    final query =
        params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
    final json = await _request('GET', '/invoices?$query') as Map<String, dynamic>;
    return (json['data'] as List<dynamic>)
        .map((e) => InvoiceSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<InvoiceDetail> getInvoice(String id) async {
    final json = await _request('GET', '/invoices/$id') as Map<String, dynamic>;
    return InvoiceDetail.fromJson(json);
  }

  Future<PaymentResult> payCash({
    required String invoiceId,
    required int amount,
  }) async {
    return payPayments(
      invoiceId: invoiceId,
      payments: [
        {'method': 'CASH', 'amount': amount},
      ],
    );
  }

  Future<PaymentResult> payPayments({
    required String invoiceId,
    required List<Map<String, dynamic>> payments,
  }) async {
    if (_user?.role == 'CAISSIER' && !hasOpenSession) {
      throw ApiException('Ouvrez une session de caisse avant d\'encaisser');
    }

    final json = await _request(
      'POST',
      '/payments',
      body: {
        'invoiceId': invoiceId,
        if (_session != null) 'cashSessionId': _session!.id,
        'payments': payments,
      },
    ) as Map<String, dynamic>;

    await refreshOpenSession();
    notifyListeners();
    return PaymentResult.fromJson(json);
  }

  Future<MmInitiateResult> initiateMobileMoney({
    required String invoiceId,
    required int amount,
    required String phone,
    required String provider,
  }) async {
    if (_user?.role == 'CAISSIER' && !hasOpenSession) {
      throw ApiException('Ouvrez une session de caisse avant d\'encaisser');
    }

    final json = await _request(
      'POST',
      '/payments/mobile-money/initiate',
      body: {
        'invoiceId': invoiceId,
        if (_session != null) 'cashSessionId': _session!.id,
        'amount': amount,
        'phone': phone,
        'provider': provider,
      },
    ) as Map<String, dynamic>;

    return MmInitiateResult(
      paymentId: json['paymentId'] as String,
      message: json['message'] as String? ?? 'En attente de confirmation',
      mock: json['mock'] as bool? ?? false,
    );
  }

  Future<PaymentStatusInfo> getPaymentStatus(String paymentId) async {
    final json = await _request('GET', '/payments/$paymentId') as Map<String, dynamic>;
    return PaymentStatusInfo.fromJson(json);
  }

  Future<PaymentStatusInfo> pollPaymentUntilDone(
    String paymentId, {
    Duration interval = const Duration(milliseconds: 2500),
    Duration timeout = const Duration(minutes: 3),
  }) async {
    final deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      final status = await getPaymentStatus(paymentId);
      if (status.status == 'COMPLETED' || status.status == 'FAILED') {
        return status;
      }
      await Future<void>.delayed(interval);
    }
    throw ApiException('Délai dépassé — paiement Mobile Money non confirmé');
  }

  Future<void> simulateMobileMoney(String paymentId) async {
    await _request('POST', '/payments/$paymentId/simulate');
    await refreshOpenSession();
    notifyListeners();
  }

  Future<PosConfig> getPosConfig() async {
    final pos = _activePos;
    if (pos == null) throw ApiException('Sélectionnez un point de vente');
    final json = await _request('GET', '/points-of-sale/${pos.id}') as Map<String, dynamic>;
    return PosConfig.fromJson(json);
  }

  Future<ShopSettings> getShopSettings() async {
    final json = await _request('GET', '/settings') as Map<String, dynamic>;
    return ShopSettings.fromJson(json);
  }

  Future<YocoSdkConfig?> getYocoSdkConfig() async {
    try {
      final json = await _request('GET', '/settings/yoco-sdk') as Map<String, dynamic>;
      return YocoSdkConfig.fromJson(json);
    } on ApiException catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
    bool allowRefresh = true,
  }) async {
    final uri = Uri.parse('$apiBaseUrl$path');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (auth && _accessToken != null) 'Authorization': 'Bearer $_accessToken',
    };

    http.Response response;
    switch (method) {
      case 'GET':
        response = await _http.get(uri, headers: headers);
      case 'POST':
        response = await _http.post(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
      default:
        throw ApiException('Méthode HTTP non supportée: $method');
    }

    if (response.statusCode == 401 &&
        auth &&
        allowRefresh &&
        path != '/auth/refresh') {
      final refreshed = await _refreshAccessToken();
      if (refreshed) {
        return _request(
          method,
          path,
          body: body,
          auth: auth,
          allowRefresh: false,
        );
      }
    }

    dynamic decoded;
    if (response.body.isNotEmpty) {
      decoded = jsonDecode(response.body);
    }

    if (response.statusCode >= 400) {
      final err = decoded is Map<String, dynamic> ? decoded['error'] : null;
      final message = err is Map<String, dynamic>
          ? (err['message'] as String? ?? 'Erreur serveur')
          : 'Erreur ${response.statusCode}';
      throw ApiException(message, statusCode: response.statusCode);
    }

    return decoded;
  }
}

String _localDateParam(DateTime date) {
  final local = date.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  return '${local.year}-$month-$day';
}
