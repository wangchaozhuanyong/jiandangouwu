import {
  DEFAULT_SHARE_TEMPLATE,
  AUDIT_CSV_EXPORT_CONFIRMATION,
  AUDIT_CSV_EXPORT_LIMIT,
  DEFAULT_INVENTORY_RISK_THRESHOLD,
  INVENTORY_RISK_THRESHOLD_MAX,
  INVENTORY_RISK_THRESHOLD_MIN,
  isConfiguredContactChannel,
  auditCsvFilename,
  securityAuditActions,
  securityAuditActionsForCategory,
  securityAuditActionsForDefaultSeverity,
  securityEventCategories,
  securityEventSeverities,
  serializeAuditCsv,
  type AdminInventoryRiskLevel,
  type AdminInventoryRiskSummary,
  type ContactChannelMode,
  type ContactChannelType,
  type SecurityAuditSummary,
  type SecurityEventCategory,
  type SecurityEventSeverity,
} from "@cloudbridge/contracts";
import {
  ApiInputError,
  bootstrapOrReadAdmin,
  headerUser,
  pageMeta,
  parsePage,
  readJson,
  requireAdmin,
  requireCsrf,
  success,
  writeAudit,
  type AdminIdentity,
} from "./http";
import {
  adminPermissions,
  adminRoleDefinition,
  adminRoleDefinitions,
  adminRoleForPermissions,
} from "./access-roles";
import {
  decryptOrderContact,
  ProtectedDataInvalidError,
} from "./data-protection";
import {
  createPrivacyRequest,
  getDataGovernanceOverview,
  runDataKeyRotation,
  updatePrivacyRequest,
} from "./data-governance";
import {
  getExchangeRateSyncSettings,
  runExchangeRateSync,
  updateExchangeRateSyncSettings,
} from "./exchange-rates";
import {
  deleteManagedMedia,
  listManagedMedia,
  removeWechatQr,
  replaceMediaReferences,
  uploadManagedMedia,
  uploadWechatQr,
} from "./media-api";
import {
  completeBackupRestoreDrill,
  createManualBackup,
  createBackupRestoreDrillTransfer,
  downloadBackupSnapshot,
  ensureDailyBackup,
  getBackupReadiness,
  listBackupSnapshots,
  validateBackupRestorePackage,
  verifyBackupSnapshot,
} from "./backup-api";
import { reconcileExpiredOrders } from "./order-expiry";
import {
  getTelegramSettings,
  listTelegramDeliveries,
  retryTelegramDelivery,
  testTelegramConnection,
  updateTelegramSettingValue,
} from "./telegram";
import { normalizeLegacyLineBreaks } from "./text";
import type { D1Database, SitesEnv } from "./types";

const orderTransitions: Readonly<Record<string, readonly string[]>> = {
  MANUAL_PENDING: ["CONTACTED", "CANCELLED"],
  CONTACTED: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["PAYMENT_PROCESSING", "PAID", "CANCELLED"],
  PAYMENT_PROCESSING: ["PAID", "CANCELLED", "DISPUTED"],
  PAID: ["FULFILLING", "REFUND_PENDING", "DISPUTED"],
  FULFILLING: ["COMPLETED", "REFUND_PENDING", "DISPUTED"],
  COMPLETED: ["REFUND_PENDING", "DISPUTED"],
  CANCELLED: [],
  REFUND_PENDING: ["REFUNDED", "DISPUTED"],
  REFUNDED: [],
  DISPUTED: ["REFUND_PENDING", "REFUNDED"],
};
const auditTimeRangeMs = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
} as const;

