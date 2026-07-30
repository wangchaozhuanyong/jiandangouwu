import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeBase64Url,
  decryptOrderContact,
  deriveSitesAesKey,
  deriveSitesHmacKey,
  encryptOrderContact,
  ProtectedDataInvalidError,
  sitesDataAdditionalData,
  sitesDataAdditionalDataV3,
} from "../server/data-protection.ts";

const dataKey = Buffer.alloc(32, 7).toString("base64url");

test("Sites writes key-versioned v3 order contacts with a purpose-derived key and authenticated context", async () => {
  const first = await encryptOrderContact("customer@example.test", dataKey);
  const second = await encryptOrderContact("customer@example.test", dataKey);

  assert.match(first, /^v3\.[a-f0-9]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
  assert.notEqual(first, second);
  assert.equal(await decryptOrderContact(first, dataKey), "customer@example.test");

  const [version, keyId, ivValue, encryptedValue] = first.split(".");
  assert.equal(version, "v3");
  const backupKey = await deriveSitesAesKey(
    dataKey,
    "BACKUP_SNAPSHOT",
    "BACKUP",
    ["decrypt"],
  );
  await assert.rejects(
    crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64Url(ivValue),
        additionalData: sitesDataAdditionalDataV3("ORDER_CONTACT", keyId),
      },
      backupKey,
      decodeBase64Url(encryptedValue),
    ),
  );
});

test("Sites keeps legacy v1 contacts readable while rejecting tampered or wrong-key v2 data", async () => {
  const legacy = await legacyContact("legacy@example.test", dataKey);
  assert.equal(await decryptOrderContact(legacy, dataKey), "legacy@example.test");

  const current = await encryptOrderContact("current@example.test", dataKey);
  const tampered = `${current.slice(0, -1)}${current.endsWith("A") ? "B" : "A"}`;
  await assert.rejects(
    decryptOrderContact(tampered, dataKey),
    (error) => error instanceof ProtectedDataInvalidError && error.kind === "CONTACT",
  );
  await assert.rejects(
    decryptOrderContact(current, Buffer.alloc(32, 8).toString("base64url")),
    (error) => error instanceof ProtectedDataInvalidError && error.kind === "CONTACT",
  );
});

test("Sites derives independent HMAC keys for restore tokens and restore proofs", async () => {
  const value = new TextEncoder().encode("same input");
  const tokenKey = await deriveSitesHmacKey(
    dataKey,
    "RESTORE_TOKEN",
    "BACKUP",
    ["sign"],
  );
  const proofKey = await deriveSitesHmacKey(
    dataKey,
    "RESTORE_PROOF",
    "BACKUP",
    ["sign"],
  );
  const tokenSignature = Buffer.from(
    await crypto.subtle.sign("HMAC", tokenKey, value),
  ).toString("hex");
  const proofSignature = Buffer.from(
    await crypto.subtle.sign("HMAC", proofKey, value),
  ).toString("hex");

  assert.notEqual(tokenSignature, proofSignature);
});

test("Sites data-key validation keeps order and backup failure codes distinct", async () => {
  await assert.rejects(
    encryptOrderContact("customer@example.test", undefined),
    (error) => error?.code === "ORDER_ENCRYPTION_NOT_CONFIGURED" && error?.status === 503,
  );
  await assert.rejects(
    deriveSitesAesKey("not-a-32-byte-key", "BACKUP_SNAPSHOT", "BACKUP", ["encrypt"]),
    (error) => error?.code === "BACKUP_ENCRYPTION_INVALID" && error?.status === 503,
  );
});

async function legacyContact(value, encodedKey) {
  const key = await crypto.subtle.importKey(
    "raw",
    Buffer.from(encodedKey, "base64url"),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = new Uint8Array(12).fill(3);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `v1.${Buffer.from(iv).toString("base64url")}.${Buffer.from(encrypted).toString("base64url")}`;
}
