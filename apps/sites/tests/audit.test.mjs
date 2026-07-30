import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { handleAdminApi } from "../server/admin-api.ts";
import { ApiInputError } from "../server/http.ts";

const migration = readFileSync(
  new URL("../drizzle/0000_salty_fat_cobra.sql", import.meta.url),
  "utf8",
).replaceAll("--> statement-breakpoint", "");

test("Sites audit history applies server filters, pagination, facets, and a safe field allowlist", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  seedAdministrator(sqlite);
  const now = Date.now();
  seedAudit(sqlite, {
    id: "audit-newest",
    traceId: "trace-newest",
    action: "order.status.update",
    result: "DENIED",
    actorEmail: "operator@example.test",
    actorName: "Operator",
    targetType: "ORDER",
    targetId: "order-3",
    reason: "100% review required",
    createdAt: new Date(now - 1_000).toISOString(),
  });
  seedAudit(sqlite, {
    id: "audit-middle",
    traceId: "trace-middle",
    action: "order.contact.reveal",
    result: "DENIED",
    actorEmail: "operator@example.test",
    actorName: "Operator",
    targetType: "ORDER",
    targetId: "order-2",
    reason: "100% review required",
    createdAt: new Date(now - 2_000).toISOString(),
  });
  seedAudit(sqlite, {
    id: "audit-oldest",
    traceId: "trace-oldest",
    action: "order.assignment.update",
    result: "DENIED",
    actorEmail: "operator@example.test",
    actorName: "Operator",
    targetType: "ORDER",
    targetId: "order-1",
    reason: "100% review required",
    createdAt: new Date(now - 3_000).toISOString(),
  });
  seedAudit(sqlite, {
    id: "audit-system",
    traceId: "trace-system",
    action: "backup.daily",
    result: "SUCCEEDED",
    actorEmail: null,
    actorName: null,
    targetType: null,
    targetId: null,
    reason: null,
    createdAt: new Date(now - 4_000).toISOString(),
  });
  seedAudit(sqlite, {
    id: "audit-product",
    traceId: "trace-product",
    action: "product.update",
    result: "FAILED",
    actorEmail: "catalog@example.test",
    actorName: "Catalog",
    targetType: "PRODUCT",
    targetId: "product-1",
    reason: "Catalog validation failed",
    createdAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
  });

  try {
    const response = await handleAdminApi(
      auditRequest(
        "/v1/admin/audit?page=2&pageSize=2&result=DENIED&actor=administrator"
        + "&targetType=ORDER&timeRange=all&search=100%25",
      ),
      { DB: d1Adapter(sqlite), MEDIA: {} },
      "/v1/admin/audit",
    );
    assert.ok(response);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const payload = await response.json();
    assert.deepEqual(payload.meta, {
      page: 2,
      pageSize: 2,
      total: 3,
      pageCount: 2,
    });
    assert.deepEqual(payload.data.facets.targetTypes, ["ORDER", "PRODUCT", "SYSTEM"]);
    assert.equal(payload.data.items.length, 1);
    assert.deepEqual(payload.data.items[0], {
      id: "audit-oldest",
      requestId: "trace-oldest",
      action: "order.assignment.update",
      targetType: "ORDER",
      targetId: "order-1",
      result: "DENIED",
      reason: "100% review required",
      actor: {
        displayName: "Operator",
        email: "operator@example.test",
      },
      createdAt: payload.data.items[0].createdAt,
    });
    const serialized = JSON.stringify(payload.data.items[0]);
    assert.equal(serialized.includes("beforeData"), false);
    assert.equal(serialized.includes("afterData"), false);
    assert.equal(serialized.includes("ipHash"), false);

    const systemResponse = await handleAdminApi(
      auditRequest("/v1/admin/audit?actor=system&timeRange=24h"),
      { DB: d1Adapter(sqlite), MEDIA: {} },
      "/v1/admin/audit",
    );
    assert.ok(systemResponse);
    const systemPayload = await systemResponse.json();
    assert.equal(systemPayload.meta.total, 1);
    assert.equal(systemPayload.data.items[0].id, "audit-system");
    assert.equal(systemPayload.data.items[0].actor, null);
  } finally {
    sqlite.close();
  }
});

