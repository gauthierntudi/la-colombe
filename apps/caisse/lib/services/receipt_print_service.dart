import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/models.dart';
import 'yoco_print_channel.dart';

class ReceiptPrintService {
  static String buildReceiptText({
    required InvoiceDetail invoice,
    required ShopSettings shop,
  }) {
    final dateFmt = DateFormat('dd/MM/yyyy HH:mm');
    final buf = StringBuffer()
      ..writeln(shop.name.toUpperCase())
      ..writeln('BON DE SORTIE')
      ..writeln('=' * 32)
      ..writeln('Facture : ${invoice.number}')
      ..writeln('Site    : ${invoice.pointOfSaleName ?? ''}')
      ..writeln('Date    : ${dateFmt.format((invoice.paidAt ?? invoice.createdAt).toLocal())}');

    if (invoice.customerName != null) {
      buf.writeln('Client  : ${invoice.customerName}');
    }
    if (invoice.customerPhone != null) {
      buf.writeln('Tel.    : ${invoice.customerPhone}');
    }

    buf.writeln('-' * 32);

    for (final line in invoice.lines) {
      buf.writeln(line.productName);
      buf.writeln(
        '  ${line.quantity} x ${formatCdf(line.unitPrice)} = ${formatCdf(line.lineTotalTtc)} FC',
      );
    }

    buf
      ..writeln('-' * 32)
      ..writeln('HT   : ${formatCdf(invoice.subtotalHt)} FC')
      ..writeln('TVA  : ${formatCdf(invoice.taxAmount)} FC')
      ..writeln('TTC  : ${formatCdf(invoice.totalTtc)} FC');

    if (invoice.payments.isNotEmpty) {
      buf.writeln('-' * 32);
      for (final p in invoice.payments) {
        final label = paymentMethodLabels[p.method] ?? p.method;
        buf.writeln('$label : ${formatCdf(p.amount)} FC');
      }
    }

    buf
      ..writeln('=' * 32)
      ..writeln('Merci pour votre achat !');

    if (shop.address != null) buf.writeln(shop.address);
    if (shop.phone != null) buf.writeln('Tel: ${shop.phone}');

    return buf.toString();
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
        build: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: text
              .split('\n')
              .map((line) => pw.Text(line, style: const pw.TextStyle(fontSize: 9)))
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
    final text = buildReceiptText(invoice: invoice, shop: shop);

    if (posConfig?.yocoPrintEnabled == true) {
      final yocoOk = await YocoPrintChannel.printReceipt(
        text: text,
        jobName: 'Bon ${invoice.number}',
      );
      if (yocoOk) return;
    }

    final doc = await buildReceiptPdf(invoice: invoice, shop: shop);
    await Printing.layoutPdf(onLayout: (_) async => doc.save());
  }
}
