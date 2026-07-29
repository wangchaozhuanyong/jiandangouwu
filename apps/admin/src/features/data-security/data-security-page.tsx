import {
  ArrowsClockwise,
  Database,
  FileMagnifyingGlass,
  Fingerprint,
  Globe,
  IdentificationBadge,
  Key,
  ListMagnifyingGlass,
  LockKey,
  ShieldCheck,
  ShieldWarning,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useMemo,
} from "react";
import {
  ApiError,
  getAudit,
  type AdminUser,
  type AuditEvent,
  type Locale,
} from "../../api";
import {
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../../admin-ui";
import { securityActionLabel } from "../security-events/model";
import {
  buildDataSecurityReadiness,
  type DataGovernanceGateCode,
  type DataSecurityBoundaryCode,
  type DataSecurityControlCode,
} from "./model";

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

type IconComponent = typeof Database;

const controlCopy: Record<
  DataSecurityControlCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
    evidence: string;
    icon: IconComponent;
  }
> = {
  CONTACT_PROTECTION: {
    title: { zh: "订单联系方式保护", en: "Order contact protection" },
    body: {
      zh: "写入前使用认证加密，列表默认只返回脱敏值；完整值需要独立权限、近期认证、原因和审计。",
      en: "Authenticated encryption is applied before storage. Lists return masked values; full reveal requires a separate permission, recent authentication, a reason, and audit.",
    },
    evidence: "AES-256-GCM · SHA-256 lookup hash",
    icon: Fingerprint,
  },
  CREDENTIAL_PROTECTION: {
    title: { zh: "管理员凭据保护", en: "Administrator credential protection" },
    body: {
      zh: "密码只保存 scrypt 派生值；TOTP 密钥使用服务器保护服务加密，安全投影不返回认证内部字段。",
      en: "Passwords are stored only as scrypt derivations. TOTP secrets use server-side protection, and safe projections exclude authentication internals.",
    },
    evidence: "scrypt · protected TOTP secret",
    icon: Key,
  },
  SERVER_SESSION: {
    title: { zh: "服务端会话与请求保护", en: "Server session and request protection" },
    body: {
      zh: "管理员会话保存在 Valkey；Cookie 使用 HttpOnly、Secure、SameSite=Strict，写请求同时校验 CSRF。",
      en: "Administrator sessions live in Valkey. Cookies use HttpOnly, Secure, and SameSite=Strict, while writes also require CSRF validation.",
    },
    evidence: "Valkey · HttpOnly · CSRF",
    icon: LockKey,
  },
  DATABASE_RBAC: {
    title: { zh: "数据库权限实时校验", en: "Database-backed authorization" },
    body: {
      zh: "受保护请求重新读取 MySQL 中的账号状态与有效权限，撤销授权后不能继续依赖旧会话快照。",
      en: "Protected requests re-read account status and effective permissions from MySQL, so revoked access cannot continue from a stale session snapshot.",
    },
    evidence: "MySQL RBAC · fail closed",
    icon: IdentificationBadge,
  },
  AUDIT_RECORDING: {
    title: { zh: "敏感操作审计", en: "Sensitive-operation audit" },
    body: {
      zh: "登录、权限、联系方式查看与关键配置操作写入 MySQL 审计事件；IP 只保存 SHA-256 哈希。",
      en: "Authentication, access, contact reveal, and critical configuration actions write MySQL audit events. IP values are stored only as SHA-256 hashes.",
    },
    evidence: "AuditEvent · SHA-256 IP hash",
    icon: FileMagnifyingGlass,
  },
};

const boundaryCopy: Record<
  DataSecurityBoundaryCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
    protection: Record<Locale, string>;
    icon: IconComponent;
  }
