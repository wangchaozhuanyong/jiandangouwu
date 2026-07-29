import {
  ArrowsClockwise,
  CloudArrowUp,
  CurrencyCircleDollar,
  Database,
  EnvelopeSimple,
  HardDrives,
  Images,
  PlugsConnected,
  Pulse,
  ShieldCheck,
  TelegramLogo,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useMemo } from "react";
import {
  getCurrencies,
  getHealth,
  type AdminCurrency,
  type HealthStatus,
  type Locale,
} from "../../api";
import {
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  PanelState,
  RefreshNotice,
} from "../../admin-ui";
import {
  getTelegramNewOrderSettings,
} from "../notifications/api";
import type { AdminTelegramNewOrderSettings } from "@cloudbridge/contracts";
import {
  buildIntegrationReadiness,
  type IntegrationDefinitionCode,
  type IntegrationDefinitionState,
  type IntegrationGateCode,
  type IntegrationJobCode,
  type IntegrationReadiness,
} from "./model";

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

type IconComponent = typeof Database;

const definitionCopy: Record<
  IntegrationDefinitionCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
    scope: Record<Locale, string>;
    evidence: string;
    access: string;
    icon: IconComponent;
  }
> = {
  API_MYSQL_HEALTH: {
    title: { zh: "API 与 MySQL 运行探测", en: "API and MySQL runtime probe" },
    body: {
      zh: "本页调用现有健康接口。接口只有在本次请求成功，且 MySQL `SELECT 1` 与 Valkey `PING` 都通过时才返回健康；它不是可用率或性能监控。",
      en: "This page calls the existing health endpoint. It reports healthy only when this request, MySQL `SELECT 1`, and Valkey `PING` all succeed; it is not uptime or performance monitoring.",
    },
    scope: { zh: "本地运行", en: "Local runtime" },
    evidence: "GET /v1/health",
    access: "PUBLIC_HEALTH",
    icon: Database,
  },
  VALKEY_SESSION_STORE: {
    title: { zh: "Valkey 管理员会话运行探测", en: "Valkey administrator-session runtime probe" },
    body: {
      zh: "健康接口复用 SessionService 的现有连接执行有时限的 PING；只返回连接状态和本次耗时，不读取会话、队列或键值。",
      en: "The health endpoint reuses SessionService's existing connection for a time-bounded PING. It returns only connection state and this check's latency, without reading sessions, queues, or keys.",
    },
    scope: { zh: "本次运行", en: "This runtime check" },
    evidence: "GET /v1/health · SessionService.assertAvailable",
    access: "PUBLIC_HEALTH",
    icon: HardDrives,
  },
  MYSQL_CURRENCY_CONFIGURATION: {
    title: { zh: "MySQL 币种与汇率配置", en: "MySQL currency and rate configuration" },
    body: {
      zh: "页面仅在拥有 `catalog.read` 时读取当前币种与已保存汇率。它们是管理员维护的 MySQL 值，不是外部汇率提供商同步。",
      en: "The page reads current currencies and stored rates only with `catalog.read`. They are administrator-managed MySQL values, not an external rate-provider sync.",
    },
    scope: { zh: "受权限保护", en: "Permission protected" },
    evidence: "GET /v1/admin/currencies",
    access: "catalog.read",
    icon: ArrowsClockwise,
  },
  LOCAL_MEDIA_PIPELINE: {
    title: { zh: "本地媒体引用", en: "Local media references" },
    body: {
      zh: "商品与轮播使用 `/assets/` 本地路径。当前没有上传、对象存储、CDN 同步或媒体处理任务。",
      en: "Products and heroes use local `/assets/` paths. Upload, object storage, CDN synchronization, and media-processing jobs do not exist.",
    },
    scope: { zh: "本地能力", en: "Local capability" },
    evidence: "Product.imageKey · Hero.imageKey",
    access: "LOCAL_ASSETS",
    icon: Images,
  },
  TELEGRAM_NEW_ORDER: {
    title: { zh: "Telegram 新订单路由", en: "Telegram new-order route" },
    body: {
      zh: "只有 `settings.read` 可以读取已保存配置。服务端固定派生未连接、未有效启用、未配置 Token 和未外部核验。",
      en: "Only `settings.read` can read the saved configuration. The server always derives not connected, not effectively enabled, no token, and not externally verified.",
    },
    scope: { zh: "外部服务", en: "External service" },
    evidence: "notifications.telegram.new-order",
    access: "settings.read",
    icon: TelegramLogo,
  },
  AWS_STAGING_TEMPLATE: {
    title: { zh: "AWS staging 模板", en: "AWS staging template" },
    body: {
      zh: "CDK 定义 ECS、RDS、Valkey、ALB、WAF、CloudWatch 与访问日志桶；当前没有 deploy 或运行资源证据。",
      en: "CDK defines ECS, RDS, Valkey, ALB, WAF, CloudWatch, and an access-log bucket. There is no deploy or runtime-resource evidence.",
    },
    scope: { zh: "云模板", en: "Cloud template" },
    evidence: "infra/lib/cloudbridge-stack.ts",
    access: "NOT_DEPLOYED",
    icon: CloudArrowUp,
  },
};

