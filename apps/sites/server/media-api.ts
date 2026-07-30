import type {
  AdminManagedMediaObject,
  AdminMediaReplacement,
} from "@cloudbridge/contracts";
import {
  ApiInputError,
  readJson,
  writeAudit,
  type AdminIdentity,
} from "./http";
import { chinaDateKey } from "./time";
import type {
  D1Database,
  D1PreparedStatement,
  SitesEnv,
} from "./types";

const maximumMediaBytes = 5_000_000;
const uploadKeyPattern = /^uploads\/\d{4}\/\d{2}\/[0-9a-f-]{36}-[a-z0-9][a-z0-9-]{0,79}\.(?:jpe?g|png|webp)$/u;
const replaceableImagePathPattern = /^\/(?:assets\/[A-Za-z0-9][A-Za-z0-9._/-]*|media\/uploads\/\d{4}\/\d{2}\/[0-9a-f-]{36}-[a-z0-9][a-z0-9-]{0,79})\.(?:avif|gif|jpe?g|png|webp)$/u;

type MediaRow = {
  key: string;
  contentType: AdminManagedMediaObject["contentType"];
  byteSize: number;
  uploadedByEmail: string;
  createdAt: string;
  productReferences: number;
  heroReferences: number;
  supportReferences: number;
};

type ValidatedUpload = {
  key: string;
  path: string;
  fileName: string;
  contentType: AdminManagedMediaObject["contentType"];
  bytes: ArrayBuffer;
};

export function isPublicMediaObjectKey(key: string): boolean {
  return uploadKeyPattern.test(key)
    && !key.includes("//")
    && !key.split("/").some((segment) => segment === "." || segment === "..");
}

export async function listManagedMedia(
  env: SitesEnv,
): Promise<AdminManagedMediaObject[]> {
  const rows = (await env.DB.prepare(
    `SELECT m.key, m.content_type AS contentType, m.byte_size AS byteSize,
      m.uploaded_by_email AS uploadedByEmail, m.created_at AS createdAt,
      (SELECT COUNT(*) FROM products p WHERE p.image_key = '/media/' || m.key) AS productReferences,
      (SELECT COUNT(*) FROM heroes h WHERE h.image_key = '/media/' || m.key) AS heroReferences,
      (SELECT COUNT(*) FROM merchant_channels c
        WHERE c.type = 'WECHAT' AND c.direct_target = '/media/' || m.key) AS supportReferences
     FROM media_objects m ORDER BY m.created_at DESC, m.key ASC`,
  ).all<MediaRow>()).results ?? [];

  return Promise.all(rows.map(async (row) => mediaObject(
    row,
    await env.MEDIA.get(row.key) ? "AVAILABLE" : "MISSING",
  )));
}

export async function uploadManagedMedia(
  env: SitesEnv,
  request: Request,
  actor: AdminIdentity,
): Promise<AdminManagedMediaObject> {
  const form = await readMediaForm(request);
  const reason = requiredReason(form.get("reason"));
  const upload = await validateUpload(form.get("file"));
  const createdAt = new Date().toISOString();

  await env.MEDIA.put(upload.key, upload.bytes, {
    httpMetadata: { contentType: upload.contentType },
  });
  try {
    await env.DB.batch([
      insertMediaStatement(env.DB, upload, actor.email, createdAt),
      auditStatement(env.DB, {
        action: "media.object.uploaded",
        actor,
        targetId: upload.key,
        reason,
      }),
    ]);
  } catch (error) {
    await env.MEDIA.delete(upload.key);
    throw error;
  }

  return {
    key: upload.key,
    path: upload.path,
    fileName: upload.fileName,
    contentType: upload.contentType,
    byteSize: upload.bytes.byteLength,
    uploadedByEmail: actor.email,
    createdAt,
    storageStatus: "AVAILABLE",
    productReferences: 0,
    heroReferences: 0,
    supportReferences: 0,
  };
}

