#!/usr/bin/env node

import {
  constants,
  createDecipheriv,
  createHash,
  createHmac,
  generateKeyPairSync,
  privateDecrypt,
} from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const snapshotTables = [
  "admin_members",
  "audit_events",
  "categories",
  "category_translations",
  "currencies",
  "exchange_rates",
  "hero_translations",
  "heroes",
  "media_objects",
  "merchant_channels",
  "order_status_history",
  "orders",
  "product_translations",
  "products",
  "site_settings",
];

const insertOrder = [
  "admin_members",
  "audit_events",
  "categories",
  "currencies",
  "heroes",
  "media_objects",
  "merchant_channels",
  "site_settings",
  "category_translations",
  "exchange_rates",
  "hero_translations",
  "products",
  "product_translations",
  "orders",
  "order_status_history",
];

const deleteOrder = [
  "order_status_history",
  "orders",
  "product_translations",
  "products",
  "category_translations",
  "hero_translations",
  "exchange_rates",
  "merchant_channels",
  "media_objects",
  "site_settings",
  "audit_events",
  "heroes",
  "categories",
  "currencies",
  "admin_members",
];

const scriptPath = fileURLToPath(import.meta.url);
const defaultMigrationsDirectory = new URL("../apps/sites/drizzle/", import.meta.url);

export function prepareRestoreDrill(stateDirectory) {
  const directory = resolve(stateDirectory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const publicJwk = publicKey.export({ format: "jwk" });
  const privateKeyPath = resolve(directory, "private-key.pem");
  const requestPath = resolve(directory, "request.json");
  writeFileSync(
    privateKeyPath,
    privateKey.export({ format: "pem", type: "pkcs8" }),
    { flag: "wx", mode: 0o600 },
  );
  writeFileSync(
    requestPath,
    `${JSON.stringify({ publicKey: publicJwk }, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  return { directory, privateKeyPath, requestPath, publicKey: publicJwk };
}

export function runIsolatedRestoreDrill({
  transfer,
  privateKey,
  migrationsDirectory = defaultMigrationsDirectory,
  completedAt = new Date().toISOString(),
}) {
  const envelope = transfer?.data ?? transfer;
  if (
    envelope?.format !== "cloudbridge-restore-drill-transfer"
    || envelope?.version !== 1
    || envelope?.algorithm !== "RSA-OAEP-SHA256+AES-256-GCM"
    || typeof envelope.drillToken !== "string"
  ) {
    throw new Error("Restore drill transfer format is invalid.");
  }
  const transferKey = privateDecrypt(
    {
      key: privateKey,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(envelope.wrappedKey, "base64url"),
  );
  if (transferKey.length !== 32) throw new Error("Restore drill transfer key is invalid.");
  const encrypted = Buffer.from(envelope.ciphertext, "base64url");
  if (encrypted.length <= 16) throw new Error("Restore drill ciphertext is invalid.");
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    transferKey,
    Buffer.from(envelope.iv, "base64url"),
  );
  decipher.setAuthTag(authTag);
  const bundle = JSON.parse(Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8"));
  if (
    bundle?.format !== "cloudbridge-restore-drill-bundle"
    || bundle?.version !== 1
    || typeof bundle?.drillId !== "string"
    || typeof bundle?.proofKey !== "string"
    || typeof bundle?.payloadSha256 !== "string"
    || typeof bundle?.expiresAt !== "string"
    || !bundle?.payload?.tables
  ) {
    throw new Error("Restore drill bundle is invalid.");
  }
  if (new Date(bundle.expiresAt).getTime() < new Date(completedAt).getTime()) {
    throw new Error("Restore drill transfer has expired.");
  }
  const payloadText = JSON.stringify(bundle.payload);
  const payloadSha256 = createHash("sha256").update(payloadText).digest("hex");
  if (payloadSha256 !== bundle.payloadSha256) {
    throw new Error("Restore drill payload checksum does not match.");
  }

  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(readMigrations(migrationsDirectory));
    sqlite.exec("PRAGMA foreign_keys = OFF");
    sqlite.exec("BEGIN");
    try {
      for (const table of deleteOrder) {
        sqlite.exec(`DELETE FROM ${quoteIdentifier(table)}`);
      }
      for (const table of insertOrder) {
        const rows = bundle.payload.tables[table];
        if (!Array.isArray(rows)) throw new Error(`Snapshot table ${table} is missing.`);
        restoreRows(sqlite, table, rows);
      }
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    } finally {
      sqlite.exec("PRAGMA foreign_keys = ON");
    }

    const foreignKeyViolations = sqlite.prepare("PRAGMA foreign_key_check").all();
    const recordCounts = Object.fromEntries(snapshotTables.map((table) => [
      table,
      Number(sqlite.prepare(
        `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`,
      ).get()?.count ?? 0),
    ]));
    const readbackRecordCount = Object.values(recordCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const expectedRecordCount = Number(bundle.logicalValidation?.recordCount);
    if (
      foreignKeyViolations.length !== 0
      || !Number.isSafeInteger(expectedRecordCount)
      || readbackRecordCount !== expectedRecordCount
      || snapshotTables.some(
        (table) => recordCounts[table] !== bundle.payload.tables[table].length,
      )
    ) {
      throw new Error("Isolated SQLite restore read-back validation failed.");
    }
    const result = {
      drillId: bundle.drillId,
      payloadSha256,
      schemaVersion: Number(bundle.payload.schemaVersion),
      tableCount: snapshotTables.length,
      recordCount: expectedRecordCount,
      readbackRecordCount,
      foreignKeyViolationCount: foreignKeyViolations.length,
      target: "NODE_SQLITE_MEMORY",
      completedAt,
    };
    const proof = createHmac(
      "sha256",
      Buffer.from(bundle.proofKey, "base64url"),
    ).update(restoreDrillProofMessage(result)).digest("base64url");
    return {
      completion: {
        token: envelope.drillToken,
        result,
        proof,
      },
      summary: {
        target: result.target,
        tableCount: result.tableCount,
        recordCount: result.recordCount,
        foreignKeyViolationCount: result.foreignKeyViolationCount,
        completedAt: result.completedAt,
      },
    };
  } finally {
    sqlite.close();
  }
}

function restoreRows(sqlite, table, rows) {
  const schemaColumns = new Set(
    sqlite.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all()
      .map((column) => String(column.name)),
  );
  for (const row of rows) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new Error(`Snapshot row in ${table} is invalid.`);
    }
    const columns = Object.keys(row);
    if (
      columns.length === 0
      || columns.some((column) => !schemaColumns.has(column))
    ) {
      throw new Error(`Snapshot columns in ${table} do not match the current schema.`);
    }
    const statement = sqlite.prepare(
      `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")})`
      + ` VALUES (${columns.map(() => "?").join(", ")})`,
    );
    statement.run(...columns.map((column) => row[column]));
  }
}