export async function handleAdminApi(
  request: Request,
  env: SitesEnv,
  pathname: string,
): Promise<Response | null> {
  if (!pathname.startsWith("/v1/admin/")) return null;
  const url = new URL(request.url);

  if (request.method === "GET" && pathname === "/v1/admin/auth/me") {
    const identity = await bootstrapOrReadAdmin(env.DB, request);
    if (!identity) throw new ApiInputError("ADMIN_AUTH_REQUIRED", "ChatGPT sign-in is required.", 401);
    return success({
      user: adminUser(identity),
      csrfToken: "sites-siwc",
    });
  }
  if (request.method === "GET" && pathname === "/v1/admin/sites-readiness") {
    const identity = await requireAdmin(env.DB, request, "settings.read");
    const settingsRow = await env.DB.prepare(
      "SELECT value_json AS valueJson FROM site_settings WHERE key = 'storefront.settings' LIMIT 1",
    ).first<{ valueJson: string }>();
    const settings = parseJsonRecord(settingsRow?.valueJson);
    const contactChannels = await adminChannels(env.DB);
    const activeContactChannels = contactChannels.filter((channel) => channel.active);
    const configuredActiveContactChannels = activeContactChannels.filter(
      isConfiguredContactChannel,
    );
    return success({
      runtime: "sites",
      database: "connected",
      objectStorage: env.MEDIA ? "bound" : "missing",
      chatgptAuthentication: headerUser(request) ? "connected" : "missing",
      dataEncryptionKey: env.CLOUDBRIDGE_DATA_KEY ? "configured" : "not_configured",
      administrator: { email: identity.email, displayName: identity.displayName },
      storefront: {
        acceptOrders: settings.acceptOrders === true,
        supportEnabled: settings.supportEnabled === true,
        activeContactChannels: activeContactChannels.length,
        configuredActiveContactChannels: configuredActiveContactChannels.length,
      },
      checkedAt: new Date().toISOString(),
    });
  }

  if (request.method === "GET" && pathname === "/v1/admin/overview") {
    await requireAdmin(env.DB, request);
    await reconcileExpiredOrders(env.DB);
    return success(await overview(env.DB));
  }
  if (pathname === "/v1/admin/categories") {
    if (request.method === "GET") {
      await requireAdmin(env.DB, request, "catalog.read");
      return success(await adminCategories(env.DB));
    }
    if (request.method === "POST") {
      const actor = await writeIdentity(env.DB, request, "catalog.write");
      return success(await createCategory(env.DB, request, actor), { status: 201 });
    }
  }
  const categoryMatch = pathname.match(/^\/v1\/admin\/categories\/([^/]+)$/u);
  if (categoryMatch && request.method === "PATCH") {
    const actor = await writeIdentity(env.DB, request, "catalog.write");
    return success(await updateCategory(env.DB, request, decodeURIComponent(categoryMatch[1]), actor));
  }

  if (pathname === "/v1/admin/products") {
    if (request.method === "GET") {
      await requireAdmin(env.DB, request, "catalog.read");
      const query = readProductListQuery(url);
      const result = await adminProducts(env.DB, query);
      return success(result.items, {
        meta: pageMeta(query.page, query.pageSize, result.total),
      });
    }
    if (request.method === "POST") {
      const actor = await writeIdentity(env.DB, request, "catalog.write");
      return success(await createProduct(env.DB, request, actor), { status: 201 });
    }
  }
  const productMatch = pathname.match(/^\/v1\/admin\/products\/([^/]+)$/u);
  if (productMatch && request.method === "PATCH") {
    const actor = await writeIdentity(env.DB, request, "catalog.write");
    return success(await updateProduct(env.DB, request, decodeURIComponent(productMatch[1]), actor));
  }

  if (pathname === "/v1/admin/currencies" && request.method === "GET") {
    await requireAdmin(env.DB, request, "catalog.read");
    return success(await adminCurrencies(env.DB));
  }
  const rateHistoryMatch = pathname.match(/^\/v1\/admin\/currencies\/([^/]+)\/rates$/u);
  if (rateHistoryMatch && request.method === "GET") {
    await requireAdmin(env.DB, request, "catalog.read");
    return success(await currencyRateHistory(
      env.DB,
      decodeURIComponent(rateHistoryMatch[1]).toUpperCase(),
    ));
  }
  const rateMatch = pathname.match(/^\/v1\/admin\/currencies\/([^/]+)\/rate$/u);
  if (rateMatch && request.method === "PATCH") {
    const actor = await writeIdentity(env.DB, request, "currencies.write");
    return success(await updateCurrencyRate(
      env,
      request,
      decodeURIComponent(rateMatch[1]).toUpperCase(),
      actor,
    ));
  }
  if (pathname === "/v1/admin/exchange-rate-sync") {
    if (request.method === "GET") {
      await requireAdmin(env.DB, request, "catalog.read");
      return success(await getExchangeRateSyncSettings(env.DB));
    }
    if (request.method === "PATCH") {
      const actor = await writeIdentity(env.DB, request, "currencies.write");
      const body = await readJson<Record<string, unknown>>(request);
      return success(await updateExchangeRateSyncSettings(env.DB, {
        enabled: body.enabled !== false,
        intervalMinutes: safeInteger(body.intervalMinutes, "intervalMinutes", 1),
        modes: body.modes && typeof body.modes === "object"
          ? body.modes as Record<string, unknown>
          : {},
        version: safeInteger(body.version, "version", 1),
        reason: requiredString(body.reason, "reason", 8, 500),
      }, actor));
    }
  }
  if (pathname === "/v1/admin/exchange-rate-sync/run" && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "currencies.write");
    return success(await runExchangeRateSync(env, "MANUAL", actor));
  }

  if (pathname === "/v1/admin/heroes") {
    if (request.method === "GET") {
      await requireAdmin(env.DB, request, "content.read");
      return success(await adminHeroes(env.DB));
    }
    if (request.method === "POST") {
      const actor = await writeIdentity(env.DB, request, "content.write");
      return success(await createHero(env.DB, request, actor), { status: 201 });
    }
  }
  if (pathname === "/v1/admin/heroes/order" && request.method === "PATCH") {
    const actor = await writeIdentity(env.DB, request, "content.write");
    return success(await reorderRows(env.DB, request, actor, "heroes", "content.hero.reordered"));
  }
  const heroMatch = pathname.match(/^\/v1\/admin\/heroes\/([^/]+)$/u);
  if (heroMatch && request.method === "PATCH") {
    const actor = await writeIdentity(env.DB, request, "content.write");
    return success(await updateHero(env.DB, request, decodeURIComponent(heroMatch[1]), actor));
  }

  if (pathname === "/v1/admin/contact-channels" && request.method === "GET") {
    await requireAdmin(env.DB, request, "support.read");
    return success(await adminChannels(env.DB));
  }
  if (pathname === "/v1/admin/contact-channels/order" && request.method === "PATCH") {
    const actor = await writeIdentity(env.DB, request, "support.write");
    return success(await reorderRows(
      env.DB,
      request,
      actor,
      "merchant_channels",
      "support.channel.reordered",
    ));
  }
  const channelMatch = pathname.match(/^\/v1\/admin\/contact-channels\/([^/]+)$/u);
  if (channelMatch && request.method === "PATCH") {
    const actor = await writeIdentity(env.DB, request, "support.write");
    return success(await updateChannel(env.DB, request, decodeURIComponent(channelMatch[1]), actor));
  }
  const channelQrMatch = pathname.match(/^\/v1\/admin\/contact-channels\/([^/]+)\/qr$/u);
  if (channelQrMatch && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "support.write");
    const id = decodeURIComponent(channelQrMatch[1]);
    await uploadWechatQr(env, request, id, actor);
    return success((await adminChannels(env.DB)).find((item) => item.id === id), { status: 201 });
  }
  if (channelQrMatch && request.method === "DELETE") {
    const actor = await writeIdentity(env.DB, request, "support.write");
    const id = decodeURIComponent(channelQrMatch[1]);
    await removeWechatQr(env, request, id, actor);
    return success((await adminChannels(env.DB)).find((item) => item.id === id));
  }

  if (pathname === "/v1/admin/site-settings") {
    if (request.method === "GET") {
      await requireAdmin(env.DB, request, "settings.read");
      return success(await adminSettings(env.DB));
    }
    if (request.method === "PATCH") {
      const actor = await writeIdentity(env.DB, request, "settings.write");
      return success(await updateSettings(env.DB, request, actor));
    }
  }

  if (pathname === "/v1/admin/media") {
    if (request.method === "GET") {
      await requireAdminAny(env.DB, request, ["catalog.read", "content.read"]);
      return success(await listManagedMedia(env));
    }
    if (request.method === "POST") {
      const actor = await writeIdentityAny(
        env.DB,
        request,
        ["catalog.write", "content.write"],
      );
      return success(await uploadManagedMedia(env, request, actor), { status: 201 });
    }
  }
  if (pathname === "/v1/admin/media/replace" && request.method === "POST") {
    const actor = await writeIdentityAll(
      env.DB,
      request,
      ["catalog.write", "content.write"],
    );
    return success(await replaceMediaReferences(env, request, actor), { status: 201 });
  }
  const mediaMatch = pathname.match(/^\/v1\/admin\/media\/([^/]+)$/u);
  if (mediaMatch && request.method === "DELETE") {
    const actor = await writeIdentityAny(
      env.DB,
      request,
      ["catalog.write", "content.write"],
    );
    await deleteManagedMedia(
      env,
      request,
      decodeURIComponent(mediaMatch[1]),
      actor,
    );
    return new Response(null, { status: 204 });
  }

  if (pathname === "/v1/admin/audit" && request.method === "GET") {
    await requireAdmin(env.DB, request, "audit.read");
    const auditQuery = readAuditQuery(url);
    const whereSql = auditQuery.conditions.length > 0
      ? ` WHERE ${auditQuery.conditions.join(" AND ")}`
      : "";
    const total = Number((await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM audit_events${whereSql}`,
    ).bind(...auditQuery.bindings).first<{ count: number }>())?.count ?? 0);
    const rows = (await env.DB.prepare(
      `SELECT id, trace_id AS requestId, action,
        COALESCE(target_type, 'SYSTEM') AS targetType, target_id AS targetId,
        result, reason, actor_display_name AS actorDisplayName,
        actor_email AS actorEmail, created_at AS createdAt
       FROM audit_events${whereSql}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    ).bind(
      ...auditQuery.bindings,
      auditQuery.pageSize,
      auditQuery.offset,
    ).all<{
      id: string;
      requestId: string;
      action: string;
      targetType: string;
      targetId: string | null;
      result: "SUCCEEDED" | "FAILED" | "DENIED";
      reason: string | null;
      actorDisplayName: string | null;
      actorEmail: string | null;
      createdAt: string;
    }>()).results ?? [];
    const targetTypes = (await env.DB.prepare(
      `SELECT DISTINCT COALESCE(target_type, 'SYSTEM') AS targetType
       FROM audit_events ORDER BY targetType ASC`,
    ).all<{ targetType: string }>()).results ?? [];
    const securitySummary = auditQuery.scope === "security"
      ? await readSecurityAuditSummary(env.DB)
      : undefined;
    return success({
      items: rows.map((row) => ({
        id: row.id,
        requestId: row.requestId,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        result: row.result,
        reason: row.reason,
        actor: row.actorEmail
          ? { displayName: row.actorDisplayName ?? row.actorEmail, email: row.actorEmail }
          : null,
        createdAt: row.createdAt,
      })),
      facets: {
        targetTypes: targetTypes.map((row) => row.targetType),
        ...(securitySummary ? { securitySummary } : {}),
      },
    }, {
      meta: pageMeta(auditQuery.page, auditQuery.pageSize, total),
    });
  }

  if (pathname === "/v1/admin/audit/export" && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "audit.read");
    const exportInput = await readAuditExportInput(request);
    const whereSql = exportInput.query.conditions.length > 0
      ? ` WHERE ${exportInput.query.conditions.join(" AND ")}`
      : "";
    const total = Number((await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM audit_events${whereSql}`,
    ).bind(...exportInput.query.bindings).first<{ count: number }>())?.count ?? 0);
    if (total > AUDIT_CSV_EXPORT_LIMIT) {
      await writeAudit(env.DB, {
        action: "audit.export.csv",
        result: "DENIED",
        actor,
        targetType: "AUDIT_EXPORT",
        targetId: crypto.randomUUID(),
        reason: exportInput.reason,
      });
      throw new ApiInputError(
        "AUDIT_EXPORT_LIMIT_EXCEEDED",
        `The current filter matches more than ${AUDIT_CSV_EXPORT_LIMIT} records. Narrow the filter before exporting.`,
        409,
      );
    }
    const rows = (await env.DB.prepare(
      `SELECT id, trace_id AS requestId, action,
        COALESCE(target_type, 'SYSTEM') AS targetType, target_id AS targetId,
        result, reason, actor_display_name AS actorDisplayName,
        actor_email AS actorEmail, created_at AS createdAt
       FROM audit_events${whereSql}
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    ).bind(
      ...exportInput.query.bindings,
      AUDIT_CSV_EXPORT_LIMIT + 1,
    ).all<{
      id: string;
      requestId: string;
      action: string;
      targetType: string;
      targetId: string | null;
      result: "SUCCEEDED" | "FAILED" | "DENIED";
      reason: string | null;
      actorDisplayName: string | null;
      actorEmail: string | null;
      createdAt: string;
    }>()).results ?? [];
    if (rows.length > AUDIT_CSV_EXPORT_LIMIT) {
      await writeAudit(env.DB, {
        action: "audit.export.csv",
        result: "DENIED",
        actor,
        targetType: "AUDIT_EXPORT",
        targetId: crypto.randomUUID(),
        reason: exportInput.reason,
      });
      throw new ApiInputError(
        "AUDIT_EXPORT_LIMIT_EXCEEDED",
        `The current filter matches more than ${AUDIT_CSV_EXPORT_LIMIT} records. Narrow the filter before exporting.`,
        409,
      );
    }
    const exportId = crypto.randomUUID();
    const csv = serializeAuditCsv(rows.map((row) => ({
      id: row.id,
      requestId: row.requestId,
      createdAt: row.createdAt,
      action: row.action,
      actorDisplayName: row.actorDisplayName,
      actorEmail: row.actorEmail,
      targetType: row.targetType,
      targetId: row.targetId,
      result: row.result,
      reason: row.reason,
    })));
    await writeAudit(env.DB, {
      action: "audit.export.csv",
      result: "SUCCEEDED",
      actor,
      targetType: "AUDIT_EXPORT",
      targetId: exportId,
      reason: exportInput.reason,
    });
    const filename = auditCsvFilename();
    return new Response(csv, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Export-Record-Count": String(rows.length),
      },
    });
  }

  if (pathname === "/v1/admin/backups") {
    if (request.method === "GET") {
      await requireAdmin(env.DB, request, "settings.read");
      await ensureDailyBackup(env);
      return success({
        items: await listBackupSnapshots(env.DB),
        readiness: await getBackupReadiness(env.DB),
      });
    }
    if (request.method === "POST") {
      const actor = await writeIdentity(env.DB, request, "settings.write");
      return success(await createManualBackup(env, request, actor), { status: 201 });
    }
  }
  const backupVerifyMatch = pathname.match(/^\/v1\/admin\/backups\/([^/]+)\/verify$/u);
  if (backupVerifyMatch && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "settings.write");
    return success(await verifyBackupSnapshot(
      env,
      request,
      decodeURIComponent(backupVerifyMatch[1]),
      actor,
    ));
  }
  const backupRestoreValidationMatch = pathname.match(
    /^\/v1\/admin\/backups\/([^/]+)\/restore-validation$/u,
  );
  if (backupRestoreValidationMatch && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "settings.write");
    return success(await validateBackupRestorePackage(
      env,
      request,
      decodeURIComponent(backupRestoreValidationMatch[1]),
      actor,
    ));
  }
  const backupRestoreDrillTransferMatch = pathname.match(
    /^\/v1\/admin\/backups\/([^/]+)\/restore-drill-transfer$/u,
  );
  if (backupRestoreDrillTransferMatch && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "settings.write");
    return success(await createBackupRestoreDrillTransfer(
      env,
      request,
      decodeURIComponent(backupRestoreDrillTransferMatch[1]),
      actor,
    ));
  }
  const backupRestoreDrillCompleteMatch = pathname.match(
    /^\/v1\/admin\/backups\/([^/]+)\/restore-drill-complete$/u,
  );
  if (backupRestoreDrillCompleteMatch && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "settings.write");
    return success(await completeBackupRestoreDrill(
      env,
      request,
      decodeURIComponent(backupRestoreDrillCompleteMatch[1]),
      actor,
    ));
  }
  const backupDownloadMatch = pathname.match(/^\/v1\/admin\/backups\/([^/]+)\/download$/u);
  if (backupDownloadMatch && request.method === "GET") {
    await requireAdmin(env.DB, request, "settings.read");
    return downloadBackupSnapshot(env, decodeURIComponent(backupDownloadMatch[1]));
  }

  if (pathname === "/v1/admin/orders" && request.method === "GET") {
    await requireAdmin(env.DB, request, "orders.read");
    await reconcileExpiredOrders(env.DB);
    return listOrders(env.DB, url);
  }
  if (pathname === "/v1/admin/orders/assignees" && request.method === "GET") {
    await requireAdmin(env.DB, request, "orders.read");
    const rows = await env.DB.prepare(
      "SELECT id, display_name AS displayName FROM admin_members WHERE status = 'ACTIVE' ORDER BY display_name ASC",
    ).all<{ id: string; displayName: string }>();
    return success(rows.results ?? []);
  }
  const orderStatusMatch = pathname.match(/^\/v1\/admin\/orders\/([^/]+)\/status$/u);
  if (orderStatusMatch && request.method === "PATCH") {
    const actor = await writeIdentity(env.DB, request, "orders.write");
    await reconcileExpiredOrders(env.DB);
    return success(await updateOrderStatus(
      env.DB,
      request,
      decodeURIComponent(orderStatusMatch[1]),
      actor,
    ));
  }
  const orderAssignmentMatch = pathname.match(/^\/v1\/admin\/orders\/([^/]+)\/assignment$/u);
  if (orderAssignmentMatch && request.method === "PATCH") {
    const actor = await writeIdentity(env.DB, request, "orders.write");
    return success(await updateOrderAssignment(
      env.DB,
      request,
      decodeURIComponent(orderAssignmentMatch[1]),
      actor,
    ));
  }
  const orderRevealMatch = pathname.match(/^\/v1\/admin\/orders\/([^/]+)\/reveal-contact$/u);
  if (orderRevealMatch && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "contacts.reveal");
    return success(await revealOrderContact(
      env,
      request,
      decodeURIComponent(orderRevealMatch[1]),
      actor,
    ));
  }
  const orderMatch = pathname.match(/^\/v1\/admin\/orders\/([^/]+)$/u);
  if (orderMatch && request.method === "GET") {
    await requireAdmin(env.DB, request, "orders.read");
    await reconcileExpiredOrders(env.DB);
    return success(await orderDetail(env.DB, decodeURIComponent(orderMatch[1])));
  }

  if (pathname === "/v1/admin/access/members" && request.method === "GET") {
    await requireAdmin(env.DB, request, "team.manage");
    return success(await teamOverview(env.DB));
  }
  if (pathname === "/v1/admin/access/members" && request.method === "POST") {
    const actor = await writeIdentityAll(env.DB, request, ["team.manage", "roles.manage"]);
    return success(await createTeamMember(env.DB, request, actor), { status: 201 });
  }
  const teamMemberMatch = pathname.match(/^\/v1\/admin\/access\/members\/([^/]+)$/u);
  if (teamMemberMatch && request.method === "PATCH") {
    const actor = await writeIdentityAll(env.DB, request, ["team.manage", "roles.manage"]);
    return success(await updateTeamMember(
      env.DB,
      request,
      decodeURIComponent(teamMemberMatch[1]),
      actor,
    ));
  }
  if (pathname === "/v1/admin/access/roles" && request.method === "GET") {
    await requireAdmin(env.DB, request, "roles.manage");
    return success(await rolesOverview(env.DB));
  }

  if (pathname === "/v1/admin/manual-payment-events" && request.method === "GET") {
    await requireAdmin(env.DB, request, "orders.read");
    return manualPaymentEvents(env.DB, url);
  }

  if (pathname === "/v1/admin/telegram-new-order-settings") {
    if (request.method === "GET") {
      await requireAdmin(env.DB, request, "settings.read");
      return success(await getTelegramSettings(env));
    }
    if (request.method === "PUT") {
      const actor = await writeIdentity(env.DB, request, "settings.write");
      const body = await readJson<Record<string, unknown>>(request);
      return success(await updateTelegramSettingValue(env, {
        version: safeInteger(body.version, "version", 1),
        requestedEnabled: body.requestedEnabled === true,
        recipientGroupLabel: requiredString(body.recipientGroupLabel, "recipientGroupLabel", 1, 120),
        includedFields: Array.isArray(body.includedFields)
          ? body.includedFields.map((item) => String(item).toUpperCase())
          : [],
        reason: requiredString(body.reason, "reason", 8, 500),
      }, actor));
    }
  }
  if (pathname === "/v1/admin/telegram-new-order-settings/simulation" && request.method === "POST") {
    await writeIdentity(env.DB, request, "settings.read");
    const settings = await getTelegramSettings(env);
    return success({
      mode: "SIMULATED",
      recipientGroupLabel: settings.recipientGroupLabel,
      fields: [
        { code: "ORDER_NUMBER", value: "CB-DEMO-0001" },
        { code: "PRODUCT", value: "CloudBridge Demo Product" },
        { code: "AMOUNT", value: "89.00" },
        { code: "CURRENCY", value: "MYR" },
        { code: "STATUS", value: "MANUAL_PENDING" },
        { code: "CREATED_AT", value: new Date().toISOString() },
        { code: "CONTACT_CHANNEL", value: "EMAIL" },
        { code: "MASKED_CONTACT", value: "de***@invalid.example" },
      ].filter((field) => settings.includedFields.includes(
        field.code as (typeof settings.includedFields)[number],
      )),
      generatedAt: new Date().toISOString(),
      deliveryAttempted: false,
      externalDeliveryVerified: false,
    });
  }
  if (pathname === "/v1/admin/telegram-new-order-settings/test" && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "settings.write");
    const body = await readJson<Record<string, unknown>>(request);
    return success(await testTelegramConnection(
      env,
      actor,
      requiredString(body.reason, "reason", 8, 500),
    ));
  }
  if (pathname === "/v1/admin/telegram-deliveries" && request.method === "GET") {
    await requireAdmin(env.DB, request, "settings.read");
    return success(await listTelegramDeliveries(env.DB));
  }
  const telegramRetryMatch = pathname.match(/^\/v1\/admin\/telegram-deliveries\/([^/]+)\/retry$/u);
  if (telegramRetryMatch && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "settings.write");
    const body = await readJson<Record<string, unknown>>(request);
    return success(await retryTelegramDelivery(
      env.DB,
      decodeURIComponent(telegramRetryMatch[1]),
      actor,
      requiredString(body.reason, "reason", 8, 500),
    ));
  }

  if (pathname === "/v1/admin/data-governance" && request.method === "GET") {
    await requireAdmin(env.DB, request, "settings.read");
    return success(await getDataGovernanceOverview(env));
  }
  if (pathname === "/v1/admin/privacy-requests" && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "settings.write");
    const body = await readJson<Record<string, unknown>>(request);
    return success(await createPrivacyRequest(env, {
      type: requiredString(body.type, "type", 1, 20),
      requesterReference: requiredString(body.requesterReference, "requesterReference", 3, 240),
      reason: requiredString(body.reason, "reason", 8, 500),
    }, actor), { status: 201 });
  }
  const privacyRequestMatch = pathname.match(/^\/v1\/admin\/privacy-requests\/([^/]+)$/u);
  if (privacyRequestMatch && request.method === "PATCH") {
    const actor = await writeIdentity(env.DB, request, "settings.write");
    const body = await readJson<Record<string, unknown>>(request);
    return success(await updatePrivacyRequest(
      env,
      decodeURIComponent(privacyRequestMatch[1]),
      {
        status: requiredString(body.status, "status", 1, 40),
        reason: requiredString(body.reason, "reason", 8, 500),
        confirmation: nullableString(body.confirmation, "confirmation", 120) ?? undefined,
        correctedReference: nullableString(body.correctedReference, "correctedReference", 240) ?? undefined,
      },
      actor,
    ));
  }
  if (pathname === "/v1/admin/data-governance/key-rotation" && request.method === "POST") {
    const actor = await writeIdentity(env.DB, request, "settings.write");
    const body = await readJson<Record<string, unknown>>(request);
    return success(await runDataKeyRotation(
      env,
      actor,
      requiredString(body.reason, "reason", 8, 500),
      requiredString(body.confirmation, "confirmation", 1, 120),
    ));
  }

  return null;
}

