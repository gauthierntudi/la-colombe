class PointOfSale {
  PointOfSale({
    required this.id,
    required this.code,
    required this.name,
    required this.type,
  });

  final String id;
  final String code;
  final String name;
  final String type;

  factory PointOfSale.fromJson(Map<String, dynamic> json) => PointOfSale(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
        type: json['type'] as String,
      );

  bool get isStore => type == 'STORE';
}

class AppUser {
  AppUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.pointOfSales,
    this.avatarUrl,
  });

  final String id;
  final String email;
  final String name;
  final String role;
  final List<PointOfSale> pointOfSales;
  final String? avatarUrl;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        email: json['email'] as String,
        name: json['name'] as String,
        role: json['role'] as String,
        avatarUrl: json['avatarUrl'] as String?,
        pointOfSales: (json['pointOfSales'] as List<dynamic>? ?? [])
            .map((e) => PointOfSale.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  List<PointOfSale> get storePoints =>
      pointOfSales.where((p) => p.isStore).toList();

  bool get canInvoice =>
      role == 'FACTURANT' || role == 'ADMIN' || role == 'MANAGER';

  bool get canCashier =>
      role == 'CAISSIER' || role == 'ADMIN' || role == 'MANAGER';

  bool get canUseMobileApp => canInvoice || canCashier;
}

class Product {
  Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.unitPrice,
    required this.taxRate,
    this.barcode,
    this.availableStock,
    this.imageUrl,
  });

  final String id;
  final String sku;
  final String name;
  final int unitPrice;
  final double taxRate;
  final String? barcode;
  int? availableStock;
  final String? imageUrl;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        sku: json['sku'] as String,
        name: json['name'] as String,
        unitPrice: (json['unitPrice'] as num).toInt(),
        taxRate: (json['taxRate'] as num).toDouble(),
        barcode: json['barcode'] as String?,
        imageUrl: json['imageUrl'] as String?,
      );
}

class CartLine {
  CartLine({
    required this.product,
    required this.quantity,
  });

  final Product product;
  int quantity;

  int get lineTotalTtc {
    final ht = product.unitPrice * quantity;
    final tax = (ht * product.taxRate / 100).round();
    return ht + tax;
  }
}

class CashSession {
  CashSession({
    required this.id,
    required this.status,
    required this.openingCash,
    required this.totalSales,
    required this.invoiceCount,
    required this.openedAt,
    this.totalMobileMoney = 0,
    this.cashCollected,
    this.closingCash,
    this.expectedCash,
    this.cashVariance,
    this.closedAt,
  });

  final String id;
  final String status;
  final int openingCash;
  final int totalSales;
  final int totalMobileMoney;
  final int? cashCollected;
  final int invoiceCount;
  final DateTime openedAt;
  final int? closingCash;
  final int? expectedCash;
  final int? cashVariance;
  final DateTime? closedAt;

  bool get isOpen => status == 'OPEN';

  /// Espèces attendues en caisse (fond initial + encaissements espèces).
  int get expectedCashInDrawer {
    if (expectedCash != null) return expectedCash!;
    return openingCash + (cashCollected ?? 0);
  }

  factory CashSession.fromJson(Map<String, dynamic> json) => CashSession(
        id: json['id'] as String,
        status: json['status'] as String,
        openingCash: (json['openingCash'] as num).toInt(),
        totalSales: (json['totalSales'] as num).toInt(),
        totalMobileMoney: (json['totalMobileMoney'] as num?)?.toInt() ?? 0,
        cashCollected: json['cashCollected'] != null
            ? (json['cashCollected'] as num).toInt()
            : null,
        invoiceCount: (json['invoiceCount'] as num).toInt(),
        openedAt: DateTime.parse(json['openedAt'] as String),
        closingCash: json['closingCash'] != null
            ? (json['closingCash'] as num).toInt()
            : null,
        expectedCash: json['expectedCash'] != null
            ? (json['expectedCash'] as num).toInt()
            : null,
        cashVariance: json['cashVariance'] != null
            ? (json['cashVariance'] as num).toInt()
            : null,
        closedAt: json['closedAt'] != null
            ? DateTime.parse(json['closedAt'] as String)
            : null,
      );
}

