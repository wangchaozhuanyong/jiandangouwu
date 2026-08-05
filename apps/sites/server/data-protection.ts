import { ApiInputError } from "./http";

export const sitesDataProtectionPurposes = [
  "ORDER_CONTACT",
  "CONTACT_LOOKUP",
  "ORDER_LOOKUP",
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
const purposeInfoV3 = (purpose: SitesDataProtectionPurpose, keyId: string): ArrayBuffer =>
  textBuffer(`cloudbridge:sites:${purpose.toLowerCase().replaceAll("_", "-")}:v3:${keyId}`);

export class ProtectedDataInvalidError extends Error {
  constructor(readonly kind: "CONTACT") {
    super(`Protected ${kind.toLowerCase()} data is invalid.`);
  }
}

export async function encryptOrderContact(
  value: string,
  encodedKey: string | undefined,
  nextEncodedKey?: string,
): Promise<string> {
  const activeKey = nextEncodedKey ?? encodedKey;
  const keyId = await sitesDataKeyId(activeKey, "ORDER");
  const key = await deriveSitesAesKey(
    activeKey,
    "ORDER_CONTACT",
    "ORDER",
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: purposeInfoV3("ORDER_CONTACT", keyId),
    },
    key,
    encoder.encode(value),
  );
  return `v3.${keyId}.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptOrderContact(
  value: string,
  encodedKey: string | undefined,
  context: SitesDataKeyContext = "ORDER",
  nextEncodedKey?: string,
): Promise<string> {
  const parts = value.split(".");
  const version = parts[0];
  if (version === "v3") {
    const [, keyId, ivValue, encryptedValue, extra] = parts;
    if (!keyId || !ivValue || !encryptedValue || extra) {
      throw new ProtectedDataInvalidError("CONTACT");
    }
    const matchingKey = await matchingDataKey(
      keyId,
      [nextEncodedKey, encodedKey],
      context,
    );
    if (!matchingKey) throw new ProtectedDataInvalidError("CONTACT");
    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: decodeBase64Url(ivValue),
          additionalData: purposeInfoV3("ORDER_CONTACT", keyId),
        },
        await deriveSitesAesKey(matchingKey, "ORDER_CONTACT", context, ["decrypt"]),
        decodeBase64Url(encryptedValue),
      );
      return new TextDecoder().decode(decrypted);
    } catch {
      throw new ProtectedDataInvalidError("CONTACT");
    }
  }
  const [, ivValue, encryptedValue, extra] = parts;
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

export async function hashOrderContact(
  value: string,
  encodedKey: string | undefined,
  nextEncodedKey?: string,
): Promise<string> {
  const activeKey = nextEncodedKey ?? encodedKey;
  const keyId = await sitesDataKeyId(activeKey, "ORDER");
  const key = await deriveSitesHmacKey(
    activeKey,
    "CONTACT_LOOKUP",
    "ORDER",
    ["sign"],
  );
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase();
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(normalized));
  return `v2.${keyId}.${encodeBase64Url(new Uint8Array(digest))}`;
}

export async function hashOrderLookupSubject(
  value: string,
  encodedKey: string | undefined,
  nextEncodedKey?: string,
): Promise<string> {
  const activeKey = nextEncodedKey ?? encodedKey;
  const keyId = await sitesDataKeyId(activeKey, "ORDER");
  const key = await deriveSitesHmacKey(
    activeKey,
    "ORDER_LOOKUP",
    "ORDER",
    ["sign"],
  );
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase();
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(normalized));
  return `v2.${keyId}.${encodeBase64Url(new Uint8Array(digest))}`;
}

export async function sitesDataKeyId(
  encodedKey: string | undefined,
  context: SitesDataKeyContext,
): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", requireSitesDataKey(encodedKey, context));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

export function sitesDataAdditionalDataV3(
  purpose: SitesDataProtectionPurpose,
  keyId: string,
): ArrayBuffer {
  return purposeInfoV3(purpose, keyId);
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

async function matchingDataKey(
  keyId: string,
  candidates: Array<string | undefined>,
  context: SitesDataKeyContext,
): Promise<string | null> {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (await sitesDataKeyId(candidate, context) === keyId) return candidate;
    } catch {
      // Invalid candidates fail closed after all configured slots are checked.
    }
  }
  return null;
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