export async function handleSitesHealth(env: SitesEnv): Promise<Response> {
  const start = performance.now();
  await env.DB.prepare("SELECT 1 AS ok").first();
  const databaseLatency = Math.max(0, Math.round(performance.now() - start));
  return success({
    status: "healthy",
    database: "connected",
    runtime: "sites",
    objectStorage: env.MEDIA ? "bound" : "missing",
    latencyMs: {
      database: databaseLatency,
    },
    timestamp: new Date().toISOString(),
  });
}

async function writeIdentity(
  db: D1Database,
  request: Request,
  permission: string,
): Promise<AdminIdentity> {
  requireCsrf(request);
  return requireAdmin(db, request, permission);
}

async function requireAdminAny(
  db: D1Database,
  request: Request,
  permissions: readonly string[],
): Promise<AdminIdentity> {
  const identity = await requireAdmin(db, request);
  if (!permissions.some((permission) => identity.permissions.includes(permission))) {
    throw new ApiInputError(
      "PERMISSION_DENIED",
      `One of ${permissions.join(", ")} is required.`,
      403,
    );
  }
  return identity;
}

async function writeIdentityAny(
  db: D1Database,
  request: Request,
  permissions: readonly string[],
): Promise<AdminIdentity> {
  requireCsrf(request);
  return requireAdminAny(db, request, permissions);
}

async function writeIdentityAll(
  db: D1Database,
  request: Request,
  permissions: readonly string[],
): Promise<AdminIdentity> {
  requireCsrf(request);
  const identity = await requireAdmin(db, request);
  const missing = permissions.filter(
    (permission) => !identity.permissions.includes(permission),
  );
  if (missing.length > 0) {
    throw new ApiInputError(
      "PERMISSION_DENIED",
      `Permissions ${missing.join(", ")} are required.`,
      403,
    );
  }
  return identity;
}

function adminUser(identity: AdminIdentity) {
  const role = adminRoleForPermissions(identity.permissions);
  return {
    id: identity.id,
    email: identity.email,
    displayName: identity.displayName,
    roles: [{ key: role.key, name: role.name }],
    permissions: identity.permissions,
    authProvider: "SITES",
  };
}

async function overview(db: D1Database) {
  const [
    productCount,
    activeProducts,
    openOrders,
    categoryCount,
    inventoryRisk,
  ] = await Promise.all([
    count(db, "SELECT COUNT(*) AS count FROM products WHERE status <> 'ARCHIVED'"),
    count(db, "SELECT COUNT(*) AS count FROM products WHERE status = 'ACTIVE'"),
    count(db, "SELECT COUNT(*) AS count FROM orders WHERE status NOT IN ('COMPLETED','CANCELLED','REFUNDED')"),
    count(db, "SELECT COUNT(*) AS count FROM categories WHERE status = 'ACTIVE'"),
    inventoryRiskSummary(db),
  ]);
  const latest = (await db.prepare(
    `${orderListSql()} ORDER BY o.created_at DESC, o.id DESC LIMIT 6`,
  ).all<OrderListRow>()).results ?? [];
  return {
    metrics: { productCount, activeProducts, openOrders, categoryCount },
    inventoryRisk,
    latestOrders: latest.map(orderListItem),
  };
}

async function inventoryRiskSummary(db: D1Database): Promise<AdminInventoryRiskSummary> {
  const settingsRow = await db.prepare(
    "SELECT value_json AS valueJson FROM site_settings WHERE key = 'storefront.settings' LIMIT 1",
  ).first<{ valueJson: string }>();
  const threshold = inventoryRiskThresholdValue(
    parseJsonRecord(settingsRow?.valueJson).inventoryRiskThreshold,
  );
  const counts = await db.prepare(
    `SELECT
      COUNT(*) AS evaluatedProductCount,
      SUM(CASE WHEN stock_mode = 'FINITE' AND stock_quantity = 0 THEN 1 ELSE 0 END)
        AS soldOutCount,
      SUM(CASE
        WHEN stock_mode = 'FINITE' AND stock_quantity BETWEEN 1 AND ? THEN 1
        ELSE 0
      END) AS lowStockCount,
      SUM(CASE
        WHEN stock_mode NOT IN ('FINITE', 'UNLIMITED')
          OR (stock_mode = 'FINITE' AND (stock_quantity IS NULL OR stock_quantity < 0))
          OR (stock_mode = 'UNLIMITED' AND stock_quantity IS NOT NULL)
        THEN 1
        ELSE 0
      END) AS invalidStockCount
     FROM products
     WHERE status = 'ACTIVE'`,
  ).bind(threshold).first<{
    evaluatedProductCount: number | null;
    soldOutCount: number | null;
    lowStockCount: number | null;
    invalidStockCount: number | null;
  }>();
  const rows = (await db.prepare(
    `SELECT
      p.id,
      p.slug,
      p.stock_quantity AS stockQuantity,
      p.updated_at AS updatedAt,
      zh.name AS nameZh,
      en.name AS nameEn,
      CASE
        WHEN p.stock_mode NOT IN ('FINITE', 'UNLIMITED')
          OR (p.stock_mode = 'FINITE' AND (p.stock_quantity IS NULL OR p.stock_quantity < 0))
          OR (p.stock_mode = 'UNLIMITED' AND p.stock_quantity IS NOT NULL)
        THEN 'INVALID_STOCK'
        WHEN p.stock_mode = 'FINITE' AND p.stock_quantity = 0 THEN 'SOLD_OUT'
        ELSE 'LOW_STOCK'
      END AS risk
     FROM products p
     LEFT JOIN product_translations zh
       ON zh.product_id = p.id AND zh.locale = 'ZH'
     LEFT JOIN product_translations en
       ON en.product_id = p.id AND en.locale = 'EN'
     WHERE p.status = 'ACTIVE'
       AND (
         p.stock_mode NOT IN ('FINITE', 'UNLIMITED')
         OR (p.stock_mode = 'FINITE' AND (
           p.stock_quantity IS NULL
           OR p.stock_quantity < 0
           OR p.stock_quantity BETWEEN 0 AND ?
         ))
         OR (p.stock_mode = 'UNLIMITED' AND p.stock_quantity IS NOT NULL)
       )
     ORDER BY
       CASE
         WHEN p.stock_mode NOT IN ('FINITE', 'UNLIMITED')
           OR (p.stock_mode = 'FINITE' AND (p.stock_quantity IS NULL OR p.stock_quantity < 0))
           OR (p.stock_mode = 'UNLIMITED' AND p.stock_quantity IS NOT NULL)
         THEN 0
         WHEN p.stock_mode = 'FINITE' AND p.stock_quantity = 0 THEN 1
         ELSE 2
       END ASC,
       CASE WHEN p.stock_quantity IS NULL THEN 2147483647 ELSE p.stock_quantity END ASC,
       p.updated_at DESC,
       p.id ASC
     LIMIT 6`,
  ).bind(threshold).all<{
    id: string;
    slug: string;
    stockQuantity: number | null;
    updatedAt: string;
    nameZh: string | null;
    nameEn: string | null;
    risk: string;
  }>()).results ?? [];
  const soldOutCount = Number(counts?.soldOutCount ?? 0);
  const lowStockCount = Number(counts?.lowStockCount ?? 0);
  const invalidStockCount = Number(counts?.invalidStockCount ?? 0);

  return {
    source: "LIVE_DATABASE_QUERY",
    threshold,
    evaluatedProductCount: Number(counts?.evaluatedProductCount ?? 0),
    affectedProductCount: soldOutCount + lowStockCount + invalidStockCount,
    soldOutCount,
    lowStockCount,
    invalidStockCount,
    sampleLimit: 6,
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: { zh: row.nameZh ?? "", en: row.nameEn ?? "" },
      stockQuantity: row.stockQuantity === null ? null : Number(row.stockQuantity),
      risk: (
        ["INVALID_STOCK", "SOLD_OUT", "LOW_STOCK"].includes(row.risk)
          ? row.risk
          : "INVALID_STOCK"
      ) as AdminInventoryRiskLevel,
      updatedAt: row.updatedAt,
    })),
  };
}

async function adminCategories(db: D1Database) {
  const rows = await db.prepare(
    `SELECT c.id, c.slug, c.status, c.sort_order AS sortOrder, c.version,
      zh.name AS nameZh, en.name AS nameEn, c.updated_at AS updatedAt,
      COUNT(p.id) AS productCount
     FROM categories c
     LEFT JOIN category_translations zh ON zh.category_id = c.id AND zh.locale = 'ZH'
     LEFT JOIN category_translations en ON en.category_id = c.id AND en.locale = 'EN'
     LEFT JOIN products p ON p.category_id = c.id AND p.status <> 'ARCHIVED'
     WHERE c.status <> 'ARCHIVED'
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.id ASC`,
  ).all<{
    id: string;
    slug: string;
    status: string;
    sortOrder: number;
    version: number;
    nameZh: string | null;
    nameEn: string | null;
    updatedAt: string;
    productCount: number;
  }>();
  return (rows.results ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    status: row.status,
    sortOrder: row.sortOrder,
    version: row.version,
    name: { zh: row.nameZh ?? "", en: row.nameEn ?? "" },
    productCount: Number(row.productCount),
    updatedAt: row.updatedAt,
  }));
}

async function createCategory(db: D1Database, request: Request, actor: AdminIdentity) {
  const body = await readJson<Record<string, unknown>>(request);
  const input = categoryInput(body);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      "INSERT INTO categories (id, slug, status, sort_order, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
    ).bind(id, input.slug, input.status, input.sortOrder, now, now),
    db.prepare(
      "INSERT INTO category_translations (category_id, locale, name) VALUES (?, 'ZH', ?)",
    ).bind(id, input.nameZh),
    db.prepare(
      "INSERT INTO category_translations (category_id, locale, name) VALUES (?, 'EN', ?)",
    ).bind(id, input.nameEn),
  ]);
  await writeAudit(db, {
    action: "catalog.category.created",
    result: "SUCCEEDED",
    actor,
    targetType: "CATEGORY",
    targetId: id,
  });
  return (await adminCategories(db)).find((item) => item.id === id);
}

