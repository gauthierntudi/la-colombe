import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/models.dart';
import 'yoco_print_channel.dart';

/// Largeur utile ticket thermique (~80 mm, police monospace).
const _thermalCols = 42;

class ReceiptPrintService {
  static String buildReceiptText({
    required InvoiceDetail invoice,
    required ShopSettings shop,
  }) {
    final issueDate = (invoice.paidAt ?? invoice.createdAt).toLocal();
    final dateOnly = DateFormat('dd/MM/yyyy').format(issueDate);
    final customer = invoice.customerName?.trim();
    final buf = StringBuffer();

    buf.writeln(_center(shop.name.toUpperCase(), _thermalCols));
    buf.writeln(_center('BON DE SORTIE', _thermalCols));
    buf.writeln('=' * _thermalCols);

    _writeLegalLine(buf, 'RCCM', shop.rccm);
    _writeLegalLine(buf, 'Id.Nat.', shop.idNat);
    _writeLegalLine(buf, 'Impot', shop.taxNumber);
    if (shop.address != null && shop.address!.isNotEmpty) {
      buf.writeln(_wrap(shop.address!, _thermalCols));
    }
    if (shop.phone != null && shop.phone!.isNotEmpty) {
      buf.writeln('TEL ${shop.phone}');
    }

    buf.writeln('-' * _thermalCols);
    buf.writeln('Kinshasa, le $dateOnly');
    buf.writeln('BON DE SORTIE N° ${invoice.number}');
    if (invoice.pointOfSaleName != null) {
      buf.writeln('Site : ${invoice.pointOfSaleName}');
    }

    buf.writeln('-' * _thermalCols);
    buf.writeln(
      'Mr, Mm : ${customer ?? '—'}'
      '${customer != null ? ' — Doit pour ce qui suit' : ''}',
    );
    buf.writeln('Client : ${customer ?? '—'}');
    if (invoice.customerPhone != null) {
      buf.writeln('Tel.   : ${invoice.customerPhone}');
    }
    buf.writeln('Objet  : Achat de marchandises');

    buf.writeln('-' * _thermalCols);
    buf.writeln(
      '${_col('Qté', 4)} ${_col('DESIGNATION', 18)} '
      '${_col('P.U.', 8, right: true)} ${_col('P.T.', 9, right: true)}',
    );
    buf.writeln('-' * _thermalCols);

    for (final line in invoice.lines) {
      final name = line.productName.length > 18
          ? '${line.productName.substring(0, 17)}…'
          : line.productName;
      buf.writeln(
        '${_col('${line.quantity}', 4)} ${_col(name, 18)} '
        '${_col(formatCdf(line.unitPrice), 8, right: true)} '
        '${_col(formatCdf(line.lineTotalTtc), 9, right: true)}',
      );
    }

    buf.writeln('-' * _thermalCols);
    buf.writeln(
      '${_col('TOTAL', 23)} ${_col('${formatCdf(invoice.totalTtc)} FC', 18, right: true)}',
    );
    buf.writeln(
      '  HT  : ${formatCdf(invoice.subtotalHt)} FC   '
      'TVA : ${formatCdf(invoice.taxAmount)} FC',
    );

    if (invoice.payments.isNotEmpty) {
      buf.writeln('-' * _thermalCols);
      for (final p in invoice.payments) {
        final label = paymentMethodLabels[p.method] ?? p.method;
        buf.writeln('$label : ${formatCdf(p.amount)} FC');
      }
    }

    buf
      ..writeln('=' * _thermalCols)
      ..writeln(_center('Merci pour votre achat !', _thermalCols));

    return buf.toString();
  }

