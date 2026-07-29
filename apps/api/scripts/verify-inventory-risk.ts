import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { AdminService } from "../src/admin/admin.service.js";
import { AuditService } from "../src/audit/audit.service.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

const token = randomBytes(6).toString("hex");
const categoryId = `qa-inventory-category-${token}`;
const categorySlug = `qa-inventory-${token}`;
const productIds = {
  invalid: `qa-inventory-invalid-${token}`,
  soldOut: `qa-inventory-sold-out-${token}`,
  lowStock: `qa-inventory-low-stock-${token}`,
  safe: `qa-inventory-safe-${token}`,
};
const prisma = new PrismaService(new ConfigService());
const admin = new AdminService(
  prisma,
  new AuditService(prisma),
  { reconcileExpired: async () => ({ candidates: 0, cancelled: 0, stockRestored: 0 }) } as never,
);

try {
  const baseline = await admin.overview();
  await prisma.category.create({
    data: {
      id: categoryId,
      slug: categorySlug,
      status: "ACTIVE",
      translations: {
        create: [
          { locale: "ZH", name: "QA 库存风险验证" },
          { locale: "EN", name: "QA inventory risk verification" },
        ],
      },
    },
  });
  const products = [
    {
      id: productIds.invalid,
      stockQuantity: null,
      nameZh: "QA 库存数据冲突",
      nameEn: "QA invalid stock",
    },
    {
      id: productIds.soldOut,
      stockQuantity: 0,
      nameZh: "QA 售罄商品",
      nameEn: "QA sold-out product",
    },
    {
      id: productIds.lowStock,
      stockQuantity: 3,
      nameZh: "QA 低库存商品",
      nameEn: "QA low-stock product",
    },
    {
      id: productIds.safe,
      stockQuantity: 4,
      nameZh: "QA 安全库存商品",
      nameEn: "QA safe-stock product",
    },
  ] as const;
  for (const [index, product] of products.entries()) {
    await prisma.product.create({
      data: {
        id: product.id,
        slug: `${categorySlug}-${index}`,
        categoryId,
        imageKey: "/assets/product-codex.webp",
        basePrice: new Prisma.Decimal("10.00"),
        stockMode: "FINITE",
        stockQuantity: product.stockQuantity,
        status: "ACTIVE",
        sortOrder: 10_000 + index,
        translations: {
          create: [
            {
              locale: "ZH",
              name: product.nameZh,
              normalizedName: product.nameZh.toLocaleLowerCase(),
              kicker: "QA",
              description: "只用于本地全库库存风险验证。",
            },
            {
              locale: "EN",
              name: product.nameEn,
              normalizedName: product.nameEn.toLocaleLowerCase(),
              kicker: "QA",
              description: "Used only for local full-catalog inventory risk verification.",
            },
          ],
        },
      },
    });
  }

  const result = await admin.overview();
  assert.equal(
    result.inventoryRisk.evaluatedProductCount,
    baseline.inventoryRisk.evaluatedProductCount + 4,
  );
  assert.equal(
    result.inventoryRisk.affectedProductCount,
    baseline.inventoryRisk.affectedProductCount + 3,
  );
  assert.equal(
    result.inventoryRisk.invalidStockCount,
    baseline.inventoryRisk.invalidStockCount + 1,
  );
  assert.equal(
    result.inventoryRisk.soldOutCount,
    baseline.inventoryRisk.soldOutCount + 1,
  );
  assert.equal(
    result.inventoryRisk.lowStockCount,
    baseline.inventoryRisk.lowStockCount + 1,
  );
  assert.equal(result.inventoryRisk.threshold, 3);
  assert.equal(result.inventoryRisk.sampleLimit, 6);
  assert.deepEqual(
    result.inventoryRisk.items
      .filter((item) => Object.values(productIds).includes(item.id))
      .map((item) => [item.id, item.risk, item.stockQuantity]),
    [
      [productIds.invalid, "INVALID_STOCK", null],
      [productIds.soldOut, "SOLD_OUT", 0],
      [productIds.lowStock, "LOW_STOCK", 3],
    ],
  );
  assert.equal(
    result.inventoryRisk.items.some((item) => item.id === productIds.safe),
    false,
  );

  console.log(JSON.stringify({
    verified: true,
    source: result.inventoryRisk.source,
    threshold: result.inventoryRisk.threshold,
    evaluatedProductCount: result.inventoryRisk.evaluatedProductCount,
    affectedProductCount: result.inventoryRisk.affectedProductCount,
    samplePriority: ["INVALID_STOCK", "SOLD_OUT", "LOW_STOCK"],
  }));
} finally {
  await prisma.product.deleteMany({ where: { id: { in: Object.values(productIds) } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  const remainingQaRecords = await Promise.all([
    prisma.product.count({ where: { id: { in: Object.values(productIds) } } }),
    prisma.productTranslation.count({ where: { productId: { in: Object.values(productIds) } } }),
    prisma.category.count({ where: { id: categoryId } }),
    prisma.categoryTranslation.count({ where: { categoryId } }),
  ]);
  assert.deepEqual(remainingQaRecords, [0, 0, 0, 0]);
  console.log(JSON.stringify({
    cleanupVerified: true,
    remainingQaRecords: remainingQaRecords.reduce((sum, count) => sum + count, 0),
  }));
  await prisma.$disconnect();
}
