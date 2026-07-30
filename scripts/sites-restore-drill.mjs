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
  "data_key_versions",
  "exchange_rate_sync_runs",
  "privacy_requests",
  "telegram_deliveries",
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
  "data_key_versions",
  "exchange_rate_sync_runs",
  "privacy_requests",
  "category_translations",
  "exchange_rates",
  "hero_translations",
  "products",
  "product_translations",
  "orders",
  "telegram_deliveries",
  "order_status_history",
];

const deleteOrder = [
  "order_status_history",
  "telegram_deliveries",
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
  "privacy_requests",
  "exchange_rate_sync_runs",
  "data_key_versions",
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
  d1CandidateDirectory,
  completedAt = new Date().toISOString(),
}) {
  const { bundle, envelope, payloadSha256 } = decryptRestoreDrillTransfer({
    transfer,
    privateKey,
    completedAt,
  });
  const migrationsSql = readMigrations(migrationsDirectory);

  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(migrationsSql);
    restoreSnapshot(sqlite, bundle.payload);
    const validation = validateRestoredDatabase(sqlite, bundle);
    const d1Candidate = d1CandidateDirectory
      ? createD1ImportCandidate({
          bundle,
          completedAt,
          directory: d1CandidateDirectory,
          migrationsSql,
          validation,
        })
      : null;
    const result = {
      drillId: bundle.drillId,
      payloadSha256,
      schemaVersion: Number(bundle.payload.schemaVersion),
      tableCount: snapshotTables.length,
      recordCount: validation.recordCount,
      readbackRecordCount: validation.readbackRecordCount,
      foreignKeyViolationCount: validation.foreignKeyViolationCount,
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
        ...(d1Candidate ? { d1Candidate } : {}),
      },
    };
  } finally {
    sqlite.close();
  }
}

