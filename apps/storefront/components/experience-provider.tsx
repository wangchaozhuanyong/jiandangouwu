"use client";

import {
  contactChannelTypes,
  type OrderReceipt,
  type ProductSummary,
} from "@cloudbridge/contracts";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type OrderDraft = {
  channel: "WHATSAPP" | "EMAIL" | "TELEGRAM" | "WECHAT" | "QQ";
  contact: string;
  idempotencyKey: string | null;
};

type ListingPosition = {
  href: string;
  scrollY: number;
};

type ExperienceContextValue = {
  currency: string;
  setCurrency: (currency: string) => void;
  supportOpen: boolean;
  openSupport: () => void;
  closeSupport: () => void;
  getOrderDraft: (slug: string) => OrderDraft;
  updateOrderDraft: (slug: string, patch: Partial<OrderDraft>) => void;
  clearOrderDraft: (slug: string) => void;
  rememberListing: (href: string, scrollY: number) => void;
  getListingHref: (locale: string) => string;
  consumeListingScroll: (href: string) => number | null;
  cartItems: ProductSummary[];
  addCartItem: (product: ProductSummary) => void;
  removeCartItem: (productId: string) => void;
  removeCartItems: (productIds: readonly string[]) => void;
  clearCart: () => void;
  orderReceipts: OrderReceipt[];
  orderReceiptsReady: boolean;
  rememberOrderReceipt: (receipt: OrderReceipt) => void;
  clearOrderReceipts: () => void;
};

const DEFAULT_DRAFT: OrderDraft = {
  channel: "WHATSAPP",
  contact: "",
  idempotencyKey: null,
};

const ExperienceContext = createContext<ExperienceContextValue | null>(null);
const CURRENCY_KEY = "cloudbridge-storefront-currency";
const ORDER_RECEIPTS_KEY = "cloudbridge-storefront-order-receipts";
const MAX_ORDER_RECEIPTS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMoney(value: unknown): value is { amount: string; currency: string } {
  return isRecord(value)
    && typeof value.amount === "string"
    && typeof value.currency === "string"
    && value.amount.length <= 48
    && /^[A-Z]{3,8}$/u.test(value.currency);
}

function isReceiptItem(value: unknown): boolean {
  return isRecord(value)
    && typeof value.productId === "string"
    && typeof value.productName === "string"
    && isMoney(value.amount)
    && (value.referenceAmount === null || isMoney(value.referenceAmount));
}

function isSafeOrderReceipt(value: unknown): value is OrderReceipt {
  return isRecord(value)
    && /^CB\d{8}[A-F0-9]{24}$/u.test(String(value.orderNumber ?? ""))
    && typeof value.status === "string"
    && /^[A-Z_]{3,40}$/u.test(value.status)
    && typeof value.productName === "string"
    && isMoney(value.amount)
    && (value.referenceAmount === null || isMoney(value.referenceAmount))
    && contactChannelTypes.includes(value.contactChannel as (typeof contactChannelTypes)[number])
    && typeof value.maskedContact === "string"
    && typeof value.reservedUntil === "string"
    && (
      value.items === undefined
      || (Array.isArray(value.items)
        && value.items.length <= 10
        && value.items.every(isReceiptItem))
    );
}

function readOrderReceipts(): OrderReceipt[] {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(ORDER_RECEIPTS_KEY) ?? "null");
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed
      .filter(isSafeOrderReceipt)
      .filter((receipt) => {
        if (seen.has(receipt.orderNumber)) return false;
        seen.add(receipt.orderNumber);
        return true;
      })
      .slice(0, MAX_ORDER_RECEIPTS);
  } catch {
    return [];
  }
}