test("Sites security audit scope recognizes both runtime aliases before paging and returns a full summary", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  seedAdministrator(sqlite);
  const now = Date.now();
  for (const [index, input] of [
    {
      id: "sites-setting",
      action: "settings.storefront.updated",
      result: "SUCCEEDED",
      targetType: "SETTINGS",
    },
    {
      id: "mysql-setting",
      action: "site_setting.update",
      result: "SUCCEEDED",
      targetType: "SiteSetting",
    },
    {
      id: "unknown-denied",
      action: "custom.restricted.operation",
      result: "DENIED",
      targetType: "SYSTEM",
    },
    {
      id: "login-failed",
      action: "auth.login.failed",
      result: "FAILED",
      targetType: "AdminUser",
    },
    {
      id: "ordinary-success",
      action: "product.update",
      result: "SUCCEEDED",
      targetType: "PRODUCT",
    },
  ].entries()) {
    seedAudit(sqlite, {
      ...input,
      traceId: `trace-${input.id}`,
      actorEmail: "operator@example.test",
      actorName: "Operator",
      targetId: input.id,
      reason: "Security scope fixture",
      createdAt: new Date(now - index * 1_000).toISOString(),
    });
  }

  try {
    const response = await handleAdminApi(
      auditRequest(
        "/v1/admin/audit?page=1&pageSize=1&scope=security"
        + "&category=configuration&severity=medium&timeRange=all",
      ),
      { DB: d1Adapter(sqlite), MEDIA: {} },
      "/v1/admin/audit",
    );
    assert.ok(response);
    const payload = await response.json();
    assert.deepEqual(payload.meta, {
      page: 1,
      pageSize: 1,
      total: 2,
      pageCount: 2,
    });
    assert.equal(payload.data.items.length, 1);
    assert.equal(payload.data.items[0].id, "sites-setting");
    assert.deepEqual(payload.data.facets.securitySummary, {
      total: 4,
      last24Hours: 4,
      needsReview: 2,
      deniedOrFailed: 2,
    });
    const serialized = JSON.stringify(payload.data.items[0]);
    assert.equal(serialized.includes("beforeData"), false);
    assert.equal(serialized.includes("afterData"), false);
    assert.equal(serialized.includes("ipHash"), false);

    const highResponse = await handleAdminApi(
      auditRequest(
        "/v1/admin/audit?scope=security&severity=high&timeRange=all",
      ),
      { DB: d1Adapter(sqlite), MEDIA: {} },
      "/v1/admin/audit",
    );
    assert.ok(highResponse);
    const highPayload = await highResponse.json();
    assert.equal(highPayload.meta.total, 2);
    assert.deepEqual(
      highPayload.data.items.map((item) => item.id),
      ["unknown-denied", "login-failed"],
    );

    const authorizationResponse = await handleAdminApi(
      auditRequest(
        "/v1/admin/audit?scope=security&category=authorization&timeRange=all",
      ),
      { DB: d1Adapter(sqlite), MEDIA: {} },
      "/v1/admin/audit",
    );
    assert.ok(authorizationResponse);
    const authorizationPayload = await authorizationResponse.json();
    assert.deepEqual(
      authorizationPayload.data.items.map((item) => item.id),
      ["unknown-denied"],
    );
  } finally {
    sqlite.close();
  }
});

test("Sites audit history rejects invalid pagination and filter values", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  seedAdministrator(sqlite);
  try {
    await assert.rejects(
      handleAdminApi(
        auditRequest("/v1/admin/audit?page=1001"),
        { DB: d1Adapter(sqlite), MEDIA: {} },
        "/v1/admin/audit",
      ),
      (error) => error instanceof ApiInputError
        && error.code === "VALIDATION_FAILED"
        && error.details?.[0]?.field === "page",
    );
    await assert.rejects(
      handleAdminApi(
        auditRequest("/v1/admin/audit?result=UNKNOWN"),
        { DB: d1Adapter(sqlite), MEDIA: {} },
        "/v1/admin/audit",
      ),
      (error) => error instanceof ApiInputError
        && error.code === "VALIDATION_FAILED"
        && error.details?.[0]?.field === "result",
    );
    for (const [field, value] of [
      ["scope", "operations"],
      ["category", "network"],
      ["severity", "critical"],
    ]) {
      await assert.rejects(
        handleAdminApi(
          auditRequest(`/v1/admin/audit?${field}=${value}`),
          { DB: d1Adapter(sqlite), MEDIA: {} },
          "/v1/admin/audit",
        ),
        (error) => error instanceof ApiInputError
          && error.code === "VALIDATION_FAILED"
          && error.details?.[0]?.field === field,
      );
    }
  } finally {
    sqlite.close();
  }
});

