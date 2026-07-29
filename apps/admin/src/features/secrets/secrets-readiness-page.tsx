import {
  Browser,
  Database,
  Fingerprint,
  HardDrives,
  Key,
  LockKey,
  PlugsConnected,
  ShieldCheck,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import type { Locale } from "../../api";
import {
  buildSecretReadiness,
  type SecretControlCode,
  type SecretDomainCode,
  type SecretGateCode,
} from "./model";

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

type IconComponent = typeof Key;

const domainCopy: Record<
  SecretDomainCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
    source: Record<Locale, string>;
    keys: ReadonlyArray<string>;
    consumers: Record<Locale, string>;
    icon: IconComponent;
    risk?: "SHARED_SCOPE";
  }
> = {
  DATABASE_CREDENTIALS: {
    title: { zh: "数据库连接凭据", en: "Database connection credentials" },
    body: {
      zh: "CDK 让 RDS 生成一份凭据 Secret，并把主机、用户名和密码分别注入 API 任务。",
      en: "CDK lets RDS generate one credential secret and injects host, username, and password into the API task.",
    },
    source: { zh: "RDS 自动生成的 Secret", en: "RDS-generated secret" },
    keys: ["DB_HOST", "DB_USER", "DB_PASSWORD"],
    consumers: { zh: "仅 API 任务", en: "API task only" },
    icon: Database,
  },
  CACHE_AUTHENTICATION: {
    title: { zh: "Valkey 认证令牌", en: "Valkey authentication token" },
    body: {
      zh: "CDK 定义独立 Secrets Manager Secret，并只把认证值注入 API 任务。",
      en: "CDK defines a separate Secrets Manager secret and injects the authentication value only into the API task.",
    },
    source: { zh: "Secrets Manager 定义", en: "Secrets Manager definition" },
    keys: ["REDIS_PASSWORD"],
    consumers: { zh: "API 会话存储", en: "API session store" },
    icon: HardDrives,
  },
  ADMIN_SESSION: {
    title: { zh: "管理员会话机密", en: "Administrator session secret" },
    body: {
      zh: "服务端使用独立 Session Secret 保护会话，不把值交给管理后台或客户端构建。",
      en: "The server uses a dedicated session secret and never provides its value to the admin or storefront build.",
    },
    source: { zh: "Secrets Manager 定义", en: "Secrets Manager definition" },
    keys: ["SESSION_SECRET"],
    consumers: { zh: "API 会话服务", en: "API session service" },
    icon: LockKey,
  },
  APPLICATION_ENCRYPTION: {
    title: { zh: "应用数据加密密钥", en: "Application data-encryption key" },
    body: {
      zh: "当前同一个服务端配置同时用于订单联系方式和 TOTP 密钥的 AES-256-GCM 加密，尚未完成数据域分离。",
      en: "One server-side configuration currently encrypts both order contacts and TOTP secrets with AES-256-GCM; domain separation is not implemented.",
    },
    source: { zh: "Secrets Manager 定义", en: "Secrets Manager definition" },
    keys: ["AUTH_ENCRYPTION_KEY"],
    consumers: { zh: "订单与认证服务", en: "Orders and authentication services" },
    icon: Fingerprint,
    risk: "SHARED_SCOPE",
  },
};

const controlCopy: Record<
  SecretControlCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
    evidence: string;
    icon: IconComponent;
  }
> = {
  SERVER_ONLY_INJECTION: {
    title: { zh: "仅服务端注入", en: "Server-only injection" },
    body: {
      zh: "六个生产绑定只进入 API ECS 容器；管理后台与客户端任务没有 Secret 注入。",
      en: "All six production bindings enter only the API ECS container; admin and storefront tasks receive no secrets.",
    },
    evidence: "apiContainer.secrets",
    icon: PlugsConnected,
  },
  TASK_ROLE_READ_GRANTS: {
    title: { zh: "任务角色最小读取", en: "Task-role read grants" },
    body: {
      zh: "RDS、Valkey、会话和应用加密 Secret 只向 API Task Role 授予读取权限。",
      en: "RDS, Valkey, session, and application-encryption secrets grant read access only to the API task role.",
    },
    evidence: "grantRead(apiTask.taskRole)",
    icon: ShieldCheck,
  },
  FRONTEND_SECRET_ISOLATION: {
    title: { zh: "前端机密隔离", en: "Frontend secret isolation" },
    body: {
      zh: "公开构建变量只包含 API 地址与站点地址，CDK 没有向前端容器配置 Secret。",
      en: "Public build variables contain only API and site addresses, and CDK configures no secrets for frontend containers.",
    },
    evidence: "0 frontend secret bindings",
    icon: Browser,
  },
  VALUELESS_ADMIN_PROJECTION: {
    title: { zh: "无值管理投影", en: "Value-less admin projection" },
    body: {
      zh: "本页由仓库定义生成，不读取 `.env`、Secrets Manager 值、密钥后缀、版本或轮换时间。",
      en: "This page is derived from repository definitions and never reads `.env`, Secrets Manager values, suffixes, versions, or rotation dates.",
    },
    evidence: "no secret metadata API",
    icon: Key,
  },
};