class InvoiceSummary {
  InvoiceSummary({
    required this.id,
    required this.number,
    required this.status,
    required this.totalTtc,
    required this.createdAt,
    this.paidAt,
    this.customerName,
    this.customerPhone,
  });

  final String id;
  final String number;
  final String status;
  final int totalTtc;
  final DateTime createdAt;
  final DateTime? paidAt;
  final String? customerName;
  final String? customerPhone;

  DateTime get paidOrCreatedAt => paidAt ?? createdAt;

  factory InvoiceSummary.fromJson(Map<String, dynamic> json) => InvoiceSummary(
        id: json['id'] as String,
        number: json['number'] as String,
        status: json['status'] as String,
        totalTtc: (json['totalTtc'] as num).toInt(),
        createdAt: DateTime.parse(json['createdAt'] as String),
        paidAt: json['paidAt'] != null
            ? DateTime.parse(json['paidAt'] as String)
            : null,
        customerName: json['customerName'] as String?,
        customerPhone: json['customerPhone'] as String?,
      );
}

class InvoiceLine {
  InvoiceLine({
    required this.productName,
    required this.productSku,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotalTtc,
    this.imageUrl,
  });

  final String productName;
  final String productSku;
  final int quantity;
  final int unitPrice;
  final int lineTotalTtc;
  final String? imageUrl;

  factory InvoiceLine.fromJson(Map<String, dynamic> json) => InvoiceLine(
        productName: json['productName'] as String,
        productSku: json['productSku'] as String? ?? '',
        quantity: (json['quantity'] as num).toInt(),
        unitPrice: (json['unitPrice'] as num).toInt(),
        lineTotalTtc: (json['lineTotalTtc'] as num).toInt(),
        imageUrl: json['productImageUrl'] as String?,
      );
}

class InvoicePayment {
  InvoicePayment({required this.method, required this.amount});

  final String method;
  final int amount;

  factory InvoicePayment.fromJson(Map<String, dynamic> json) => InvoicePayment(
        method: json['method'] as String,
        amount: (json['amount'] as num).toInt(),
      );
}

class PosConfig {
  PosConfig({
    required this.yocoPrintEnabled,
    this.yocoDeviceId,
  });

  final bool yocoPrintEnabled;
  final String? yocoDeviceId;

  factory PosConfig.fromJson(Map<String, dynamic> json) => PosConfig(
        yocoPrintEnabled: json['yocoPrintEnabled'] as bool? ?? false,
        yocoDeviceId: json['yocoDeviceId'] as String?,
      );
}

class ShopSettings {
  ShopSettings({
    required this.name,
    this.address,
    this.phone,
    this.rccm,
    this.idNat,
    this.taxNumber,
  });

  final String name;
  final String? address;
  final String? phone;
  final String? rccm;
  final String? idNat;
  final String? taxNumber;

  factory ShopSettings.fromJson(Map<String, dynamic> json) => ShopSettings(
        name: json['name'] as String,
        address: json['address'] as String?,
        phone: json['phone'] as String?,
        rccm: json['rccm'] as String?,
        idNat: json['idNat'] as String?,
        taxNumber: json['taxNumber'] as String?,
      );
}

class YocoSdkConfig {
  YocoSdkConfig({
    required this.integrationSecret,
    required this.merchantId,
    required this.merchantName,
    required this.merchantPhone,
    required this.merchantAddress,
    required this.sandbox,
  });

  final String integrationSecret;
  final String merchantId;
  final String merchantName;
  final String merchantPhone;
  final String merchantAddress;
  final bool sandbox;

  factory YocoSdkConfig.fromJson(Map<String, dynamic> json) => YocoSdkConfig(
        integrationSecret: json['integrationSecret'] as String,
        merchantId: json['merchantId'] as String,
        merchantName: json['merchantName'] as String,
        merchantPhone: json['merchantPhone'] as String? ?? '',
        merchantAddress: json['merchantAddress'] as String? ?? '',
        sandbox: json['sandbox'] as bool? ?? false,
      );
}

