import assert from "node:assert/strict";
import test from "node:test";
import {
  createPrivacyRequest,
  getCleanupPreview,
  getDataKeyRotationStatus,
  runDataKeyRotation,
  updatePrivacyRequest,
} from "../server/data-governance.ts";
import {
  decryptOrderContact,
  encryptOrderContact,
  hashOrderContact,
  sitesDataKeyId,
} from "../server/data-protection.ts";
import {
  createTestDatabase,
  memoryR2,
  seedOrder,
  testActor,
} from "./test-helpers.mjs";

const currentKey = Buffer.alloc(32, 17).toString("base64url");
const nextKey = Buffer.alloc(32, 29).toString("base64url");
const originalContact = "customer@example.test";

async function privacyFixture() {
  const { sqlite, db } = createTestDatabase();
  const env = {
    DB: db,
    MEDIA: memoryR2(),
    CLOUDBRIDGE_DATA_KEY: currentKey,
  };
  await seedOrder(sqlite, {
    contactEncrypted: await encryptOrderContact(originalContact, currentKey),
    contactHash: await hashOrderContact(originalContact, currentKey),
    contact: "cu***@example.test",
  });
  return { sqlite, env };
}

async function createVerifiedRequest(env, type) {
  const created = await createPrivacyRequest(env, {
    type,
    requesterReference: originalContact,
    reason: "Customer submitted a verified privacy request",
  }, testActor);
  return updatePrivacyRequest(env, created.id, {
    status: "IDENTITY_VERIFIED",
    reason: "Identity evidence was reviewed by the owner",
  }, testActor);
}

test("access requests encrypt the requester reference and export only verified order metadata", async () => {
  const { sqlite, env } = await privacyFixture();
  const verified = await createVerifiedRequest(env, "ACCESS");
  const stored = sqlite.prepare(
    "SELECT requester_reference, requester_lookup_hash FROM privacy_requests WHERE id = ?",
  ).get(verified.id);
  assert.notEqual(stored.requester_reference, originalContact);
  assert.match(stored.requester_reference, /^v3\./u);
  assert.match(stored.requester_lookup_hash, /^v2\./u);

  const completed = await updatePrivacyRequest(env, verified.id, {
    status: "COMPLETED",
    reason: "Export delivered after identity verification",
    confirmation: "EXPORT VERIFIED DATA",
  }, testActor);
  assert.deepEqual(completed.result, {
    action: "EXPORTED",
    affectedOrders: 1,
    exportedOrders: [{
      orderNumber: "CB-order-governance-test",
      status: "COMPLETED",
      contactChannel: "EMAIL",
      maskedContact: "cu***@example.test",
      createdAt: "2025-01-01T00:00:00.000Z",
    }],
  });
  assert.doesNotMatch(JSON.stringify(completed.result), new RegExp(originalContact, "u"));
  sqlite.close();
});

test("correction requests replace ciphertext and HMAC only after identity verification", async () => {
  const { sqlite, env } = await privacyFixture();
  const verified = await createVerifiedRequest(env, "CORRECTION");
  const correctedContact = "corrected@example.test";
  const completed = await updatePrivacyRequest(env, verified.id, {
    status: "COMPLETED",
    reason: "Corrected contact approved by the verified requester",
    confirmation: "CORRECT VERIFIED CONTACT",
    correctedReference: correctedContact,
  }, testActor);
  assert.deepEqual(completed.result, { action: "CORRECTED", affectedOrders: 1 });
  const order = sqlite.prepare(
    "SELECT contact_encrypted, contact_hash, masked_contact FROM orders WHERE id = ?",
  ).get("order-governance-test");
  assert.equal(
    await decryptOrderContact(order.contact_encrypted, currentKey),
    correctedContact,
  );
  assert.equal(order.contact_hash, await hashOrderContact(correctedContact, currentKey));
  assert.equal(order.masked_contact, "co***@example.test");
  sqlite.close();
});

