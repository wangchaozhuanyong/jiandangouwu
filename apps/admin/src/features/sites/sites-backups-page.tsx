import {
  Archive,
  ArrowsClockwise,
  CheckCircle,
  CloudArrowDown,
  Database,
  Key,
  Play,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import {
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import { ApiError, type Locale } from "../../api";
import { formatDate, PanelState, RefreshNotice } from "../../admin-ui";
import {
  backupDownloadUrl,
  completeSitesBackupRestoreDrill,
  createSitesBackup,
  createSitesBackupRestoreDrillTransfer,
  getSitesBackups,
  type SitesBackupReadiness,
  type SitesBackupSnapshot,
  type SitesBackupsResponse,
  type SitesRestoreDrillCompletion,
  validateSitesBackupRestorePackage,
  verifySitesBackup,
} from "./backups-api";

const copy = (locale: Locale, zh: string, en: string) => locale === "zh" ? zh : en;

export default function SitesBackupsPage({
  canWrite,
  locale,
}: {
  canWrite: boolean;
  locale: Locale;
}) {
  const loader = useCallback((signal: AbortSignal) => getSitesBackups(signal), []);
  const resource = useCachedAdminResource<SitesBackupsResponse>("sites-backups", loader);
  const slow = useSlowAdminRequest(resource.state);
  const { notify } = useAdminStatus();
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [drillBackupId, setDrillBackupId] = useState("");
  const [drillRequestJson, setDrillRequestJson] = useState("");
  const [drillTransferJson, setDrillTransferJson] = useState("");
  const [drillCompletionJson, setDrillCompletionJson] = useState("");
  const backups = resource.data?.items ?? [];
  const readiness = resource.data?.readiness ?? null;
  const verified = backups.filter((backup) => backup.status === "VERIFIED");
  const latest = verified[0] ?? null;
  const latestAutomatic = verified.find((backup) => backup.mode === "AUTOMATIC") ?? null;
  const selectedDrillBackupId = drillBackupId || latest?.id || "";
  const readyReason = reason.trim().length >= 8;
  const drillPublicKey = useMemo(
    () => parseDrillPublicKey(drillRequestJson),
    [drillRequestJson],
  );
  const drillCompletion = useMemo(
    () => parseDrillCompletion(drillCompletionJson),
    [drillCompletionJson],
  );
  const totalBytes = useMemo(
    () => verified.reduce((sum, backup) => sum + Number(backup.byteSize ?? 0), 0),
    [verified],
  );

  const commitBackup = (backup: SitesBackupSnapshot, prepend = false) => {
    if (!resource.data) return;
    const remaining = backups.filter((item) => item.id !== backup.id);
    resource.commit({
      ...resource.data,
      items: prepend ? [backup, ...remaining] : backups.map(
        (item) => item.id === backup.id ? backup : item,
      ),
    });
  };

  const create = async () => {
    if (!canWrite || !readyReason || busyId) return;
    setBusyId("create");
    setError("");
    try {
      const created = await createSitesBackup(reason.trim());
      commitBackup(created, true);
      setReason("");
      notify(copy(locale, "加密备份已创建并通过回读校验。", "Encrypted backup created and read-back verified."));
      void resource.reload();
    } catch (requestError) {
      const message = errorMessage(requestError, locale);
      setError(message);
      notify(message, "error");
    } finally {
      setBusyId("");
    }
  };

  const verify = async (id: string) => {
    if (!canWrite || !readyReason || busyId) return;
    setBusyId(`verify:${id}`);
    setError("");
    try {
      const checked = await verifySitesBackup(id, reason.trim());
      commitBackup(checked);
      notify(copy(locale, "备份校验和、解密与记录数校验均已通过。", "Checksum, decryption, and record-count verification passed."));
    } catch (requestError) {
      const message = errorMessage(requestError, locale);
      setError(message);
      notify(message, "error");
    } finally {
      setBusyId("");
    }
  };

  const validateRestore = async (id: string) => {
    if (!canWrite || !readyReason || busyId) return;
    setBusyId(`restore:${id}`);
    setError("");
    try {
      const checked = await validateSitesBackupRestorePackage(id, reason.trim());
      commitBackup(checked);
      notify(copy(
        locale,
        "恢复包的表结构、关联、配置 JSON 与加密联系方式均通过逻辑验证，当前 D1 未被修改。",
        "The restore package passed logical table, relation, JSON, and encrypted-contact validation. The current D1 database was not modified.",
      ));
      void resource.reload();
    } catch (requestError) {
      const message = errorMessage(requestError, locale);
      setError(message);
      notify(message, "error");
    } finally {
      setBusyId("");
    }
  };

  const createDrillTransfer = async () => {
    if (
      !canWrite
      || !readyReason
      || !selectedDrillBackupId
      || !drillPublicKey
      || busyId
    ) return;
    setBusyId("drill-transfer");
    setError("");
    try {
      const transfer = await createSitesBackupRestoreDrillTransfer(
        selectedDrillBackupId,
        reason.trim(),
        drillPublicKey,
      );
      setDrillTransferJson(JSON.stringify(transfer, null, 2));
      setDrillCompletionJson("");
      notify(copy(
        locale,
        "加密转移包已生成；它将在 30 分钟后过期，当前 D1 未被修改。",
        "The encrypted transfer is ready and expires in 30 minutes. The current D1 database was not modified.",
      ));
    } catch (requestError) {
      const message = errorMessage(requestError, locale);
      setError(message);
      notify(message, "error");
    } finally {
      setBusyId("");
    }
  };

  const completeDrill = async () => {
    if (
      !canWrite
      || !readyReason
      || !selectedDrillBackupId
      || !drillCompletion
      || busyId
    ) return;
    setBusyId("drill-complete");
    setError("");
    try {
      const checked = await completeSitesBackupRestoreDrill(
        selectedDrillBackupId,
        reason.trim(),
        drillCompletion,
      );
      commitBackup(checked);
      setDrillRequestJson("");
      setDrillTransferJson("");
      setDrillCompletionJson("");
      notify(copy(
        locale,
        "隔离 SQLite 恢复、全表回读和外键检查均已通过；当前 D1 未被修改。",
        "The isolated SQLite restore, full-table read-back, and foreign-key check passed. The current D1 database was not modified.",
      ));
      void resource.reload();
    } catch (requestError) {
      const message = errorMessage(requestError, locale);
      setError(message);
      notify(message, "error");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="sites-backups-page">
      <div className="sites-platform-truth-note" role="note">
        <ShieldCheck size={21} aria-hidden="true" />
        <span>
          <strong>{copy(locale, "Sites D1 加密备份", "Encrypted Sites D1 backups")}</strong>
          {copy(
            locale,
            "每天首次访问会自动把业务表快照加密后写入 R2；创建完成必须通过回读、校验和、解密和记录数检查。下载文件仍为密文。",
            "The first visit each day writes an encrypted business-table snapshot to R2. Creation must pass read-back, checksum, decryption, and record-count checks. Downloads remain encrypted.",
          )}
        </span>
      </div>

      <section className="admin-panel sites-backups-panel">
        <RefreshNotice
          locale={locale}
          retry={() => void resource.reload()}
          slow={slow}
          state={resource.state}
        />
        {!resource.data ? (
          <PanelState
            kind="cards"
            locale={locale}
            retry={() => void resource.reload()}
            state={resource.state}
          />
        ) : (
          <>
            <div className="sites-platform-summary">
              <BackupStat
                icon={Archive}
                label={copy(locale, "已验证备份", "Verified backups")}
                value={String(verified.length)}
              />
              <BackupStat
                icon={Database}
                label={copy(locale, "最近业务记录", "Latest record count")}
                value={latest ? String(latest.recordCount) : "—"}
              />
              <BackupStat
                icon={CloudArrowDown}
                label={copy(locale, "备份占用", "Backup storage")}
                value={formatBytes(totalBytes)}
              />
              <BackupStat
                icon={CheckCircle}
                label={copy(locale, "每日自动备份", "Daily automatic backup")}
                value={latestAutomatic ? formatDate(latestAutomatic.createdAt, locale) : copy(locale, "等待首次运行", "Awaiting first run")}
                warning={!latestAutomatic}
              />
            </div>

            {readiness && <BackupReadiness readiness={readiness} locale={locale} />}

            <div className="sites-backups-create">
              <label>
                <span>{copy(locale, "备份或校验原因", "Backup or verification reason")}</span>
                <input
                  disabled={!canWrite || Boolean(busyId)}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={copy(locale, "例如：上线前创建恢复点", "Example: create a pre-launch restore point")}
                  value={reason}
                />
              </label>
              <button
                className="admin-primary"
                disabled={!canWrite || !readyReason || Boolean(busyId)}
                onClick={() => void create()}
                type="button"
              >
                <Archive size={17} />
                {busyId === "create"
                  ? copy(locale, "正在创建…", "Creating…")
                  : copy(locale, "立即创建加密备份", "Create encrypted backup")}
              </button>
              <button
                className="admin-secondary"
                disabled={resource.state === "refreshing"}
                onClick={() => void resource.reload()}
                type="button"
              >
                <ArrowsClockwise size={17} />
                {copy(locale, "刷新清单", "Refresh list")}
              </button>
            </div>
            {!canWrite && (
              <p className="sites-platform-warning" role="note">
                <WarningCircle size={18} />
                {copy(locale, "当前账号只能查看和下载，不能创建或重新校验备份。", "This account can view and download backups but cannot create or reverify them.")}
              </p>
            )}
            {error && <p className="form-error sites-backups-error" role="alert"><WarningCircle />{error}</p>}

            <div className="sites-backups-boundary" role="note">
              <WarningCircle size={18} />
              <span>
                <strong>{copy(locale, "恢复边界", "Restore boundary")}</strong>
                {copy(
                  locale,
                  "“验证恢复包”只执行逻辑检查。隔离恢复运行器会把加密转移包恢复到一次性内存 SQLite，核对全部表、记录数和外键后回传签名证明，全程不会写入当前 D1。该演练仍不等于独立 D1 的切换演练；正式覆盖恢复前还要在另一套 D1 完成导入、管理员访问和订单核验。",
                  "\"Validate restore package\" performs logical checks only. The isolated recovery runner restores an encrypted transfer into a one-time in-memory SQLite database, verifies every table, record count, and foreign key, then returns signed evidence without writing to the current D1 database. This still does not replace a separate-D1 cutover rehearsal, which remains required before an in-place production recovery.",
                )}
              </span>
            </div>

            <details className="sites-restore-drill-workbench">
              <summary>
                <span><Key size={18} aria-hidden="true" /></span>
                <span>
                  <strong>{copy(locale, "隔离恢复演练工作台", "Isolated restore drill workbench")}</strong>
                  <small>{copy(
                    locale,
                    "仅处理公钥、加密转移包和签名证明；私钥与明文数据库不会上传。",
                    "Only the public key, encrypted transfer, and signed proof are handled here. The private key and plaintext database are never uploaded.",
                  )}</small>
                </span>
              </summary>
              <div className="sites-restore-drill-steps">
                <p>{copy(
                  locale,
                  "先在项目目录运行 prepare，粘贴 request.json；生成转移包后在本机运行 restore，再粘贴 completion.json。转移包 30 分钟后失效。",
                  "Run prepare in the project first and paste request.json. After generating the transfer, run restore locally and paste completion.json. Transfers expire after 30 minutes.",
                )}</p>
                <label>
                  <span>{copy(locale, "演练备份", "Backup to drill")}</span>
                  <select
                    disabled={!canWrite || Boolean(busyId)}
                    onChange={(event) => {
                      setDrillBackupId(event.target.value);
                      setDrillTransferJson("");
                      setDrillCompletionJson("");
                    }}
                    value={selectedDrillBackupId}
                  >
                    {verified.map((backup) => (
                      <option key={backup.id} value={backup.id}>
                        {formatDate(backup.createdAt, locale)} · {backup.recordCount} {copy(locale, "条记录", "records")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{copy(locale, "1. 公钥请求（request.json）", "1. Public-key request (request.json)")}</span>
                  <textarea
                    aria-invalid={Boolean(drillRequestJson) && !drillPublicKey}
                    disabled={!canWrite || Boolean(busyId)}
                    onChange={(event) => {
                      setDrillRequestJson(event.target.value);
                      setDrillTransferJson("");
                    }}
                    placeholder={'{\n  "publicKey": { "kty": "RSA", "n": "…", "e": "AQAB" }\n}'}
                    spellCheck={false}
                    value={drillRequestJson}
                  />
                </label>
                <button
                  className="admin-secondary"
                  disabled={!canWrite || !readyReason || !selectedDrillBackupId || !drillPublicKey || Boolean(busyId)}
                  onClick={() => void createDrillTransfer()}
                  type="button"
                >
                  <Play size={17} />
                  {busyId === "drill-transfer"
                    ? copy(locale, "正在生成…", "Generating…")
                    : copy(locale, "生成加密转移包", "Generate encrypted transfer")}
                </button>
                <label>
                  <span>{copy(locale, "2. 加密转移包（保存为 transfer.json）", "2. Encrypted transfer (save as transfer.json)")}</span>
                  <textarea
                    readOnly
                    spellCheck={false}
                    value={drillTransferJson}
                  />
                </label>
                <label>
                  <span>{copy(locale, "3. 本机签名证明（completion.json）", "3. Local signed proof (completion.json)")}</span>
                  <textarea
                    aria-invalid={Boolean(drillCompletionJson) && !drillCompletion}
                    disabled={!canWrite || Boolean(busyId)}
                    onChange={(event) => setDrillCompletionJson(event.target.value)}
                    placeholder={'{\n  "token": "…",\n  "result": { "target": "NODE_SQLITE_MEMORY" },\n  "proof": "…"\n}'}
                    spellCheck={false}
                    value={drillCompletionJson}
                  />
                </label>
                <button
                  className="admin-primary"
                  disabled={!canWrite || !readyReason || !selectedDrillBackupId || !drillCompletion || Boolean(busyId)}
                  onClick={() => void completeDrill()}
                  type="button"
                >
                  <ShieldCheck size={17} />
                  {busyId === "drill-complete"
                    ? copy(locale, "正在核验…", "Verifying…")
                    : copy(locale, "核验并记录演练", "Verify and record drill")}
                </button>
              </div>
            </details>

            <div className="sites-backups-table-wrap" tabIndex={0}>
              <table className="sites-backups-table">
                <thead>
                  <tr>
                    <th>{copy(locale, "创建时间", "Created")}</th>
                    <th>{copy(locale, "方式", "Mode")}</th>
                    <th>{copy(locale, "状态", "Status")}</th>
                    <th>{copy(locale, "记录数", "Records")}</th>
                    <th>{copy(locale, "文件大小", "Size")}</th>
                    <th>{copy(locale, "校验和", "Checksum")}</th>
                    <th>{copy(locale, "最近校验", "Last verified")}</th>
                    <th>{copy(locale, "恢复包验证", "Restore package")}</th>
                    <th>{copy(locale, "操作", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr><td colSpan={9}>{copy(locale, "尚无备份。打开前台后每日自动备份会开始运行，也可以立即手动创建。", "No backups yet. Daily backup starts after the storefront is opened, or create one now.")}</td></tr>
                  ) : backups.map((backup) => (
                    <tr key={backup.id}>
                      <td>{formatDate(backup.createdAt, locale)}</td>
                      <td>{backup.mode === "AUTOMATIC" ? copy(locale, "每日自动", "Daily automatic") : copy(locale, "手动", "Manual")}</td>
                      <td><BackupStatus status={backup.status} locale={locale} /></td>
                      <td>{backup.recordCount}</td>
                      <td>{backup.byteSize === null ? "—" : formatBytes(backup.byteSize)}</td>
                      <td><code title={backup.checksumSha256 ?? ""}>{backup.checksumSha256?.slice(0, 16) ?? "—"}</code></td>
                      <td>{backup.verifiedAt ? formatDate(backup.verifiedAt, locale) : "—"}</td>
                      <td>
                        <RestoreValidationStatus backup={backup} locale={locale} />
                      </td>
                      <td>
                        <div className="sites-backups-actions">
                          <button
                            className="admin-secondary"
                            disabled={!canWrite || !readyReason || Boolean(busyId) || backup.status !== "VERIFIED"}
                            onClick={() => void verify(backup.id)}
                            type="button"
                          >
                            {busyId === `verify:${backup.id}` ? copy(locale, "校验中…", "Verifying…") : copy(locale, "重新校验", "Verify")}
                          </button>
                          <button
                            className="admin-secondary"
                            disabled={!canWrite || !readyReason || Boolean(busyId) || backup.status !== "VERIFIED"}
                            onClick={() => void validateRestore(backup.id)}
                            type="button"
                          >
                            {busyId === `restore:${backup.id}`
                              ? copy(locale, "验证中…", "Validating…")
                              : copy(locale, "验证恢复包", "Validate restore")}
                          </button>
                          {backup.downloadable ? (
                            <a className="admin-secondary" href={backupDownloadUrl(backup.id)}>
                              {copy(locale, "下载", "Download")}
                            </a>
                          ) : <span>—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </section>
  );
}

function BackupReadiness({
  readiness,
  locale,
}: {
  readiness: SitesBackupReadiness;
  locale: Locale;
}) {
  const stateLabel = readiness.state === "READY"
    ? copy(locale, "当前正常", "Ready")
    : readiness.state === "ATTENTION"
      ? copy(locale, "需要复核", "Needs review")
      : copy(locale, "阻止恢复承诺", "Recovery blocked");
  const gateLabels: Record<SitesBackupReadiness["gates"][number]["code"], string> = {
    RECENT_VERIFIED_BACKUP: copy(locale, "26 小时内有已验证备份", "Verified backup within 26 hours"),
    TODAY_AUTOMATIC_BACKUP: copy(locale, "今天的自动备份已完成", "Today's automatic backup completed"),
    NO_RECENT_BACKUP_FAILURE: copy(locale, "七天内无失败或卡住记录", "No failed or stuck backup in seven days"),
    RECENT_ISOLATED_RESTORE_DRILL: copy(locale, "30 天内完成隔离 SQLite 恢复演练", "Isolated SQLite restore drill completed within 30 days"),
    EXTERNAL_ALERT_DELIVERY: copy(locale, "外部备份异常告警已验证送达", "External backup alert delivery verified"),
  };
  return (
    <section className={`sites-backup-readiness is-${readiness.state.toLocaleLowerCase()}`}>
      <div>
        <span><ShieldCheck size={20} aria-hidden="true" /></span>
        <div>
          <small>{copy(locale, "备份异常监测", "Backup exception monitoring")}</small>
          <strong>{stateLabel}</strong>
          <p>
            {copy(
              locale,
              "每次打开本页都会核对最近备份、今日自动备份、失败/卡住记录、隔离恢复演练与外部告警送达。邮件、短信或 Telegram 告警尚未连接，因此当前不会显示为完全就绪。",
              "Opening this page checks recent backups, today's automatic run, failed or stuck records, the isolated restore drill, and external alert delivery. Email, SMS, and Telegram alerts are not connected, so readiness remains incomplete.",
            )}
          </p>
        </div>
      </div>
      <ul>
        {readiness.gates.map((gate) => (
          <li className={gate.state === "PASS" ? "is-pass" : "is-fail"} key={gate.code}>
            {gate.state === "PASS" ? <CheckCircle size={16} /> : <WarningCircle size={16} />}
            <span>{gateLabels[gate.code]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BackupStat({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: typeof Archive;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <article className={warning ? "is-warning" : "is-ready"}>
      <span><Icon size={22} /></span>
      <div><small>{label}</small><strong>{value}</strong></div>
    </article>
  );
}

function BackupStatus({ status, locale }: { status: SitesBackupSnapshot["status"]; locale: Locale }) {
  const label = status === "VERIFIED"
    ? copy(locale, "已验证", "Verified")
    : status === "CREATING"
      ? copy(locale, "创建中", "Creating")
      : copy(locale, "失败", "Failed");
  return <span className={`sites-backup-status is-${status.toLocaleLowerCase()}`}>{label}</span>;
}

function RestoreValidationStatus({
  backup,
  locale,
}: {
  backup: SitesBackupSnapshot;
  locale: Locale;
}) {
  const isolated = backup.restoreValidation?.kind === "ISOLATED_SQLITE";
  const label = backup.restoreValidationStatus === "PASSED"
    ? isolated
      ? copy(locale, "隔离演练通过", "Isolated drill passed")
      : copy(locale, "逻辑验证通过", "Logical validation passed")
    : backup.restoreValidationStatus === "FAILED"
      ? copy(locale, "逻辑验证失败", "Logical validation failed")
      : copy(locale, "尚未运行", "Not run");
  const detail = backup.restoreValidation
    ? copy(
      locale,
      `${backup.restoreValidation.tableCount} 张表 · ${backup.restoreValidation.relationshipChecks} 项关联`,
      `${backup.restoreValidation.tableCount} tables · ${backup.restoreValidation.relationshipChecks} relations`,
    )
    : null;
  return (
    <span
      className={`sites-restore-validation is-${backup.restoreValidationStatus.toLocaleLowerCase()}`}
      title={backup.restoreValidationErrorCode ?? ""}
    >
      <strong>{label}</strong>
      {detail && <small>{detail}</small>}
    </span>
  );
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, locale: Locale): string {
  if (error instanceof ApiError && error.code === "BACKUP_ENCRYPTION_NOT_CONFIGURED") {
    return copy(locale, "备份加密密钥尚未配置，未创建任何明文备份。", "Backup encryption is not configured. No plaintext backup was created.");
  }
  if (error instanceof ApiError && error.status === 403) {
    return copy(locale, "当前账号没有执行此备份操作的权限。", "This account cannot perform this backup operation.");
  }
  if (error instanceof ApiError && error.code.startsWith("BACKUP_RESTORE_")) {
    return copy(
      locale,
      "恢复包逻辑验证失败。当前 D1 没有被修改，请保留该备份记录并检查错误代码。",
      "Restore-package logical validation failed. The current D1 database was not modified; retain the backup record and review the error code.",
    );
  }
  return copy(locale, "服务器没有确认备份操作完成，请刷新清单后重试。", "The server did not confirm the backup operation. Refresh the list and try again.");
}

function parseDrillPublicKey(value: string): JsonWebKey | null {
  try {
    const parsed = JSON.parse(value) as { publicKey?: JsonWebKey };
    const key = parsed.publicKey;
    return key?.kty === "RSA"
      && typeof key.n === "string"
      && typeof key.e === "string"
      ? key
      : null;
  } catch {
    return null;
  }
}

function parseDrillCompletion(value: string): SitesRestoreDrillCompletion | null {
  try {
    const parsed = JSON.parse(value) as SitesRestoreDrillCompletion;
    const result = parsed?.result;
    return typeof parsed?.token === "string"
      && typeof parsed?.proof === "string"
      && typeof result?.drillId === "string"
      && typeof result?.payloadSha256 === "string"
      && result?.target === "NODE_SQLITE_MEMORY"
      && typeof result?.completedAt === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}
