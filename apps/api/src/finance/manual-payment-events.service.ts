import type {
  AdminManualPaymentEvent,
  ManualPaymentEventType,
  OrderStatus,
} from "@cloudbridge/contracts";
import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AdminManualPaymentEventListQueryDto } from "./manual-payment-events.dto.js";

const paymentEventTypeByStatus = {
  PAID: "MANUALLY_RECORDED_PAID",
  REFUND_PENDING: "REFUND_REVIEW_STARTED",
  REFUNDED: "MANUALLY_RECORDED_REFUNDED",
  DISPUTED: "DISPUTE_REVIEW_STARTED",
} as const satisfies Readonly<Record<string, ManualPaymentEventType>>;

type ManualPaymentStatus = keyof typeof paymentEventTypeByStatus;

const manualPaymentStatuses = Object.keys(
  paymentEventTypeByStatus,
) as ManualPaymentStatus[];

const statusByPaymentEventType = Object.fromEntries(
  Object.entries(paymentEventTypeByStatus).map(([status, eventType]) => [
    eventType,
    status,
  ]),
) as Readonly<Record<ManualPaymentEventType, ManualPaymentStatus>>;

const manualPaymentEventSelect = {
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
  order: {
    select: {
      id: true,
      orderNumber: true,
      productNameSnapshot: true,
      currencyCode: true,
      amount: true,
      referenceCurrencyCode: true,
      referenceAmount: true,
      exchangeRateSnapshot: true,
      status: true,
      assignedTo: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  },
} satisfies Prisma.OrderStatusHistorySelect;

type ManualPaymentEventRow = Prisma.OrderStatusHistoryGetPayload<{
  select: typeof manualPaymentEventSelect;
}>;

const serializeManualPaymentEvent = (
  event: ManualPaymentEventRow,
  currencyDigits: ReadonlyMap<string, number>,
): AdminManualPaymentEvent => ({
  statusHistoryId: event.id,
  eventType: paymentEventTypeByStatus[event.toStatus as ManualPaymentStatus],
  fromStatus: event.fromStatus,
  toStatus: event.toStatus,
  orderId: event.order.id,
  orderNumber: event.order.orderNumber,
  productNameSnapshot: event.order.productNameSnapshot,
  orderAmount: {
    amount: event.order.amount.toFixed(
      currencyDigits.get(event.order.currencyCode) ?? 2,
    ),
    currency: event.order.currencyCode,
  },
  referenceAmount: event.order.referenceAmount
    && event.order.referenceCurrencyCode
    ? {
        amount: event.order.referenceAmount.toFixed(
          currencyDigits.get(event.order.referenceCurrencyCode) ?? 2,
        ),
        currency: event.order.referenceCurrencyCode,
      }
    : null,
  exchangeRateSnapshot: event.order.exchangeRateSnapshot.toFixed(10),
  currentStatus: event.order.status,
  currentAssignee: event.order.assignedTo,
  actor: event.actor,
  reason: event.reason,
  recordedAt: event.createdAt.toISOString(),
  externalActionVerified: false,
});

@Injectable()
export class ManualPaymentEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminManualPaymentEventListQueryDto) {
    const search = query.search?.trim();
    const orderFilters: Prisma.OrderWhereInput = {
      ...(query.currencyCode ? { currencyCode: query.currencyCode } : {}),
      ...(query.assigneeId === "UNASSIGNED"
        ? { assignedToId: null }
        : query.assigneeId
          ? { assignedToId: query.assigneeId }
          : {}),
    };
    const where: Prisma.OrderStatusHistoryWhereInput = {
      toStatus: query.eventType
        ? statusByPaymentEventType[query.eventType]
        : { in: [...manualPaymentStatuses] },
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(Object.keys(orderFilters).length > 0 ? { order: orderFilters } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search } },
              { order: { orderNumber: { contains: search } } },
              { order: { productNameSnapshot: { contains: search } } },
            ],
          }
        : {}),
    };

    const [total, events, currencies] = await this.prisma.$transaction([
      this.prisma.orderStatusHistory.count({ where }),
      this.prisma.orderStatusHistory.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: manualPaymentEventSelect,
      }),
      this.prisma.currency.findMany({
        select: {
          code: true,
          digits: true,
        },
      }),
    ]);
    const currencyDigits = new Map(
      currencies.map((currency) => [currency.code, currency.digits]),
    );

    return {
      data: events.map((event) =>
        serializeManualPaymentEvent(event, currencyDigits)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }
}
