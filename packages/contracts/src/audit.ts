export const AUDIT_CSV_EXPORT_LIMIT = 5_000;
export const AUDIT_CSV_EXPORT_CONFIRMATION = "EXPORT_AUDIT_CSV";

export type AuditCsvRow = {
  id: string;
  requestId: string;
  createdAt: string;
  action: string;
  actorDisplayName: string | null;
  actorEmail: string | null;
  targetType: string;
  targetId: string | null;
  result: "SUCCEEDED" | "FAILED" | "DENIED";
  reason: string | null;
};

const auditCsvColumns: ReadonlyArray<{
  header: string;
  value: (row: AuditCsvRow) => string;
}> = [
  { header: "event_id", value: (row) => row.id },
  { header: "request_id", value: (row) => row.requestId },
  { header: "created_at", value: (row) => row.createdAt },
  { header: "action", value: (row) => row.action },
  { header: "actor_name", value: (row) => row.actorDisplayName ?? "" },
  { header: "actor_email", value: (row) => row.actorEmail ?? "" },
  { header: "target_type", value: (row) => row.targetType },
  { header: "target_id", value: (row) => row.targetId ?? "" },
  { header: "result", value: (row) => row.result },
  { header: "reason", value: (row) => row.reason ?? "" },
];

const spreadsheetFormulaPrefix = /^[\t ]*[=+\-@]/u;

const csvCell = (input: string): string => {
  const safe = spreadsheetFormulaPrefix.test(input) ? `'${input}` : input;
  return `"${safe.replaceAll("\"", "\"\"")}"`;
};

export function serializeAuditCsv(rows: readonly AuditCsvRow[]): string {
  const header = auditCsvColumns.map((column) => csvCell(column.header)).join(",");
  const body = rows.map((row) => (
    auditCsvColumns.map((column) => csvCell(column.value(row))).join(",")
  ));
  return `\uFEFF${[header, ...body].join("\r\n")}\r\n`;
}

export function auditCsvFilename(now = new Date()): string {
  const stamp = now.toISOString()
    .replace(/\.\d{3}Z$/u, "Z")
    .replaceAll(":", "")
    .replace("T", "-");
  return `cloudbridge-audit-${stamp}.csv`;
}