function decryptRestoreDrillTransfer({
  transfer,
  privateKey,
  completedAt,
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
  return { bundle, envelope, payloadSha256 };
}

function restoreSnapshot(sqlite, payload) {
  sqlite.exec("PRAGMA foreign_keys = OFF");
  sqlite.exec("BEGIN");
  try {
    for (const table of deleteOrder) {
      sqlite.exec(`DELETE FROM ${quoteIdentifier(table)}`);
    }
    for (const table of insertOrder) {
      const rows = payload.tables[table];
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
}

function validateRestoredDatabase(sqlite, bundle) {
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
  return {
    recordCount: expectedRecordCount,
    readbackRecordCount,
    foreignKeyViolationCount: foreignKeyViolations.length,
    recordCounts,
  };
}

function createD1ImportCandidate({
  bundle,
  completedAt,
  directory,
  migrationsSql,
  validation,
}) {
  const candidateDirectory = resolve(directory);
  const restoreSql = d1RestoreSql(bundle.payload, migrationsSql);
  const verifySql = d1VerifySql();
  validateD1ImportSql(restoreSql, bundle);
  const restoreSqlSha256 = createHash("sha256").update(restoreSql).digest("hex");
  const verifySqlSha256 = createHash("sha256").update(verifySql).digest("hex");
  mkdirSync(candidateDirectory, { mode: 0o700 });
  chmodSync(candidateDirectory, 0o700);
  const restoreSqlPath = resolve(candidateDirectory, "restore.sql");
  const verifySqlPath = resolve(candidateDirectory, "verify.sql");
  const manifestPath = resolve(candidateDirectory, "manifest.json");
  const runbookPath = resolve(candidateDirectory, "RUNBOOK.md");
  const manifest = {
    format: "cloudbridge-d1-import-candidate",
    version: 1,
    target: "CLOUDFLARE_D1_NEW_DATABASE",
    generatedAt: completedAt,
    source: {
      backupId: bundle.backupId,
      drillId: bundle.drillId,
      payloadCreatedAt: bundle.payload.createdAt,
      payloadSha256: bundle.payloadSha256,
      schemaVersion: Number(bundle.payload.schemaVersion),
    },
    validation: {
      tableCount: snapshotTables.length,
      recordCount: validation.recordCount,
      readbackRecordCount: validation.readbackRecordCount,
      foreignKeyViolationCount: validation.foreignKeyViolationCount,
      recordCounts: validation.recordCounts,
    },
    files: {
      restoreSql: "restore.sql",
      restoreSqlSha256,
      verifySql: "verify.sql",
      verifySqlSha256,
      runbook: "RUNBOOK.md",
    },
    boundaries: {
      productionD1Modified: false,
      r2ObjectsIncluded: false,
      backupHistoryIncluded: false,
      containsPlaintextBusinessData: true,
      cutoverCompleted: false,
      rollbackCompleted: false,
    },
  };
  writeProtectedFile(restoreSqlPath, restoreSql);
  writeProtectedFile(verifySqlPath, verifySql);
  writeProtectedFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeProtectedFile(runbookPath, d1CandidateRunbook(manifest));
  return {
    directory: candidateDirectory,
    manifestPath,
    restoreSqlPath,
    restoreSqlSha256,
    verifySqlPath,
    recordCount: validation.recordCount,
    tableCount: snapshotTables.length,
    productionD1Modified: false,
    cutoverCompleted: false,
  };
}

function d1RestoreSql(payload, migrationsSql) {
  const lines = [
    "-- CloudBridge D1 import candidate.",
    "-- Contains plaintext business metadata. Keep this file private and delete it after the drill.",
    "-- Import only into a newly created, empty D1 database. Never target the current production binding.",
    "-- Wrangler manages the remote import transaction; this file intentionally contains no BEGIN or COMMIT.",
    migrationsSql.trim(),
    "PRAGMA defer_foreign_keys = true;",
  ];
  for (const table of deleteOrder) {
    lines.push(`DELETE FROM ${quoteIdentifier(table)};`);
  }
  for (const table of insertOrder) {
    const rows = payload.tables[table];
    if (!Array.isArray(rows)) throw new Error(`Snapshot table ${table} is missing.`);
    for (const row of rows) {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        throw new Error(`Snapshot row in ${table} is invalid.`);
      }
      const columns = Object.keys(row).sort();
      if (columns.length === 0) throw new Error(`Snapshot row in ${table} is empty.`);
      lines.push(
        `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")})`
        + ` VALUES (${columns.map((column) => sqlLiteral(row[column])).join(", ")});`,
      );
    }
  }
  lines.push(
    "PRAGMA foreign_key_check;",
    "",
  );
  return lines.join("\n");
}

function d1VerifySql() {
  const countQuery = snapshotTables.map((table) => (
    `SELECT '${table}' AS table_name, COUNT(*) AS record_count FROM ${quoteIdentifier(table)}`
  )).join("\nUNION ALL\n");
  return [
    "-- Run against the new D1 database after restore.sql.",
    "PRAGMA foreign_key_check;",
    `${countQuery};`,
    "",
  ].join("\n");
}

function validateD1ImportSql(sql, bundle) {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(sql);
    validateRestoredDatabase(sqlite, bundle);
  } finally {
    sqlite.close();
  }
}

function sqlLiteral(value) {
  if (value === null) return "NULL";
  if (typeof value === "string") {
    if (value.includes("\0")) throw new Error("Snapshot string contains an unsupported NUL byte.");
    return `'${value.replaceAll("'", "''")}'`;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  throw new Error("Snapshot value cannot be represented in a D1 SQL import.");
}

function writeProtectedFile(path, value) {
  writeFileSync(path, value, { flag: "wx", mode: 0o600 });
  chmodSync(path, 0o600);
}

function d1CandidateRunbook(manifest) {
  return `# CloudBridge D1 restore candidate

This directory contains plaintext business metadata. Keep the directory at mode 0700 and every file at mode 0600. Delete it after the rehearsal.

## Safety boundary

- Never run \`restore.sql\` against the current production D1 binding.
- Create a new, empty D1 database and record both the old and new database identifiers before any switch.
- This package restores D1 rows only. It does not copy R2 media or encrypted backup objects.
- The backup history table is intentionally not restored.
- Generating and validating this package did not modify production and did not complete a cutover or rollback.

## Import and verify

1. Confirm \`restore.sql\` SHA-256 is \`${manifest.files.restoreSqlSha256}\`.
2. Import into the new database only:
   \`npx wrangler d1 execute <NEW_D1_DATABASE_NAME> --remote --file restore.sql\`
3. Run \`verify.sql\` against the new database:
   \`npx wrangler d1 execute <NEW_D1_DATABASE_NAME> --remote --file verify.sql\`
4. Compare every returned table count with \`manifest.json\` and require zero rows from \`PRAGMA foreign_key_check\`.
5. Before switching traffic, verify administrator sign-in, storefront configuration, product/category counts, one read-only order query, and R2 media availability.

## Cutover and rollback gate

Do not switch the Sites D1 binding until a maintenance window, owner, exact binding change, smoke-test checklist, and rollback decision window are recorded. Rollback means restoring the previous D1 binding and redeploying the previous known-good Sites version; neither action is performed by this package.
`;
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

function optionalOption(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : option(args, name);
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
      d1CandidateDirectory: optionalOption(args, "--d1-candidate-dir"),
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
