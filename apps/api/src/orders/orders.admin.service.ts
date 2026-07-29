import type {
  AdminOrderAssignee,
  AdminOrderDetail,
  AdminOrderListItem,
  ManualPaymentStage,
  OrderStatus,
  RevealedAdminOrderContact,
} from "@cloudbridge/contracts";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import type { AdminActor } from "../common/admin-actor.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ContactProtectionService } from "./contact-protection.service.js";
import { OrderReservationService } from "./order-reservation.service.js";
import type {
  AdminOrderListQueryDto,
  AssignAdminOrderDto,
  RevealAdminOrderContactDto,
  UpdateAdminOrderStatusDto,
} from "./orders.admin.dto.js";

export const orderTransitions: Readonly<Record<OrderStatus, ReadonlyArray<OrderStatus>>> = {
  MANUAL_PENDING: ["CONTACTED", "CANCELLED"],
  CONTACTED: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["PAYMENT_PROCESSING", "PAID", "CANCELLED"],
  PAYMENT_PROCESSING: ["PAID", "CANCELLED", "DISPUTED"],
  PAID: ["FULFILLING", "REFUND_PENDING", "DISPUTED"],
  FULFILLING: ["COMPLETED", "REFUND_PENDING", "DISPUTED"],
  COMPLETED: ["REFUND_PENDING", "DISPUTED"],
  CANCELLED: [],
  REFUND_PENDING: ["REFUNDED", "DISPUTED"],
  REFUNDED: [],
  DISPUTED: ["REFUND_PENDING", "REFUNDED"],
};

const afterSalesStatuses = [
  "REFUND_PENDING",
  "REFUNDED",
  "DISPUTED",
] as const satisfies ReadonlyArray<OrderStatus>;

export const deriveManualPaymentStage = (status: OrderStatus): ManualPaymentStage => {
  if (status === "PAYMENT_PROCESSING") return "EXTERNAL_PROCESSING_UNVERIFIED";
  if (status === "PAID" || status === "FULFILLING" || status === "COMPLETED") {
    return "MANUALLY_RECORDED_PAID";
  }
  if (status === "REFUND_PENDING") return "REFUND_REVIEW";
  if (status === "REFUNDED") return "MANUALLY_RECORDED_REFUNDED";
  if (status === "DISPUTED") return "DISPUTE_REVIEW";
  if (status === "CANCELLED") return "CANCELLED";
  return "NOT_RECORDED";
};