test("erasure anonymizes verified matches and cleanup remains preview-only", async () => {
  const { sqlite, env } = await privacyFixture();
  const verified = await createVerifiedRequest(env, "ERASURE");
  const completed = await updatePrivacyRequest(env, verified.id, {
    status: "COMPLETED",
    reason: "Verified erasure request approved by the owner",
    confirmation: "ANONYMIZE VERIFIED CONTACT",
  }, testActor);
  assert.deepEqual(completed.result, { action: "ANONYMIZED", affectedOrders: 1 });
  const order = sqlite.prepare(
    `SELECT contact_encrypted, contact_hash, masked_contact,
      contact_erased_at, contact_erasure_request_id
     FROM orders WHERE id = ?`,
  ).get("order-governance-test");
  assert.match(order.contact_encrypted, /^erased:/u);
  assert.match(order.contact_hash, /^erased:/u);
  assert.equal(order.masked_contact, "已匿名 / Erased");
  assert.ok(order.contact_erased_at);
  assert.equal(order.contact_erasure_request_id, verified.id);

  const preview = await getCleanupPreview(env.DB, new Date("2026-07-29T00:00:00.000Z"));
  assert.equal(preview.writesPerformed, false);
  assert.equal(preview.ordersEligible, 0);
  assert.equal(preview.contactsEligible, 0);
  sqlite.close();
});

test("key rotation re-encrypts contacts and backups while failures preserve the active key", async () => {
  const success = await privacyFixture();
  success.env.CLOUDBRIDGE_DATA_KEY_NEXT = nextKey;
  const rotated = await runDataKeyRotation(
    success.env,
    testActor,
    "Scheduled Sites-managed key rotation",
    "ROTATE DATA KEY",
  );
  const nextOrderKeyId = await sitesDataKeyId(nextKey, "ORDER");
  assert.equal(rotated.state, "COMPLETED");
  assert.equal(rotated.nextKeyId, nextOrderKeyId);
  const protectedContact = success.sqlite.prepare(
    "SELECT contact_encrypted, contact_hash FROM orders WHERE id = ?",
  ).get("order-governance-test");
  assert.match(protectedContact.contact_encrypted, new RegExp(`^v3\\.${nextOrderKeyId}\\.`,"u"));
  assert.equal(
    await decryptOrderContact(protectedContact.contact_encrypted, currentKey, "ORDER", nextKey),
    originalContact,
  );
  assert.match(protectedContact.contact_hash, new RegExp(`^v2\\.${nextOrderKeyId}\\.`,"u"));
  const backupEnvelopes = success.env.MEDIA.values().map((value) => JSON.parse(value));
  assert.ok(backupEnvelopes.length >= 1);
  assert.ok(backupEnvelopes.every((envelope) => envelope.version === 3));
  const nextBackupKeyId = await sitesDataKeyId(nextKey, "BACKUP");
  assert.ok(backupEnvelopes.every((envelope) => envelope.keyId === nextBackupKeyId));
  success.sqlite.close();

  const failed = await privacyFixture();
  failed.env.MEDIA = memoryR2({ failPut: true });
  failed.env.CLOUDBRIDGE_DATA_KEY_NEXT = nextKey;
  const before = failed.sqlite.prepare(
    "SELECT contact_encrypted FROM orders WHERE id = ?",
  ).get("order-governance-test").contact_encrypted;
  await assert.rejects(
    runDataKeyRotation(
      failed.env,
      testActor,
      "Failure-path key rotation verification",
      "ROTATE DATA KEY",
    ),
    /encrypted backup could not be created/u,
  );
  const status = await getDataKeyRotationStatus(failed.env);
  const after = failed.sqlite.prepare(
    "SELECT contact_encrypted FROM orders WHERE id = ?",
  ).get("order-governance-test").contact_encrypted;
  assert.equal(status.state, "FAILED");
  assert.equal(after, before);
  assert.equal(await decryptOrderContact(after, currentKey), originalContact);
  failed.sqlite.close();
});