enum PayMode { cash, mobileMoney }

const mmProviders = [
  (value: 'ORANGE', label: 'Orange Money'),
  (value: 'AIRTEL', label: 'Airtel Money'),
  (value: 'VODACOM', label: 'M-Pesa (Vodacom)'),
];

class MmInitiateResult {
  MmInitiateResult({
    required this.paymentId,
    required this.message,
    this.mock = false,
  });

  final String paymentId;
  final String message;
  final bool mock;
}

class PaymentStatusInfo {
  PaymentStatusInfo({
    required this.status,
    required this.invoiceStatus,
  });

  final String status;
  final String invoiceStatus;

  factory PaymentStatusInfo.fromJson(Map<String, dynamic> json) =>
      PaymentStatusInfo(
        status: json['status'] as String,
        invoiceStatus: json['invoiceStatus'] as String,
      );
}

class InvoiceDetail extends InvoiceSummary {
  InvoiceDetail({
    required super.id,
    required super.number,
    required super.status,
    required super.totalTtc,
    required super.createdAt,
    super.customerName,
    super.customerPhone,
    super.paidAt,
    required this.subtotalHt,
    required this.taxAmount,
    required this.lines,
    this.expiresAt,
    this.pointOfSaleName,
    this.pointOfSaleCode,
    this.payments = const [],
  });

  final int subtotalHt;
  final int taxAmount;
  final List<InvoiceLine> lines;
  final DateTime? expiresAt;
  final String? pointOfSaleName;
  final String? pointOfSaleCode;
  final List<InvoicePayment> payments;

  factory InvoiceDetail.fromJson(Map<String, dynamic> json) => InvoiceDetail(
        id: json['id'] as String,
        number: json['number'] as String,
        status: json['status'] as String,
        totalTtc: (json['totalTtc'] as num).toInt(),
        createdAt: DateTime.parse(json['createdAt'] as String),
        customerName: json['customerName'] as String?,
        customerPhone: json['customerPhone'] as String?,
        subtotalHt: (json['subtotalHt'] as num).toInt(),
        taxAmount: (json['taxAmount'] as num).toInt(),
        expiresAt: json['expiresAt'] != null
            ? DateTime.parse(json['expiresAt'] as String)
            : null,
        paidAt: json['paidAt'] != null
            ? DateTime.parse(json['paidAt'] as String)
            : null,
        pointOfSaleName: (json['pointOfSale'] as Map<String, dynamic>?)?['name']
            as String?,
        pointOfSaleCode: (json['pointOfSale'] as Map<String, dynamic>?)?['code']
            as String?,
        lines: (json['lines'] as List<dynamic>)
            .map((e) => InvoiceLine.fromJson(e as Map<String, dynamic>))
            .toList(),
        payments: (json['payments'] as List<dynamic>? ?? [])
            .map((e) => InvoicePayment.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class PaymentResult {
  PaymentResult({
    required this.invoiceId,
    required this.number,
    required this.status,
    required this.totalTtc,
    this.paidAt,
  });

  final String invoiceId;
  final String number;
  final String status;
  final int totalTtc;
  final DateTime? paidAt;

  factory PaymentResult.fromJson(Map<String, dynamic> json) => PaymentResult(
        invoiceId: json['invoiceId'] as String,
        number: json['number'] as String,
        status: json['status'] as String,
        totalTtc: (json['totalTtc'] as num).toInt(),
        paidAt: json['paidAt'] != null
            ? DateTime.parse(json['paidAt'] as String)
            : null,
      );
}

String formatCdf(int amount) {
  final s = amount.toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
    buf.write(s[i]);
  }
  return buf.toString();
}

const invoiceStatusLabels = {
  'DRAFT': 'Brouillon',
  'PENDING_PAYMENT': 'En attente',
  'PAID': 'Payée',
  'CANCELLED': 'Annulée',
  'EXPIRED': 'Expirée',
};

const paymentMethodLabels = {
  'CASH': 'Espèces',
  'MOBILE_MONEY': 'Mobile Money',
  'OTHER': 'Autre',
};