> = {
  PUBLIC_CATALOG: {
    title: { zh: "公开目录内容", en: "Public catalog content" },
    body: {
      zh: "商品、分类、轮播、政策和公开站点配置通过白名单响应提供。",
      en: "Products, categories, hero content, policies, and public site configuration use allowlisted responses.",
    },
    protection: { zh: "公开 API 安全投影", en: "Safe public API projection" },
    icon: Globe,
  },
  ORDER_CONTACT: {
    title: { zh: "订单联系方式", en: "Order contact values" },
    body: {
      zh: "属于个人数据；默认脱敏，密文与哈希不进入管理列表。",
      en: "Personal data; masked by default, with ciphertext and hashes excluded from administrative lists.",
    },
    protection: { zh: "认证加密 + 受审计揭示", en: "Authenticated encryption + audited reveal" },
    icon: Fingerprint,
  },
  ADMIN_IDENTITY: {
    title: { zh: "管理员身份与权限", en: "Administrator identity and access" },
    body: {
      zh: "属于受限数据；页面只读取安全白名单字段、角色、权限和 TOTP 开关状态。",
      en: "Restricted data; pages receive only allowlisted identity fields, roles, permissions, and TOTP enabled state.",
    },
    protection: { zh: "安全投影 + 服务端会话", en: "Safe projection + server session" },
    icon: UserCircle,
  },
  AUDIT_EVIDENCE: {
    title: { zh: "安全审计证据", en: "Security audit evidence" },
    body: {
      zh: "属于内部数据；本页不读取前后差异、IP 哈希或其他额外敏感字段。",
      en: "Internal data; this page does not read before/after payloads, IP hashes, or other sensitive fields.",
    },
    protection: { zh: "audit.read + 白名单字段", en: "audit.read + allowlisted fields" },
    icon: ListMagnifyingGlass,
  },
};

const gateCopy: Record<
  DataGovernanceGateCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
  }
> = {
  CLASSIFICATION_POLICY: {
    title: { zh: "正式数据分类政策", en: "Approved data-classification policy" },
    body: {
      zh: "当前卡片是代码边界说明，不是已经审批并持久化的治理政策。",
      en: "The current cards describe code boundaries, not an approved and persisted governance policy.",
    },
  },
  RETENTION_SCHEDULE: {
    title: { zh: "保留期限与调度器", en: "Retention periods and scheduler" },
    body: {
      zh: "订单、管理员、审计和运行数据尚无已批准期限，也没有自动到期任务。",
      en: "Orders, administrators, audit, and runtime data have no approved periods or automated expiry job.",
    },
  },
  DELETION_AND_ANONYMIZATION: {
    title: { zh: "删除与匿名化工作流", en: "Deletion and anonymization workflow" },
    body: {
      zh: "尚未实现暂停、复核、级联影响、执行证据或不可逆确认。",
      en: "Hold, review, dependency impact, execution evidence, and irreversible confirmation are not implemented.",
    },
  },
  PRIVACY_REQUESTS: {
    title: { zh: "隐私权请求处理", en: "Privacy-rights request handling" },
    body: {
      zh: "尚未实现访问、更正、导出、删除请求的时限、负责人和结果证据。",
      en: "Access, correction, export, and deletion requests have no deadlines, owners, or outcome evidence.",
    },
  },
  PRODUCTION_KEY_MANAGEMENT: {
    title: { zh: "生产密钥管理", en: "Production key management" },
    body: {
      zh: "本地环境变量不等于 AWS Secrets Manager、KMS、轮换或生产访问证据。",
      en: "Local environment variables do not prove AWS Secrets Manager, KMS, rotation, or production access.",
    },
  },
};

const accessLabels = {
  PUBLIC: { zh: "公开边界", en: "Public boundary" },
  INTERNAL: { zh: "内部边界", en: "Internal boundary" },
  PERSONAL: { zh: "个人数据", en: "Personal data" },
  RESTRICTED: { zh: "受限数据", en: "Restricted data" },
} as const;

