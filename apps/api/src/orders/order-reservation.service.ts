import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

const reconciliationLimit = 100;
const expiryReason = "Reservation expired before merchant confirmation";

export type OrderReservationReconciliation = {
  candidates: number;
  cancelled: number;
  stockRestored: number;
};

@Injectable()
export class OrderReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async reconcileExpired(
    now = new Date(),
  ): Promise<OrderReservationReconciliation> {
    const candidates = await this.prisma.order.findMany({
      where: {
        status: "MANUAL_PENDING",
        inventoryReserved: true,
        inventoryReleasedAt: null,
        reservedUntil: { lte: now },
      },
      orderBy: [
        { reservedUntil: "asc" },
        { id: "asc" },
      ],
      take: reconciliationLimit,
      select: {
        id: true,
        productId: true,
      },
    });

    let cancelled = 0;
    let stockRestored = 0;
    for (const candidate of candidates) {
      const result = await this.prisma.$transaction(async (transaction) => {
        const orderUpdate = await transaction.order.updateMany({
          where: {
            id: candidate.id,
            status: "MANUAL_PENDING",
            inventoryReserved: true,
            inventoryReleasedAt: null,
            reservedUntil: { lte: now },
          },
          data: {
            status: "CANCELLED",
            inventoryReleasedAt: now,
          },
        });
        if (orderUpdate.count !== 1) {
          return { cancelled: 0, stockRestored: 0 };
        }

        const productUpdate = await transaction.product.updateMany({
          where: {
            id: candidate.productId,
            stockMode: "FINITE",
            stockQuantity: { not: null },
          },
          data: {
            stockQuantity: { increment: 1 },
            version: { increment: 1 },
          },
        });
        await transaction.orderStatusHistory.create({
          data: {
            orderId: candidate.id,
            fromStatus: "MANUAL_PENDING",
            toStatus: "CANCELLED",
            reason: expiryReason,
          },
        });
        await this.audit.record({
          action: "order.reservation.expired",
          targetType: "Order",
          targetId: candidate.id,
          result: "SUCCEEDED",
          requestId: `system:order-expiry:${randomUUID()}`,
          reason: expiryReason,
          beforeData: {
            status: "MANUAL_PENDING",
            inventoryReserved: true,
          },
          afterData: {
            status: "CANCELLED",
            inventoryReleasedAt: now.toISOString(),
            stockRestored: productUpdate.count === 1,
          },
        }, transaction);
        return {
          cancelled: 1,
          stockRestored: productUpdate.count === 1 ? 1 : 0,
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      cancelled += result.cancelled;
      stockRestored += result.stockRestored;
    }

    return {
      candidates: candidates.length,
      cancelled,
      stockRestored,
    };
  }
}