const gateCopy: Record<
  SecretGateCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
  }
> = {
  AWS_DEPLOYMENT_EVIDENCE: {
    title: { zh: "AWS 部署证据", en: "AWS deployment evidence" },
    body: {
      zh: "CDK 已定义资源，但尚未 deploy；当前没有 Secrets Manager、ECS 或生产访问的运行证据。",
      en: "CDK defines the resources, but no deploy has occurred; there is no runtime evidence for Secrets Manager, ECS, or production access.",
    },
  },
  RUNTIME_SECRET_METADATA: {
    title: { zh: "运行时机密元数据", en: "Runtime secret metadata" },
    body: {
      zh: "尚无只返回存在状态、版本和轮换时间的受保护服务端元数据接口。",
      en: "No protected server endpoint currently returns existence, version, or rotation metadata without values.",
    },
  },
  AUTOMATED_ROTATION: {
    title: { zh: "自动轮换与双版本回滚", en: "Automated rotation and dual-version rollback" },
    body: {
      zh: "尚未定义轮换调度、兼容解密窗口、失败回滚或执行审计。",
      en: "Rotation scheduling, compatible decryption windows, failure rollback, and execution audit are not implemented.",
    },
  },
  KEY_DOMAIN_SEPARATION: {
    title: { zh: "加密密钥数据域分离", en: "Encryption-key domain separation" },
    body: {
      zh: "`AUTH_ENCRYPTION_KEY` 当前同时保护联系方式与 TOTP 密钥；拆分前需要兼容读取与数据迁移方案。",
      en: "`AUTH_ENCRYPTION_KEY` currently protects both contacts and TOTP secrets; separation requires compatible reads and a data migration plan.",
    },
  },
  CUSTOMER_MANAGED_KMS: {
    title: { zh: "客户管理 KMS Key", en: "Customer-managed KMS key" },
    body: {
      zh: "当前 CDK 没有定义客户管理 KMS Key、Key Policy 或独立轮换证据。",
      en: "Current CDK defines no customer-managed KMS key, key policy, or separate rotation evidence.",
    },
  },
  INCIDENT_AND_ROLLBACK_RUNBOOK: {
    title: { zh: "泄露处置与回滚手册", en: "Compromise response and rollback runbook" },
    body: {
      zh: "尚未批准吊销、重新加密、服务重启、回滚、负责人和恢复验证流程。",
      en: "Revocation, re-encryption, service restart, rollback, ownership, and recovery verification are not yet approved.",
    },
  },
};

const stateLabel = (
  locale: Locale,
  state: "DEFINED_INFRA" | "NOT_DEPLOYED" | "NOT_IMPLEMENTED" | "NOT_DEFINED",
): string => {
  if (state === "DEFINED_INFRA") return copy(locale, "基础设施已定义", "Infrastructure defined");
  if (state === "NOT_DEPLOYED") return copy(locale, "未部署", "Not deployed");
  if (state === "NOT_IMPLEMENTED") return copy(locale, "未开发", "Not implemented");
  return copy(locale, "未定义", "Not defined");
};