async function updateCategory(
  db: D1Database,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  const input = categoryInput(body);
  const version = safeInteger(body.version, "version", 1);
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE categories SET slug = ?, status = ?, sort_order = ?,
      version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
  ).bind(input.slug, input.status, input.sortOrder, now, id, version).run();
  if (changes(result) !== 1) throw new ApiInputError("VERSION_CONFLICT", "The category changed. Refresh and try again.", 409);
  await db.batch([
    db.prepare("UPDATE category_translations SET name = ? WHERE category_id = ? AND locale = 'ZH'")
      .bind(input.nameZh, id),
    db.prepare("UPDATE category_translations SET name = ? WHERE category_id = ? AND locale = 'EN'")
      .bind(input.nameEn, id),
  ]);
  await writeAudit(db, {
    action: "catalog.category.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "CATEGORY",
    targetId: id,
  });
  const saved = (await adminCategories(db)).find((item) => item.id === id);
  if (!saved) throw new ApiInputError("CATEGORY_NOT_FOUND", "Category was not found.", 404);
  return saved;
}

async function adminProducts(
  db: D1Database,
  query: {
    pageSize: number;
    offset: number;
    search: string | null;
    status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED" | null;
  },
) {
  const conditions = [query.status ? "p.status = ?" : "p.status <> 'ARCHIVED'"];
  const bindings: string[] = query.status ? [query.status] : [];
  if (query.search) {
    conditions.push(
      "(instr(zh.normalized_name, ?) > 0 OR instr(en.normalized_name, ?) > 0 OR instr(lower(p.slug), ?) > 0)",
    );
    bindings.push(query.search, query.search, query.search);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = Number((await db.prepare(
    `SELECT COUNT(*) AS count FROM products p
     JOIN product_translations zh ON zh.product_id = p.id AND zh.locale = 'ZH'
     JOIN product_translations en ON en.product_id = p.id AND en.locale = 'EN'
     ${where}`,
  ).bind(...bindings).first<{ count: number }>())?.count ?? 0);
  const rows = await db.prepare(
    `${adminProductSql()} ${where}
     ORDER BY p.sort_order ASC, p.updated_at DESC, p.id ASC LIMIT ? OFFSET ?`,
  ).bind(...bindings, query.pageSize, query.offset).all<AdminProductRow>();
  return {
    items: (rows.results ?? []).map(adminProductItem),
    total,
  };
}

async function createProduct(db: D1Database, request: Request, actor: AdminIdentity) {
  const body = await readJson<Record<string, unknown>>(request);
  const input = productInput(body);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO products (
        id, slug, category_id, image_key, base_price, compare_at_price,
        stock_mode, stock_quantity, status, sort_order, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(
      id,
      input.slug,
      input.categoryId,
      input.imageKey,
      input.basePrice,
      input.compareAtPrice,
      input.stockMode,
      input.stockQuantity,
      input.status,
      input.sortOrder,
      now,
      now,
    ),
    productTranslationInsert(db, id, "ZH", input.nameZh, input.kickerZh, input.descriptionZh),
    productTranslationInsert(db, id, "EN", input.nameEn, input.kickerEn, input.descriptionEn),
  ]);
  await writeAudit(db, {
    action: "catalog.product.created",
    result: "SUCCEEDED",
    actor,
    targetType: "PRODUCT",
    targetId: id,
  });
  return adminProductById(db, id);
}

async function updateProduct(
  db: D1Database,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  const input = productInput(body);
  const version = safeInteger(body.version, "version", 1);
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE products SET slug = ?, category_id = ?, image_key = ?, base_price = ?,
      compare_at_price = ?, stock_mode = ?, stock_quantity = ?, status = ?,
      sort_order = ?, version = version + 1, updated_at = ?
     WHERE id = ? AND version = ?`,
  ).bind(
    input.slug,
    input.categoryId,
    input.imageKey,
    input.basePrice,
    input.compareAtPrice,
    input.stockMode,
    input.stockQuantity,
    input.status,
    input.sortOrder,
    now,
    id,
    version,
  ).run();
  if (changes(result) !== 1) throw new ApiInputError("VERSION_CONFLICT", "The product changed. Refresh and try again.", 409);
  await db.batch([
    productTranslationUpdate(db, id, "ZH", input.nameZh, input.kickerZh, input.descriptionZh),
    productTranslationUpdate(db, id, "EN", input.nameEn, input.kickerEn, input.descriptionEn),
  ]);
  await writeAudit(db, {
    action: "catalog.product.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "PRODUCT",
    targetId: id,
  });
  return adminProductById(db, id);
}

async function adminProductById(db: D1Database, id: string) {
  const row = await db.prepare(`${adminProductSql()} WHERE p.id = ? LIMIT 1`)
    .bind(id).first<AdminProductRow>();
  if (!row) throw new ApiInputError("PRODUCT_NOT_FOUND", "Product was not found.", 404);
  return adminProductItem(row);
}

async function adminCurrencies(db: D1Database) {
  const rows = await db.prepare(
    `SELECT c.code, c.token, c.name_zh AS nameZh, c.name_en AS nameEn,
      c.digits, c.active, r.rate, r.effective_at AS effectiveAt
     FROM currencies c
     LEFT JOIN exchange_rates r ON r.id = (
       SELECT id FROM exchange_rates latest
       WHERE latest.from_code = 'MYR' AND latest.to_code = c.code
       ORDER BY latest.effective_at DESC, latest.id DESC LIMIT 1
     )
     ORDER BY c.sort_order ASC, c.code ASC`,
  ).all<{
    code: string;
    token: string;
    nameZh: string;
    nameEn: string;
    digits: number;
    active: number;
    rate: string | null;
    effectiveAt: string | null;
  }>();
  return (rows.results ?? []).map((row) => ({
    code: row.code,
    token: row.token,
    name: { zh: row.nameZh, en: row.nameEn },
    digits: row.digits,
    active: Boolean(row.active),
    rate: row.rate,
    effectiveAt: row.effectiveAt,
  }));
}

async function currencyRateHistory(db: D1Database, code: string) {
  const currency = await db.prepare("SELECT code FROM currencies WHERE code = ? LIMIT 1")
    .bind(code).first<{ code: string }>();
  if (!currency) throw new ApiInputError("CURRENCY_NOT_FOUND", "Currency was not found.", 404);
  const rows = await db.prepare(
    `SELECT id, from_code AS fromCode, to_code AS toCode, rate, source,
      effective_at AS effectiveAt, expires_at AS expiresAt, created_at AS createdAt
     FROM exchange_rates
     WHERE from_code = 'MYR' AND to_code = ?
     ORDER BY effective_at DESC, id DESC
     LIMIT 100`,
  ).bind(code).all<{
    id: string;
    fromCode: string;
    toCode: string;
    rate: string;
    source: string;
    effectiveAt: string;
    expiresAt: string | null;
    createdAt: string;
  }>();
  return rows.results ?? [];
}

async function updateCurrencyRate(
  env: SitesEnv,
  request: Request,
  code: string,
  actor: AdminIdentity,
) {
  const db = env.DB;
  const body = await readJson<Record<string, unknown>>(request);
  const rate = decimalString(body.rate, "rate", 10);
  const reason = requiredString(body.reason, "reason", 8, 500);
  const currency = await db.prepare("SELECT code FROM currencies WHERE code = ? LIMIT 1")
    .bind(code).first<{ code: string }>();
  if (!currency) throw new ApiInputError("CURRENCY_NOT_FOUND", "Currency was not found.", 404);
  if (code !== "MYR") {
    const settings = await getExchangeRateSyncSettings(db);
    await updateExchangeRateSyncSettings(db, {
      enabled: settings.enabled,
      intervalMinutes: settings.intervalMinutes,
      modes: Object.fromEntries(settings.currencies.map((item) => [
        item.code,
        item.code === code ? "MANUAL" : item.mode,
      ])),
      version: settings.version,
      reason,
    }, actor);
  }
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO exchange_rates (id, from_code, to_code, rate, source, effective_at, expires_at, created_at) VALUES (?, 'MYR', ?, ?, 'sites-admin-manual', ?, NULL, ?)",
  ).bind(crypto.randomUUID(), code, rate, now, now).run();
  await writeAudit(db, {
    action: "currency.rate.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "CURRENCY",
    targetId: code,
    reason,
  });
  return (await adminCurrencies(db)).find((item) => item.code === code);
}

async function adminHeroes(db: D1Database) {
  const rows = await db.prepare(
    `SELECT h.id, h.key, h.image_key AS imageKey, h.target_slug AS targetSlug,
      h.tone, h.status, h.sort_order AS sortOrder, h.version,
      zh.eyebrow AS zhEyebrow, zh.title AS zhTitle, zh.body AS zhBody, zh.cta AS zhCta,
      en.eyebrow AS enEyebrow, en.title AS enTitle, en.body AS enBody, en.cta AS enCta,
      h.created_at AS createdAt, h.updated_at AS updatedAt
     FROM heroes h
     JOIN hero_translations zh ON zh.hero_id = h.id AND zh.locale = 'ZH'
     JOIN hero_translations en ON en.hero_id = h.id AND en.locale = 'EN'
     ORDER BY h.sort_order ASC, h.id ASC`,
  ).all<HeroRow>();
  return (rows.results ?? []).map(heroItem);
}

async function createHero(db: D1Database, request: Request, actor: AdminIdentity) {
  const body = await readJson<Record<string, unknown>>(request);
  const input = heroInput(body);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      "INSERT INTO heroes (id, key, image_key, target_slug, tone, status, sort_order, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
    ).bind(id, input.key, input.imageKey, input.targetSlug, input.tone, input.status, input.sortOrder, now, now),
    heroTranslationInsert(db, id, "ZH", input.translations.zh),
    heroTranslationInsert(db, id, "EN", input.translations.en),
  ]);
  await writeAudit(db, {
    action: "content.hero.created",
    result: "SUCCEEDED",
    actor,
    targetType: "HERO",
    targetId: id,
  });
  return (await adminHeroes(db)).find((item) => item.id === id);
}

async function updateHero(db: D1Database, request: Request, id: string, actor: AdminIdentity) {
  const body = await readJson<Record<string, unknown>>(request);
  const input = heroInput(body);
  const version = safeInteger(body.version, "version", 1);
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE heroes SET key = ?, image_key = ?, target_slug = ?, tone = ?, status = ?,
      sort_order = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
  ).bind(
    input.key,
    input.imageKey,
    input.targetSlug,
    input.tone,
    input.status,
    input.sortOrder,
    now,
    id,
    version,
  ).run();
  if (changes(result) !== 1) throw new ApiInputError("VERSION_CONFLICT", "The hero changed. Refresh and try again.", 409);
  await db.batch([
    heroTranslationUpdate(db, id, "ZH", input.translations.zh),
    heroTranslationUpdate(db, id, "EN", input.translations.en),
  ]);
  await writeAudit(db, {
    action: "content.hero.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "HERO",
    targetId: id,
  });
  return (await adminHeroes(db)).find((item) => item.id === id);
}

async function adminChannels(db: D1Database) {
  const rows = await db.prepare(
    `SELECT id, type, mode, label_zh AS labelZh, label_en AS labelEn,
      public_account AS publicAccount, direct_target AS directTarget,
      service_hours_zh AS serviceHoursZh, service_hours_en AS serviceHoursEn,
      active, sort_order AS sortOrder, version, updated_at AS updatedAt
     FROM merchant_channels ORDER BY sort_order ASC, id ASC`,
  ).all<ChannelRow>();
  return (rows.results ?? []).map(channelItem);
}

async function updateChannel(
  db: D1Database,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const current = await db.prepare(
    `SELECT id, type, mode, label_zh AS labelZh, label_en AS labelEn,
      public_account AS publicAccount, direct_target AS directTarget,
      service_hours_zh AS serviceHoursZh, service_hours_en AS serviceHoursEn,
      active, sort_order AS sortOrder, version, updated_at AS updatedAt
     FROM merchant_channels WHERE id = ? LIMIT 1`,
  ).bind(id).first<ChannelRow>();
  if (!current) throw new ApiInputError("CONTACT_CHANNEL_NOT_FOUND", "The contact channel was not found.", 404);
  const body = await readJson<Record<string, unknown>>(request);
  const version = safeInteger(body.version, "version", 1);
  const label = localizedText(body.label, "label");
  const serviceHours = localizedText(body.serviceHours, "serviceHours");
  const publicAccount = requiredString(body.publicAccount, "publicAccount", 1, 240);
  const directTarget = current.type === "WECHAT"
    ? current.directTarget
    : nullableString(body.directTarget, "directTarget", 512);
  const active = Boolean(body.active);
  const sortOrder = safeInteger(body.sortOrder, "sortOrder", 0);
  const candidate = {
    type: current.type,
    mode: current.mode,
    publicAccount,
    directTarget,
  };
  if (active && !isConfiguredContactChannel(candidate)) {
    throw new ApiInputError(
      "CONTACT_CHANNEL_NOT_CONFIGURED",
      "A real public account and approved channel target are required before activation.",
      422,
    );
  }
  if (Boolean(current.active) && !active) {
    const [channels, settingsRow] = await Promise.all([
      adminChannels(db),
      db.prepare(
        "SELECT value_json AS valueJson FROM site_settings WHERE key = 'storefront.settings' LIMIT 1",
      ).first<{ valueJson: string }>(),
    ]);
    const settings = parseJsonRecord(settingsRow?.valueJson);
    const otherConfiguredChannels = channels.filter((channel) => (
      channel.id !== id
      && channel.active
      && isConfiguredContactChannel(channel)
    ));
    if (
      otherConfiguredChannels.length === 0
      && (settings.acceptOrders === true || settings.supportEnabled === true)
    ) {
      throw new ApiInputError(
        "CONTACT_CHANNEL_REQUIRED",
        "Disable new orders and support access before removing the final configured contact channel.",
        409,
      );
    }
  }
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE merchant_channels SET label_zh = ?, label_en = ?, public_account = ?,
      direct_target = ?, service_hours_zh = ?, service_hours_en = ?, active = ?,
      sort_order = ?, version = version + 1, updated_at = ?
     WHERE id = ? AND version = ?`,
  ).bind(
    label.zh,
    label.en,
    publicAccount,
    directTarget,
    serviceHours.zh,
    serviceHours.en,
    active ? 1 : 0,
    sortOrder,
    now,
    id,
    version,
  ).run();
  if (changes(result) !== 1) throw new ApiInputError("VERSION_CONFLICT", "The contact channel changed. Refresh and try again.", 409);
  await writeAudit(db, {
    action: "support.channel.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "MERCHANT_CHANNEL",
    targetId: id,
  });
  return (await adminChannels(db)).find((item) => item.id === id);
}