const jobCopy: Record<
  IntegrationJobCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
  }
> = {
  CURRENCY_RATE_SYNC: {
    title: { zh: "外部汇率定时同步", en: "Scheduled external-rate sync" },
    body: {
      zh: "没有提供商适配器、调度器或同步运行记录；当前汇率由管理员手动更新。",
      en: "There is no provider adapter, scheduler, or sync-run record; rates are updated manually.",
    },
  },
  RESERVATION_EXPIRY_RELEASE: {
    title: { zh: "预留到期自动返库", en: "Automatic expired-reservation release" },
    body: {
      zh: "MySQL 已在商品、下单、工作台和订单访问时幂等返库；这里仍标记未开发，因为没有独立调度器、持久化任务运行记录或无人值守执行证据。",
      en: "MySQL now reconciles reservations on product, checkout, workspace, and order access. This scheduled-job row remains Not implemented because there is no independent scheduler, durable run history, or unattended execution evidence.",
    },
  },
  EMAIL_DELIVERY_RETRY: {
    title: { zh: "邮件投递与失败重试", en: "Email delivery and retry" },
    body: {
      zh: "没有邮件提供商、投递事件、重试队列或最终失败处理。",
      en: "No email provider, delivery event, retry queue, or terminal-failure handling exists.",
    },
  },
  DATABASE_BACKUP_JOB: {
    title: { zh: "本地数据库备份任务", en: "Local database backup job" },
    body: {
      zh: "没有 MySQL 导出、调度、离机复制或校验任务；本地命名卷不是备份。",
      en: "No MySQL export, schedule, off-host copy, or verification job exists; the local named volume is not a backup.",
    },
  },
};

const gateCopy: Record<
  IntegrationGateCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
    icon: IconComponent;
  }
> = {
  OBJECT_STORAGE: {
    title: { zh: "媒体对象存储", en: "Media object storage" },
    body: {
      zh: "没有上传 API、对象桶、媒体迁移、CDN 或同步状态。",
      en: "There is no upload API, object bucket, media migration, CDN, or sync state.",
    },
    icon: CloudArrowUp,
  },
  EMAIL_DELIVERY: {
    title: { zh: "邮件投递服务", en: "Email delivery service" },
    body: {
      zh: "没有服务商、凭据、模板、投递记录、Webhook 或失败处理。",
      en: "There is no provider, credential, template, delivery record, webhook, or failure handling.",
    },
    icon: EnvelopeSimple,
  },
  PAYMENT_PROVIDER: {
    title: { zh: "支付提供商", en: "Payment provider" },
    body: {
      zh: "订单仍是人工确认，没有支付商、Webhook、实际到账或退款流水。",
      en: "Orders remain manually confirmed with no provider, webhook, actual settlement, or refund ledger.",
    },
    icon: CurrencyCircleDollar,
  },
  EXCHANGE_RATE_PROVIDER: {
    title: { zh: "外部汇率提供商", en: "External exchange-rate provider" },
    body: {
      zh: "当前只保存管理员维护的汇率，没有来源签名、抓取任务或失败回退。",
      en: "Only administrator-managed rates are stored, with no signed source, fetch job, or failure fallback.",
    },
    icon: ArrowsClockwise,
  },
  BACKGROUND_JOB_RUNTIME: {
    title: { zh: "后台任务运行时", en: "Background-job runtime" },
    body: {
      zh: "没有队列、调度器、Worker、幂等执行、重试或任务事件存储。",
      en: "There is no queue, scheduler, worker, idempotent execution, retry, or job-event store.",
    },
    icon: Pulse,
  },
  INTEGRATION_OBSERVABILITY: {
    title: { zh: "集成可观测性", en: "Integration observability" },
    body: {
      zh: "没有统一连接延迟、错误率、失败告警、负责人或外部结果追踪。",
      en: "There is no unified connection latency, error rate, failure alert, owner, or external-result trace.",
    },
    icon: ShieldCheck,
  },
  AWS_DEPLOYMENT_EVIDENCE: {
    title: { zh: "AWS 部署证据", en: "AWS deployment evidence" },
    body: {
      zh: "CDK synth 只生成模板；尚未创建云资源、域名、证书或生产连接。",
      en: "CDK synth only generates a template; no cloud resource, domain, certificate, or production connection exists.",
    },
    icon: CloudArrowUp,
  },
};

