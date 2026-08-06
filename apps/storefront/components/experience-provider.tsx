"use client";

import type { OrderReceipt, ProductSummary } from "@cloudbridge/contracts";

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
  clearCart: () => void;
  orderReceipts: OrderReceipt[];
  rememberOrderReceipt: (receipt: OrderReceipt) => void;
};

const DEFAULT_DRAFT: OrderDraft = {
  channel: "WHATSAPP",
  contact: "",
  idempotencyKey: null,
};

const ExperienceContext = createContext<ExperienceContextValue | null>(null);
const CURRENCY_KEY = "cloudbridge-storefront-currency";

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

  useEffect(() => {
    const saved = window.sessionStorage.getItem(CURRENCY_KEY);
    if (saved && /^[A-Z]{3,8}$/u.test(saved)) setCurrencyState(saved);
  }, []);

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

  const clearCart = useCallback(() => setCartItems([]), []);

  const rememberOrderReceipt = useCallback((receipt: OrderReceipt) => {
    setOrderReceipts((current) =>
      [
        receipt,
        ...current.filter((item) => item.orderNumber !== receipt.orderNumber),
      ].slice(0, 20),
    );
  }, []);

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
      clearCart,
      orderReceipts,
      rememberOrderReceipt,
    }),
    [
      closeSupport,
      clearOrderDraft,
      consumeListingScroll,
      cartItems,
      addCartItem,
      removeCartItem,
      clearCart,
      currency,
      getListingHref,
      getOrderDraft,
      openSupport,
      orderReceipts,
      rememberListing,
      rememberOrderReceipt,
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
