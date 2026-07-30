export type ProductSharePayload = {
  title: string;
  text: string;
  url: string;
};

export function renderProductShareTemplate(
  template: string,
  productName: string,
  price: string,
): string {
  return template
    .replaceAll("{productName}", productName)
    .replaceAll("{price}", price);
}

export function cleanProductUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export async function tryNativeProductShare(
  share: ((payload: ProductSharePayload) => Promise<void>) | undefined,
  payload: ProductSharePayload,
): Promise<"shared" | "unsupported" | "cancelled" | "failed"> {
  if (!share) return "unsupported";
  try {
    await share(payload);
    return "shared";
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError"
      ? "cancelled"
      : "failed";
  }
}

export async function copyProductShare(
  writeText: ((value: string) => Promise<void>) | undefined,
  text: string,
  url: string,
): Promise<boolean> {
  if (!writeText) return false;
  try {
    await writeText(`${text}\n${url}`);
    return true;
  } catch {
    return false;
  }
}