export default function DataSecurityPage({
  locale,
  onOpenSecurityEvents,
  user,
}: {
  locale: Locale;
  onOpenSecurityEvents: () => void;
  user: AdminUser;
}) {
  const canReadAudit = user.permissions.includes("audit.read");
  const loader = useCallback(
    (signal: AbortSignal) => canReadAudit
      ? getAudit(signal)
      : Promise.reject(new ApiError("Forbidden", 403, "FORBIDDEN")),
    [canReadAudit],
  );
  const resource = useCachedAdminResource<AuditEvent[]>(
    canReadAudit ? "audit" : "data-security:audit:forbidden",
    loader,
  );
  const slow = useSlowAdminRequest(resource.state);
  const readiness = useMemo(
    () => buildDataSecurityReadiness({
      auditEvents: resource.data,
      canReadAudit,
      user,
    }),
    [canReadAudit, resource.data, user],
  );
  const refresh = () => {
    void resource.reload();
  };

  const auditValue = readiness.auditEvidence.state === "AVAILABLE"
    ? String(readiness.auditEvidence.loadedCount)
    : readiness.auditEvidence.state === "RESTRICTED"
      ? copy(locale, "受限", "Restricted")
      : copy(locale, "读取中", "Loading");

  return (
    <section className="data-security-page">
      <div className="data-security-truth-note" role="note">
        <WarningCircle size={20} aria-hidden="true" />
        <span>
          <strong>{copy(locale, "当前是代码控制与运行证据，不是合规认证", "Current code controls and runtime evidence; not a compliance certification")}</strong>
          {copy(
            locale,
            "本页只展示当前仓库已实现的保护边界、当前管理员会话和有权读取的最近 MySQL 审计记录。保留期限、删除、匿名化、隐私请求、KMS 与生产认证没有证据时明确标为未定义、未开发或未连接。",
            "This page only shows protection boundaries implemented in the current repository, the current administrator session, and authorized recent MySQL audit records. Retention, deletion, anonymization, privacy requests, KMS, and production certification remain not defined, not implemented, or not connected when evidence is absent.",
          )}
        </span>
      </div>

      <div className="data-security-summary">
        <SecurityStat
          icon={ShieldCheck}
          label={copy(locale, "已实现代码控制", "Implemented code controls")}
          value={String(readiness.controls.length)}
          detail={copy(locale, "不等于生产认证", "Not production certification")}
        />
        <SecurityStat
          icon={FileMagnifyingGlass}
          label={copy(locale, "最近审计样本", "Recent audit sample")}
          value={auditValue}
          detail={copy(locale, "最多读取 100 条", "Up to 100 records")}
          tone={canReadAudit ? "default" : "warning"}
        />
        <SecurityStat
          icon={IdentificationBadge}
          label={copy(locale, "当前会话权限", "Current session permissions")}
          value={String(readiness.currentSession.permissionCount)}
          detail={copy(locale, `${readiness.currentSession.roleCount} 个角色`, `${readiness.currentSession.roleCount} roles`)}
        />
        <SecurityStat
          icon={ShieldWarning}
          label={copy(locale, "正式保留策略", "Approved retention policy")}
          value={copy(locale, "未定义", "Not defined")}
          detail="NOT_DEFINED"
          tone="neutral"
        />
      </div>

      <div className="data-security-toolbar">
        <p>
          <Database size={17} aria-hidden="true" />
          {copy(
            locale,
            "代码控制与治理政策保持分开；刷新只重新读取审计证据，不会扫描、移动或删除数据。",
            "Code controls and governance policy remain separate. Refresh only re-reads audit evidence; it never scans, moves, or deletes data.",
          )}
        </p>
        <button
          className="admin-secondary"
          disabled={!canReadAudit}
          onClick={refresh}
          type="button"
        >
          <ArrowsClockwise size={17} aria-hidden="true" />
          {copy(locale, "刷新审计证据", "Refresh audit evidence")}
        </button>
        <button
          className="admin-primary"
          disabled={!canReadAudit}
          onClick={onOpenSecurityEvents}
          type="button"
        >
          <ListMagnifyingGlass size={17} aria-hidden="true" />
          {copy(locale, "打开安全事件", "Open security events")}
        </button>
      </div>

      <div className="data-security-boundaries">
        {readiness.boundaries.map((boundary) => {
          const content = boundaryCopy[boundary.code];
          const Icon = content.icon;
          return (
            <article className="admin-panel data-security-boundary" key={boundary.code}>
              <span><Icon size={22} aria-hidden="true" /></span>
              <div>
                <small>{copy(locale, "当前代码边界", "CURRENT CODE BOUNDARY")}</small>
                <h2>{content.title[locale]}</h2>
                <p>{content.body[locale]}</p>
              </div>
              <div className="data-security-boundary-meta">
                <strong>{content.protection[locale]}</strong>
                <span className={`data-security-access is-${boundary.access.toLocaleLowerCase()}`}>
                  {accessLabels[boundary.access][locale]}
                </span>
                <span className="data-security-retention">
                  {copy(locale, "保留期未定义", "Retention not defined")}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="data-security-main-grid">
        <section className="admin-panel data-security-controls">
          <div className="data-security-panel-heading">
            <div>
              <small>{copy(locale, "仓库实现", "REPOSITORY IMPLEMENTATION")}</small>
              <h2>{copy(locale, "当前已经执行的保护控制", "Protection controls currently enforced")}</h2>
              <p>{copy(locale, "这些结论来自当前正式主平台代码与自动测试。", "These statements come from the current formal-platform code and automated tests.")}</p>
            </div>
            <span className="data-security-state is-code">IMPLEMENTED_CODE</span>
          </div>
          <ol>
            {readiness.controls.map((control) => {
              const content = controlCopy[control.code];
              const Icon = content.icon;
              return (
                <li key={control.code}>
                  <span><Icon size={18} aria-hidden="true" /></span>
                  <div>
                    <strong>{content.title[locale]}</strong>
                    <p>{content.body[locale]}</p>
                    <code>{content.evidence}</code>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="admin-panel data-security-session">
          <div className="data-security-panel-heading">
            <div>
              <small>{copy(locale, "当前会话证据", "CURRENT SESSION EVIDENCE")}</small>
              <h2>{copy(locale, "本次管理员访问边界", "Administrator access boundary")}</h2>
              <p>{copy(locale, "只显示服务器会话返回的安全白名单字段。", "Only server-session allowlisted fields are shown.")}</p>
            </div>
            <span className={`data-security-state is-${readiness.currentSession.auditReadGranted ? "available" : "restricted"}`}>
              {readiness.currentSession.auditReadGranted ? "AUDIT_READ" : "RESTRICTED"}
            </span>
          </div>
          <dl className="data-security-session-facts">
            <div>
              <dt>{copy(locale, "角色数量", "Role count")}</dt>
              <dd>{readiness.currentSession.roleCount}</dd>
            </div>
            <div>
              <dt>{copy(locale, "权限数量", "Permission count")}</dt>
              <dd>{readiness.currentSession.permissionCount}</dd>
            </div>
            <div>
              <dt>{copy(locale, "TOTP 双重验证", "TOTP two-factor authentication")}</dt>
              <dd>{readiness.currentSession.totpEnabled ? copy(locale, "已开启", "Enabled") : copy(locale, "未开启", "Not enabled")}</dd>
            </div>
            <div>
              <dt><code>audit.read</code></dt>
              <dd>{readiness.currentSession.auditReadGranted ? copy(locale, "已授予", "Granted") : copy(locale, "未授予", "Not granted")}</dd>
            </div>
          </dl>
          <div className="data-security-role-list">
            <strong>{copy(locale, "当前角色键", "Current role keys")}</strong>
            <ul>
              {readiness.currentSession.roleKeys.map((role) => <li key={role}><code>{role}</code></li>)}
            </ul>
          </div>
          <div className="data-security-audit-facts">
            <div>
              <small>{copy(locale, "拒绝或失败", "Denied or failed")}</small>
              <strong>{readiness.auditEvidence.deniedOrFailedCount ?? "—"}</strong>
            </div>
            <div>
              <small>{copy(locale, "敏感联系方式查看", "Sensitive contact reveals")}</small>
              <strong>{readiness.auditEvidence.sensitiveAccessCount ?? "—"}</strong>
            </div>
            <div>
              <small>{copy(locale, "最新审计记录", "Latest audit record")}</small>
              <strong>
                {readiness.auditEvidence.latestRecordedAt
                  ? formatDate(readiness.auditEvidence.latestRecordedAt, locale)
                  : copy(locale, "无可用记录", "No available record")}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <section className="admin-panel data-security-audit">
        <div className="data-security-records-heading">
          <div>
            <small>{copy(locale, "真实 MySQL 证据", "LIVE MYSQL EVIDENCE")}</small>
            <h2>{copy(locale, "最近审计记录样本", "Recent audit record sample")}</h2>
            <p>{copy(locale, "最多展示六条；事件 ID、请求 ID、时间、操作、结果、操作者和目标保持独立列。", "Up to six records; event ID, request ID, time, action, result, actor, and target remain separate columns.")}</p>
          </div>
          <span>{readiness.auditEvidence.state}</span>
        </div>
        {canReadAudit && (
          <RefreshNotice
            state={resource.state}
            locale={locale}
            retry={refresh}
            slow={slow}
          />
        )}
        {!canReadAudit ? (
          <PanelState state="forbidden" locale={locale} retry={() => undefined} />
        ) : !resource.data ? (
          <PanelState state={resource.state} locale={locale} retry={refresh} />
        ) : readiness.auditEvidence.recentEvents.length === 0 ? (
          <div className="data-security-audit-empty" role="status">
            <FileMagnifyingGlass size={29} aria-hidden="true" />
            <strong>{copy(locale, "当前没有审计记录", "No audit records are available")}</strong>
            <p>{copy(locale, "本页不会把缺失记录显示为零风险或合规通过。", "Missing records are never presented as zero risk or compliance approval.")}</p>
          </div>
        ) : (
          <div
            className="data-security-audit-table-wrap"
            tabIndex={0}
            aria-label={copy(locale, "最近数据安全审计表，可横向滚动", "Recent data-security audit table, horizontally scrollable")}
          >
            <table className="data-security-audit-table">
              <thead>
                <tr>
                  <th scope="col">{copy(locale, "事件 ID", "Event ID")}</th>
                  <th scope="col">{copy(locale, "请求 ID", "Request ID")}</th>
                  <th scope="col">{copy(locale, "记录时间", "Recorded")}</th>
                  <th scope="col">{copy(locale, "操作", "Action")}</th>
                  <th scope="col">{copy(locale, "结果", "Result")}</th>
                  <th scope="col">{copy(locale, "操作者", "Actor")}</th>
                  <th scope="col">{copy(locale, "目标类型", "Target type")}</th>
                  <th scope="col">{copy(locale, "目标 ID", "Target ID")}</th>
                </tr>
              </thead>
              <tbody>
                {readiness.auditEvidence.recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td><code>{event.id}</code></td>
                    <td><code>{event.requestId}</code></td>
                    <td><time dateTime={event.createdAt}>{formatDate(event.createdAt, locale)}</time></td>
                    <td>{securityActionLabel(event.action, locale)}</td>
                    <td><StatusPill status={event.result} locale={locale} /></td>
                    <td>{event.actor?.displayName ?? copy(locale, "系统", "System")}</td>
                    <td><code>{event.targetType}</code></td>
                    <td><code>{event.targetId ?? "—"}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel data-security-gates">
        <div className="data-security-panel-heading">
          <div>
            <small>{copy(locale, "治理上线门槛", "GOVERNANCE LAUNCH GATES")}</small>
            <h2>{copy(locale, "仍需业务与技术共同完成", "Business and engineering work still required")}</h2>
            <p>{copy(locale, "未定义、未开发和未连接保持为不同状态。", "Not defined, not implemented, and not connected remain distinct states.")}</p>
          </div>
        </div>
        <ol>
          {readiness.gates.map((gate) => (
            <li key={gate.code}>
              <span className={`data-security-gate-icon is-${gate.state.toLocaleLowerCase().replaceAll("_", "-")}`}>
                {gate.state === "NOT_CONNECTED"
                  ? <LockKey size={18} aria-hidden="true" />
                  : gate.state === "NOT_IMPLEMENTED"
                    ? <Database size={18} aria-hidden="true" />
                    : <FileMagnifyingGlass size={18} aria-hidden="true" />}
              </span>
              <div>
                <strong>{gateCopy[gate.code].title[locale]}</strong>
                <p>{gateCopy[gate.code].body[locale]}</p>
              </div>
              <span className={`data-security-state is-${gate.state.toLocaleLowerCase().replaceAll("_", "-")}`}>
                {gate.state === "NOT_DEFINED"
                  ? copy(locale, "未定义", "Not defined")
                  : gate.state === "NOT_IMPLEMENTED"
                    ? copy(locale, "未开发", "Not implemented")
                    : copy(locale, "未连接", "Not connected")}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

function SecurityStat({
  detail,
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  detail: string;
  icon: IconComponent;
  label: string;
  tone?: "default" | "neutral" | "warning";
  value: string;
}) {
  return (
    <article className={`data-security-stat is-${tone}`}>
      <span><Icon size={21} aria-hidden="true" /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{detail}</em>
    </article>
  );
}