async function reorderRows(
  db: D1Database,
  request: Request,
  actor: AdminIdentity,
  table: "heroes" | "merchant_channels",
  action: string,
) {
  const body = await readJson<{ items?: Array<{ id?: unknown; version?: unknown }> }>(request);
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
    throw new ApiInputError("INVALID_ORDER", "A non-empty ordered item list is required.", 422);
  }
  const now = new Date().toISOString();
  const statements = body.items.map((item, index) => db.prepare(
    `UPDATE ${table} SET sort_order = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
  ).bind(
    index + 1,
    now,
    requiredString(item.id, "id", 1, 120),
    safeInteger(item.version, "version", 1),
  ));
  const results = await db.batch(statements);
  if (results.some((result) => changes(result) !== 1)) {
    throw new ApiInputError("VERSION_CONFLICT", "The order changed. Refresh and try again.", 409);
  }
  await writeAudit(db, {
    action,
    result: "SUCCEEDED",
    actor,
    targetType: table === "heroes" ? "HERO" : "MERCHANT_CHANNEL",
    reason: "Administrative reorder",
  });
  return table === "heroes" ? adminHeroes(db) : adminChannels(db);
}

async function adminSettings(db: D1Database) {
  const [row, channels] = await Promise.all([
    db.prepare(
      "SELECT value_json AS valueJson, version, updated_at AS updatedAt FROM site_settings WHERE key = 'storefront.settings' LIMIT 1",
    ).first<{ valueJson: string; version: number; updatedAt: string }>(),
    adminChannels(db),
  ]);
  if (!row) throw new ApiInputError("SETTINGS_NOT_FOUND", "Storefront settings were not found.", 404);
  const settings = parseJsonRecord(row.valueJson);
  const activeChannels = channels.filter((channel) => channel.active);
  return {
    ...settings,
    shareTemplate: normalizedShareTemplate(settings.shareTemplate),
    inventoryRiskThreshold: inventoryRiskThresholdValue(settings.inventoryRiskThreshold),
    version: row.version,
    updatedAt: row.updatedAt,
    orderReadiness: {
      activeContactChannels: activeChannels.length,
      configuredActiveContactChannels: activeChannels.filter(isConfiguredContactChannel).length,
    },
  };
}

async function updateSettings(db: D1Database, request: Request, actor: AdminIdentity) {
  const body = await readJson<Record<string, unknown>>(request);
  const version = safeInteger(body.version, "version", 1);
  const reason = requiredString(body.reason, "reason", 8, 500);
  const currentRow = await db.prepare(
    "SELECT value_json AS valueJson, version FROM site_settings WHERE key = 'storefront.settings' LIMIT 1",
  ).first<{ valueJson: string; version: number }>();
  if (!currentRow || currentRow.version !== version) {
    throw new ApiInputError("VERSION_CONFLICT", "Settings changed. Refresh and try again.", 409);
  }
  const currentSettings = parseJsonRecord(currentRow.valueJson);
  const settings = {
    siteName: localizedText(body.siteName, "siteName"),
    defaultLocale: body.defaultLocale === "en" ? "en" : "zh",
    seoDescription: localizedText(body.seoDescription, "seoDescription"),
    policyVersion: requiredString(body.policyVersion, "policyVersion", 1, 80),
    acceptOrders: Boolean(body.acceptOrders),
    supportEnabled: Boolean(body.supportEnabled),
    inventoryRiskThreshold: boundedInteger(
      body.inventoryRiskThreshold,
      "inventoryRiskThreshold",
      INVENTORY_RISK_THRESHOLD_MIN,
      INVENTORY_RISK_THRESHOLD_MAX,
    ),
    transitServiceEnabled: Boolean(body.transitServiceEnabled),
    transitServiceUrl: nullableHttpsUrl(body.transitServiceUrl, "transitServiceUrl"),
    shareTemplate: body.shareTemplate === undefined
      ? normalizedShareTemplate(currentSettings.shareTemplate)
      : validatedShareTemplate(body.shareTemplate),
  };
  if (settings.acceptOrders && !settings.supportEnabled) {
    throw new ApiInputError(
      "ORDER_SUPPORT_REQUIRED",
      "Support access must be enabled before new orders can be accepted.",
      422,
    );
  }
  if (settings.acceptOrders || settings.supportEnabled) {
    const channels = await adminChannels(db);
    const configuredActiveChannels = channels.filter((channel) => (
      channel.active && isConfiguredContactChannel(channel)
    ));
    if (configuredActiveChannels.length === 0) {
      throw new ApiInputError(
        "CONTACT_CHANNEL_REQUIRED",
        "At least one configured active contact channel is required before support or ordering can be enabled.",
        422,
      );
    }
  }
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE site_settings SET value_json = ?, version = version + 1,
      updated_at = ?, updated_by_email = ? WHERE key = 'storefront.settings' AND version = ?`,
  ).bind(JSON.stringify(settings), now, actor.email, version).run();
  if (changes(result) !== 1) throw new ApiInputError("VERSION_CONFLICT", "Settings changed. Refresh and try again.", 409);
  await writeAudit(db, {
    action: "settings.storefront.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "SITE_SETTING",
    targetId: "storefront.settings",
    reason,
  });
  return adminSettings(db);
}

async function listOrders(db: D1Database, url: URL): Promise<Response> {
  const { page, pageSize, offset } = parsePage(url);
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  const search = url.searchParams.get("search")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const scope = url.searchParams.get("scope");
  const assigneeId = url.searchParams.get("assigneeId");
  const channel = url.searchParams.get("contactChannel");
  if (scope === "AFTER_SALES") {
    conditions.push("o.status IN ('REFUND_PENDING','REFUNDED','DISPUTED')");
  } else if (status) {
    conditions.push("o.status = ?");
    bindings.push(status);
  }
  if (assigneeId === "UNASSIGNED") conditions.push("o.assigned_to_id IS NULL");
  else if (assigneeId) {
    conditions.push("o.assigned_to_id = ?");
    bindings.push(assigneeId);
  }
  if (channel) {
    conditions.push("o.contact_channel = ?");
    bindings.push(channel);
  }
  if (search) {
    conditions.push("(o.order_number LIKE ? OR o.product_name_snapshot LIKE ? OR o.masked_contact LIKE ?)");
    const pattern = `%${search}%`;
    bindings.push(pattern, pattern, pattern);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const total = Number((await db.prepare(`SELECT COUNT(*) AS count FROM orders o${where}`)
    .bind(...bindings).first<{ count: number }>())?.count ?? 0);
  const rows = await db.prepare(
    `${orderListSql()}${where} ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`,
  ).bind(...bindings, pageSize, offset).all<OrderListRow>();
  return success((rows.results ?? []).map(orderListItem), {
    meta: pageMeta(page, pageSize, total),
  });
}

async function orderDetail(db: D1Database, id: string) {
  const row = await db.prepare(`${orderListSql()} WHERE o.id = ? LIMIT 1`)
    .bind(id).first<OrderListRow>();
  if (!row) throw new ApiInputError("ORDER_NOT_FOUND", "Order was not found.", 404);
  const events = await db.prepare(
    `SELECT h.id, h.from_status AS fromStatus, h.to_status AS toStatus,
      h.reason, h.actor_email AS actorEmail, h.created_at AS createdAt,
      m.id AS actorId, m.display_name AS actorDisplayName
     FROM order_status_history h
     LEFT JOIN admin_members m ON m.email = h.actor_email
     WHERE h.order_id = ? ORDER BY h.created_at ASC, h.id ASC`,
  ).bind(id).all<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    actorEmail: string | null;
    actorId: string | null;
    actorDisplayName: string | null;
    createdAt: string;
  }>();
  const base = orderListItem(row);
  return {
    ...base,
    exchangeRateSnapshot: row.exchangeRateSnapshot,
    productVersion: row.productVersion,
    acceptedPolicyVersion: row.acceptedPolicyVersion,
    allowedTransitions: orderTransitions[row.status] ?? [],
    statusHistory: (events.results ?? []).map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      actor: event.actorEmail
        ? { id: event.actorId ?? event.actorEmail, displayName: event.actorDisplayName ?? event.actorEmail }
        : null,
      createdAt: event.createdAt,
    })),
  };
}

async function updateOrderStatus(
  db: D1Database,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  const expectedStatus = requiredString(body.expectedStatus, "expectedStatus", 1, 40);
  const expectedUpdatedAt = requiredString(body.expectedUpdatedAt, "expectedUpdatedAt", 1, 80);
  const status = requiredString(body.status, "status", 1, 40);
  const reason = requiredString(body.reason, "reason", 8, 500);
  if (!(orderTransitions[expectedStatus] ?? []).includes(status)) {
    throw new ApiInputError("INVALID_STATUS_TRANSITION", "The requested status transition is not allowed.", 422);
  }
  const current = await db.prepare(
    "SELECT status, updated_at AS updatedAt, inventory_reserved AS inventoryReserved, inventory_released_at AS inventoryReleasedAt, product_id AS productId FROM orders WHERE id = ? LIMIT 1",
  ).bind(id).first<{
    status: string;
    updatedAt: string;
    inventoryReserved: number;
    inventoryReleasedAt: string | null;
    productId: string;
  }>();
  if (!current) throw new ApiInputError("ORDER_NOT_FOUND", "Order was not found.", 404);
  if (current.status !== expectedStatus || current.updatedAt !== expectedUpdatedAt) {
    throw new ApiInputError("VERSION_CONFLICT", "The order changed. Refresh and try again.", 409);
  }
  const now = new Date().toISOString();
  const releaseInventory = status === "CANCELLED"
    && Boolean(current.inventoryReserved)
    && !current.inventoryReleasedAt;
  const history = db.prepare(
    `INSERT INTO order_status_history
      (id, order_id, from_status, to_status, reason, actor_email, created_at)
     SELECT ?, id, status, ?, ?, ?, ?
     FROM orders
     WHERE id = ? AND status = ? AND updated_at = ?`,
  ).bind(
    crypto.randomUUID(),
    status,
    reason,
    actor.email,
    now,
    id,
    expectedStatus,
    expectedUpdatedAt,
  );
  const update = db.prepare(
    `UPDATE orders SET status = ?, updated_at = ?,
      inventory_released_at = CASE WHEN ? = 1 THEN ? ELSE inventory_released_at END
     WHERE id = ? AND status = ? AND updated_at = ?`,
  ).bind(status, now, releaseInventory ? 1 : 0, now, id, expectedStatus, expectedUpdatedAt);
  const statements = [history, update];
  if (releaseInventory) {
    statements.push(db.prepare(
      `UPDATE products
       SET stock_quantity = stock_quantity + 1, version = version + 1, updated_at = ?
       WHERE id = ? AND stock_mode = 'FINITE'
         AND EXISTS (
           SELECT 1 FROM orders
           WHERE id = ? AND status = 'CANCELLED'
             AND updated_at = ? AND inventory_released_at = ?
         )`,
    ).bind(now, current.productId, id, now, now));
  }
  const results = await db.batch(statements);
  if (changes(results[0]) !== 1 || changes(results[1]) !== 1) {
    throw new ApiInputError("VERSION_CONFLICT", "The order changed. Refresh and try again.", 409);
  }
  await writeAudit(db, {
    action: "order.status.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "ORDER",
    targetId: id,
    reason,
  });
  return orderDetail(db, id);
}

