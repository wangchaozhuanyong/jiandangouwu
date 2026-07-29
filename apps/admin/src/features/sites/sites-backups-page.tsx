import {
  Archive,
  ArrowsClockwise,
  CheckCircle,
  CloudArrowDown,
  Database,
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
  createSitesBackup,
  getSitesBackups,
  type SitesBackupReadiness,
  type SitesBackupSnapshot,
  type SitesBackupsResponse,
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
  const backups = resource.data?.items ?? [];
  const readiness = resource.data?.readiness ?? null;
  const verified = backups.filter((backup) => backup.status === "VERIFIED");
  const latest = verified[0] ?? null;
  const latestAutomatic = verified.find((backup) => backup.mode === "AUTOMATIC") ?? null;
  const readyReason = reason.trim().length >= 8;
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
                  "“验证恢复包”会检查主键、表关联、配置 JSON 与加密联系方式能否读取，但不会写入或覆盖当前 D1。它不是隔离数据库恢复演练；正式恢复仍须先在独立 D1 完整导入，再验证管理员访问和订单数据后安排切换。",
                  "\"Validate restore package\" checks primary keys, table relations, configuration JSON, and encrypted-contact readability without writing to the current D1 database. It is not an isolated-database restore drill; a real recovery must still import into a separate D1 database and validate administrator access and orders before cutover.",
                )}
              </span>
            </div>

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
    RECENT_LOGICAL_RESTORE_VALIDATION: copy(locale, "七天内完成恢复包逻辑验证", "Restore package logically validated within seven days"),
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
              "每次打开本页都会核对最近备份、今日自动备份、失败/卡住记录与恢复包验证。外部邮件、短信或 Telegram 告警尚未连接。",
              "Opening this page checks recent backups, today's automatic run, failed or stuck records, and restore-package validation. External email, SMS, or Telegram alerts are not connected.",
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
  const label = backup.restoreValidationStatus === "PASSED"
    ? copy(locale, "逻辑验证通过", "Logical validation passed")
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