function readMigrations(directory) {
  return readdirSync(directory)
    .filter((name) => /^\d+_.+\.sql$/u.test(name))
    .sort()
    .map((name) => readFileSync(new URL(name, directory), "utf8"))
    .join("\n")
    .replaceAll("--> statement-breakpoint", "");
}

function quoteIdentifier(value) {
  if (!/^[a-z][a-z0-9_]*$/u.test(value)) {
    throw new Error("Unsafe SQLite identifier.");
  }
  return `"${value}"`;
}

function restoreDrillProofMessage(result) {
  return [
    result.drillId,
    result.payloadSha256,
    String(result.schemaVersion),
    String(result.tableCount),
    String(result.recordCount),
    String(result.readbackRecordCount),
    String(result.foreignKeyViolationCount),
    result.target,
    result.completedAt,
  ].join("\n");
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) throw new Error(`${name} is required.`);
  return args[index + 1];
}

function main(args) {
  const [command] = args;
  if (command === "prepare") {
    const prepared = prepareRestoreDrill(option(args, "--state-dir"));
    process.stdout.write(`${JSON.stringify({
      requestPath: prepared.requestPath,
      privateKeyPath: prepared.privateKeyPath,
    })}\n`);
    return;
  }
  if (command === "restore") {
    const stateDirectory = resolve(option(args, "--state-dir"));
    const transferPath = resolve(option(args, "--transfer"));
    const completionPath = resolve(option(args, "--completion"));
    const result = runIsolatedRestoreDrill({
      transfer: JSON.parse(readFileSync(transferPath, "utf8")),
      privateKey: readFileSync(resolve(stateDirectory, "private-key.pem"), "utf8"),
    });
    writeFileSync(
      completionPath,
      `${JSON.stringify(result.completion, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    process.stdout.write(`${JSON.stringify(result.summary)}\n`);
    return;
  }
  throw new Error("Use prepare or restore.");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