export async function uploadWechatQr(
  env: SitesEnv,
  request: Request,
  channelId: string,
  actor: AdminIdentity,
): Promise<void> {
  const form = await readMediaForm(request);
  const reason = requiredReason(form.get("reason"));
  const version = requiredFormVersion(form.get("version"));
  const current = await readWechatChannel(env.DB, channelId);
  if (current.version !== version) {
    throw new ApiInputError("VERSION_CONFLICT", "The contact channel changed. Refresh and try again.", 409);
  }
  const upload = await validateUpload(form.get("file"));
  const createdAt = new Date().toISOString();
  const auditId = crypto.randomUUID();

  await env.MEDIA.put(upload.key, upload.bytes, {
    httpMetadata: { contentType: upload.contentType },
  });
  try {
    const results = await env.DB.batch([
      insertMediaStatement(env.DB, upload, actor.email, createdAt),
      env.DB.prepare(
        `UPDATE merchant_channels SET direct_target = ?, version = version + 1,
          updated_at = ? WHERE id = ? AND type = 'WECHAT' AND version = ?`,
      ).bind(upload.path, createdAt, channelId, version),
      auditStatement(env.DB, {
        action: "support.channel.qr.uploaded",
        actor,
        targetId: channelId,
        targetType: "MERCHANT_CHANNEL",
        reason,
        eventId: auditId,
      }),
    ]);
    if (changes(results[1]) !== 1) {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM media_objects WHERE key = ?").bind(upload.key),
        env.DB.prepare("DELETE FROM audit_events WHERE id = ?").bind(auditId),
      ]);
      await env.MEDIA.delete(upload.key);
      throw new ApiInputError("VERSION_CONFLICT", "The contact channel changed. Refresh and try again.", 409);
    }
  } catch (error) {
    await env.MEDIA.delete(upload.key);
    throw error;
  }
}

