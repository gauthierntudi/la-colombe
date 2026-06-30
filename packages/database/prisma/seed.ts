import { PrismaClient, Role, PointOfSaleType, StockMovementType, InvoiceStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed GES Boutique...");

  const settings = await prisma.shopSettings.upsert({
    where: { id: "default-settings" },
    update: {},
    create: {
      id: "default-settings",
      name: "La Colombe",
      address: "Kinshasa, RDC",
      phone: "+243900000000",
      currency: "CDF",
      defaultTaxRate: 16,
      country: "CD",
    },
  });

  const depot = await prisma.pointOfSale.upsert({
    where: { code: "KIN-DEPOT" },
    update: {},
    create: {
      code: "KIN-DEPOT",
      name: "Dépôt Central Kinshasa",
      type: PointOfSaleType.DEPOT,
      address: "Zone industrielle, Kinshasa",
      invoicePrefix: "DEP",
    },
  });

  const store = await prisma.pointOfSale.upsert({
    where: { code: "KIN-01" },
    update: {},
    create: {
      code: "KIN-01",
      name: "Magasin Kinshasa Centre",
      type: PointOfSaleType.STORE,
      address: "Gombe, Kinshasa",
      invoicePrefix: "KIN-FAC",
      yocoPrintEnabled: true,
    },
  });

  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@ges.local" },
    update: {},
    create: {
      email: "admin@ges.local",
      passwordHash,
      name: "Administrateur",
      role: Role.ADMIN,
    },
  });

  const facturantHash = await bcrypt.hash("facturant123", 10);
  const facturant = await prisma.user.upsert({
    where: { email: "facturant@ges.local" },
    update: {},
    create: {
      email: "facturant@ges.local",
      passwordHash: facturantHash,
      name: "Jean Facturant",
      role: Role.FACTURANT,
    },
  });

  await prisma.userPointOfSale.upsert({
    where: {
      userId_pointOfSaleId: { userId: facturant.id, pointOfSaleId: store.id },
    },
    update: {},
    create: { userId: facturant.id, pointOfSaleId: store.id },
  });

  const caissierHash = await bcrypt.hash("caissier123", 10);
  const caissier = await prisma.user.upsert({
    where: { email: "caissier@ges.local" },
    update: {},
    create: {
      email: "caissier@ges.local",
      passwordHash: caissierHash,
      name: "Marie Caissière",
      role: Role.CAISSIER,
    },
  });

  await prisma.userPointOfSale.upsert({
    where: {
      userId_pointOfSaleId: { userId: caissier.id, pointOfSaleId: store.id },
    },
    update: {},
    create: { userId: caissier.id, pointOfSaleId: store.id },
  });

  await prisma.cashSession.upsert({
    where: { id: "demo-cash-session-1" },
    update: {},
    create: {
      id: "demo-cash-session-1",
      userId: caissier.id,
      pointOfSaleId: store.id,
      status: "OPEN",
      openingCash: 50000,
    },
  });

  const categories = await Promise.all(
    ["Électronique", "Alimentation", "Hygiène"].map((name, i) =>
      prisma.category.upsert({
        where: { id: `cat-${i + 1}` },
        update: {},
        create: { id: `cat-${i + 1}`, name, sortOrder: i },
      })
    )
  );

  const productsData = [
    {
      sku: "PRD-001",
      name: "Téléphone Samsung A15",
      barcode: "8901234567890",
      unitPrice: 350000,
      categoryId: categories[0].id,
      imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&h=200&fit=crop",
      depotQty: 50,
      storeQty: 10,
    },
    {
      sku: "PRD-002",
      name: "Riz 25kg",
      barcode: "8901234567891",
      unitPrice: 45000,
      categoryId: categories[1].id,
      imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&h=200&fit=crop",
      depotQty: 200,
      storeQty: 40,
    },
    {
      sku: "PRD-003",
      name: "Savon liquide 1L",
      barcode: "8901234567892",
      unitPrice: 8000,
      categoryId: categories[2].id,
      imageUrl: "https://images.unsplash.com/photo-1600856204853-9f9ba919ca94?w=200&h=200&fit=crop",
      depotQty: 100,
      storeQty: 25,
    },
  ];

  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { imageUrl: p.imageUrl },
      create: {
        sku: p.sku,
        name: p.name,
        barcode: p.barcode,
        unitPrice: p.unitPrice,
        taxRate: 16,
        minStockLevel: 5,
        categoryId: p.categoryId,
        imageUrl: p.imageUrl,
      },
    });

    for (const [pos, qty] of [
      [depot, p.depotQty],
      [store, p.storeQty],
    ] as const) {
      const existing = await prisma.productStock.findUnique({
        where: {
          productId_pointOfSaleId: {
            productId: product.id,
            pointOfSaleId: pos.id,
          },
        },
      });

      if (!existing) {
        await prisma.productStock.create({
          data: {
            productId: product.id,
            pointOfSaleId: pos.id,
            physicalStock: qty,
          },
        });

        await prisma.stockMovement.create({
          data: {
            productId: product.id,
            pointOfSaleId: pos.id,
            type: StockMovementType.PURCHASE_IN,
            quantity: qty,
            reason: "Stock initial seed",
            userId: admin.id,
          },
        });
      }
    }
  }

  const p1 = await prisma.product.findUnique({ where: { sku: "PRD-001" } });
  const p2 = await prisma.product.findUnique({ where: { sku: "PRD-002" } });

  if (p1 && p2) {
    const existingPending = await prisma.invoice.findUnique({
      where: { number: "KIN-FAC-0001" },
    });

    if (!existingPending) {
      const qty1 = 1;
      const qty2 = 2;
      const price1 = Number(p1.unitPrice);
      const price2 = Number(p2.unitPrice);
      const tax = 16;
      const ht1 = qty1 * price1;
      const ht2 = qty2 * price2;
      const tax1 = Math.round((ht1 * tax) / 100);
      const tax2 = Math.round((ht2 * tax) / 100);
      const subtotalHt = ht1 + ht2;
      const taxAmount = tax1 + tax2;
      const totalTtc = subtotalHt + taxAmount;

      const pending = await prisma.invoice.create({
        data: {
          number: "KIN-FAC-0001",
          status: InvoiceStatus.PENDING_PAYMENT,
          pointOfSaleId: store.id,
          customerName: "Jean Dupont",
          customerPhone: "+243812345678",
          subtotalHt,
          taxAmount,
          totalTtc,
          createdById: facturant.id,
          validatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lines: {
            create: [
              {
                productId: p1.id,
                productName: p1.name,
                quantity: qty1,
                unitPrice: price1,
                taxRate: tax,
                lineTotalHt: ht1,
                lineTax: tax1,
                lineTotalTtc: ht1 + tax1,
              },
              {
                productId: p2.id,
                productName: p2.name,
                quantity: qty2,
                unitPrice: price2,
                taxRate: tax,
                lineTotalHt: ht2,
                lineTax: tax2,
                lineTotalTtc: ht2 + tax2,
              },
            ],
          },
        },
      });

      for (const [productId, qty] of [
        [p1.id, qty1],
        [p2.id, qty2],
      ] as const) {
        const stock = await prisma.productStock.findUnique({
          where: {
            productId_pointOfSaleId: { productId, pointOfSaleId: store.id },
          },
        });
        if (stock) {
          await prisma.productStock.update({
            where: { id: stock.id },
            data: { reservedStock: stock.reservedStock + qty },
          });
          await prisma.stockMovement.create({
            data: {
              productId,
              pointOfSaleId: store.id,
              type: StockMovementType.RESERVATION,
              quantity: qty,
              reason: `Réservation facture ${pending.number}`,
              invoiceId: pending.id,
              userId: admin.id,
            },
          });
        }
      }

      await prisma.pointOfSale.update({
        where: { id: store.id },
        data: { invoiceNextNum: 2 },
      });
    }

    const existingPaid = await prisma.invoice.findUnique({
      where: { number: "KIN-FAC-0002" },
    });

    if (!existingPaid && p1) {
      const qty = 1;
      const price = Number(p1.unitPrice);
      const ht = qty * price;
      const taxAmt = Math.round((ht * 16) / 100);
      const ttc = ht + taxAmt;
      const paidAt = new Date();

      const paid = await prisma.invoice.create({
        data: {
          number: "KIN-FAC-0002",
          status: InvoiceStatus.PAID,
          pointOfSaleId: store.id,
          subtotalHt: ht,
          taxAmount: taxAmt,
          totalTtc: ttc,
          createdById: facturant.id,
          validatedAt: paidAt,
          paidAt,
          lines: {
            create: {
              productId: p1.id,
              productName: p1.name,
              quantity: qty,
              unitPrice: price,
              taxRate: 16,
              lineTotalHt: ht,
              lineTax: taxAmt,
              lineTotalTtc: ttc,
            },
          },
          payments: {
            create: {
              method: PaymentMethod.CASH,
              status: PaymentStatus.COMPLETED,
              amount: ttc,
              completedAt: paidAt,
            },
          },
        },
      });

      const stock = await prisma.productStock.findUnique({
        where: {
          productId_pointOfSaleId: { productId: p1.id, pointOfSaleId: store.id },
        },
      });
      if (stock) {
        await prisma.productStock.update({
          where: { id: stock.id },
          data: { physicalStock: stock.physicalStock - qty },
        });
        await prisma.stockMovement.create({
          data: {
            productId: p1.id,
            pointOfSaleId: store.id,
            type: StockMovementType.SALE_OUT,
            quantity: -qty,
            reason: `Vente facture ${paid.number}`,
            invoiceId: paid.id,
            userId: admin.id,
          },
        });
      }
    }

    const latestInvoice = await prisma.invoice.findFirst({
      where: {
        pointOfSaleId: store.id,
        number: { startsWith: `${store.invoicePrefix}-` },
      },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    if (latestInvoice) {
      const suffix = `${store.invoicePrefix}-`;
      const seq = parseInt(latestInvoice.number.slice(suffix.length), 10);
      if (!Number.isNaN(seq)) {
        await prisma.pointOfSale.update({
          where: { id: store.id },
          data: { invoiceNextNum: seq + 1 },
        });
      }
    }
  }

  console.log("✅ Seed terminé");
  console.log(`   Organisation: ${settings.name}`);
  console.log(`   Sites: ${store.name}, ${depot.name}`);
  console.log(`   Admin: admin@ges.local / admin123`);
  console.log(`   Facturant: facturant@ges.local / facturant123`);
  console.log(`   Caissier: caissier@ges.local / caissier123 (session ouverte)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
