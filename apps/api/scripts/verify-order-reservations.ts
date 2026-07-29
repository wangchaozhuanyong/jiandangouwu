import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { ConflictException } from "@nestjs/common";
import { AuditService } from "../src/audit/audit.service.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { OrderReservationService } from "../src/orders/order-reservation.service.js";
import { OrdersAdminService } from "../src/orders/orders.admin.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

const token = randomBytes(6).toString("hex");
const categoryId = `qa-reservation-category-${token}`;
const categorySlug = `qa-reservation-${token}`;
const productId = `qa-reservation-product-${token}`;
const orderId = `qa-reservation-order-${token}`;
const manualOrderId = `qa-reservation-manual-${token}`;
const orderNumber = `QA-RES-${token.toUpperCase()}`;
const manualOrderNumber = `QA-MAN-${token.toUpperCase()}`;
const idempotencyKey = `qa-reservation-${token}`;
const manualIdempotencyKey = `qa-reservation-manual-${token}`;
const adminId = `qa-reservation-admin-${token}`;
const adminEmail = `qa-reservation-${token}@invalid.example`;
const reconciledAt = new Date();
const reservedUntil = new Date(reconciledAt.getTime() - 60_000);

const prisma = new PrismaService(new ConfigService());
const reservations = new OrderReservationService(
  prisma,
  new AuditService(prisma),
);
const audit = new AuditService(prisma);
const adminOrders = new OrdersAdminService(
  prisma,
  audit,
  { reveal: () => "" } as never,
  reservations,
);