export function ExperienceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currency, setCurrencyState] = useState("CNY");
  const [supportOpen, setSupportOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>({});
  const [listing, setListing] = useState<ListingPosition | null>(null);
  const [cartItems, setCartItems] = useState<ProductSummary[]>([]);
  const [orderReceipts, setOrderReceipts] = useState<OrderReceipt[]>([]);
  const [orderReceiptsReady, setOrderReceiptsReady] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(CURRENCY_KEY);
    if (saved && /^[A-Z]{3,8}$/u.test(saved)) setCurrencyState(saved);
  }, []);

  useEffect(() => {
    setOrderReceipts(readOrderReceipts());
    setOrderReceiptsReady(true);
  }, []);

  useEffect(() => {
    if (!orderReceiptsReady) return;
    try {
      if (orderReceipts.length) {
        window.sessionStorage.setItem(ORDER_RECEIPTS_KEY, JSON.stringify(orderReceipts));
      } else {
        window.sessionStorage.removeItem(ORDER_RECEIPTS_KEY);
      }
    } catch {
      // A restricted browser storage context only loses local restoration.
    }
  }, [orderReceipts, orderReceiptsReady]);

  const setCurrency = useCallback((next: string) => {
    setCurrencyState(next);
    window.sessionStorage.setItem(CURRENCY_KEY, next);
  }, []);

  const openSupport = useCallback(() => setSupportOpen(true), []);
  const closeSupport = useCallback(() => setSupportOpen(false), []);

  const getOrderDraft = useCallback(
    (slug: string) => drafts[slug] ?? DEFAULT_DRAFT,
    [drafts],
  );

  const updateOrderDraft = useCallback(
    (slug: string, patch: Partial<OrderDraft>) => {
      setDrafts((current) => ({
        ...current,
        [slug]: { ...(current[slug] ?? DEFAULT_DRAFT), ...patch },
      }));
    },
    [],
  );

  const clearOrderDraft = useCallback((slug: string) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
  }, []);

  const rememberListing = useCallback((href: string, scrollY: number) => {
    setListing({ href, scrollY: Math.max(0, Math.round(scrollY)) });
  }, []);

  const getListingHref = useCallback(
    (locale: string) => {
      if (!listing) return `/${locale}#catalog`;
      const queryIndex = listing.href.indexOf("?");
      const query = queryIndex >= 0 ? listing.href.slice(queryIndex) : "";
      return `/${locale}${query}#catalog`;
    },
    [listing],
  );

  const consumeListingScroll = useCallback(
    (href: string) => {
      if (!listing || listing.href !== href) return null;
      setListing(null);
      return listing.scrollY;
    },
    [listing],
  );

  const addCartItem = useCallback((product: ProductSummary) => {
    setCartItems((current) =>
      current.some((item) => item.id === product.id)
        ? current
        : [...current, product],
    );
  }, []);

  const removeCartItem = useCallback((productId: string) => {
    setCartItems((current) => current.filter((item) => item.id !== productId));
  }, []);

  const removeCartItems = useCallback((productIds: readonly string[]) => {
    const submittedIds = new Set(productIds);
    setCartItems((current) => current.filter((item) => !submittedIds.has(item.id)));
  }, []);

  const clearCart = useCallback(() => setCartItems([]), []);

  const rememberOrderReceipt = useCallback((receipt: OrderReceipt) => {
    setOrderReceipts((current) =>
      [
        receipt,
        ...current.filter((item) => item.orderNumber !== receipt.orderNumber),
      ].slice(0, MAX_ORDER_RECEIPTS),
    );
  }, []);

  const clearOrderReceipts = useCallback(() => setOrderReceipts([]), []);

  const value = useMemo<ExperienceContextValue>(
    () => ({
      currency,
      setCurrency,
      supportOpen,
      openSupport,
      closeSupport,
      getOrderDraft,
      updateOrderDraft,
      clearOrderDraft,
      rememberListing,
      getListingHref,
      consumeListingScroll,
      cartItems,
      addCartItem,
      removeCartItem,
      removeCartItems,
      clearCart,
      orderReceipts,
      orderReceiptsReady,
      rememberOrderReceipt,
      clearOrderReceipts,
    }),
    [
      closeSupport,
      clearOrderDraft,
      consumeListingScroll,
      cartItems,
      addCartItem,
      removeCartItem,
      removeCartItems,
      clearCart,
      currency,
      getListingHref,
      getOrderDraft,
      openSupport,
      orderReceipts,
      orderReceiptsReady,
      rememberListing,
      rememberOrderReceipt,
      clearOrderReceipts,
      setCurrency,
      supportOpen,
      updateOrderDraft,
    ],
  );

  return (
    <ExperienceContext.Provider value={value}>
      {children}
    </ExperienceContext.Provider>
  );
}

export function useExperience(): ExperienceContextValue {
  const value = useContext(ExperienceContext);
  if (!value)
    throw new Error("useExperience must be used inside ExperienceProvider");
  return value;
}