export default function SecretsReadinessPage({
  locale,
  onOpenDataSecurity,
  onOpenSecurity,
}: {
  locale: Locale;
  onOpenDataSecurity: () => void;
  onOpenSecurity: () => void;
}) {
  const readiness = useMemo(() => buildSecretReadiness(), []);

  return (
    <section className="secrets-readiness-page">
      <div className="secrets-readiness-truth-note" role="note">
        <WarningCircle size={20} aria-hidden="true" />
        <span>
          <strong>{copy(locale, "只展示仓库定义，不读取任何机密值", "Repository definitions only; no secret values are read")}</strong>
          {copy(
            locale,
            "本页只陈述 `.env.example`、API 使用边界与 AWS CDK 中能够核对的配置名称和注入关系。它不检查本地 `.env`，不读取 Secrets Manager，也不显示后缀、版本、创建时间或轮换成功。",
            "This page only states configuration names and injection relationships verifiable in `.env.example`, API code, and AWS CDK. It does not inspect local `.env`, read Secrets Manager, or show suffixes, versions, creation dates, or rotation success.",
          )}
        </span>
      </div>

      <div className="secrets-readiness-summary">
        <ReadinessStat
          icon={Key}
          label={copy(locale, "机密来源定义", "Secret source definitions")}
          value={String(readiness.sourceCount)}
          detail={copy(locale, "仅 CDK 代码证据", "CDK code evidence only")}
        />
        <ReadinessStat
          icon={PlugsConnected}
          label={copy(locale, "API 生产绑定", "API production bindings")}
          value={String(readiness.productionBindingCount)}
          detail={copy(locale, "全部服务端注入", "All server-side")}
        />
        <ReadinessStat
          icon={Browser}
          label={copy(locale, "前端机密绑定", "Frontend secret bindings")}
          value={String(readiness.frontendBindingCount)}
          detail={copy(locale, "后台与客户端均为 0", "Admin and storefront: 0")}
        />
        <ReadinessStat
          icon={ShieldWarning}
          label={copy(locale, "自动轮换任务", "Automated rotation jobs")}
          value={String(readiness.automatedRotationCount)}
          detail="NOT_IMPLEMENTED"
          tone="warning"
        />
      </div>

      <div className="secrets-readiness-toolbar">
        <p>
          <LockKey size={17} aria-hidden="true" />
          {copy(
            locale,
            "不存在新增、查看或轮换按钮；真实机密变更必须先具备兼容解密、回滚和审计设计。",
            "There are no create, reveal, or rotate controls. Real secret changes first require compatible decryption, rollback, and audit design.",
          )}
        </p>
        <button className="admin-secondary" onClick={onOpenSecurity} type="button">
          <ShieldCheck size={17} aria-hidden="true" />
          {copy(locale, "打开安全中心", "Open security center")}
        </button>
        <button className="admin-primary" onClick={onOpenDataSecurity} type="button">
          <Fingerprint size={17} aria-hidden="true" />
          {copy(locale, "打开数据安全", "Open data security")}
        </button>
      </div>

      <div className="secrets-readiness-domains">
        {Object.entries(domainCopy).map(([code, content]) => {
          const Icon = content.icon;
          return (
            <article className="admin-panel secrets-readiness-domain" key={code}>
              <span><Icon size={22} aria-hidden="true" /></span>
              <div>
                <small>{copy(locale, "当前仓库边界", "CURRENT REPOSITORY BOUNDARY")}</small>
                <h2>{content.title[locale]}</h2>
                <p>{content.body[locale]}</p>
              </div>
              <div className="secrets-readiness-domain-meta">
                <div>
                  <small>{copy(locale, "配置名称", "Configuration keys")}</small>
                  <strong>{content.keys.map((key) => <code key={key}>{key}</code>)}</strong>
                </div>
                <div>
                  <small>{copy(locale, "生产来源", "Production source")}</small>
                  <strong>{content.source[locale]}</strong>
                </div>
                <div>
                  <small>{copy(locale, "消费边界", "Consumers")}</small>
                  <strong>{content.consumers[locale]}</strong>
                </div>
              </div>
              <div className="secrets-readiness-domain-state">
                <span className="secrets-readiness-state is-defined">{stateLabel(locale, "DEFINED_INFRA")}</span>
                {content.risk === "SHARED_SCOPE" && (
                  <span className="secrets-readiness-state is-warning">
                    {copy(locale, "共享数据域", "Shared scope")}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="secrets-readiness-main-grid">
        <section className="admin-panel secrets-readiness-controls">
          <PanelHeading
            eyebrow={copy(locale, "代码控制", "CODE CONTROLS")}
            title={copy(locale, "当前已经具备的隔离边界", "Isolation boundaries already in code")}
            body={copy(locale, "这些状态只证明仓库定义存在，不证明 AWS 已运行。", "These states prove repository definitions only, not a running AWS environment.")}
            state={copy(locale, "代码已实现", "Implemented in code")}
            stateClass="is-defined"
          />
          <ol>
            {readiness.controls.map((control) => {
              const content = controlCopy[control.code];
              const Icon = content.icon;
              return (
                <li key={control.code}>
                  <span><Icon size={19} aria-hidden="true" /></span>
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

        <section className="admin-panel secrets-readiness-limitations">
          <PanelHeading
            eyebrow={copy(locale, "当前限制", "CURRENT LIMITATIONS")}
            title={copy(locale, "不能从页面推断的状态", "States this page cannot infer")}
            body={copy(locale, "缺少证据时保持未知或未开发，不使用模拟后缀补齐。", "Missing evidence stays unknown or unimplemented; simulated suffixes never fill the gap.")}
            state={copy(locale, "运行未检查", "Runtime not inspected")}
            stateClass="is-warning"
          />
          <dl>
            <div>
              <dt>{copy(locale, "本地 `.env` 值", "Local `.env` values")}</dt>
              <dd>{copy(locale, "未读取", "Not read")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "Secrets Manager 资源", "Secrets Manager resources")}</dt>
              <dd>{copy(locale, "未部署", "Not deployed")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "版本、后缀与轮换时间", "Versions, suffixes, and rotation dates")}</dt>
              <dd>{copy(locale, "未采集", "Not collected")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "联系方式查询哈希", "Contact lookup hash")}</dt>
              <dd>SHA-256 · NOT_HMAC</dd>
            </div>
            <div>
              <dt>{copy(locale, "应用加密数据域", "Application encryption domains")}</dt>
              <dd>{copy(locale, "联系方式 + TOTP 共享", "Contacts + TOTP shared")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "外部支付与 Telegram 凭据", "Payment and Telegram credentials")}</dt>
              <dd>{copy(locale, "未连接", "Not connected")}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="admin-panel secrets-readiness-bindings">
        <div className="secrets-readiness-records-heading">
          <div>
            <small>{copy(locale, "生产注入清单", "PRODUCTION INJECTION LEDGER")}</small>
            <h2>{copy(locale, "API Task 的六个机密绑定", "Six secret bindings for the API task")}</h2>
            <p>{copy(locale, "每个绑定保持单行；仅展示名称、来源和代码状态。", "Each binding stays on one line and shows only its name, source, and code state.")}</p>
          </div>
          <span>{readiness.bindings.length} BINDINGS</span>
        </div>
        <div
          aria-label={copy(locale, "生产机密绑定表，可横向滚动", "Production secret binding table, horizontally scrollable")}
          className="secrets-readiness-table-wrap"
          tabIndex={0}
        >
          <table className="secrets-readiness-table">
            <thead>
              <tr>
                <th>{copy(locale, "配置名称", "Configuration key")}</th>
                <th>{copy(locale, "数据域", "Domain")}</th>
                <th>{copy(locale, "生产来源", "Production source")}</th>
                <th>{copy(locale, "消费方", "Consumer")}</th>
                <th>{copy(locale, "基础设施", "Infrastructure")}</th>
                <th>{copy(locale, "运行证据", "Runtime evidence")}</th>
                <th>{copy(locale, "自动轮换", "Automated rotation")}</th>
              </tr>
            </thead>
            <tbody>
              {readiness.bindings.map((binding) => (
                <tr key={binding.code}>
                  <td><code>{binding.code}</code></td>
                  <td>{domainCopy[binding.domain].title[locale]}</td>
                  <td><code>{binding.productionSource}</code></td>
                  <td><code>{binding.consumer}</code></td>
                  <td><span className="secrets-readiness-state is-defined">{stateLabel(locale, binding.infrastructureState)}</span></td>
                  <td><span className="secrets-readiness-state is-not-deployed">{stateLabel(locale, binding.runtimeState)}</span></td>
                  <td><span className="secrets-readiness-state is-not-implemented">{stateLabel(locale, binding.rotationState)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel secrets-readiness-gates">
        <PanelHeading
          eyebrow={copy(locale, "上线门槛", "LAUNCH GATES")}
          title={copy(locale, "仍需安全与运维共同完成", "Security and operations work still required")}
          body={copy(locale, "未部署、未开发和未定义保持为不同状态。", "Not deployed, not implemented, and not defined remain distinct states.")}
          state={copy(locale, "六项待完成", "Six open gates")}
          stateClass="is-warning"
        />
        <ol>
          {readiness.gates.map((gate, index) => {
            const content = gateCopy[gate.code];
            return (
              <li key={gate.code}>
                <span className={`secrets-readiness-gate-icon is-${gate.state.toLowerCase().replaceAll("_", "-")}`}>
                  {gate.state === "NOT_DEPLOYED"
                    ? <PlugsConnected size={18} aria-hidden="true" />
                    : <ShieldWarning size={18} aria-hidden="true" />}
                </span>
                <div>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                  <strong>{content.title[locale]}</strong>
                  <p>{content.body[locale]}</p>
                </div>
                <span className={`secrets-readiness-state is-${gate.state.toLowerCase().replaceAll("_", "-")}`}>
                  {stateLabel(locale, gate.state)}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </section>
  );
}

function ReadinessStat({
  detail,
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  detail: string;
  icon: IconComponent;
  label: string;
  tone?: "default" | "warning";
  value: string;
}) {
  return (
    <article className={`secrets-readiness-stat${tone === "warning" ? " is-warning" : ""}`}>
      <span><Icon size={21} aria-hidden="true" /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{detail}</em>
    </article>
  );
}

function PanelHeading({
  body,
  eyebrow,
  state,
  stateClass,
  title,
}: {
  body: string;
  eyebrow: string;
  state: string;
  stateClass: string;
  title: string;
}) {
  return (
    <div className="secrets-readiness-panel-heading">
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <span className={`secrets-readiness-state ${stateClass}`}>{state}</span>
    </div>
  );
}
