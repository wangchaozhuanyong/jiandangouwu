import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const readOptional = (file) => (
  existsSync(new URL(`../${file}`, import.meta.url)) ? read(file) : ""
);

test("正式后台的24个页面都使用真实或明确受限的专属页面", () => {
  const app = read("apps/admin/src/App.tsx");
  const dashboard = read("apps/admin/src/pages/dashboard-page.tsx");
  const orders = read("apps/admin/src/pages/orders-page.tsx");
  const products = read("apps/admin/src/pages/products-page.tsx");
  const categories = read("apps/admin/src/pages/categories-page.tsx");
  const currencies = read("apps/admin/src/pages/currencies-page.tsx");
  const security = read("apps/admin/src/pages/security-page.tsx");
  const audit = read("apps/admin/src/pages/audit-page.tsx");
  const securityEvents = read("apps/admin/src/features/security-events/security-events-page.tsx");
  const media = read("apps/admin/src/features/media/media-page.tsx");
  const notifications = read("apps/admin/src/features/notifications/notifications-page.tsx");
  const reconciliation = read("apps/admin/src/features/finance/reconciliation-page.tsx");
  const dataSecurity = read("apps/admin/src/features/data-security/data-security-page.tsx");
  const secrets = read("apps/admin/src/features/secrets/secrets-readiness-page.tsx");
  const backups = read("apps/admin/src/features/backups/backup-readiness-page.tsx");
  const integrations = read("apps/admin/src/features/integrations/integration-readiness-page.tsx");

  assert.equal(existsSync(new URL("../apps/admin/src/pages/design-preview-page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/admin/src/design-workflows.tsx", import.meta.url)), false);
  assert.doesNotMatch(app, /DesignPreviewPage|design-preview-page/u);
  assert.match(app, /<AccountCenterDialog/u);
  assert.match(app, /ChatGPT 管理登录/u);
  assert.match(dashboard, /buildDashboardSnapshot/u);
  assert.match(dashboard, /snapshot\.inventoryRisk\.affectedProductCount/u);
  assert.match(dashboard, /className="dashboard-inventory-table"/u);
  assert.match(dashboard, /IMPLEMENTED_LIVE_QUERY/u);
  assert.match(dashboard, /NOT_COLLECTED/u);
  assert.doesNotMatch(dashboard, /DesignWorkflowDialog|dashboard-insights|Operations alert design|运营提醒设计/u);
  assert.match(orders, /<OrderDetailDialog/u);
  assert.doesNotMatch(orders, /DesignWorkflowDialog|order-workbench|design-preview-note/u);
  assert.match(products, /buildProductImpact/u);
  assert.match(products, /canWrite/u);
  assert.match(products, /getProducts\(query, signal\)/u);
  assert.match(products, /readAdminProductQuery\(window\.location\.search\)/u);
  assert.match(products, /adminProductQuerySearch/u);
  assert.match(products, /productQueryFromFilter/u);
  assert.match(products, /statusLabels\[status\]/u);
  assert.match(products, /className="product-admin-pagination"/u);
  assert.match(products, /window\.addEventListener\("popstate"/u);
  assert.doesNotMatch(products, /debouncedSearch|setTimeout/u);
  assert.doesNotMatch(products, /DesignWorkflowDialog|inventory-center|Inventory and publishing design|库存与发布设计/u);
  assert.match(app, /<ProductsPage[\s\S]*?permissions\.includes\("catalog\.write"\)/u);
  assert.match(categories, /buildCategoryImpact/u);
  assert.match(categories, /canWrite/u);
  assert.match(app, /<CategoriesPage[\s\S]*?permissions\.includes\("catalog\.write"\)/u);
  assert.match(categories, /不会自动隐藏、移动或删除关联商品/u);
  assert.doesNotMatch(categories, /DesignWorkflowDialog|id="categories"|影响与排序设计|Impact and ordering design/u);
  assert.match(currencies, /getCurrencyRateHistory/u);
  assert.doesNotMatch(currencies, /DesignWorkflowDialog|id="currencies"/u);
  assert.match(security, /<SessionWorkbench locale=\{locale\}/u);
  assert.match(audit, /getAuditPage/u);
  assert.doesNotMatch(audit, /DesignWorkflowDialog|design-preview-note|id="logs"/u);
  assert.match(app, /page === "banners"[\s\S]*?<BannersPage/u);
  assert.match(app, /page === "contacts"[\s\S]*?<ContactsPage/u);
  assert.match(app, /page === "settings"[\s\S]*?<SettingsPage/u);
  assert.match(app, /page === "team"[\s\S]*?<TeamPage/u);
  assert.match(app, /page === "roles"[\s\S]*?<RolesPage/u);
  assert.match(app, /page === "translations"[\s\S]*?<TranslationsPage/u);
  assert.match(app, /page === "security-events"[\s\S]*?<SecurityEventsPage/u);
  assert.match(app, /page === "media"[\s\S]*?<MediaPage/u);
  assert.match(app, /page === "notifications"[\s\S]*?<NotificationsPage/u);
  assert.match(app, /page === "reconciliation"[\s\S]*?<ReconciliationPage/u);
  assert.match(app, /page === "data-security"[\s\S]*?<DataSecurityPage/u);
  assert.match(app, /page === "secrets"[\s\S]*?<SecretsReadinessPage/u);
  assert.match(app, /page === "backups"[\s\S]*?<BackupReadinessPage/u);
  assert.match(app, /page === "integrations"[\s\S]*?<IntegrationReadinessPage/u);
  assert.match(securityEvents, /getAudit/u);
  assert.match(media, /getAllProducts/u);
  assert.match(media, /getHeroes/u);
  assert.match(notifications, /getTelegramNewOrderSettings/u);
  assert.match(reconciliation, /getAllManualPaymentEvents/u);
  assert.match(dataSecurity, /getAudit/u);
  assert.match(secrets, /buildSecretReadiness/u);
  assert.match(backups, /buildBackupReadiness/u);
  assert.match(integrations, /buildIntegrationReadiness/u);
});

test("审计日志页面使用服务端筛选与完整历史分页并只展示安全白名单字段", () => {
  const page = read("apps/admin/src/pages/audit-page.tsx");
  const model = read("apps/admin/src/features/audit/model.ts");
  const api = read("apps/admin/src/api.ts");
  const service = read("apps/api/src/admin/admin.service.ts");
  const css = read("apps/admin/src/styles.css");

  assert.match(page, /useCachedAdminResource<AuditEventPage>\([\s\S]*?`audit-page:/u);
  assert.match(page, /当前筛选共/u);
  assert.match(page, /筛选、分页和安全 CSV 导出由服务器执行/u);
  assert.match(page, /前后差异、IP 哈希和正式保留策略不向前端开放/u);
  assert.match(page, /<table className="audit-log-table">/u);
  assert.match(page, /事件 ID[\s\S]*?追踪 ID[\s\S]*?发生时间[\s\S]*?动作/u);
  assert.match(page, /auditQuerySearch/u);
  assert.match(page, /audit-log-pagination/u);
  assert.match(page, /应用筛选/u);
  assert.doesNotMatch(page, /filterAuditEvents/u);
  assert.match(page, /<Dialog/u);
  assert.match(page, /exportAuditCsv/u);
  assert.match(page, /安全导出 CSV/u);
  assert.match(page, /文件下载后将离开系统控制范围/u);
  assert.doesNotMatch(page, /DesignWorkflowDialog|design-preview-note/u);
  assert.match(model, /auditActionLabel/u);
  assert.match(model, /auditTargetTypes/u);
  assert.match(model, /readAuditQuery/u);
  assert.match(model, /auditQueryFromFilter/u);
  assert.match(api, /export const getAuditPage/u);
  assert.match(api, /export const exportAuditCsv/u);
  assert.match(api, /Audit pagination metadata failed the runtime contract/u);
  assert.match(service, /const where = auditWhere\(query\)/u);
  assert.match(service, /async exportAuditEvents/u);
  assert.match(service, /AUDIT_CSV_EXPORT_LIMIT/u);
  assert.match(service, /RECENT_AUTHENTICATION_REQUIRED/u);
  assert.match(service, /auditEvent\.groupBy/u);
  assert.match(service, /auditEvent\.findMany\(\{[\s\S]*?select:\s*\{[\s\S]*?requestId:\s*true/u);
  assert.doesNotMatch(service.match(/async auditEvents[\s\S]*?private async saveNewProduct/u)?.[0] ?? "", /include:\s*\{\s*actor/u);
  assert.match(css, /\.audit-log-table\s*\{[^}]*min-width:\s*1740px;/u);
  assert.match(css, /\.audit-log-detail-button\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
  assert.match(css, /\.audit-log-pagination\s*\{[^}]*display:\s*flex;/u);
  assert.doesNotMatch(css, /\.admin-content\s*\{[^}]*animation:[^;}]*\bboth\b/u);
});

test("集成就绪中心只读取真实证据并删除旧健康与任务幻象", () => {
  const app = read("apps/admin/src/App.tsx");
  const api = read("apps/admin/src/api.ts");
  const page = read("apps/admin/src/features/integrations/integration-readiness-page.tsx");
  const model = read("apps/admin/src/features/integrations/model.ts");
  const css = read("apps/admin/src/styles.css");
  const health = read("apps/api/src/health/health.controller.ts");
  const healthContract = read("packages/contracts/src/health.ts");
  const compose = read("compose.yaml");
  const session = read("apps/api/src/auth/session.service.ts");
  const infra = read("infra/lib/cloudbridge-stack.ts");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/integrations\/integration-readiness-page"\)\)/u);
  assert.match(app, /page === "integrations"[\s\S]*?<IntegrationReadinessPage/u);
  assert.match(app, /permissions=\{user\.permissions\}/u);
  assert.match(page, /getHealth\(signal\)/u);
  assert.match(page, /canReadCurrencies \? getCurrencies\(signal\) : Promise\.resolve\(null\)/u);
  assert.match(page, /canReadTelegram \? getTelegramNewOrderSettings\(signal\) : Promise\.resolve\(null\)/u);
  assert.match(page, /一次健康请求不等于全系统健康/u);
  assert.match(page, /刷新只重新读取现有 GET 接口/u);
  assert.match(page, /旧预览中的追踪编号、计划时间和成功结果已经删除/u);
  assert.doesNotMatch(page, /method:\s*"POST"|method:\s*"PUT"|method:\s*"PATCH"|method:\s*"DELETE"|simulateTelegramNewOrder|updateTelegramNewOrderSettings/u);
  assert.match(api, /request<HealthStatus>\("\/health", \{ signal \}\)/u);
  assert.match(api, /health\.valkey !== "connected"/u);
  assert.match(api, /isNonNegativeSafeInteger\(health\.latencyMs\?\.database\)/u);
  assert.match(api, /isNonNegativeSafeInteger\(health\.latencyMs\?\.valkey\)/u);
  assert.match(healthContract, /valkey:\s*"connected"/u);
  assert.match(healthContract, /latencyMs:\s*\{[\s\S]*?database:\s*number;[\s\S]*?valkey:\s*number;/u);
  assert.match(health, /\$queryRaw`SELECT 1`/u);
  assert.match(health, /SessionService/u);
  assert.match(health, /sessions\.assertAvailable\(\)/u);
  assert.match(health, /Promise\.all/u);
  assert.match(health, /HEALTH_PROBE_TIMEOUT_MS\s*=\s*1_500/u);
  assert.match(health, /ServiceUnavailableException/u);
  assert.doesNotMatch(health, /new Redis/u);
  assert.match(session, /async assertAvailable\(\): Promise<void>/u);
  assert.match(session, /this\.redis\.ping\(\)/u);
  assert.match(page, /API 响应 \+ MySQL SELECT 1 \+ Valkey PING/u);
  assert.match(model, /healthProbeResultCount:\s*3/u);
  assert.doesNotMatch(`${page}\n${model}`, /NOT_QUERIED|VALKEY_HEALTH_PROBE/u);

  for (const state of ["RUNTIME_VERIFIED", "IMPLEMENTED_LOCAL", "RESTRICTED", "NOT_CONNECTED", "NOT_DEPLOYED", "NOT_IMPLEMENTED"]) {
    assert.match(model, new RegExp(state, "u"));
  }
  assert.match(model, /activeExternalConnectionCount:\s*0/u);
  assert.match(model, /implementedBackgroundJobCount:\s*0/u);
  assert.match(compose, /image:\s*mysql:8\.4/u);
  assert.match(compose, /image:\s*valkey\/valkey:8-alpine/u);
  assert.match(session, /new Redis\(redisUrl/u);
  assert.match(infra, /engine:\s*"valkey"/u);
  assert.match(infra, /new s3\.Bucket\(this, "AccessLogsBucket"/u);
  assert.doesNotMatch(`${page}\n${model}`, /99\.99%|TRACE-CB-JOB|2 个通知等待重试|每 30 分钟同步|3 项正常|每日数据备份/u);
  assert.equal(existsSync(new URL("../apps/admin/src/pages/design-preview-page.tsx", import.meta.url)), false);
  assert.match(css, /\.integration-readiness-table\s*\{[^}]*min-width:\s*1420px;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.integration-readiness-toolbar\s*\{\s*grid-template-columns:\s*1fr;/u);
  assert.match(css, /\.integration-readiness-table-wrap\s*\{[^}]*overflow-x:\s*auto;/u);
  assert.match(css, /\.admin-topbar > div:first-of-type\s*\{[^}]*flex:\s*1 1 auto;/u);
  assert.match(css, /\.admin-language\s*\{[^}]*flex:\s*none;/u);
  assert.match(css, /@media \(max-width: 340px\)[\s\S]*?\.admin-topbar h1\s*\{[^}]*overflow-wrap:\s*anywhere;/u);
});

test("备份就绪页只投影仓库定义并明确关闭恢复门禁", () => {
  const app = read("apps/admin/src/App.tsx");
  const page = read("apps/admin/src/features/backups/backup-readiness-page.tsx");
  const model = read("apps/admin/src/features/backups/model.ts");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const css = read("apps/admin/src/styles.css");
  const compose = read("compose.yaml");
  const infra = read("infra/lib/cloudbridge-stack.ts");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/backups\/backup-readiness-page"\)\)/u);
  assert.match(app, /page === "backups"[\s\S]*?<BackupReadinessPage/u);
  assert.match(page, /持久化不等于备份，模板定义不等于已经可恢复/u);
  assert.match(page, /不存在创建快照或开始恢复按钮/u);
  assert.match(page, /<table className="backup-readiness-table">/u);
  assert.doesNotMatch(page, /\bfetch\(|method:\s*"POST"|method:\s*"PUT"|method:\s*"PATCH"|method:\s*"DELETE"/u);

  for (const value of ["LOCAL_MYSQL_VOLUME", "LOCAL_VALKEY_VOLUME", "AWS_RDS_AUTOMATED_BACKUP", "AWS_VALKEY_SNAPSHOT"]) {
    assert.match(model, new RegExp(value, "u"));
  }
  for (const state of ["DEFINED_LOCAL_CONFIG", "DEFINED_INFRA", "NOT_A_BACKUP", "NOT_DEPLOYED", "NOT_IMPLEMENTED", "NOT_DEFINED", "NOT_PERFORMED"]) {
    assert.match(model, new RegExp(state, "u"));
  }
  assert.match(compose, /cloudbridge_mysql:\/var\/lib\/mysql/u);
  assert.match(compose, /cloudbridge_redis:\/data/u);
  assert.match(compose, /--appendonly",\s*"yes"/u);
  assert.match(infra, /backupRetention:\s*Duration\.days\(7\)/u);
  assert.match(infra, /deleteAutomatedBackups:\s*false/u);
  assert.match(infra, /deletionProtection:\s*true/u);
  assert.match(infra, /snapshotRetentionLimit:\s*7/u);
  assert.match(infra, /snapshotWindow:\s*"18:00-19:00"/u);

  assert.doesNotMatch(`${page}\n${model}`, /BKP-|1\.8[149] GB|04:00|30 days|21m 48s|完整备份成功|备份存储正常|全部通过/u);
  assert.doesNotMatch(preview, /page === "backups"|function BackupsDesign|BKP-/u);
  assert.match(css, /\.backup-readiness-table\s*\{[^}]*min-width:\s*1500px;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.backup-readiness-toolbar\s*\{\s*grid-template-columns:\s*1fr;/u);
});

test("机密配置页只投影仓库定义并关闭未具备证据的上线门禁", () => {
  const app = read("apps/admin/src/App.tsx");
  const page = read("apps/admin/src/features/secrets/secrets-readiness-page.tsx");
  const model = read("apps/admin/src/features/secrets/model.ts");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const css = read("apps/admin/src/styles.css");
  const infra = read("infra/lib/cloudbridge-stack.ts");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/secrets\/secrets-readiness-page"\)\)/u);
  assert.match(app, /page === "secrets"[\s\S]*?<SecretsReadinessPage/u);
  assert.match(page, /只展示仓库定义，不读取任何机密值/u);
  assert.match(page, /不存在新增、查看或轮换按钮/u);
  assert.match(page, /SHA-256 · NOT_HMAC/u);
  assert.match(page, /<table className="secrets-readiness-table">/u);
  assert.doesNotMatch(page, /\bfetch\(|method:\s*"POST"|method:\s*"PUT"|method:\s*"PATCH"|method:\s*"DELETE"/u);

  for (const code of ["DB_HOST", "DB_USER", "DB_PASSWORD", "REDIS_PASSWORD", "SESSION_SECRET", "AUTH_ENCRYPTION_KEY"]) {
    assert.match(model, new RegExp(code, "u"));
    assert.match(infra, new RegExp(`${code}:\\s*ecs\\.Secret\\.fromSecretsManager`, "u"));
  }
  for (const state of ["DEFINED_INFRA", "NOT_DEPLOYED", "NOT_IMPLEMENTED", "NOT_DEFINED"]) {
    assert.match(model, new RegExp(state, "u"));
  }
  for (const fabricatedCode of ["STRIPE_SIGNING_SECRET", "DATABASE_APP_PASSWORD", "CONTACT_ENCRYPTION_KEY", "TELEGRAM_BOT_TOKEN"]) {
    assert.doesNotMatch(`${page}\n${model}`, new RegExp(fabricatedCode, "u"));
  }
  assert.doesNotMatch(`${page}\n${model}`, /••••|14 天|32 天|71 天|rotateSecret|createSecret/u);
  assert.doesNotMatch(preview, /page === "secrets"|function SecretsDesign/u);
  assert.match(css, /\.secrets-readiness-table\s*\{[^}]*min-width:\s*1340px;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.secrets-readiness-toolbar\s*\{\s*grid-template-columns:\s*1fr;/u);
});

test("数据安全中心只读取当前会话与安全审计并明确治理缺口", () => {
  const app = read("apps/admin/src/App.tsx");
  const page = read("apps/admin/src/features/data-security/data-security-page.tsx");
  const model = read("apps/admin/src/features/data-security/model.ts");
  const api = read("apps/admin/src/api.ts");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/data-security\/data-security-page"\)\)/u);
  assert.match(app, /page === "data-security"[\s\S]*?<DataSecurityPage/u);
  assert.match(page, /user\.permissions\.includes\("audit\.read"\)/u);
  assert.match(page, /canReadAudit\s*\?\s*getAudit\(signal\)/u);
  assert.match(api, /getAuditPage\(\{\s*page:\s*1,\s*pageSize:\s*100\s*\},\s*signal\)/u);
  assert.match(page, /当前是代码控制与运行证据，不是合规认证/u);
  assert.match(page, /不会扫描、移动或删除数据/u);
  assert.match(page, /<table className="data-security-audit-table">/u);
  assert.doesNotMatch(page, /method:\s*"POST"|method:\s*"PUT"|method:\s*"PATCH"|method:\s*"DELETE"/u);

  for (const state of ["IMPLEMENTED_CODE", "NOT_DEFINED", "NOT_IMPLEMENTED", "NOT_CONNECTED"]) {
    assert.match(model, new RegExp(state, "u"));
  }
  for (const code of ["CONTACT_PROTECTION", "SERVER_SESSION", "DATABASE_RBAC", "AUDIT_RECORDING"]) {
    assert.match(model, new RegExp(code, "u"));
  }
  assert.match(model, /visibleAuditEvents = canReadAudit \? auditEvents : null/u);
  assert.doesNotMatch(page, /30 天|365 天|90 天|设备数据|运行日志|不可篡改|执行策略检查/u);
  assert.doesNotMatch(preview, /page === "data-security"|function DataSecurityDesign/u);
  assert.match(css, /\.data-security-audit-table\s*\{[^}]*min-width:\s*1320px;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.data-security-toolbar\s*\{\s*grid-template-columns:\s*1fr;/u);
});

test("对账中心只读取内部人工状态并明确外部证据未采集", () => {
  const app = read("apps/admin/src/App.tsx");
  const page = read("apps/admin/src/features/finance/reconciliation-page.tsx");
  const model = read("apps/admin/src/features/finance/reconciliation-model.ts");
  const api = read("apps/admin/src/features/finance/api.ts");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/finance\/reconciliation-page"\)\)/u);
  assert.match(app, /page === "reconciliation"[\s\S]*?<ReconciliationPage/u);
  assert.match(app, /canRead=\{user\.permissions\.includes\("orders\.read"\)\}/u);
  assert.match(page, /canRead\s*\?\s*getAllManualPaymentEvents\(signal\)/u);
  assert.match(page, /manual-payment-events:reconciliation-all/u);
  assert.match(page, /这些数据是未采集，不是零/u);
  assert.match(page, /onOpenPayments/u);
  assert.match(page, /<table className="reconciliation-record-table">/u);
  assert.doesNotMatch(page, /Stripe|结算总额|差异金额|导出对账|method:\s*"POST"|method:\s*"PUT"|method:\s*"PATCH"|method:\s*"DELETE"/u);

  assert.match(api, /getAllManualPaymentEvents/u);
  assert.match(api, /pageSize:\s*100/u);
  assert.match(api, /\} while \(page <= pageCount\)/u);
  assert.match(model, /NOT_COLLECTED/u);
  assert.match(model, /NOT_IMPLEMENTED/u);
  assert.match(model, /event\.externalActionVerified !== false/u);
  assert.doesNotMatch(model, /totalAmount|settledAmount|variance/u);

  assert.doesNotMatch(preview, /page === "reconciliation"|function ReconciliationDesign|Stripe/u);
  assert.match(css, /\.reconciliation-record-table\s*\{[^}]*min-width:\s*1120px;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.reconciliation-toolbar\s*\{\s*grid-template-columns:\s*1fr;/u);
});

test("通知中心只读取真实未连接状态且不伪造投递记录", () => {
  const app = read("apps/admin/src/App.tsx");
  const page = read("apps/admin/src/features/notifications/notifications-page.tsx");
  const model = read("apps/admin/src/features/notifications/model.ts");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/notifications\/notifications-page"\)\)/u);
  assert.match(app, /page === "notifications"[\s\S]*?<NotificationsPage/u);
  assert.match(app, /canRead=\{user\.permissions\.includes\("settings\.read"\)\}/u);
  assert.match(page, /canRead\s*\?\s*getTelegramNewOrderSettings\(signal\)/u);
  assert.match(page, /"telegram-new-order-settings"/u);
  assert.match(model, /NOT_COLLECTED/u);
  assert.match(page, /这些数据是未采集，不是零/u);
  assert.match(page, /onOpenTelegram/u);
  assert.doesNotMatch(page, /simulateTelegramNewOrder|updateTelegramNewOrderSettings|method:\s*"POST"|method:\s*"PUT"/u);
  assert.doesNotMatch(page, /未读 2|新订单等待领取|邮件通知发送失败|法币汇率更新完成|TRACE-CB-NTF/u);
  assert.match(model, /DELIVERY_EVENT_STORE/u);
  assert.match(model, /RETRY_QUEUE/u);
  assert.match(model, /state:\s*"NOT_IMPLEMENTED"/u);
  assert.doesNotMatch(preview, /page === "notifications"|function NotificationsDesign|TRACE-CB-NTF/u);
  assert.match(css, /\.notification-toolbar button\s*\{[^}]*white-space:\s*nowrap;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.notification-toolbar\s*\{\s*grid-template-columns:\s*1fr;/u);
});

test("媒体页在 Sites 运行时管理真实 R2 对象并保持引用与删除门禁", () => {
  const app = read("apps/admin/src/App.tsx");
  const page = read("apps/admin/src/features/media/media-page.tsx");
  const model = read("apps/admin/src/features/media/model.ts");
  const api = read("apps/admin/src/api.ts");
  const sitesApi = read("apps/sites/server/media-api.ts");
  const sitesAdmin = read("apps/sites/server/admin-api.ts");
  const router = read("apps/sites/server/router.ts");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/media\/media-page"\)\)/u);
  assert.match(app, /page === "media"[\s\S]*?<MediaPage/u);
  assert.match(app, /sitesRuntime=\{user\.authProvider === "SITES"\}/u);
  assert.match(page, /permissions\.includes\("catalog\.read"\)/u);
  assert.match(page, /permissions\.includes\("content\.read"\)/u);
  assert.match(page, /permissions\.includes\("catalog\.write"\)/u);
  assert.match(page, /permissions\.includes\("content\.write"\)/u);
  assert.match(page, /getAllProducts\(signal\)/u);
  assert.match(page, /getHeroes\(signal\)/u);
  assert.match(page, /getManagedMedia\(signal\)/u);
  assert.match(page, /uploadManagedMedia/u);
  assert.match(page, /replaceManagedMedia/u);
  assert.match(page, /deleteManagedMedia/u);
  assert.match(page, /selected && !operation/u);
  assert.match(api, /body instanceof FormData/u);
  assert.match(api, /\/admin\/media\/replace/u);
  assert.match(sitesAdmin, /listManagedMedia/u);
  assert.match(sitesAdmin, /writeIdentityAll[\s\S]*?"catalog\.write", "content\.write"/u);
  assert.match(sitesApi, /maximumMediaBytes = 5_000_000/u);
  assert.match(sitesApi, /MEDIA_OBJECT_IN_USE/u);
  assert.match(sitesApi, /media\.references\.replaced/u);
  assert.match(router, /isPublicMediaObjectKey/u);
  assert.match(sitesApi, /uploadKeyPattern/u);
  assert.match(model, /localRasterAsset/u);
  assert.match(model, /referencesByPath/u);
  assert.match(model, /mergeMediaInventory/u);
  assert.doesNotMatch(preview, /page === "media"|function MediaDesign|mediaAssets/u);
  assert.match(css, /\.media-detail-button\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
  assert.match(css, /\.media-kind-filter button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/u);
  assert.match(css, /\.media-reference-scroll\s*\{[^}]*overflow-x:\s*auto;/u);
  assert.match(css, /\.media-confirm-check\s*\{[^}]*min-height:\s*44px;/u);
});

test("安全事件页面只投影真实审计信号且不伪造威胁检测结论", () => {
  const app = read("apps/admin/src/App.tsx");
  const page = read("apps/admin/src/features/security-events/security-events-page.tsx");
  const model = read("apps/admin/src/features/security-events/model.ts");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/security-events\/security-events-page"\)\)/u);
  assert.match(app, /page === "security-events"[\s\S]*?<SecurityEventsPage/u);
  assert.match(page, /useCachedAdminResource<AuditEvent\[\]>\("audit"/u);
  assert.match(page, /最近 100 条审计记录/u);
  assert.match(page, /当前账号的其他会话可在安全中心手动撤销/u);
  assert.doesNotMatch(page, /安全评分|实时风险事件|已阻止行为/u);
  assert.match(model, /event\.result !== "DENIED"/u);
  assert.match(model, /securityActionProfiles/u);
  assert.doesNotMatch(preview, /page === "security-events"|SecurityEventsDesign/u);
  assert.match(page, /事件 ID[\s\S]*?追踪 ID[\s\S]*?发生时间/u);
  assert.match(page, /event\.requestId/u);
  assert.match(css, /\.security-event-table\s*\{[^}]*min-width:\s*1750px;/u);
  assert.match(css, /\.security-event-detail-button\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
});

test("安全中心使用真实 Valkey 会话并保持 Sites 身份边界", () => {
  const page = read("apps/admin/src/pages/security-page.tsx");
  const api = read("apps/admin/src/api.ts");
  const controller = read("apps/api/src/auth/auth.controller.ts");
  const auth = read("apps/api/src/auth/auth.service.ts");
  const sessions = read("apps/api/src/auth/session.service.ts");
  const css = read("apps/admin/src/styles.css");

  assert.match(page, /getAdminSessions/u);
  assert.match(page, /revokeAdminSession/u);
  assert.match(page, /revokeOtherAdminSessions/u);
  assert.match(page, /仅列出当前账号的服务端会话，不采集设备名称、IP 地址或浏览器指纹/u);
  assert.match(page, /密码与双重验证由 ChatGPT 管理/u);
  assert.doesNotMatch(page, /DesignWorkflowDialog|界面设计预览|Interface design preview/u);
  assert.match(api, /\/admin\/auth\/sessions/u);
  assert.match(controller, /@Get\("sessions"\)/u);
  assert.match(controller, /@Delete\("sessions\/:sessionId"\)/u);
  assert.match(controller, /@Post\("sessions\/revoke-others"\)/u);
  assert.match(auth, /The current session must use sign out/u);
  assert.match(auth, /auth\.session\.revoked/u);
  assert.match(auth, /auth\.sessions\.others_revoked/u);
  assert.match(sessions, /scanKeys\("admin-session:\*"\)/u);
  assert.match(
    sessions,
    /private async scanKeys\(pattern: string\)[\s\S]*?this\.redis\.scan\([\s\S]*?"MATCH"[\s\S]*?pattern/u,
  );
  assert.doesNotMatch(sessions, /\.keys\(/u);
  assert.match(css, /\.security-session-table\s*\{[^}]*min-width:\s*980px;/u);
  assert.match(css, /\.security-session-table-wrap\s*\{[^}]*overflow-x:\s*auto;/u);
  assert.match(css, /\.security-session-table \.admin-danger\s*\{[^}]*min-height:\s*44px;/u);
});

test("真实订单中心使用模块化列表、详情、权限和敏感信息边界", () => {
  const app = read("apps/admin/src/App.tsx");
  const page = read("apps/admin/src/pages/orders-page.tsx");
  const api = read("apps/admin/src/features/orders/api.ts");
  const filters = read("apps/admin/src/features/orders/order-filters.tsx");
  const table = read("apps/admin/src/features/orders/orders-table.tsx");
  const detail = read("apps/admin/src/features/orders/order-detail-dialog.tsx");
  const contact = read("apps/admin/src/features/orders/sensitive-contact-panel.tsx");
  const timeline = read("apps/admin/src/features/orders/order-timeline.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /canWrite=\{user\.permissions\.includes\("orders\.write"\)\}/u);
  assert.match(app, /canRevealContact=\{user\.permissions\.includes\("contacts\.reveal"\)\}/u);
  assert.match(page, /readOrderQuery\(window\.location\.search,\s*scope\)/u);
  assert.match(page, /window\.addEventListener\("popstate"/u);
  assert.match(page, /filtered[\s\S]*?没有符合当前筛选的订单/u);
  assert.match(filters, /statuses\.map/u);
  assert.match(filters, /assigneeId/u);
  assert.match(filters, /contactChannelTypes\.map/u);

  for (const path of [
    "/admin/orders?",
    "/admin/orders/assignees",
    "/status",
    "/assignment",
    "/reveal-contact",
  ]) {
    assert.match(api, new RegExp(path.replace(/[?]/gu, "\\?"), "u"));
  }

  for (const column of [
    "订单号", "创建时间", "商品", "金额", "币种", "参考金额", "参考币种",
    "渠道", "脱敏账号", "订单状态", "人工付款记录阶段", "负责人", "预留到期", "操作",
  ]) {
    assert.match(table, new RegExp(column, "u"), `${column} should remain a dedicated column`);
  }
  assert.match(table, /<table className="order-record-table">/u);
  assert.doesNotMatch(table, /revealAdminOrderContact|revealedContact/u);

  assert.match(detail, /getAdminOrderDetail/u);
  assert.match(detail, /data\.allowedTransitions\.map/u);
  assert.match(detail, /expectedStatus:\s*data\.status/u);
  assert.match(detail, /expectedAssigneeId:\s*data\.assignedTo/u);
  assert.match(detail, /error instanceof ApiError && error\.status === 409/u);
  assert.match(detail, /\{canWrite \?/u);
  assert.match(detail, /\{canRevealContact \?/u);
  assert.match(timeline, /events\.map/u);

  assert.match(contact, /revealDurationMs = 60_000/u);
  assert.match(contact, /document\.hidden/u);
  assert.match(contact, /visibilitychange/u);
  assert.match(contact, /reason\.trim\(\)/u);
  assert.doesNotMatch(contact, /localStorage|sessionStorage|useCachedAdminResource|notify\(/u);

  assert.match(css, /\.order-record-table\s*\{[^}]*min-width:\s*1860px;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.order-record-table th:first-child/u);
  assert.match(css, /\.row-action\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
});