const stateLabel = (locale: Locale, state: IntegrationDefinitionState): string => {
  if (state === "RUNTIME_VERIFIED") return copy(locale, "本次运行已核验", "Verified this run");
  if (state === "DEFINED_LOCAL_CONFIG") return copy(locale, "本地配置已定义", "Local config defined");
  if (state === "IMPLEMENTED_LOCAL") return copy(locale, "仅本地实现", "Local implementation only");
  if (state === "RESTRICTED") return copy(locale, "权限受限", "Permission restricted");
  if (state === "NOT_CONNECTED") return copy(locale, "未连接", "Not connected");
  return copy(locale, "未部署", "Not deployed");
};

const stateClass = (state: string): string =>
  `is-${state.toLowerCase().replaceAll("_", "-")}`;

const formatTimestamp = (value: string | null, locale: Locale): string => {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return copy(locale, "无可用时间", "No available time");
  }
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
};

type IntegrationPayload = {
  health: HealthStatus;
  currencies: AdminCurrency[] | null;
  telegram: AdminTelegramNewOrderSettings | null;
};

export default function IntegrationReadinessPage({
  locale,
  permissions,
  onOpenBackups,
  onOpenCurrencies,
  onOpenNotifications,
}: {
  locale: Locale;
  permissions: string[];
  onOpenBackups: () => void;
  onOpenCurrencies: () => void;
  onOpenNotifications: () => void;
}) {
  const canReadCurrencies = permissions.includes("catalog.read");
  const canReadTelegram = permissions.includes("settings.read");
  const loader = useCallback(async (signal: AbortSignal): Promise<IntegrationPayload> => {
    const [health, currencies, telegram] = await Promise.all([
      getHealth(signal),
      canReadCurrencies ? getCurrencies(signal) : Promise.resolve(null),
      canReadTelegram ? getTelegramNewOrderSettings(signal) : Promise.resolve(null),
    ]);
    return { health, currencies, telegram };
  }, [canReadCurrencies, canReadTelegram]);
  const resource = useCachedAdminResource<IntegrationPayload>(
    `integration-readiness:${canReadCurrencies ? "currency" : "no-currency"}:${canReadTelegram ? "telegram" : "no-telegram"}`,
    loader,
  );
  const slow = useSlowAdminRequest(resource.state);
  const readiness = useMemo<IntegrationReadiness | null>(
    () => resource.data
      ? buildIntegrationReadiness({
          health: resource.data.health,
          canReadCurrencies,
          currencies: resource.data.currencies,
          canReadTelegram,
          telegram: resource.data.telegram,
        })
      : null,
    [canReadCurrencies, canReadTelegram, resource.data],
  );

  return (
    <section className="integration-readiness-page">
      <div className="integration-readiness-truth-note" role="note">
        <WarningCircle size={20} aria-hidden="true" />
        <span>
          <strong>{copy(locale, "一次健康请求不等于全系统健康", "One health request is not whole-system health")}</strong>
          {copy(
            locale,
            "本页只读取现有 API、MySQL 与 Valkey 健康探测，以及当前账号有权读取的币种和 Telegram 配置。对象存储、邮件、支付、外部汇率、后台任务和 AWS 没有运行证据时不会显示为正常。",
            "This page reads only the existing API, MySQL, and Valkey health probe and the currency and Telegram configuration this account may access. Object storage, email, payments, external rates, background jobs, and AWS are never shown as healthy without runtime evidence.",
          )}
        </span>
      </div>

      {!readiness ? (
        <section className="admin-panel integration-readiness-loading">
          <RefreshNotice
            locale={locale}
            retry={() => void resource.reload()}
            slow={slow}
            state={resource.state}
          />
          <PanelState
            kind="cards"
            locale={locale}
            retry={() => void resource.reload()}
            state={resource.state}
          />
        </section>
      ) : (
        <>
          <div className="integration-readiness-summary">
            <IntegrationStat
              detail={copy(locale, "API 响应 + MySQL SELECT 1 + Valkey PING", "API response + MySQL SELECT 1 + Valkey PING")}
              icon={Pulse}
              label={copy(locale, "本次运行探测结果", "Runtime probe results")}
              value={String(readiness.healthProbeResultCount)}
            />
            <IntegrationStat
              detail={readiness.configuredRateCount === null
                ? "catalog.read · RESTRICTED"
                : copy(locale, `${readiness.configuredRateCount} 条已有汇率`, `${readiness.configuredRateCount} stored rates`)}
              icon={ArrowsClockwise}
              label={copy(locale, "可见币种配置", "Visible currency configurations")}
              tone={readiness.configuredCurrencyCount === null ? "warning" : undefined}
              value={readiness.configuredCurrencyCount === null
                ? copy(locale, "受限", "Restricted")
                : String(readiness.configuredCurrencyCount)}
            />
            <IntegrationStat
              detail={copy(locale, "邮件、支付、汇率、Telegram 均未接通", "Email, payment, rates, and Telegram are not connected")}
              icon={PlugsConnected}
              label={copy(locale, "已接通外部服务", "Connected external services")}
              tone="warning"
              value={String(readiness.activeExternalConnectionCount)}
            />
            <IntegrationStat
              detail="NOT_IMPLEMENTED"
              icon={Pulse}
              label={copy(locale, "已实现后台任务", "Implemented background jobs")}
              tone="warning"
              value={String(readiness.implementedBackgroundJobCount)}
            />
          </div>

          <div className="integration-readiness-toolbar">
            <p>
              <ShieldCheck size={17} aria-hidden="true" />
              {copy(
                locale,
                `健康接口检查时间：${formatTimestamp(readiness.health.timestamp, locale)}。刷新只重新读取现有 GET 接口。`,
                `Health-endpoint check: ${formatTimestamp(readiness.health.timestamp, locale)}. Refresh only re-reads existing GET endpoints.`,
              )}
            </p>
            <button
              className="admin-secondary"
              disabled={!canReadTelegram}
              onClick={onOpenNotifications}
              type="button"
            >
              <TelegramLogo size={17} aria-hidden="true" />
              {copy(locale, "打开通知就绪", "Open notification readiness")}
            </button>
            <button
              className="admin-primary"
              onClick={() => void resource.reload()}
              type="button"
            >
              <ArrowsClockwise size={17} aria-hidden="true" />
              {copy(locale, "刷新真实证据", "Refresh real evidence")}
            </button>
          </div>

          <div className="integration-readiness-definitions">
            {readiness.definitions.map((definition) => {
              const content = definitionCopy[definition.code];
              const Icon = content.icon;
              return (
                <article className="admin-panel integration-readiness-definition" key={definition.code}>
                  <span><Icon size={22} aria-hidden="true" /></span>
                  <div>
                    <small>{content.scope[locale]}</small>
                    <h2>{content.title[locale]}</h2>
                    <p>{content.body[locale]}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>{copy(locale, "仓库 / 接口证据", "Repository / endpoint evidence")}</dt>
                      <dd><code>{content.evidence}</code></dd>
                    </div>
                    <div>
                      <dt>{copy(locale, "读取边界", "Read boundary")}</dt>
                      <dd><code>{content.access}</code></dd>
                    </div>
                  </dl>
                  <span className={`integration-readiness-state ${stateClass(definition.state)}`}>
                    {stateLabel(locale, definition.state)}
                  </span>
                </article>
              );
            })}
          </div>

          <div className="integration-readiness-main-grid">
            <section className="admin-panel integration-readiness-runtime">
              <PanelHeading
                body={copy(locale, "只列出本次页面真正读取到的运行结果。", "Only runtime results actually read by this page are listed.")}
                eyebrow={copy(locale, "运行证据", "RUNTIME EVIDENCE")}
                state={copy(locale, "3 项已核验", "3 results verified")}
                stateClass="is-runtime-verified"
                title={copy(locale, "API、MySQL 与 Valkey 本次可达", "API, MySQL, and Valkey are reachable in this check")}
              />
              <dl>
                <div>
                  <dt>API</dt>
                  <dd><span className="integration-readiness-state is-runtime-verified">healthy</span></dd>
                </div>
                <div>
                  <dt>MySQL</dt>
                  <dd><span className="integration-readiness-state is-runtime-verified">connected</span></dd>
                </div>
                <div>
                  <dt>{copy(locale, "MySQL 本次耗时", "MySQL latency this check")}</dt>
                  <dd>{readiness.health.latencyMs.database} ms</dd>
                </div>
                <div>
                  <dt>Valkey</dt>
                  <dd><span className="integration-readiness-state is-runtime-verified">connected</span></dd>
                </div>
                <div>
                  <dt>{copy(locale, "Valkey 本次耗时", "Valkey latency this check")}</dt>
                  <dd>{readiness.health.latencyMs.valkey} ms</dd>
                </div>
                <div>
                  <dt>{copy(locale, "检查时间", "Checked at")}</dt>
                  <dd>{formatTimestamp(readiness.health.timestamp, locale)}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-panel integration-readiness-access">
              <PanelHeading
                body={copy(locale, "受保护证据沿用既有权限，不因本页放宽。", "Protected evidence keeps its existing permissions and is not widened by this page.")}
                eyebrow={copy(locale, "受保护证据", "PROTECTED EVIDENCE")}
                state={copy(locale, "权限原样保留", "Permissions preserved")}
                stateClass="is-restricted"
                title={copy(locale, "币种与 Telegram 配置", "Currency and Telegram configuration")}
              />
              <dl>
                <div>
                  <dt>{copy(locale, "币种读取", "Currency read")}</dt>
                  <dd>{canReadCurrencies ? "catalog.read" : "RESTRICTED"}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "有效币种", "Active currencies")}</dt>
                  <dd>{readiness.currencies.activeCount ?? "RESTRICTED"}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "最近汇率生效时间", "Latest rate effective time")}</dt>
                  <dd>{readiness.currencies.latestEffectiveAt
                    ? formatTimestamp(readiness.currencies.latestEffectiveAt, locale)
                    : copy(locale, "受限或无记录", "Restricted or no record")}</dd>
                </div>
                <div>
                  <dt>Telegram</dt>
                  <dd>{stateLabel(locale, readiness.telegram.state)}</dd>
                </div>
              </dl>
              <div className="integration-readiness-access-actions">
                <button
                  className="admin-secondary"
                  disabled={!canReadCurrencies}
                  onClick={onOpenCurrencies}
                  type="button"
                >
                  <ArrowsClockwise size={17} aria-hidden="true" />
                  {copy(locale, "打开币种配置", "Open currency configuration")}
                </button>
                <button
                  className="admin-secondary"
                  onClick={onOpenBackups}
                  type="button"
                >
                  <HardDrives size={17} aria-hidden="true" />
                  {copy(locale, "打开备份就绪", "Open backup readiness")}
                </button>
              </div>
            </section>
          </div>

          <section className="admin-panel integration-readiness-jobs">
            <PanelHeading
              body={copy(locale, "旧预览中的追踪编号、计划时间和成功结果已经删除。", "The old preview's trace IDs, scheduled times, and success results have been removed.")}
              eyebrow={copy(locale, "后台任务边界", "BACKGROUND JOB BOUNDARY")}
              state={copy(locale, "0 项已实现", "0 implemented")}
              stateClass="is-not-implemented"
              title={copy(locale, "四项旧任务均没有运行时", "All four former jobs have no runtime")}
            />
            <ol>
              {readiness.jobs.map((job, index) => {
                const content = jobCopy[job.code];
                return (
                  <li key={job.code}>
                    <span><Pulse size={18} aria-hidden="true" /></span>
                    <div>
                      <small>{String(index + 1).padStart(2, "0")}</small>
                      <strong>{content.title[locale]}</strong>
                      <p>{content.body[locale]}</p>
                    </div>
                    <span className="integration-readiness-state is-not-implemented">
                      {copy(locale, "未开发", "Not implemented")}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="admin-panel integration-readiness-records">
            <div className="integration-readiness-records-heading">
              <div>
                <small>{copy(locale, "集成证据清单", "INTEGRATION EVIDENCE INVENTORY")}</small>
                <h2>{copy(locale, "六个当前系统边界", "Six current system boundaries")}</h2>
                <p>{copy(locale, "每个定义保持单行；状态只代表本页实际证据。", "Each definition stays on one line; status represents only this page's actual evidence.")}</p>
              </div>
              <span>6 DEFINITIONS</span>
            </div>
            <div
              aria-label={copy(locale, "集成证据定义表，可横向滚动", "Integration evidence definition table, horizontally scrollable")}
              className="integration-readiness-table-wrap"
              role="region"
              tabIndex={0}
            >
              <table className="integration-readiness-table">
                <thead>
                  <tr>
                    <th>{copy(locale, "定义代码", "Definition code")}</th>
                    <th>{copy(locale, "系统范围", "System scope")}</th>
                    <th>{copy(locale, "仓库来源", "Repository source")}</th>
                    <th>{copy(locale, "证据位置", "Evidence location")}</th>
                    <th>{copy(locale, "读取边界", "Read boundary")}</th>
                    <th>{copy(locale, "当前状态", "Current state")}</th>
                  </tr>
                </thead>
                <tbody>
                  {readiness.definitions.map((definition) => {
                    const content = definitionCopy[definition.code];
                    return (
                      <tr key={definition.code}>
                        <td><code>{definition.code}</code></td>
                        <td>{content.scope[locale]}</td>
                        <td><code>{definition.repositorySource}</code></td>
                        <td><code>{content.evidence}</code></td>
                        <td><code>{content.access}</code></td>
                        <td>
                          <span className={`integration-readiness-state ${stateClass(definition.state)}`}>
                            {stateLabel(locale, definition.state)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-panel integration-readiness-gates">
            <PanelHeading
              body={copy(locale, "未开发与未部署保持为不同状态，不用“降级”掩盖缺失能力。", "Not implemented and not deployed remain distinct; “degraded” never hides a missing capability.")}
              eyebrow={copy(locale, "上线门槛", "LAUNCH GATES")}
              state={copy(locale, "七项待完成", "Seven gates open")}
              stateClass="is-not-deployed"
              title={copy(locale, "生产集成之前仍需完成", "Required before production integrations")}
            />
            <ol>
              {readiness.gates.map((gate, index) => {
                const content = gateCopy[gate.code];
                const Icon = content.icon;
                return (
                  <li key={gate.code}>
                    <span className={`integration-readiness-gate-icon ${stateClass(gate.state)}`}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <small>{String(index + 1).padStart(2, "0")}</small>
                      <strong>{content.title[locale]}</strong>
                      <p>{content.body[locale]}</p>
                    </div>
                    <span className={`integration-readiness-state ${stateClass(gate.state)}`}>
                      {gate.state === "NOT_DEPLOYED"
                        ? copy(locale, "未部署", "Not deployed")
                        : copy(locale, "未开发", "Not implemented")}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </section>
  );
}

function IntegrationStat({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: IconComponent;
  label: string;
  tone?: "warning";
  value: string;
}) {
  return (
    <article className={`integration-readiness-stat${tone ? ` is-${tone}` : ""}`}>
      <span><Icon size={20} aria-hidden="true" /></span>
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
  stateClass: stateTone,
  title,
}: {
  body: string;
  eyebrow: string;
  state: string;
  stateClass: string;
  title: string;
}) {
  return (
    <div className="integration-readiness-panel-heading">
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <span className={`integration-readiness-state ${stateTone}`}>{state}</span>
    </div>
  );
}