test("Sites audit CSV export requires CSRF and confirmation, neutralizes formulas, and audits success", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  seedAdministrator(sqlite);
  seedAudit(sqlite, {
    id: "audit-export-source",
    traceId: "trace-export-source",
    action: "=HYPERLINK(\"https://invalid.example\")",
    result: "DENIED",
    actorEmail: "operator@example.test",
    actorName: "+Operator",
    targetType: "ORDER",
    targetId: "-1",
    reason: "@unsafe",
    createdAt: new Date().toISOString(),
  });

  try {
    await assert.rejects(
      handleAdminApi(
        auditExportRequest(
          { reason: "Approved security review", confirmation: "EXPORT_AUDIT_CSV" },
          { csrf: false },
        ),
        { DB: d1Adapter(sqlite), MEDIA: {} },
        "/v1/admin/audit/export",
      ),
      (error) => error instanceof ApiInputError
        && error.code === "CSRF_VALIDATION_FAILED",
    );
    await assert.rejects(
      handleAdminApi(
        auditExportRequest({ reason: "Approved security review", confirmation: "WRONG" }),
        { DB: d1Adapter(sqlite), MEDIA: {} },
        "/v1/admin/audit/export",
      ),
      (error) => error instanceof ApiInputError
        && error.code === "VALIDATION_FAILED",
    );
    const response = await handleAdminApi(
      auditExportRequest({
        result: "DENIED",
        timeRange: "all",
        reason: "Approved security review",
        confirmation: "EXPORT_AUDIT_CSV",
      }),
      { DB: d1Adapter(sqlite), MEDIA: {} },
      "/v1/admin/audit/export",
    );
    assert.ok(response);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.equal(response.headers.get("x-export-record-count"), "1");
    assert.match(
      response.headers.get("content-disposition") ?? "",
      /^attachment; filename="cloudbridge-audit-/u,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
    const csv = new TextDecoder().decode(bytes);
    assert.equal(csv.startsWith("\"event_id\""), true);
    assert.equal(csv.includes("\"'=HYPERLINK(\"\"https://invalid.example\"\")\""), true);
    assert.equal(csv.includes("\"'+Operator\""), true);
    assert.equal(csv.includes("\"'-1\""), true);
    assert.equal(csv.includes("\"'@unsafe\""), true);
    const exportAudit = sqlite.prepare(
      "SELECT result, actor_email AS actorEmail, reason FROM audit_events WHERE action = 'audit.export.csv'",
    ).get();
    assert.deepEqual({ ...exportAudit }, {
      result: "SUCCEEDED",
      actorEmail: "owner@example.test",
      reason: "Approved security review",
    });
  } finally {
    sqlite.close();
  }
});

function auditRequest(path) {
  return new Request(`https://example.test${path}`, {
    headers: {
      "oai-authenticated-user-email": "owner@example.test",
    },
  });
}

function auditExportRequest(body, { csrf = true } = {}) {
  return new Request("https://example.test/v1/admin/audit/export", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-email": "owner@example.test",
      ...(csrf ? { "x-csrf-token": "sites-siwc" } : {}),
    },
    body: JSON.stringify(body),
  });
}

function seedAdministrator(sqlite) {
  const now = new Date().toISOString();
  sqlite.prepare(
    `INSERT INTO admin_members
      (id, email, display_name, status, permissions_json, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
  ).run(
    "admin-owner",
    "owner@example.test",
    "Owner",
    JSON.stringify(["audit.read"]),
    now,
    now,
    now,
  );
}

function seedAudit(sqlite, input) {
  sqlite.prepare(
    `INSERT INTO audit_events
      (id, trace_id, action, result, actor_email, actor_display_name,
       target_type, target_id, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.traceId,
    input.action,
    input.result,
    input.actorEmail,
    input.actorName,
    input.targetType,
    input.targetId,
    input.reason,
    input.createdAt,
  );
}

function d1Adapter(sqlite) {
  return {
    prepare(query) {
      return statementAdapter(sqlite.prepare(query));
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function statementAdapter(statement) {
  let values = [];
  return {
    bind(...nextValues) {
      values = nextValues;
      return this;
    },
    async first() {
      return statement.get(...values) ?? null;
    },
    async all() {
      return {
        success: true,
        results: statement.all(...values),
        meta: { changes: 0 },
      };
    },
    async run() {
      const result = statement.run(...values);
      return {
        success: true,
        results: [],
        meta: { changes: Number(result.changes) },
      };
    },
  };
}
