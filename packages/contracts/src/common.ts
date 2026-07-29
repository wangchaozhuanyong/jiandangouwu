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