const orderListSelect = {
  id: true,
  orderNumber: true,
  productId: true,
  productNameSnapshot: true,
  currencyCode: true,
  amount: true,
  referenceCurrencyCode: true,
  referenceAmount: true,
  contactChannel: true,
  maskedContact: true,
  status: true,
  paymentMode: true,
  reservedUntil: true,
  assignedTo: {
    select: {
      id: true,
      displayName: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

const orderDetailSelect = {
  ...orderListSelect,
  exchangeRateSnapshot: true,
  productVersion: true,
  acceptedPolicyVersion: true,
  statusHistory: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

type OrderListRow = Prisma.OrderGetPayload<{ select: typeof orderListSelect }>;
type OrderDetailRow = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;
type OrderReadClient = Pick<Prisma.TransactionClient, "currency" | "order">;

const serializeListItem = (
  order: OrderListRow,
  currencyDigits: ReadonlyMap<string, number>,
): AdminOrderListItem => ({
  id: order.id,
  orderNumber: order.orderNumber,
  productId: order.productId,
  productNameSnapshot: order.productNameSnapshot,
  amount: {
    amount: order.amount.toFixed(currencyDigits.get(order.currencyCode) ?? 2),
    currency: order.currencyCode,
  },
  referenceAmount: order.referenceAmount && order.referenceCurrencyCode
    ? {
        amount: order.referenceAmount.toFixed(
          currencyDigits.get(order.referenceCurrencyCode) ?? 2,
        ),
        currency: order.referenceCurrencyCode,
      }
    : null,
  contactChannel: order.contactChannel,
  maskedContact: order.maskedContact,
  status: order.status,
  paymentMode: order.paymentMode,
  paymentStage: deriveManualPaymentStage(order.status),
  reservedUntil: order.reservedUntil.toISOString(),
  assignedTo: order.assignedTo,
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
});

const serializeDetail = (
  order: OrderDetailRow,
  currencyDigits: ReadonlyMap<string, number>,
): AdminOrderDetail => ({
  ...serializeListItem(order, currencyDigits),
  exchangeRateSnapshot: order.exchangeRateSnapshot.toFixed(10),
  productVersion: order.productVersion,
  acceptedPolicyVersion: order.acceptedPolicyVersion,
  allowedTransitions: orderTransitions[order.status],
  statusHistory: order.statusHistory.map((event) => ({
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    reason: event.reason,
    actor: event.actor,
    createdAt: event.createdAt.toISOString(),
  })),
});

@Injectable()
export class OrdersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contacts: ContactProtectionService,
    private readonly reservations: OrderReservationService,
  ) {}

  async list(query: AdminOrderListQueryDto) {
    await this.reservations.reconcileExpired();
    const search = query.search?.trim();
    if (
      query.scope === "AFTER_SALES"
      && query.status
      && !afterSalesStatuses.includes(query.status as (typeof afterSalesStatuses)[number])
    ) {
      throw new BadRequestException(
        "The selected order status is not part of the after-sales scope.",
      );
    }
    const status = query.status
      ?? (query.scope === "AFTER_SALES" ? { in: [...afterSalesStatuses] } : undefined);
    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      ...(query.contactChannel ? { contactChannel: query.contactChannel } : {}),
      ...(query.assigneeId === "UNASSIGNED"
        ? { assignedToId: null }
        : query.assigneeId
          ? { assignedToId: query.assigneeId }
          : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search } },
              { productNameSnapshot: { contains: search } },
              { maskedContact: { contains: search } },
            ],
          }
        : {}),
    };
    const [total, orders, currencies] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: orderListSelect,
      }),
      this.prisma.currency.findMany({
        select: { code: true, digits: true },
      }),
    ]);
    const currencyDigits = new Map(currencies.map((currency) => [currency.code, currency.digits]));
    return {
      data: orders.map((order) => serializeListItem(order, currencyDigits)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async assignees(): Promise<AdminOrderAssignee[]> {
    return this.prisma.adminUser.findMany({
      where: {
        status: "ACTIVE",
        roles: {
          some: {
            role: {
              permissions: {
                some: {
                  permission: {
                    key: "orders.write",
                  },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        displayName: true,
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
    });
  }

  async detail(id: string): Promise<AdminOrderDetail> {
    await this.reservations.reconcileExpired();
    return this.loadDetail(this.prisma, id);
  }

  async updateStatus(
    id: string,
    input: UpdateAdminOrderStatusDto,
    actor: AdminActor,
  ): Promise<AdminOrderDetail> {
    await this.reservations.reconcileExpired();
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.order.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          productId: true,
          inventoryReserved: true,
          inventoryReleasedAt: true,
          updatedAt: true,
        },
      });
      if (!current) throw new NotFoundException("Order not found.");
      const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
      if (
        current.status !== input.expectedStatus
        || current.updatedAt.getTime() !== expectedUpdatedAt.getTime()
      ) {
        throw new ConflictException("Order changed. Reload the latest order before saving.");
      }
      if (!orderTransitions[current.status].includes(input.status)) {
        throw new ConflictException(
          `Order cannot move from ${current.status} to ${input.status}.`,
        );
      }

      const shouldReleaseInventory = input.status === "CANCELLED"
        && current.inventoryReserved
        && current.inventoryReleasedAt === null;
      const inventoryReleasedAt = shouldReleaseInventory ? new Date() : undefined;
      const updated = await transaction.order.updateMany({
        where: {
          id,
          status: input.expectedStatus,
          updatedAt: expectedUpdatedAt,
          ...(shouldReleaseInventory ? { inventoryReleasedAt: null } : {}),
        },
        data: {
          status: input.status,
          inventoryReleasedAt,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Order changed. Reload the latest order before saving.");
      }
      const stockUpdate = shouldReleaseInventory
        ? await transaction.product.updateMany({
            where: {
              id: current.productId,
              stockMode: "FINITE",
              stockQuantity: { not: null },
            },
            data: {
              stockQuantity: { increment: 1 },
              version: { increment: 1 },
            },
          })
        : { count: 0 };
      await transaction.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: current.status,
          toStatus: input.status,
          reason: input.reason,
          actorId: actor.userId,
        },
      });
      await this.audit.record({
        actorId: actor.userId,
        action: "order.status.update",
        targetType: "Order",
        targetId: id,
        result: "SUCCEEDED",
        reason: input.reason,
        beforeData: { status: current.status },
        afterData: {
          status: input.status,
          externalActionVerified: false,
          ...(input.status === "CANCELLED"
            ? {
                inventoryReleased: shouldReleaseInventory,
                stockRestored: stockUpdate.count === 1,
              }
            : {}),
        },
        ...actor,
      }, transaction);
      return this.loadDetail(transaction, id);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async updateAssignment(
    id: string,
    input: AssignAdminOrderDto,
    actor: AdminActor,
  ): Promise<AdminOrderDetail> {
    await this.reservations.reconcileExpired();
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.order.findUnique({
        where: { id },
        select: {
          id: true,
          assignedToId: true,
          updatedAt: true,
        },
      });
      if (!current) throw new NotFoundException("Order not found.");
      const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
      if (
        current.assignedToId !== input.expectedAssigneeId
        || current.updatedAt.getTime() !== expectedUpdatedAt.getTime()
      ) {
        throw new ConflictException("Order changed. Reload the latest order before saving.");
      }
      if (input.assigneeId) {
        const assignee = await transaction.adminUser.findFirst({
          where: {
            id: input.assigneeId,
            status: "ACTIVE",
            roles: {
              some: {
                role: {
                  permissions: {
                    some: {
                      permission: {
                        key: "orders.write",
                      },
                    },
                  },
                },
              },
            },
          },
          select: { id: true },
        });
        if (!assignee) {
          throw new BadRequestException("The selected assignee is unavailable.");
        }
      }

      const updated = await transaction.order.updateMany({
        where: {
          id,
          assignedToId: input.expectedAssigneeId,
          updatedAt: expectedUpdatedAt,
        },
        data: {
          assignedToId: input.assigneeId,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Order changed. Reload the latest order before saving.");
      }
      await this.audit.record({
        actorId: actor.userId,
        action: "order.assignment.update",
        targetType: "Order",
        targetId: id,
        result: "SUCCEEDED",
        reason: input.reason,
        beforeData: { assigneeId: current.assignedToId },
        afterData: { assigneeId: input.assigneeId },
        ...actor,
      }, transaction);
      return this.loadDetail(transaction, id);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async revealContact(
    id: string,
    input: RevealAdminOrderContactDto,
    actor: AdminActor,
  ): Promise<RevealedAdminOrderContact> {
    if (!actor.reauthenticatedAt || Date.now() - actor.reauthenticatedAt > 5 * 60_000) {
      await this.audit.record({
        actorId: actor.userId,
        action: "order.contact.reveal",
        targetType: "Order",
        targetId: id,
        result: "DENIED",
        reason: input.reason,
        ...actor,
      });
      throw new ForbiddenException("Recent reauthentication is required.");
    }
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        contactEncrypted: true,
        contactChannel: true,
      },
    });
    if (!order) throw new NotFoundException("Order not found.");
    try {
      const contact = this.contacts.reveal(order.contactEncrypted);
      await this.audit.record({
        actorId: actor.userId,
        action: "order.contact.reveal",
        targetType: "Order",
        targetId: id,
        result: "SUCCEEDED",
        reason: input.reason,
        ...actor,
      });
      return {
        contact,
        channel: order.contactChannel,
      };
    } catch (error) {
      await this.audit.record({
        actorId: actor.userId,
        action: "order.contact.reveal",
        targetType: "Order",
        targetId: id,
        result: "FAILED",
        reason: input.reason,
        ...actor,
      });
      throw error;
    }
  }

  private async loadDetail(
    client: OrderReadClient,
    id: string,
  ): Promise<AdminOrderDetail> {
    const order = await client.order.findUnique({
      where: { id },
      select: orderDetailSelect,
    });
    if (!order) throw new NotFoundException("Order not found.");
    const currencyCodes = [
      order.currencyCode,
      ...(order.referenceCurrencyCode ? [order.referenceCurrencyCode] : []),
    ];
    const currencies = await client.currency.findMany({
      where: {
        code: {
          in: currencyCodes,
        },
      },
      select: {
        code: true,
        digits: true,
      },
    });
    return serializeDetail(
      order,
      new Map(currencies.map((currency) => [currency.code, currency.digits])),
    );
  }
}