  static String buildReceiptHtml({
    required InvoiceDetail invoice,
    required ShopSettings shop,
  }) {
    final issueDate = (invoice.paidAt ?? invoice.createdAt).toLocal();
    final dateOnly = DateFormat('dd/MM/yyyy').format(issueDate);
    final customer = invoice.customerName?.trim();
    final customerLabel = _escapeHtml(customer ?? '—');
    final linesHtml = invoice.lines
        .map(
          (line) => '''
      <tr>
        <td class="c-qty">${line.quantity}</td>
        <td class="c-name">${_escapeHtml(line.productName)}</td>
        <td class="c-num">${formatCdf(line.unitPrice)}</td>
        <td class="c-num">${formatCdf(line.lineTotalTtc)}</td>
      </tr>''',
        )
        .join('\n');

    final paymentsHtml = invoice.payments.isEmpty
        ? ''
        : '''
    <div class="payments">
      ${invoice.payments.map((p) {
        final label = paymentMethodLabels[p.method] ?? p.method;
        return '<div>${_escapeHtml(label)} : ${formatCdf(p.amount)} FC</div>';
      }).join()}
    </div>''';

    return '''
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=302"/>
  <style>
    @page { size: 80mm auto; margin: 2mm 3mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: 9px;
      line-height: 1.35;
      color: #000;
      margin: 0;
      padding: 0;
      width: 100%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .shop-name {
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      margin-bottom: 4px;
    }
    .legal {
      font-size: 8px;
      font-weight: 700;
      text-align: center;
      margin: 1px 0;
    }
    .legal-line { margin: 1px 0; }
    .location {
      text-align: center;
      font-size: 8px;
      font-weight: 700;
      text-decoration: underline;
      margin-top: 2px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin: 8px 0 6px;
      font-size: 8px;
    }
    .meta-date { flex: 1; white-space: nowrap; }
    .doc-title {
      font-size: 11px;
      font-weight: 700;
      text-align: right;
      white-space: nowrap;
    }
    .client-block {
      font-size: 8px;
      margin: 6px 0 8px;
      line-height: 1.5;
    }
    .client-block div { margin: 2px 0; }
    table.items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 8px;
      margin-top: 4px;
    }
    table.items th,
    table.items td {
      border: 1px solid #000;
      padding: 2px 3px;
      vertical-align: top;
    }
    table.items th {
      font-weight: 700;
      text-align: center;
    }
    .c-qty { width: 11%; text-align: center; }
    .c-name { width: 46%; word-wrap: break-word; }
    .c-num { width: 21%; text-align: right; white-space: nowrap; }
    tr.total td {
      border-top: 2px solid #000;
      font-weight: 700;
      padding-top: 4px;
    }
    tr.total .total-label { text-align: left; }
    tr.total .total-value { text-align: right; font-size: 9px; }
    .tax-row {
      font-size: 8px;
      margin-top: 4px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .payments {
      font-size: 8px;
      margin-top: 6px;
      border-top: 1px dashed #000;
      padding-top: 4px;
    }
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      border-top: 2px solid #000;
      padding-top: 6px;
    }
    .site { font-size: 8px; text-align: center; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="shop-name">${_escapeHtml(shop.name)}</div>
  ${_legalHtml('RCCM', shop.rccm)}
  ${_legalHtml('Id.Nat.', shop.idNat)}
  ${_legalHtml('Impot', shop.taxNumber)}
  ${shop.address != null && shop.address!.isNotEmpty ? '<div class="legal legal-line">${_escapeHtml(shop.address!)}</div>' : ''}
  ${shop.phone != null && shop.phone!.isNotEmpty ? '<div class="legal legal-line">TEL ${_escapeHtml(shop.phone!)}</div>' : ''}
  <div class="location">Kinshasa</div>

  <div class="meta-row">
    <div class="meta-date">Kinshasa, le $dateOnly</div>
    <div class="doc-title">BON DE SORTIE N° ${_escapeHtml(invoice.number)}</div>
  </div>
  ${invoice.pointOfSaleName != null ? '<div class="site">${_escapeHtml(invoice.pointOfSaleName!)}</div>' : ''}

  <div class="client-block">
    <div>Mr, Mm : $customerLabel${customer != null ? ' — Doit pour ce qui suit' : ''}</div>
    <div>Client : $customerLabel</div>
    ${invoice.customerPhone != null ? '<div>Tel. : ${_escapeHtml(invoice.customerPhone!)}</div>' : ''}
    <div>Objet : Achat de marchandises</div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="c-qty">Qté</th>
        <th class="c-name">DESIGNATION</th>
        <th class="c-num">P.U.</th>
        <th class="c-num">P.T.</th>
      </tr>
    </thead>
    <tbody>
      $linesHtml
      <tr class="total">
        <td colspan="2" class="total-label">TOTAL</td>
        <td colspan="2" class="total-value">${formatCdf(invoice.totalTtc)} FC</td>
      </tr>
    </tbody>
  </table>

  <div class="tax-row">
    <span>HT : ${formatCdf(invoice.subtotalHt)} FC</span>
    <span>TVA : ${formatCdf(invoice.taxAmount)} FC</span>
  </div>
  $paymentsHtml

  <div class="footer">Merci pour votre achat !</div>
</body>
</html>''';
  }

