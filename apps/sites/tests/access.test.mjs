import assert from "node:assert/strict";
import test from "node:test";
import { handleCloudBridgeRequest } from "../server/router.ts";
import { createTestDatabase, memoryR2 } from "./test-helpers.mjs";

test("owner can pre-authorize staff, duplicate and invalid roles fail, and first matching sign-in activates", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = { DB: db, MEDIA: memoryR2() };
  const ownerSession = await call(env, "/v1/admin/auth/me", { email: "owner@example.test" });
  assert.equal(ownerSession.response.status, 200);
  assert.equal(ownerSession.body.data.user.roles[0].key, "SUPER_ADMIN");

  const created = await call(env, "/v1/admin/access/members", {
    method: "POST",
    email: "owner@example.test",
    body: {
      displayName: "Operations One",
      email: "ops@example.test",
      roleKey: "OPERATIONS",
      confirmationEmail: "owner@example.test",
      reason: "Prepare daily catalog and order operations",
    },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.status, "INVITED");
  assert.equal(created.body.data.roles[0].key, "OPERATIONS");

  const duplicate = await call(env, "/v1/admin/access/members", {
    method: "POST",
    email: "owner@example.test",
    body: {
      displayName: "Duplicate",
      email: "ops@example.test",
      roleKey: "READ_ONLY",
      confirmationEmail: "owner@example.test",
      reason: "Verify duplicate email protection",
    },
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.error.code, "ADMIN_MEMBER_EMAIL_EXISTS");

  const invalidRole = await call(env, "/v1/admin/access/members", {
    method: "POST",
    email: "owner@example.test",
    body: {
      displayName: "Invalid Owner",
      email: "invalid@example.test",
      roleKey: "SUPER_ADMIN",
      confirmationEmail: "owner@example.test",
      reason: "Verify protected owner role assignment",
    },
  });
  assert.equal(invalidRole.response.status, 422);

  const activated = await call(env, "/v1/admin/auth/me", {
    email: "ops@example.test",
    name: "Operations Signed In",
  });
  assert.equal(activated.response.status, 200);
  assert.equal(activated.body.data.user.roles[0].key, "OPERATIONS");
  const row = sqlite.prepare(
    "SELECT status, display_name AS displayName FROM admin_members WHERE email = ?",
  ).get("ops@example.test");
  assert.equal(row.status, "ACTIVE");
  assert.equal(row.displayName, "Operations Signed In");
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'team.member.activated'")
      .get().count,
    1,
  );
});

test("staff cannot manage access, owners are protected, and stale updates fail closed", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = { DB: db, MEDIA: memoryR2() };
  const owner = await call(env, "/v1/admin/auth/me", { email: "owner@example.test" });
  const ownerId = owner.body.data.user.id;

  const created = await call(env, "/v1/admin/access/members", {
    method: "POST",
    email: "owner@example.test",
    body: {
      displayName: "Support One",
      email: "support@example.test",
      roleKey: "CUSTOMER_SUPPORT",
      confirmationEmail: "owner@example.test",
      reason: "Authorize customer support operations",
    },
  });
  const member = created.body.data;

  await call(env, "/v1/admin/auth/me", { email: "support@example.test" });
  const denied = await call(env, "/v1/admin/access/members", {
    method: "POST",
    email: "support@example.test",
    body: {
      displayName: "Unauthorized",
      email: "blocked@example.test",
      roleKey: "READ_ONLY",
      confirmationEmail: "support@example.test",
      reason: "Attempt an unauthorized access change",
    },
  });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.body.error.code, "PERMISSION_DENIED");

  const ownerSelfChange = await call(env, `/v1/admin/access/members/${ownerId}`, {
    method: "PATCH",
    email: "owner@example.test",
    body: {
      expectedUpdatedAt: sqlite.prepare("SELECT updated_at FROM admin_members WHERE id = ?").get(ownerId).updated_at,
      status: "DISABLED",
      confirmationEmail: "owner@example.test",
      reason: "Verify owner self protection remains enabled",
    },
  });
  assert.equal(ownerSelfChange.response.status, 409);
  assert.equal(ownerSelfChange.body.error.code, "OWNER_SELF_CHANGE_FORBIDDEN");

  const updated = await call(env, `/v1/admin/access/members/${member.id}`, {
    method: "PATCH",
    email: "owner@example.test",
    body: {
      expectedUpdatedAt: sqlite.prepare(
        "SELECT updated_at AS updatedAt FROM admin_members WHERE id = ?",
      ).get(member.id).updatedAt,
      roleKey: "READ_ONLY",
      confirmationEmail: "owner@example.test",
      reason: "Move support staff to read-only review duties",
    },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.roles[0].key, "READ_ONLY");

  const conflict = await call(env, `/v1/admin/access/members/${member.id}`, {
    method: "PATCH",
    email: "owner@example.test",
    body: {
      expectedUpdatedAt: member.updatedAt,
      status: "DISABLED",
      confirmationEmail: "owner@example.test",
      reason: "Verify stale member version conflict",
    },
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error.code, "VERSION_CONFLICT");

  const current = updated.body.data;
  const disabled = await call(env, `/v1/admin/access/members/${member.id}`, {
    method: "PATCH",
    email: "owner@example.test",
    body: {
      expectedUpdatedAt: current.updatedAt,
      status: "DISABLED",
      confirmationEmail: "owner@example.test",
      reason: "Suspend access while duties are reassigned",
    },
  });
  assert.equal(disabled.response.status, 200);
  assert.equal(disabled.body.data.status, "DISABLED");
  const rejectedSession = await call(env, "/v1/admin/auth/me", { email: "support@example.test" });
  assert.equal(rejectedSession.response.status, 401);
  assert.equal(
    sqlite.prepare("SELECT status FROM admin_members WHERE email = ?").get("support@example.test").status,
    "DISABLED",
  );
});

async function call(env, path, {
  method = "GET",
  email,
  name = "Test User",
  body,
}) {
  const headers = new Headers({
    "oai-authenticated-user-email": email,
    "oai-authenticated-user-full-name": encodeURIComponent(name),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });
  if (method !== "GET") {
    headers.set("content-type", "application/json");
    headers.set("x-csrf-token", "sites-siwc");
  }
  const request = new Request(`https://example.test${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await handleCloudBridgeRequest(request, env);
  assert.ok(response);
  return { response, body: await response.json() };
}
