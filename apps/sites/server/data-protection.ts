import { ApiInputError } from "./http";

export const sitesDataProtectionPurposes = [
  "ORDER_CONTACT",
  "BACKUP_SNAPSHOT",
  "RESTORE_TOKEN",
  "RESTORE_PROOF",
] as const;

export type SitesDataProtectionPurpose = (typeof sitesDataProtectionPurposes)[number];
export type SitesDataKeyContext = "ORDER" | "BACKUP";

const encoder = new TextEncoder();
const textBuffer = (value: string): ArrayBuffer =>
  encoder.encode(value).buffer as ArrayBuffer;
const hkdfSalt = textBuffer("cloudbridge:sites:data-protection:v2");

const purposeInfo = (purpose: SitesDataProtectionPurpose): ArrayBuffer =>
  textBuffer(`cloudbridge:sites:${purpose.toLowerCase().replaceAll("_", "-")}:v2`);

export class ProtectedDataInvalidError extends Error {
  constructor(readonly kind: "CONTACT") {
    super(`Protected ${kind.toLowerCase()} data is invalid.`);
  }
}

export async function encryptOrderContact(
  value: string,
  encodedKey: string | undefined,
): Promise<string> {
  const key = await deriveSitesAesKey(
    encodedKey,
    "ORDER_CONTACT",
    "ORDER",
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: purposeInfo("ORDER_CONTACT"),
    },
    key,
    encoder.encode(value),
  );
  return `v2.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptOrderContact(
  value: string,
  encodedKey: string | undefined,
  context: SitesDataKeyContext = "ORDER",
): Promise<string> {
  const [version, ivValue, encryptedValue, extra] = value.split(".");
  if (
    (version !== "v1" && version !== "v2")
    || !ivValue
    || !encryptedValue
    || extra
  ) {
    throw new ProtectedDataInvalidError("CONTACT");
  }
  const key = version === "v2"
    ? await deriveSitesAesKey(encodedKey, "ORDER_CONTACT", context, ["decrypt"])
    : await importLegacySitesAesKey(encodedKey, context, ["decrypt"]);
  try {
    const decrypted = await crypto.subtle.decrypt(
      version === "v2"
        ? {
            name: "AES-GCM",
            iv: decodeBase64Url(ivValue),
            additionalData: purposeInfo("ORDER_CONTACT"),
          }
        : {
            name: "AES-GCM",
            iv: decodeBase64Url(ivValue),
          },
      key,
      decodeBase64Url(encryptedValue),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new ProtectedDataInvalidError("CONTACT");
  }
}

export async function deriveSitesAesKey(
  encodedKey: string | undefined,
  purpose: SitesDataProtectionPurpose,
  context: SitesDataKeyContext,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const bits = await deriveSitesKeyBits(encodedKey, purpose, context);
  return crypto.subtle.importKey(
    "raw",
    bits,
    { name: "AES-GCM" },
    false,
    usages,
  );
}

export async function deriveSitesHmacKey(
  encodedKey: string | undefined,
  purpose: SitesDataProtectionPurpose,
  context: SitesDataKeyContext,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const bits = await deriveSitesKeyBits(encodedKey, purpose, context);
  return crypto.subtle.importKey(
    "raw",
    bits,
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

export async function importLegacySitesAesKey(
  encodedKey: string | undefined,
  context: SitesDataKeyContext,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    requireSitesDataKey(encodedKey, context),
    { name: "AES-GCM" },
    false,
    usages,
  );
}

export async function importLegacySitesHmacKey(
  encodedKey: string | undefined,
  context: SitesDataKeyContext,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    requireSitesDataKey(encodedKey, context),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

export function sitesDataAdditionalData(
  purpose: SitesDataProtectionPurpose,
): ArrayBuffer {
  return purposeInfo(purpose);
}

export function requireSitesDataKey(
  encodedKey: string | undefined,
  context: SitesDataKeyContext,
): ArrayBuffer {
  if (!encodedKey) {
    throw context === "ORDER"
      ? new ApiInputError(
          "ORDER_ENCRYPTION_NOT_CONFIGURED",
          "Order encryption is not configured. Orders remain paused.",
          503,
        )
      : new ApiInputError(
          "BACKUP_ENCRYPTION_NOT_CONFIGURED",
          "Backup encryption is not configured.",
          503,
        );
  }
  let keyBytes: ArrayBuffer;
  try {
    keyBytes = decodeBase64Url(encodedKey);
  } catch {
    throw invalidKey(context);
  }
  if (keyBytes.byteLength !== 32) throw invalidKey(context);
  return keyBytes;
}

export function decodeBase64Url(value: string): ArrayBuffer {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/u.test(value)) throw new Error("Invalid base64 value.");
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(
    decoded,
    (character) => character.charCodeAt(0),
  ).buffer as ArrayBuffer;
}

export function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function deriveSitesKeyBits(
  encodedKey: string | undefined,
  purpose: SitesDataProtectionPurpose,
  context: SitesDataKeyContext,
): Promise<ArrayBuffer> {
  const rootKey = await crypto.subtle.importKey(
    "raw",
    requireSitesDataKey(encodedKey, context),
    "HKDF",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: hkdfSalt,
      info: purposeInfo(purpose),
    },
    rootKey,
    256,
  );
}

function invalidKey(context: SitesDataKeyContext): ApiInputError {
  return context === "ORDER"
    ? new ApiInputError(
        "ORDER_ENCRYPTION_INVALID",
        "Order encryption is unavailable.",
        503,
      )
    : new ApiInputError(
        "BACKUP_ENCRYPTION_INVALID",
        "Backup encryption is unavailable.",
        503,
      );
}
