import { randomBytes } from "node:crypto";
import type { OrderReceipt } from "@cloudbridge/contracts";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  DEFAULT_STOREFRONT_SETTINGS,
  parseOrderGateSettings,
  POLICY_VERSION_KEY,
  STOREFRONT_SETTINGS_KEY,
} from "../settings/settings.model.js";
import { ContactProtectionService } from "./contact-protection.service.js";
import type { CreateOrderDto } from "./orders.dto.js";

const createOrderNumber = (): string => {
  const now = new Date();
  const date = [
    String(now.getUTCFullYear()).slice(-2),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `CB-${date}-${randomBytes(5).toString("hex").slice(0, 6).toUpperCase()}`;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactProtectionService,
  ) {}

  private async receipt(order: {
    orderNumber: string;
    status: string;
    productNameSnapshot: string;
    amount: Prisma.Decimal;
    currencyCode: string;
    referenceAmount: Prisma.Decimal | null;
    referenceCurrencyCode: string | null;
    contactChannel: string;
    maskedContact: string;
    reservedUntil: Date;
  }): Promise<OrderReceipt> {
    const currencyCodes = [
      order.currencyCode,
      ...(order.referenceCurrencyCode ? [order.referenceCurrencyCode] : []),
    ];
    const currencies = await this.prisma.currency.findMany({
      where: { code: { in: currencyCodes } },
      select: { code: true, digits: true },
    });
    const digitsByCode = new Map(currencies.map((currency) => [currency.code, currency.digits]));
    return {
      orderNumber: order.orderNumber,
      status: order.status as OrderReceipt["status"],
      productName: order.productNameSnapshot,
      amount: {
        amount: order.amount.toFixed(digitsByCode.get(order.currencyCode) ?? 2),
        currency: order.currencyCode,
      },
      referenceAmount: order.referenceAmount && order.referenceCurrencyCode
        ? {
            amount: order.referenceAmount.toFixed(digitsByCode.get(order.referenceCurrencyCode) ?? 2),
            currency: order.referenceCurrencyCode,
          }
        : null,
      contactChannel: order.contactChannel as OrderReceipt["contactChannel"],
      maskedContact: order.maskedContact,
      reservedUntil: order.reservedUntil.toISOString(),
    };
  }

  async create(input: CreateOrderDto, idempotencyKey: string): Promise<OrderReceipt> {
    const protectedContact = this.contacts.protect(input.contactValue);
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) {
      this.assertIdempotentReplay(existing, input, protectedContact.hash);
      return this.receipt(existing);
    }
    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const [settingsRow, legacyPolicy, activeChannel] = await Promise.all([
          transaction.siteSetting.findUnique({ where: { key: STOREFRONT_SETTINGS_KEY } }),
          transaction.siteSetting.findUnique({ where: { key: POLICY_VERSION_KEY } }),
          transaction.merchantChannel.findFirst({
            where: {
              type: input.contactChannel,
              active: true,
            },
            select: { id: true },
          }),
        ]);
        const currentPolicyVersion = typeof legacyPolicy?.value === "string"
          ? legacyPolicy.value
          : DEFAULT_STOREFRONT_SETTINGS.policyVersion;
        const settings = parseOrderGateSettings(settingsRow?.value, currentPolicyVersion);
        if (!settings.acceptOrders) {
          throw new ConflictException("New orders are currently paused.");
        }
        if (input.acceptedPolicyVersion !== settings.policyVersion) {
          throw new ConflictException("The policy version changed. Review the latest policy before submitting.");
        }
        if (!activeChannel) {
          throw new ConflictException("The selected contact channel is unavailable.");
        }

        const product = await transaction.product.findFirst({
          where: { id: input.productId, status: "ACTIVE" },
          include: {
            translations: { where: { locale: input.locale === "zh" ? "ZH" : "EN" }, take: 1 },
          },
        });
        if (!product) throw new NotFoundException("Product not found.");
        const currency = await transaction.currency.findFirst({
          where: { code: input.currency, active: true },
        });
        if (!currency) throw new NotFoundException("Currency not found.");
        const rate = await transaction.exchangeRate.findFirst({
          where: { fromCode: "MYR", toCode: currency.code },
          orderBy: { effectiveAt: "desc" },
        });
        if (!rate) throw new ConflictException("The selected currency rate is unavailable.");
        const amount = product.basePrice.mul(rate.rate).toDecimalPlaces(currency.digits);
        if (input.expectedPrice.currency !== currency.code || !amount.equals(input.expectedPrice.amount)) {
          throw new ConflictException("The product price changed. Review the latest price before submitting.");
        }
        if (product.stockMode === "FINITE") {
          const stockUpdate = await transaction.product.updateMany({
            where: {
              id: product.id,
              stockQuantity: { gte: 1 },
            },
            data: {
              stockQuantity: { decrement: 1 },
              version: { increment: 1 },
            },
          });
          if (stockUpdate.count !== 1) throw new ConflictException("This product is currently unavailable.");
        }
        const referenceRate = await transaction.exchangeRate.findFirst({
          where: { fromCode: "MYR", toCode: currency.code === "USDT" ? "MYR" : "USDT" },
          orderBy: { effectiveAt: "desc" },
          include: { toCurrency: true },
        });
        const productName = product.translations[0]?.name ?? product.slug;
        const reservedUntil = new Date(Date.now() + 30 * 60 * 1000);
        return transaction.order.create({
          data: {
            orderNumber: createOrderNumber(),
            idempotencyKey,
            productId: product.id,
            productNameSnapshot: productName,
            currencyCode: currency.code,
            amount,
            referenceCurrencyCode: referenceRate?.toCode,
            referenceAmount: referenceRate
              ? product.basePrice.mul(referenceRate.rate).toDecimalPlaces(referenceRate.toCurrency.digits)
              : null,
            exchangeRateSnapshot: rate.rate,
            productVersion: product.version,
            contactChannel: input.contactChannel,
            contactEncrypted: protectedContact.encrypted,
            contactHash: protectedContact.hash,
            maskedContact: protectedContact.masked,
            acceptedPolicyVersion: input.acceptedPolicyVersion,
            reservedUntil,
            statusHistory: {
              create: {
                toStatus: "MANUAL_PENDING",
                reason: "Public manual order created",
              },
            },
          },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      return this.receipt(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await this.prisma.order.findUnique({ where: { idempotencyKey } });
        if (duplicate) {
          this.assertIdempotentReplay(duplicate, input, protectedContact.hash);
          return this.receipt(duplicate);
        }
      }
      throw error;
    }
  }

  private assertIdempotentReplay(
    existing: {
      productId: string;
      currencyCode: string;
      amount: Prisma.Decimal;
      contactChannel: string;
      contactHash: string;
      acceptedPolicyVersion: string;
    },
    input: CreateOrderDto,
    contactHash: string,
  ): void {
    const matches = existing.productId === input.productId
      && existing.currencyCode === input.currency
      && existing.amount.equals(input.expectedPrice.amount)
      && existing.contactChannel === input.contactChannel
      && existing.contactHash === contactHash
      && existing.acceptedPolicyVersion === input.acceptedPolicyVersion;
    if (!matches) {
      throw new ConflictException(
        "This Idempotency-Key was already used for a different order request.",
      );
    }
  }
}