async function updateOrderAssignment(
  db: D1Database,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  const assigneeId = nullableString(body.assigneeId, "assigneeId", 120);
  const expectedAssigneeId = nullableString(body.expectedAssigneeId, "expectedAssigneeId", 120);
  const expectedUpdatedAt = requiredString(body.expectedUpdatedAt, "expectedUpdatedAt", 1, 80);
  const reason = requiredString(body.reason, "reason", 8, 500);
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE orders SET assigned_to_id = ?, updated_at = ?
     WHERE id = ? AND updated_at = ?
       AND ((assigned_to_id IS NULL AND ? IS NULL) OR assigned_to_id = ?)`,
  ).bind(assigneeId, now, id, expectedUpdatedAt, expectedAssigneeId, expectedAssigneeId).run();
  if (changes(result) !== 1) throw new ApiInputError("VERSION_CONFLICT", "The order assignment changed. Refresh and try again.", 409);
  await writeAudit(db, {
    action: "order.assignment.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "ORDER",
    targetId: id,
    reason,
  });
  return orderDetail(db, id);
}

async function revealOrderContact(
  env: SitesEnv,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  const reason = requiredString(body.reason, "reason", 8, 500);
  const row = await env.DB.prepare(
    "SELECT contact_encrypted AS contactEncrypted, contact_channel AS contactChannel FROM orders WHERE id = ? LIMIT 1",
  ).bind(id).first<{ contactEncrypted: string; contactChannel: string }>();
  if (!row) throw new ApiInputError("ORDER_NOT_FOUND", "Order was not found.", 404);
  let contact: string;
  try {
    contact = await decryptOrderContact(
      row.contactEncrypted,
      env.CLOUDBRIDGE_DATA_KEY,
      "ORDER",
      env.CLOUDBRIDGE_DATA_KEY_NEXT,
    );
  } catch (error) {
    if (error instanceof ProtectedDataInvalidError) {
      throw new ApiInputError(
        "ORDER_CONTACT_INVALID",
        "The encrypted contact cannot be read.",
        500,
      );
    }
    throw error;
  }
  await writeAudit(env.DB, {
    action: "order.contact.revealed",
    result: "SUCCEEDED",
    actor,
    targetType: "ORDER",
    targetId: id,
    reason,
  });
  return { contact, channel: row.contactChannel };
}

async function teamOverview(db: D1Database) {
  const members = await db.prepare(
    `SELECT id, email, display_name AS displayName, status,
      permissions_json AS permissionsJson, last_login_at AS lastLoginAt,
      created_at AS createdAt, updated_at AS updatedAt FROM admin_members
     ORDER BY created_at ASC, id ASC`,
  ).all<{
    id: string;
    email: string;
    displayName: string;
    status: string;
    permissionsJson: string;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>();
  return {
    members: (members.results ?? []).map((member) => {
      const permissions = safeJsonStringArrayForAccess(member.permissionsJson);
      const role = adminRoleForPermissions(permissions);
      return {
        id: member.id,
        email: member.email,
        displayName: member.displayName,
        status: member.status,
        lastLoginAt: member.lastLoginAt,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        authProvider: "SITES",
        roles: [roleSummary(role)],
      };
    }),
    availableRoles: adminRoleDefinitions.map(roleSummary),
  };
}

async function rolesOverview(db: D1Database) {
  const members = await db.prepare(
    "SELECT permissions_json AS permissionsJson FROM admin_members",
  ).all<{ permissionsJson: string }>();
  const roleCounts = new Map<string, number>();
  for (const member of members.results ?? []) {
    const role = adminRoleForPermissions(safeJsonStringArrayForAccess(member.permissionsJson));
    roleCounts.set(role.key, (roleCounts.get(role.key) ?? 0) + 1);
  }
  return {
    roles: adminRoleDefinitions.map((role) => ({
      ...roleSummary(role),
      permissions: [...role.permissions],
      memberCount: roleCounts.get(role.key) ?? 0,
      updatedAt: new Date().toISOString(),
      systemProtected: role.systemProtected,
      capabilities: role.capabilities,
      restrictions: role.restrictions,
    })),
    permissions: adminPermissions.map((key) => ({ key, description: null })),
  };
}

async function createTeamMember(
  db: D1Database,
  request: Request,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  confirmOwnerIdentity(body.confirmationEmail, actor);
  const displayName = requiredString(body.displayName, "displayName", 1, 120);
  const email = adminEmail(body.email, "email");
  const reason = requiredString(body.reason, "reason", 8, 500);
  const role = assignableRole(body.roleKey);
  const existing = await db.prepare(
    "SELECT id FROM admin_members WHERE email = ? LIMIT 1",
  ).bind(email).first<{ id: string }>();
  if (existing) {
    throw new ApiInputError(
      "ADMIN_MEMBER_EMAIL_EXISTS",
      "An administrator with this email already exists.",
      409,
    );
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO admin_members (id, email, display_name, status, permissions_json, last_login_at, created_at, updated_at) VALUES (?, ?, ?, 'INVITED', ?, NULL, ?, ?)",
  ).bind(
    id,
    email,
    displayName,
    JSON.stringify(role.permissions),
    now,
    now,
  ).run();
  await writeAudit(db, {
    action: "team.member.created",
    result: "SUCCEEDED",
    actor,
    targetType: "ADMIN_USER",
    targetId: id,
    reason,
  });
  return teamMemberById(db, id);
}

async function updateTeamMember(
  db: D1Database,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const current = await db.prepare(
    `SELECT id, email, display_name AS displayName, status,
      permissions_json AS permissionsJson, last_login_at AS lastLoginAt,
      created_at AS createdAt, updated_at AS updatedAt
     FROM admin_members WHERE id = ? LIMIT 1`,
  ).bind(id).first<{
    id: string;
    email: string;
    displayName: string;
    status: string;
    permissionsJson: string;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>();
  if (!current) throw new ApiInputError("ADMIN_MEMBER_NOT_FOUND", "The administrator was not found.", 404);
  if (current.id === actor.id) {
    throw new ApiInputError(
      "OWNER_SELF_CHANGE_FORBIDDEN",
      "The current owner cannot change their own access.",
      409,
    );
  }
  const currentRole = adminRoleForPermissions(safeJsonStringArrayForAccess(current.permissionsJson));
  if (currentRole.key === "SUPER_ADMIN") {
    throw new ApiInputError(
      "OWNER_PROTECTED",
      "The owner role is system protected.",
      409,
    );
  }

  const body = await readJson<Record<string, unknown>>(request);
  confirmOwnerIdentity(body.confirmationEmail, actor);
  const expectedUpdatedAt = requiredString(body.expectedUpdatedAt, "expectedUpdatedAt", 1, 80);
  const reason = requiredString(body.reason, "reason", 8, 500);
  const nextRole = body.roleKey === undefined ? currentRole : assignableRole(body.roleKey);
  const requestedStatus = body.status;
  if (
    requestedStatus !== undefined
    && requestedStatus !== "ACTIVE"
    && requestedStatus !== "DISABLED"
  ) throw fieldError("status");
  const nextStatus = requestedStatus === undefined
    ? current.status
    : requestedStatus === "ACTIVE" && current.status === "INVITED"
      ? "INVITED"
      : requestedStatus;
  const changedRole = nextRole.key !== currentRole.key;
  const changedStatus = nextStatus !== current.status;
  if (!changedRole && !changedStatus) {
    throw new ApiInputError("ADMIN_MEMBER_UNCHANGED", "No administrator access change was requested.", 422);
  }
  const now = nextIsoTimestamp(current.updatedAt);
  const result = await db.prepare(
    `UPDATE admin_members SET permissions_json = ?, status = ?, updated_at = ?
     WHERE id = ? AND updated_at = ?`,
  ).bind(
    JSON.stringify(nextRole.permissions),
    nextStatus,
    now,
    id,
    expectedUpdatedAt,
  ).run();
  if (changes(result) !== 1) {
    throw new ApiInputError(
      "VERSION_CONFLICT",
      "The administrator changed. Refresh and try again.",
      409,
    );
  }
  await writeAudit(db, {
    action: changedRole
      ? "team.member.roles.update"
      : nextStatus === "DISABLED"
        ? "team.member.disabled"
        : "team.member.enabled",
    result: "SUCCEEDED",
    actor,
    targetType: "ADMIN_USER",
    targetId: id,
    reason,
  });
  return teamMemberById(db, id);
}

async function teamMemberById(db: D1Database, id: string) {
  const overview = await teamOverview(db);
  const member = overview.members.find((item) => item.id === id);
  if (!member) throw new ApiInputError("ADMIN_MEMBER_NOT_FOUND", "The administrator was not found.", 404);
  return member;
}

function roleSummary(role: (typeof adminRoleDefinitions)[number]) {
  return {
    id: `role-${role.key.toLocaleLowerCase().replaceAll("_", "-")}`,
    key: role.key,
    name: role.name,
    description: role.description,
    assignable: role.assignable,
  };
}

function safeJsonStringArrayForAccess(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function assignableRole(value: unknown) {
  const key = typeof value === "string" ? value : "";
  const role = adminRoleDefinition(key);
  if (!role || !role.assignable) throw fieldError("roleKey");
  return role;
}

function confirmOwnerIdentity(value: unknown, actor: AdminIdentity): void {
  const confirmation = adminEmail(value, "confirmationEmail");
  if (confirmation !== actor.email.toLocaleLowerCase()) {
    throw new ApiInputError(
      "OWNER_CONFIRMATION_MISMATCH",
      "The confirmation email does not match the current owner.",
      422,
      [{
        field: "confirmationEmail",
        code: "MISMATCH",
        message: "Enter the current owner email.",
      }],
    );
  }
}

function adminEmail(value: unknown, field: string): string {
  const email = requiredString(value, field, 3, 254).toLocaleLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) throw fieldError(field);
  return email;
}

async function manualPaymentEvents(db: D1Database, url: URL): Promise<Response> {
  const { page, pageSize, offset } = parsePage(url);
  const statuses = ["PAID", "REFUND_PENDING", "REFUNDED", "DISPUTED"];
  const total = Number((await db.prepare(
    `SELECT COUNT(*) AS count FROM order_status_history WHERE to_status IN ('PAID','REFUND_PENDING','REFUNDED','DISPUTED')`,
  ).first<{ count: number }>())?.count ?? 0);
  const rows = await db.prepare(
    `SELECT h.id AS statusHistoryId, h.from_status AS fromStatus, h.to_status AS toStatus,
      h.reason, h.created_at AS recordedAt, h.actor_email AS actorEmail,
      o.id AS orderId, o.order_number AS orderNumber, o.product_name_snapshot AS productNameSnapshot,
      o.amount, o.currency_code AS currency, o.reference_amount AS referenceAmount,
      o.reference_currency_code AS referenceCurrency, o.exchange_rate_snapshot AS exchangeRateSnapshot,
      o.status AS currentStatus, o.assigned_to_id AS assignedToId,
      assigned.display_name AS assignedDisplayName, actor.id AS actorId,
      actor.display_name AS actorDisplayName
     FROM order_status_history h
     JOIN orders o ON o.id = h.order_id
     LEFT JOIN admin_members assigned ON assigned.id = o.assigned_to_id
     LEFT JOIN admin_members actor ON actor.email = h.actor_email
     WHERE h.to_status IN ('PAID','REFUND_PENDING','REFUNDED','DISPUTED')
     ORDER BY h.created_at DESC, h.id DESC LIMIT ? OFFSET ?`,
  ).bind(pageSize, offset).all<Record<string, unknown>>();
  const items = (rows.results ?? []).map((row) => {
    const toStatus = String(row.toStatus);
    const eventType = toStatus === "PAID"
      ? "MANUALLY_RECORDED_PAID"
      : toStatus === "REFUND_PENDING"
        ? "REFUND_REVIEW_STARTED"
        : toStatus === "REFUNDED"
          ? "MANUALLY_RECORDED_REFUNDED"
          : "DISPUTE_REVIEW_STARTED";
    return {
      statusHistoryId: row.statusHistoryId,
      eventType,
      fromStatus: row.fromStatus,
      toStatus,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      productNameSnapshot: row.productNameSnapshot,
      orderAmount: { amount: row.amount, currency: row.currency },
      referenceAmount: row.referenceAmount && row.referenceCurrency
        ? { amount: row.referenceAmount, currency: row.referenceCurrency }
        : null,
      exchangeRateSnapshot: row.exchangeRateSnapshot,
      currentStatus: row.currentStatus,
      currentAssignee: row.assignedToId
        ? { id: row.assignedToId, displayName: row.assignedDisplayName }
        : null,
      actor: row.actorEmail
        ? { id: row.actorId ?? row.actorEmail, displayName: row.actorDisplayName ?? row.actorEmail }
        : null,
      reason: row.reason,
      recordedAt: row.recordedAt,
      externalActionVerified: false,
    };
  });
  return success(items, { meta: pageMeta(page, pageSize, total) });
}

type AdminProductRow = {
  id: string;
  slug: string;
  imageKey: string;
  basePrice: string;
  compareAtPrice: string | null;
  stockMode: "FINITE" | "UNLIMITED";
  stockQuantity: number | null;
  status: string;
  sortOrder: number;
  version: number;
  categoryId: string;
  categorySlug: string;
  categoryNameZh: string;
  categoryNameEn: string;
  nameZh: string;
  kickerZh: string;
  descriptionZh: string;
  nameEn: string;
  kickerEn: string;
  descriptionEn: string;
  updatedAt: string;
};

type HeroRow = {
  id: string;
  key: string;
  imageKey: string;
  targetSlug: string | null;
  tone: string;
  status: string;
  sortOrder: number;
  version: number;
  zhEyebrow: string;
  zhTitle: string;
  zhBody: string;
  zhCta: string;
  enEyebrow: string;
  enTitle: string;
  enBody: string;
  enCta: string;
  createdAt: string;
  updatedAt: string;
};

type ChannelRow = {
  id: string;
  type: ContactChannelType;
  mode: ContactChannelMode;
  labelZh: string;
  labelEn: string;
  publicAccount: string;
  directTarget: string | null;
  serviceHoursZh: string;
  serviceHoursEn: string;
  active: number;
  sortOrder: number;
  version: number;
  updatedAt: string;
};

type OrderListRow = {
  id: string;
  orderNumber: string;
  productId: string;
  productNameSnapshot: string;
  amount: string;
  currency: string;
  referenceAmount: string | null;
  referenceCurrency: string | null;
  contactChannel: string;
  maskedContact: string;
  status: string;
  reservedUntil: string;
  assignedToId: string | null;
  assignedDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  exchangeRateSnapshot: string;
  productVersion: number;
  acceptedPolicyVersion: string;
};

function adminProductSql(): string {
  return `SELECT p.id, p.slug, p.image_key AS imageKey, p.base_price AS basePrice,
    p.compare_at_price AS compareAtPrice, p.stock_mode AS stockMode,
    p.stock_quantity AS stockQuantity, p.status, p.sort_order AS sortOrder,
    p.version, c.id AS categoryId, c.slug AS categorySlug,
    czh.name AS categoryNameZh, cen.name AS categoryNameEn,
    zh.name AS nameZh, zh.kicker AS kickerZh, zh.description AS descriptionZh,
    en.name AS nameEn, en.kicker AS kickerEn, en.description AS descriptionEn,
    p.updated_at AS updatedAt
   FROM products p
   JOIN categories c ON c.id = p.category_id
   JOIN category_translations czh ON czh.category_id = c.id AND czh.locale = 'ZH'
   JOIN category_translations cen ON cen.category_id = c.id AND cen.locale = 'EN'
   JOIN product_translations zh ON zh.product_id = p.id AND zh.locale = 'ZH'
   JOIN product_translations en ON en.product_id = p.id AND en.locale = 'EN'`;
}

function adminProductItem(row: AdminProductRow) {
  return {
    id: row.id,
    slug: row.slug,
    imageKey: row.imageKey,
    basePrice: row.basePrice,
    compareAtPrice: row.compareAtPrice,
    stockMode: row.stockMode,
    stockQuantity: row.stockQuantity,
    status: row.status,
    sortOrder: row.sortOrder,
    version: row.version,
    category: {
      id: row.categoryId,
      slug: row.categorySlug,
      name: { zh: row.categoryNameZh, en: row.categoryNameEn },
    },
    translations: {
      zh: { name: row.nameZh, kicker: row.kickerZh, description: row.descriptionZh },
      en: { name: row.nameEn, kicker: row.kickerEn, description: row.descriptionEn },
    },
    updatedAt: row.updatedAt,
  };
}

function heroItem(row: HeroRow) {
  return {
    id: row.id,
    key: row.key,
    imageKey: row.imageKey,
    targetSlug: row.targetSlug,
    tone: row.tone,
    status: row.status,
    sortOrder: row.sortOrder,
    version: row.version,
    translations: {
      zh: {
        eyebrow: normalizeLegacyLineBreaks(row.zhEyebrow),
        title: normalizeLegacyLineBreaks(row.zhTitle),
        body: normalizeLegacyLineBreaks(row.zhBody),
        cta: normalizeLegacyLineBreaks(row.zhCta),
      },
      en: {
        eyebrow: normalizeLegacyLineBreaks(row.enEyebrow),
        title: normalizeLegacyLineBreaks(row.enTitle),
        body: normalizeLegacyLineBreaks(row.enBody),
        cta: normalizeLegacyLineBreaks(row.enCta),
      },
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function channelItem(row: ChannelRow) {
  const qrImageUrl = row.type === "WECHAT" ? row.directTarget : null;
  return {
    id: row.id,
    type: row.type,
    mode: row.mode,
    label: { zh: row.labelZh, en: row.labelEn },
    publicAccount: row.publicAccount,
    directTarget: row.type === "WECHAT" ? null : row.directTarget,
    qrImageUrl,
    serviceHours: { zh: row.serviceHoursZh, en: row.serviceHoursEn },
    active: Boolean(row.active),
    sortOrder: row.sortOrder,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

function orderListSql(): string {
  return `SELECT o.id, o.order_number AS orderNumber, o.product_id AS productId,
    o.product_name_snapshot AS productNameSnapshot, o.amount,
    o.currency_code AS currency, o.reference_amount AS referenceAmount,
    o.reference_currency_code AS referenceCurrency,
    o.contact_channel AS contactChannel, o.masked_contact AS maskedContact,
    o.status, o.reserved_until AS reservedUntil, o.assigned_to_id AS assignedToId,
    m.display_name AS assignedDisplayName, o.created_at AS createdAt,
    o.updated_at AS updatedAt, o.exchange_rate_snapshot AS exchangeRateSnapshot,
    o.product_version AS productVersion, o.accepted_policy_version AS acceptedPolicyVersion
   FROM orders o LEFT JOIN admin_members m ON m.id = o.assigned_to_id`;
}

function orderListItem(row: OrderListRow) {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    productId: row.productId,
    productNameSnapshot: row.productNameSnapshot,
    amount: { amount: row.amount, currency: row.currency },
    referenceAmount: row.referenceAmount && row.referenceCurrency
      ? { amount: row.referenceAmount, currency: row.referenceCurrency }
      : null,
    contactChannel: row.contactChannel,
    maskedContact: row.maskedContact,
    status: row.status,
    paymentMode: "MANUAL",
    paymentStage: paymentStage(row.status),
    reservedUntil: row.reservedUntil,
    assignedTo: row.assignedToId
      ? { id: row.assignedToId, displayName: row.assignedDisplayName ?? row.assignedToId }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function paymentStage(status: string): string {
  if (status === "PAYMENT_PROCESSING") return "EXTERNAL_PROCESSING_UNVERIFIED";
  if (["PAID", "FULFILLING", "COMPLETED"].includes(status)) return "MANUALLY_RECORDED_PAID";
  if (status === "REFUND_PENDING") return "REFUND_REVIEW";
  if (status === "REFUNDED") return "MANUALLY_RECORDED_REFUNDED";
  if (status === "DISPUTED") return "DISPUTE_REVIEW";
  if (status === "CANCELLED") return "CANCELLED";
  return "NOT_RECORDED";
}

function categoryInput(body: Record<string, unknown>) {
  const status = requiredString(body.status, "status", 1, 20);
  if (!["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"].includes(status)) {
    throw new ApiInputError("INVALID_STATUS", "Category status is invalid.", 422);
  }
  return {
    nameZh: requiredString(body.nameZh, "nameZh", 1, 160),
    nameEn: requiredString(body.nameEn, "nameEn", 1, 160),
    slug: slugString(body.slug),
    sortOrder: safeInteger(body.sortOrder, "sortOrder", 0),
    status,
  };
}

function productInput(body: Record<string, unknown>) {
  const stockMode = requiredString(body.stockMode, "stockMode", 1, 20);
  const status = requiredString(body.status, "status", 1, 20);
  if (!["FINITE", "UNLIMITED"].includes(stockMode)) {
    throw new ApiInputError("INVALID_STOCK_MODE", "Stock mode is invalid.", 422);
  }
  if (!["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"].includes(status)) {
    throw new ApiInputError("INVALID_STATUS", "Product status is invalid.", 422);
  }
  return {
    slug: slugString(body.slug),
    categoryId: requiredString(body.categoryId, "categoryId", 1, 120),
    imageKey: safeImagePath(body.imageKey),
    basePrice: decimalString(body.basePrice, "basePrice", 2),
    compareAtPrice: body.compareAtPrice === null || body.compareAtPrice === ""
      ? null
      : decimalString(body.compareAtPrice, "compareAtPrice", 2),
    stockMode,
    stockQuantity: stockMode === "UNLIMITED"
      ? null
      : safeInteger(body.stockQuantity, "stockQuantity", 0),
    status,
    sortOrder: safeInteger(body.sortOrder, "sortOrder", 0),
    nameZh: requiredString(body.nameZh, "nameZh", 1, 200),
    nameEn: requiredString(body.nameEn, "nameEn", 1, 200),
    kickerZh: requiredString(body.kickerZh, "kickerZh", 1, 180),
    kickerEn: requiredString(body.kickerEn, "kickerEn", 1, 180),
    descriptionZh: requiredString(body.descriptionZh, "descriptionZh", 1, 10_000),
    descriptionEn: requiredString(body.descriptionEn, "descriptionEn", 1, 10_000),
  };
}

function heroInput(body: Record<string, unknown>) {
  const translations = body.translations as Record<string, unknown> | undefined;
  const zh = translations?.zh as Record<string, unknown> | undefined;
  const en = translations?.en as Record<string, unknown> | undefined;
  const status = requiredString(body.status, "status", 1, 20);
  const tone = requiredString(body.tone, "tone", 1, 20);
  if (!["DRAFT", "ACTIVE", "INACTIVE"].includes(status)) {
    throw new ApiInputError("INVALID_STATUS", "Hero status is invalid.", 422);
  }
  if (!["cyan", "blue", "violet", "green"].includes(tone)) {
    throw new ApiInputError("INVALID_TONE", "Hero tone is invalid.", 422);
  }
  return {
    key: slugString(body.key),
    imageKey: safeImagePath(body.imageKey),
    targetSlug: nullableString(body.targetSlug, "targetSlug", 160),
    tone,
    status,
    sortOrder: safeInteger(body.sortOrder, "sortOrder", 0),
    translations: {
      zh: heroTranslation(zh, "translations.zh"),
      en: heroTranslation(en, "translations.en"),
    },
  };
}

function heroTranslation(value: Record<string, unknown> | undefined, field: string) {
  return {
    eyebrow: normalizeLegacyLineBreaks(requiredString(value?.eyebrow, `${field}.eyebrow`, 1, 160)),
    title: normalizeLegacyLineBreaks(requiredString(value?.title, `${field}.title`, 1, 300)),
    body: normalizeLegacyLineBreaks(requiredString(value?.body, `${field}.body`, 1, 2_000)),
    cta: normalizeLegacyLineBreaks(requiredString(value?.cta, `${field}.cta`, 1, 120)),
  };
}

function productTranslationInsert(
  db: D1Database,
  productId: string,
  locale: "ZH" | "EN",
  name: string,
  kicker: string,
  description: string,
) {
  return db.prepare(
    "INSERT INTO product_translations (product_id, locale, name, normalized_name, kicker, description, aliases_json) VALUES (?, ?, ?, ?, ?, ?, NULL)",
  ).bind(productId, locale, name, name.normalize("NFKC").trim().toLocaleLowerCase(), kicker, description);
}

function productTranslationUpdate(
  db: D1Database,
  productId: string,
  locale: "ZH" | "EN",
  name: string,
  kicker: string,
  description: string,
) {
  return db.prepare(
    "UPDATE product_translations SET name = ?, normalized_name = ?, kicker = ?, description = ? WHERE product_id = ? AND locale = ?",
  ).bind(name, name.normalize("NFKC").trim().toLocaleLowerCase(), kicker, description, productId, locale);
}

function heroTranslationInsert(
  db: D1Database,
  heroId: string,
  locale: "ZH" | "EN",
  value: { eyebrow: string; title: string; body: string; cta: string },
) {
  return db.prepare(
    "INSERT INTO hero_translations (hero_id, locale, eyebrow, title, body, cta) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(heroId, locale, value.eyebrow, value.title, value.body, value.cta);
}

function heroTranslationUpdate(
  db: D1Database,
  heroId: string,
  locale: "ZH" | "EN",
  value: { eyebrow: string; title: string; body: string; cta: string },
) {
  return db.prepare(
    "UPDATE hero_translations SET eyebrow = ?, title = ?, body = ?, cta = ? WHERE hero_id = ? AND locale = ?",
  ).bind(value.eyebrow, value.title, value.body, value.cta, heroId, locale);
}

function readProductListQuery(url: URL): {
  page: number;
  pageSize: number;
  offset: number;
  search: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED" | null;
} {
  const page = auditQueryInteger(url.searchParams.get("page"), "page", 1, 1000, 1);
  const pageSize = auditQueryInteger(
    url.searchParams.get("pageSize"),
    "pageSize",
    1,
    100,
    30,
  );
  const search = auditQueryString(url.searchParams.get("search"), "search", 160)
    ?.toLocaleLowerCase() ?? null;
  const status = auditQueryEnum(
    url.searchParams.get("status"),
    "status",
    ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const,
  );
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    search,
    status,
  };
}

function readAuditQuery(url: URL): {
  page: number;
  pageSize: number;
  offset: number;
  conditions: string[];
  bindings: Array<string | number>;
  scope: "security" | null;
  category: SecurityEventCategory | null;
  severity: SecurityEventSeverity | null;
} {
  const page = auditQueryInteger(url.searchParams.get("page"), "page", 1, 1000, 1);
  const pageSize = auditQueryInteger(url.searchParams.get("pageSize"), "pageSize", 1, 100, 30);
  const search = auditQueryString(url.searchParams.get("search"), "search", 160);
  const result = auditQueryEnum(
    url.searchParams.get("result"),
    "result",
    ["SUCCEEDED", "FAILED", "DENIED"] as const,
  );
  const actor = auditQueryEnum(
    url.searchParams.get("actor"),
    "actor",
    ["administrator", "system"] as const,
  );
  const targetType = auditQueryString(url.searchParams.get("targetType"), "targetType", 80);
  const timeRange = auditQueryEnum(
    url.searchParams.get("timeRange"),
    "timeRange",
    ["24h", "7d", "30d", "all"] as const,
  ) ?? "all";
  const requestedScope = auditQueryEnum(
    url.searchParams.get("scope"),
    "scope",
    ["security"] as const,
  );
  const category = auditQueryEnum(
    url.searchParams.get("category"),
    "category",
    securityEventCategories,
  );
  const severity = auditQueryEnum(
    url.searchParams.get("severity"),
    "severity",
    securityEventSeverities,
  );
  const scope = requestedScope === "security" || category || severity
    ? "security"
    : null;
  const conditions: string[] = [];
  const bindings: Array<string | number> = [];

  if (result) {
    conditions.push("result = ?");
    bindings.push(result);
  }
  if (actor === "administrator") {
    conditions.push("actor_email IS NOT NULL");
  } else if (actor === "system") {
    conditions.push("actor_email IS NULL");
  }
  if (targetType) {
    conditions.push("COALESCE(target_type, 'SYSTEM') = ?");
    bindings.push(targetType);
  }
  if (timeRange !== "all") {
    conditions.push("created_at >= ?");
    bindings.push(new Date(Date.now() - auditTimeRangeMs[timeRange]).toISOString());
  }
  if (search) {
    const searchableColumns = [
      "id",
      "trace_id",
      "action",
      "COALESCE(target_type, 'SYSTEM')",
      "COALESCE(target_id, '')",
      "COALESCE(reason, '')",
      "COALESCE(actor_display_name, '')",
      "COALESCE(actor_email, '')",
    ];
    conditions.push(`(${searchableColumns
      .map((column) => `instr(lower(${column}), lower(?)) > 0`)
      .join(" OR ")})`);
    bindings.push(...searchableColumns.map(() => search));
  }
  if (scope === "security") {
    const securityScope = securityScopeSql();
    conditions.push(securityScope.condition);
    bindings.push(...securityScope.bindings);
  }
  if (category) {
    const categoryFilter = securityCategorySql(category);
    conditions.push(categoryFilter.condition);
    bindings.push(...categoryFilter.bindings);
  }
  if (severity) {
    const severityFilter = securitySeveritySql(severity);
    conditions.push(severityFilter.condition);
    bindings.push(...severityFilter.bindings);
  }

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    conditions,
    bindings,
    scope,
    category,
    severity,
  };
}

type AuditSqlFilter = {
  condition: string;
  bindings: string[];
};

const actionInSql = (
  actions: readonly string[],
  negate = false,
): AuditSqlFilter => ({
  condition: `action ${negate ? "NOT " : ""}IN (${actions.map(() => "?").join(", ")})`,
  bindings: [...actions],
});

const securityScopeSql = (): AuditSqlFilter => {
  const knownActions = actionInSql(securityAuditActions);
  return {
    condition: `(${knownActions.condition} OR result = 'DENIED')`,
    bindings: knownActions.bindings,
  };
};

const securityCategorySql = (
  category: SecurityEventCategory,
): AuditSqlFilter => {
  const categoryActions = actionInSql(securityAuditActionsForCategory(category));
  if (category !== "authorization") return categoryActions;
  const unknownActions = actionInSql(securityAuditActions, true);
  return {
    condition: `(${categoryActions.condition} OR (result = 'DENIED' AND ${unknownActions.condition}))`,
    bindings: [...categoryActions.bindings, ...unknownActions.bindings],
  };
};

const securitySeveritySql = (
  severity: SecurityEventSeverity,
): AuditSqlFilter => {
  const defaultActions = actionInSql(
    securityAuditActionsForDefaultSeverity(severity),
  );
  if (severity !== "high") {
    return {
      condition: `(result = 'SUCCEEDED' AND ${defaultActions.condition})`,
      bindings: defaultActions.bindings,
    };
  }
  return {
    condition: `(result IN ('FAILED', 'DENIED') OR (result = 'SUCCEEDED' AND ${defaultActions.condition}))`,
    bindings: defaultActions.bindings,
  };
};

async function auditCount(
  database: D1Database,
  filters: readonly AuditSqlFilter[],
): Promise<number> {
  const whereSql = filters.length > 0
    ? ` WHERE ${filters.map((filter) => filter.condition).join(" AND ")}`
    : "";
  const bindings = filters.flatMap((filter) => filter.bindings);
  return Number((await database.prepare(
    `SELECT COUNT(*) AS count FROM audit_events${whereSql}`,
  ).bind(...bindings).first<{ count: number }>())?.count ?? 0);
}

async function readSecurityAuditSummary(
  database: D1Database,
): Promise<SecurityAuditSummary> {
  const scope = securityScopeSql();
  const last24Hours = {
    condition: "created_at >= ?",
    bindings: [new Date(Date.now() - auditTimeRangeMs["24h"]).toISOString()],
  };
  const needsReview = securitySeveritySql("high");
  const deniedOrFailed = {
    condition: "result IN ('FAILED', 'DENIED')",
    bindings: [],
  };
  const [total, last24, review, unsuccessful] = await Promise.all([
    auditCount(database, [scope]),
    auditCount(database, [scope, last24Hours]),
    auditCount(database, [scope, needsReview]),
    auditCount(database, [scope, deniedOrFailed]),
  ]);
  return {
    total,
    last24Hours: last24,
    needsReview: review,
    deniedOrFailed: unsuccessful,
  };
}

async function readAuditExportInput(request: Request): Promise<{
  query: ReturnType<typeof readAuditQuery>;
  reason: string;
}> {
  const raw = await readJson<unknown>(request);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw fieldError("body");
  const body = raw as Record<string, unknown>;
  const allowed = new Set([
    "search",
    "result",
    "actor",
    "targetType",
    "timeRange",
    "reason",
    "confirmation",
  ]);
  const unknownField = Object.keys(body).find((field) => !allowed.has(field));
  if (unknownField) throw fieldError(unknownField);
  if (typeof body.reason !== "string") throw fieldError("reason");
  const reason = body.reason.normalize("NFKC").trim();
  if (reason.length < 8 || reason.length > 500) throw fieldError("reason");
  if (body.confirmation !== AUDIT_CSV_EXPORT_CONFIRMATION) {
    throw fieldError("confirmation");
  }
  const url = new URL(request.url);
  for (const field of ["search", "result", "actor", "targetType", "timeRange"] as const) {
    const value = body[field];
    if (value === undefined) continue;
    if (typeof value !== "string") throw fieldError(field);
    url.searchParams.set(field, value);
  }
  return {
    query: readAuditQuery(url),
    reason,
  };
}

function auditQueryInteger(
  value: string | null,
  field: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw fieldError(field);
  }
  return parsed;
}

function auditQueryString(value: string | null, field: string, maximum: number): string | null {
  if (value === null || value === "") return null;
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length === 0 || normalized.length > maximum) throw fieldError(field);
  return normalized;
}

function auditQueryEnum<const T extends readonly string[]>(
  value: string | null,
  field: string,
  values: T,
): T[number] | null {
  if (value === null || value === "") return null;
  if (!values.includes(value)) throw fieldError(field);
  return value as T[number];
}

function parseJsonRecord(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function localizedText(value: unknown, field: string): { zh: string; en: string } {
  const record = value as Record<string, unknown> | null;
  return {
    zh: requiredString(record?.zh, `${field}.zh`, 1, 2_000),
    en: requiredString(record?.en, `${field}.en`, 1, 2_000),
  };
}

function normalizedShareTemplate(value: unknown): { zh: string; en: string } {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const candidate = {
    zh: typeof record.zh === "string" && record.zh.trim() ? record.zh.trim() : DEFAULT_SHARE_TEMPLATE.zh,
    en: typeof record.en === "string" && record.en.trim() ? record.en.trim() : DEFAULT_SHARE_TEMPLATE.en,
  };
  try {
    return validatedShareTemplate(candidate);
  } catch {
    return { ...DEFAULT_SHARE_TEMPLATE };
  }
}

function validatedShareTemplate(value: unknown): { zh: string; en: string } {
  const template = localizedText(value, "shareTemplate");
  for (const localized of [template.zh, template.en]) {
    if (localized.length > 500) throw fieldError("shareTemplate");
    for (const match of localized.matchAll(/\{([^{}]+)\}/gu)) {
      if (match[1] !== "productName" && match[1] !== "price") {
        throw fieldError("shareTemplate");
      }
    }
  }
  return template;
}

function requiredString(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number,
): string {
  if (typeof value !== "string") throw fieldError(field);
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) throw fieldError(field);
  return normalized;
}

function nullableString(value: unknown, field: string, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requiredString(value, field, 1, maxLength);
}

function nullableHttpsUrl(value: unknown, field: string): string | null {
  const raw = nullableString(value, field, 512);
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw fieldError(field);
  }
  if (url.protocol !== "https:" || url.username || url.password) throw fieldError(field);
  return url.toString();
}

function safeInteger(value: unknown, field: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) throw fieldError(field);
  return Number(value);
}

function boundedInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = safeInteger(value, field, minimum);
  if (parsed > maximum) throw fieldError(field);
  return parsed;
}

function inventoryRiskThresholdValue(value: unknown): number {
  return Number.isSafeInteger(value)
    && Number(value) >= INVENTORY_RISK_THRESHOLD_MIN
    && Number(value) <= INVENTORY_RISK_THRESHOLD_MAX
    ? Number(value)
    : DEFAULT_INVENTORY_RISK_THRESHOLD;
}

function decimalString(value: unknown, field: string, maxDigits: number): string {
  if (typeof value !== "string") throw fieldError(field);
  const normalized = value.trim();
  const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${maxDigits}})?$`, "u");
  if (!pattern.test(normalized) || /^0+(?:\.0+)?$/u.test(normalized)) throw fieldError(field);
  return normalized;
}

function slugString(value: unknown): string {
  const slug = requiredString(value, "slug", 1, 160).toLocaleLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw fieldError("slug");
  return slug;
}

function safeImagePath(value: unknown): string {
  const path = requiredString(value, "imageKey", 1, 512);
  if (!/^\/(?:assets|media)\/[A-Za-z0-9/_\-.]+$/u.test(path) || path.includes("..")) {
    throw fieldError("imageKey");
  }
  return path;
}

function fieldError(field: string): ApiInputError {
  return new ApiInputError(
    "VALIDATION_FAILED",
    `Field ${field} is invalid.`,
    422,
    [{ field, code: "INVALID", message: `${field} is invalid.` }],
  );
}

function changes(result: { meta?: { changes?: number; rows_written?: number } }): number {
  return Number(result.meta?.changes ?? result.meta?.rows_written ?? 0);
}

function nextIsoTimestamp(previous: string): string {
  const previousMs = Date.parse(previous);
  const nextMs = Number.isFinite(previousMs)
    ? Math.max(Date.now(), previousMs + 1)
    : Date.now();
  return new Date(nextMs).toISOString();
}

async function count(db: D1Database, query: string): Promise<number> {
  return Number((await db.prepare(query).first<{ count: number }>())?.count ?? 0);
}