  static Future<pw.Document> buildReceiptPdf({
    required InvoiceDetail invoice,
    required ShopSettings shop,
  }) async {
    final text = buildReceiptText(invoice: invoice, shop: shop);
    final doc = pw.Document();
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.roll80,
        margin: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        build: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: text
              .split('\n')
              .map(
                (line) => pw.Text(
                  line,
                  style: pw.TextStyle(
                    fontSize: line == shop.name.toUpperCase() ? 11 : 8,
                    fontWeight: line.contains('BON DE SORTIE') ||
                            line.startsWith('TOTAL')
                        ? pw.FontWeight.bold
                        : pw.FontWeight.normal,
                  ),
                ),
              )
              .toList(),
        ),
      ),
    );
    return doc;
  }

  static Future<void> printInvoice({
    required InvoiceDetail invoice,
    required ShopSettings shop,
    PosConfig? posConfig,
  }) async {
    final html = buildReceiptHtml(invoice: invoice, shop: shop);
    final text = buildReceiptText(invoice: invoice, shop: shop);

    if (posConfig?.yocoPrintEnabled == true) {
      final yocoOk = await YocoPrintChannel.printReceipt(
        text: text,
        html: html,
        jobName: 'Bon ${invoice.number}',
      );
      if (yocoOk) return;
    }

    final doc = await buildReceiptPdf(invoice: invoice, shop: shop);
    await Printing.layoutPdf(onLayout: (_) async => doc.save());
  }

  static void _writeLegalLine(StringBuffer buf, String label, String? value) {
    if (value == null || value.isEmpty) return;
    buf.writeln('$label : $value');
  }

  static String _legalHtml(String label, String? value) {
    if (value == null || value.isEmpty) return '';
    return '<div class="legal legal-line">$label : ${_escapeHtml(value)}</div>';
  }

  static String _escapeHtml(String input) => input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  static String _col(String value, int width, {bool right = false}) {
    if (value.length > width) {
      value = '${value.substring(0, width - 1)}…';
    }
    return right ? value.padLeft(width) : value.padRight(width);
  }

  static String _center(String text, int width) {
    if (text.length >= width) return text;
    final pad = (width - text.length) ~/ 2;
    return '${' ' * pad}$text'.padRight(width);
  }

  static String _wrap(String text, int width) {
    final words = text.split(RegExp(r'\s+'));
    final lines = <String>[];
    var current = '';
    for (final word in words) {
      if (current.isEmpty) {
        current = word;
      } else if (current.length + 1 + word.length <= width) {
        current = '$current $word';
      } else {
        lines.add(current);
        current = word;
      }
    }
    if (current.isNotEmpty) lines.add(current);
    return lines.join('\n');
  }
}