try {
  const currency = await prisma.currency.findFirst({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { code: true },
  });
  assert.ok(currency, "At least one active currency is required for QA.");

  await prisma.category.create({
    data: {
      id: categoryId,
      slug: categorySlug,
      status: "ACTIVE",
      translations: {
        create: [
          { locale: "ZH", name: "QA 库存预留验证" },
          { locale: "EN", name: "QA reservation verification" },
        ],
      },
    },
  });
  await prisma.adminUser.create({
    data: {
      id: adminId,
      email: adminEmail,
      displayName: "QA reservation verifier",
      status: "ACTIVE",
    },
  });
  await prisma.product.create({
    data: {
      id: productId,
      slug: categorySlug,
      categoryId,
      imageKey: "/assets/product-codex.webp",
      basePrice: new Prisma.Decimal("10.00"),
      stockMode: "FINITE",
      stockQuantity: 3,
      status: "ACTIVE",
      translations: {
        create: [
          {
            locale: "ZH",
            name: "QA 有限库存商品",
            normalizedName: "qa 有限库存商品",
            kicker: "QA",
            description: "只用于本地库存预留闭环验证。",
          },
          {
            locale: "EN",
            name: "QA finite-stock product",
            normalizedName: "qa finite-stock product",
            kicker: "QA",
            description: "Used only for local reservation verification.",
          },
        ],
      },
    },
  });
  await prisma.$transaction(async (transaction) => {
    const stock = await transaction.product.updateMany({
      where: {
        id: productId,
        stockMode: "FINITE",
        stockQuantity: { gte: 2 },
      },
      data: {
        stockQuantity: { decrement: 2 },
        version: { increment: 1 },
      },
    });
    assert.equal(stock.count, 1);
    await transaction.order.create({
      data: {
        id: orderId,
        orderNumber,
        idempotencyKey,
        productId,
        productNameSnapshot: "QA finite-stock product",
        currencyCode: currency.code,
        amount: new Prisma.Decimal("10.00"),
        exchangeRateSnapshot: new Prisma.Decimal("1.0000000000"),
        productVersion: 1,
        contactChannel: "EMAIL",
        contactEncrypted: "qa-only-not-a-real-contact-ciphertext",
        contactHash: "0".repeat(64),
        maskedContact: "qa***@invalid.example",
        acceptedPolicyVersion: "qa-only",
        status: "MANUAL_PENDING",
        reservedUntil,
        inventoryReserved: true,
        statusHistory: {
          create: {
            toStatus: "MANUAL_PENDING",
            reason: "Local QA reservation created",
          },
        },
      },
    });
    await transaction.order.create({
      data: {
        id: manualOrderId,
        orderNumber: manualOrderNumber,
        idempotencyKey: manualIdempotencyKey,
        productId,
        productNameSnapshot: "QA finite-stock product",
        currencyCode: currency.code,
        amount: new Prisma.Decimal("10.00"),
        exchangeRateSnapshot: new Prisma.Decimal("1.0000000000"),
        productVersion: 1,
        contactChannel: "EMAIL",
        contactEncrypted: "qa-only-not-a-real-contact-ciphertext",
        contactHash: "0".repeat(64),
        maskedContact: "qa***@invalid.example",
        acceptedPolicyVersion: "qa-only",
        status: "MANUAL_PENDING",
        reservedUntil: new Date(reconciledAt.getTime() + 30 * 60_000),
        inventoryReserved: true,
        statusHistory: {
          create: {
            toStatus: "MANUAL_PENDING",
            reason: "Local QA manual reservation created",
          },
        },
      },
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  const first = await reservations.reconcileExpired(reconciledAt);
  assert.deepEqual(first, {
    candidates: 1,
    cancelled: 1,
    stockRestored: 1,
  });

  const [order, product, historyCount, auditCount] = await Promise.all([
    prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        status: true,
        inventoryReserved: true,
        inventoryReleasedAt: true,
      },
    }),
    prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { stockQuantity: true, version: true },
    }),
    prisma.orderStatusHistory.count({ where: { orderId } }),
    prisma.auditEvent.count({
      where: {
        targetType: "Order",
        targetId: orderId,
        action: "order.reservation.expired",
      },
    }),
  ]);
  assert.equal(order.status, "CANCELLED");
  assert.equal(order.inventoryReserved, true);
  assert.equal(order.inventoryReleasedAt?.toISOString(), reconciledAt.toISOString());
  assert.equal(product.stockQuantity, 2);
  assert.equal(product.version, 3);
  assert.equal(historyCount, 2);
  assert.equal(auditCount, 1);

  const second = await reservations.reconcileExpired(reconciledAt);
  assert.deepEqual(second, {
    candidates: 0,
    cancelled: 0,
    stockRestored: 0,
  });
  assert.equal(
    await prisma.orderStatusHistory.count({ where: { orderId } }),
    2,
  );
  assert.equal(
    await prisma.auditEvent.count({
      where: {
        targetType: "Order",
        targetId: orderId,
        action: "order.reservation.expired",
      },
    }),
    1,
  );

  const manualBefore = await prisma.order.findUniqueOrThrow({
    where: { id: manualOrderId },
    select: { updatedAt: true },
  });
  const manualDetail = await adminOrders.updateStatus(
    manualOrderId,
    {
      expectedStatus: "MANUAL_PENDING",
      expectedUpdatedAt: manualBefore.updatedAt.toISOString(),
      status: "CANCELLED",
      reason: "Local QA manual cancellation",
    },
    {
      userId: adminId,
      requestId: `qa-reservation:${token}`,
      ip: "127.0.0.1",
      reauthenticatedAt: Date.now(),
    },
  );
  assert.equal(manualDetail.status, "CANCELLED");
  const [manualOrder, stockAfterManual, manualHistoryCount, manualAuditCount] = await Promise.all([
    prisma.order.findUniqueOrThrow({
      where: { id: manualOrderId },
      select: { inventoryReleasedAt: true },
    }),
    prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { stockQuantity: true, version: true },
    }),
    prisma.orderStatusHistory.count({ where: { orderId: manualOrderId } }),
    prisma.auditEvent.count({
      where: {
        targetType: "Order",
        targetId: manualOrderId,
        action: "order.status.update",
      },
    }),
  ]);
  assert.ok(manualOrder.inventoryReleasedAt);
  assert.equal(stockAfterManual.stockQuantity, 3);
  assert.equal(stockAfterManual.version, 4);
  assert.equal(manualHistoryCount, 2);
  assert.equal(manualAuditCount, 1);
  await assert.rejects(
    adminOrders.updateStatus(
      manualOrderId,
      {
        expectedStatus: "MANUAL_PENDING",
        expectedUpdatedAt: manualBefore.updatedAt.toISOString(),
        status: "CANCELLED",
        reason: "Local QA duplicate cancellation",
      },
      {
        userId: adminId,
        requestId: `qa-reservation-duplicate:${token}`,
        ip: "127.0.0.1",
        reauthenticatedAt: Date.now(),
      },
    ),
    ConflictException,
  );
  assert.equal(
    (await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { stockQuantity: true },
    })).stockQuantity,
    3,
  );

  console.log(JSON.stringify({
    verified: true,
    automaticExpiry: {
      orderStatus: order.status,
      inventoryReleasedExactlyOnce: true,
      stockAfterRelease: product.stockQuantity,
      historyEvents: historyCount,
      auditEvents: auditCount,
    },
    manualCancellation: {
      orderStatus: manualDetail.status,
      inventoryReleasedExactlyOnce: true,
      stockAfterRelease: stockAfterManual.stockQuantity,
      historyEvents: manualHistoryCount,
      auditEvents: manualAuditCount,
    },
  }));
} finally {
  await prisma.$transaction([
    prisma.auditEvent.deleteMany({
      where: {
        targetType: "Order",
        targetId: { in: [orderId, manualOrderId] },
      },
    }),
    prisma.order.deleteMany({ where: { id: { in: [orderId, manualOrderId] } } }),
    prisma.productTranslation.deleteMany({ where: { productId } }),
    prisma.product.deleteMany({ where: { id: productId } }),
    prisma.categoryTranslation.deleteMany({ where: { categoryId } }),
    prisma.category.deleteMany({ where: { id: categoryId } }),
    prisma.adminUser.deleteMany({ where: { id: adminId } }),
  ]);
  const remainingQaRecords = await Promise.all([
    prisma.auditEvent.count({ where: { targetId: { in: [orderId, manualOrderId] } } }),
    prisma.orderStatusHistory.count({ where: { orderId: { in: [orderId, manualOrderId] } } }),
    prisma.order.count({ where: { id: { in: [orderId, manualOrderId] } } }),
    prisma.productTranslation.count({ where: { productId } }),
    prisma.product.count({ where: { id: productId } }),
    prisma.categoryTranslation.count({ where: { categoryId } }),
    prisma.category.count({ where: { id: categoryId } }),
    prisma.adminUser.count({ where: { id: adminId } }),
  ]);
  assert.deepEqual(remainingQaRecords, [0, 0, 0, 0, 0, 0, 0, 0]);
  console.log(JSON.stringify({
    cleanupVerified: true,
    remainingQaRecords: remainingQaRecords.reduce((sum, count) => sum + count, 0),
  }));
  await prisma.$disconnect();
}
