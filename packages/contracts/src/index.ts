export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];

export type LocalizedText = Readonly<Record<Locale, string>>;

export type Money = {
  amount: string;
  currency: string;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type ApiSuccess<T> = {
  data: T;
  meta?: PageMeta;
  requestId: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: ReadonlyArray<{
      field?: string;
      code: string;
      message: string;
    }>;
  };
  requestId: string;
};

export const productStatuses = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof productStatuses)[number];

export const stockModes = ["FINITE", "UNLIMITED"] as const;
export type StockMode = (typeof stockModes)[number];

export const orderStatuses = [
  "MANUAL_PENDING",
  "CONTACTED",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
  "PAID",
  "FULFILLING",
  "COMPLETED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "DISPUTED",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const contactChannelTypes = ["WHATSAPP", "EMAIL", "TELEGRAM", "WECHAT", "QQ"] as const;
export type ContactChannelType = (typeof contactChannelTypes)[number];

export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  order: number;
};

export type ProductSummary = {
  id: string;
  slug: string;
  categoryId: string;
  name: string;
  kicker: string;
  imageUrl: string;
  price: Money;
  compareAtPrice: Money | null;
  referencePrice: Money | null;
  stockMode: StockMode;
  stockQuantity: number | null;
  status: ProductStatus;
};

export type ProductDetail = ProductSummary & {
  description: string;
  category: CategorySummary;
};

export type CreateOrderInput = {
  locale: Locale;
  productId: string;
  currency: string;
  contactChannel: ContactChannelType;
  contactValue: string;
  acceptedPolicyVersion: string;
  expectedPrice: Money;
};

export type OrderReceipt = {
  orderNumber: string;
  status: OrderStatus;
  productName: string;
  amount: Money;
  referenceAmount: Money | null;
  contactChannel: ContactChannelType;
  maskedContact: string;
  reservedUntil: string;
};