export async function removeWechatQr(
  env: SitesEnv,
  request: Request,
  channelId: string,
  actor: AdminIdentity,
): Promise<void> {
  const body = await readJson<{ version?: unknown; reason?: unknown }>(request);
  const version = requiredJsonVersion(body.version);
  const reason = requiredReason(body.reason);
  const current = await readWechatChannel(env.DB, channelId);
  if (current.version !== version) {
    throw new ApiInputError("VERSION_CONFLICT", "The contact channel changed. Refresh and try again.", 409);
  }
  if (!current.directTarget) return;
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE merchant_channels SET direct_target = NULL, version = version + 1,
      updated_at = ? WHERE id = ? AND type = 'WECHAT' AND version = ?`,
  ).bind(now, channelId, version).run();
  if (changes(result) !== 1) {
    throw new ApiInputError("VERSION_CONFLICT", "The contact channel changed. Refresh and try again.", 409);
  }
  await writeAudit(env.DB, {
    action: "support.channel.qr.removed",
    result: "SUCCEEDED",
    actor,
    targetType: "MERCHANT_CHANNEL",
    targetId: channelId,
    reason,
  });
}

export async function replaceMediaReferences(
  env: SitesEnv,
  request: Request,
  actor: AdminIdentity,
): Promise<AdminMediaReplacement> {
  if (
    !actor.permissions.includes("catalog.write")
    || !actor.permissions.includes("content.write")
  ) {
    throw new ApiInputError(
      "MEDIA_REPLACE_PERMISSION_REQUIRED",
      "Both catalog.write and content.write are required to replace shared media references.",
      403,
    );
  }

  const form = await readMediaForm(request);
  const sourcePath = safeReplaceablePath(form.get("sourcePath"));
  const reason = requiredReason(form.get("reason"));
  const references = await referenceCounts(env.DB, sourcePath);
  if (references.products + references.heroes === 0) {
    throw new ApiInputError(
      "MEDIA_REFERENCE_NOT_FOUND",
      "The selected image is no longer referenced.",
      409,
    );
  }

  const upload = await validateUpload(form.get("file"));
  const createdAt = new Date().toISOString();
  await env.MEDIA.put(upload.key, upload.bytes, {
    httpMetadata: { contentType: upload.contentType },
  });

  let replacedProducts = 0;
  let replacedHeroes = 0;
  try {
    const results = await env.DB.batch([
      insertMediaStatement(env.DB, upload, actor.email, createdAt),
      env.DB.prepare(
        "UPDATE products SET image_key = ?, version = version + 1, updated_at = ? WHERE image_key = ?",
      ).bind(upload.path, createdAt, sourcePath),
      env.DB.prepare(
        "UPDATE heroes SET image_key = ?, version = version + 1, updated_at = ? WHERE image_key = ?",
      ).bind(upload.path, createdAt, sourcePath),
      auditStatement(env.DB, {
        action: "media.references.replaced",
        actor,
        targetId: sourcePath,
        reason,
      }),
    ]);
    replacedProducts = Number(results[1]?.meta?.changes ?? 0);
    replacedHeroes = Number(results[2]?.meta?.changes ?? 0);
  } catch (error) {
    await env.MEDIA.delete(upload.key);
    throw error;
  }

  return {
    sourcePath,
    media: {
      key: upload.key,
      path: upload.path,
      fileName: upload.fileName,
      contentType: upload.contentType,
      byteSize: upload.bytes.byteLength,
      uploadedByEmail: actor.email,
      createdAt,
      storageStatus: "AVAILABLE",
      productReferences: replacedProducts,
      heroReferences: replacedHeroes,
      supportReferences: 0,
    },
    replacedReferences: {
      products: replacedProducts,
      heroes: replacedHeroes,
    },
  };
}

export async function deleteManagedMedia(
  env: SitesEnv,
  request: Request,
  key: string,
  actor: AdminIdentity,
): Promise<void> {
  if (!isPublicMediaObjectKey(key)) {
    throw new ApiInputError("MEDIA_OBJECT_NOT_FOUND", "The media object was not found.", 404);
  }
  const metadata = await mediaRow(env.DB, key);
  if (!metadata) {
    throw new ApiInputError("MEDIA_OBJECT_NOT_FOUND", "The media object was not found.", 404);
  }
  const path = `/media/${key}`;
  const references = await referenceCounts(env.DB, path);
  if (references.products + references.heroes + references.support > 0) {
    throw new ApiInputError(
      "MEDIA_OBJECT_IN_USE",
      "Referenced media cannot be deleted. Replace its references first.",
      409,
    );
  }
  const body = await readJson<{ reason?: unknown }>(request);
  const reason = requiredReason(body.reason);
  const stored = await env.MEDIA.get(key);
  const storedBytes = stored ? await new Response(stored.body).arrayBuffer() : null;
  const storedContentType = stored?.httpMetadata?.contentType ?? metadata.contentType;

  await env.MEDIA.delete(key);
  try {
    const results = await env.DB.batch([
      env.DB.prepare("DELETE FROM media_objects WHERE key = ?").bind(key),
      auditStatement(env.DB, {
        action: "media.object.deleted",
        actor,
        targetId: key,
        reason,
      }),
    ]);
    if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
      throw new ApiInputError(
        "MEDIA_OBJECT_CONFLICT",
        "The media object changed during deletion. Reload and try again.",
        409,
      );
    }
  } catch (error) {
    if (storedBytes) {
      await env.MEDIA.put(key, storedBytes, {
        httpMetadata: { contentType: storedContentType },
      });
    }
    throw error;
  }
}

async function readMediaForm(request: Request): Promise<FormData> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength)
    && contentLength > maximumMediaBytes + 100_000
  ) {
    throw new ApiInputError("MEDIA_FILE_TOO_LARGE", "Images must not exceed 5 MB.", 413);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLocaleLowerCase().startsWith("multipart/form-data")) {
    throw new ApiInputError(
      "MEDIA_MULTIPART_REQUIRED",
      "Media uploads must use multipart form data.",
      415,
    );
  }
  try {
    return await request.formData();
  } catch {
    throw new ApiInputError("MEDIA_FORM_INVALID", "The media upload form is invalid.", 400);
  }
}

async function validateUpload(value: FormDataEntryValue | null): Promise<ValidatedUpload> {
  if (!(value instanceof File)) {
    throw new ApiInputError("MEDIA_FILE_REQUIRED", "Choose an image to upload.", 422);
  }
  if (value.size < 1 || value.size > maximumMediaBytes) {
    throw new ApiInputError("MEDIA_FILE_TOO_LARGE", "Images must be between 1 byte and 5 MB.", 413);
  }
  const bytes = await value.arrayBuffer();
  const contentType = detectedContentType(new Uint8Array(bytes));
  const declaredType = value.type.toLocaleLowerCase();
  if (
    !contentType
    || (declaredType !== "" && declaredType !== "application/octet-stream" && contentType !== declaredType)
  ) {
    throw new ApiInputError(
      "MEDIA_FILE_TYPE_INVALID",
      "Only genuine PNG, JPEG, or WebP images are accepted.",
      422,
    );
  }
  const extension = contentType === "image/png"
    ? "png"
    : contentType === "image/webp"
      ? "webp"
      : "jpg";
  const slug = safeFileSlug(value.name);
  const [year, month] = chinaDateKey(new Date()).split("-");
  const key = `uploads/${year}/${month}/${crypto.randomUUID()}-${slug}.${extension}`;
  return {
    key,
    path: `/media/${key}`,
    fileName: `${slug}.${extension}`,
    contentType,
    bytes,
  };
}

function detectedContentType(
  bytes: Uint8Array,
): AdminManagedMediaObject["contentType"] | null {
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) return "image/jpeg";
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

function safeFileSlug(fileName: string): string {
  const withoutExtension = fileName.normalize("NFKC").replace(/\.[^.]+$/u, "");
  const slug = withoutExtension
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
  return slug || "image";
}

function safeReplaceablePath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value.trim() : "";
  if (
    !replaceableImagePathPattern.test(path)
    || path.includes("//")
    || path.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new ApiInputError(
      "MEDIA_SOURCE_PATH_INVALID",
      "The source image path is not replaceable.",
      422,
    );
  }
  return path;
}

function requiredReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < 8 || reason.length > 500) {
    throw new ApiInputError(
      "MEDIA_REASON_REQUIRED",
      "A reason between 8 and 500 characters is required.",
      422,
    );
  }
  return reason;
}

async function referenceCounts(
  db: D1Database,
  path: string,
): Promise<{ products: number; heroes: number; support: number }> {
  const [products, heroes, support] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM products WHERE image_key = ?")
      .bind(path)
      .first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM heroes WHERE image_key = ?")
      .bind(path)
      .first<{ count: number }>(),
    db.prepare(
      "SELECT COUNT(*) AS count FROM merchant_channels WHERE type = 'WECHAT' AND direct_target = ?",
    ).bind(path).first<{ count: number }>(),
  ]);
  return {
    products: Number(products?.count ?? 0),
    heroes: Number(heroes?.count ?? 0),
    support: Number(support?.count ?? 0),
  };
}

async function mediaRow(db: D1Database, key: string): Promise<MediaRow | null> {
  return db.prepare(
    `SELECT key, content_type AS contentType, byte_size AS byteSize,
      uploaded_by_email AS uploadedByEmail, created_at AS createdAt,
      0 AS productReferences, 0 AS heroReferences, 0 AS supportReferences
     FROM media_objects WHERE key = ? LIMIT 1`,
  ).bind(key).first<MediaRow>();
}

function mediaObject(
  row: MediaRow,
  storageStatus: AdminManagedMediaObject["storageStatus"],
): AdminManagedMediaObject {
  return {
    key: row.key,
    path: `/media/${row.key}`,
    fileName: row.key.split("/").at(-1) ?? row.key,
    contentType: row.contentType,
    byteSize: Number(row.byteSize),
    uploadedByEmail: row.uploadedByEmail,
    createdAt: row.createdAt,
    storageStatus,
    productReferences: Number(row.productReferences),
    heroReferences: Number(row.heroReferences),
    supportReferences: Number(row.supportReferences),
  };
}

function insertMediaStatement(
  db: D1Database,
  upload: ValidatedUpload,
  email: string,
  createdAt: string,
): D1PreparedStatement {
  return db.prepare(
    "INSERT INTO media_objects (key, content_type, byte_size, uploaded_by_email, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(
    upload.key,
    upload.contentType,
    upload.bytes.byteLength,
    email,
    createdAt,
  );
}

function auditStatement(
  db: D1Database,
  input: {
    action: string;
    actor: AdminIdentity;
    targetId: string;
    targetType?: "MEDIA_OBJECT" | "MERCHANT_CHANNEL";
    reason: string;
    eventId?: string;
  },
): D1PreparedStatement {
  return db.prepare(
    "INSERT INTO audit_events (id, trace_id, action, result, actor_email, actor_display_name, target_type, target_id, reason, created_at) VALUES (?, ?, ?, 'SUCCEEDED', ?, ?, ?, ?, ?, ?)",
  ).bind(
    input.eventId ?? crypto.randomUUID(),
    crypto.randomUUID(),
    input.action,
    input.actor.email,
    input.actor.displayName,
    input.targetType ?? "MEDIA_OBJECT",
    input.targetId,
    input.reason,
    new Date().toISOString(),
  );
}

async function readWechatChannel(
  db: D1Database,
  channelId: string,
): Promise<{ version: number; directTarget: string | null }> {
  const channel = await db.prepare(
    "SELECT version, direct_target AS directTarget FROM merchant_channels WHERE id = ? AND type = 'WECHAT' LIMIT 1",
  ).bind(channelId).first<{ version: number; directTarget: string | null }>();
  if (!channel) {
    throw new ApiInputError("WECHAT_CHANNEL_NOT_FOUND", "The WeChat channel was not found.", 404);
  }
  return channel;
}

function requiredFormVersion(value: FormDataEntryValue | null): number {
  return requiredJsonVersion(typeof value === "string" ? Number(value) : value);
}

function requiredJsonVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new ApiInputError("INVALID_VERSION", "A valid channel version is required.", 422);
  }
  return Number(value);
}

function changes(result: { meta?: { changes?: number; rows_written?: number } } | undefined): number {
  return Number(result?.meta?.changes ?? result?.meta?.rows_written ?? 0);
}
