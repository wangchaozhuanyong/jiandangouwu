# CloudBridge 架构与技术路线

## 当前架构

- `apps/storefront`：Next.js 16、React 19、TypeScript、原生 CSS。客户端无账户、无购物车，通过 API 浏览分类、搜索商品、切换币种并提交一种联系方式。
- `apps/admin`：React 19、Vite 8、TypeScript、原生 CSS。独立管理入口，使用邮箱与密码登录，并支持默认关闭的可选 TOTP 双重验证。
- `apps/api`：NestJS 11、Prisma 7、MySQL 8.4。负责输入验证、目录查询、模糊搜索、金额与汇率、订单幂等、状态转换、RBAC 和审计。
- `packages/contracts`：跨客户端、后台和 API 的稳定类型与枚举，不包含页面状态。
- `infra`：AWS CDK，固定新加坡区域的 ECS Fargate、ALB、WAF、RDS MySQL Multi-AZ、ElastiCache Valkey、Secrets Manager、S3 日志与 CloudWatch。
- `src/`、`worker/` 与 Sites 构建仍保留为遗留 Vite 6 原型，只用于对照和兼容，不再是主平台数据源。

## 当前运行边界

- 本地 Docker Compose 提供 MySQL 与 Valkey；Prisma migration 和 seed 已可重复运行。
- 本地 API 已持久化目录、订单、认证与审计数据；联系值使用 AES-GCM 加密，后台列表默认只返回脱敏值。
- AWS CDK 已能 `synth`，但没有执行 `deploy`，所以 RDS、ECS、ALB、WAF、域名和证书仍属于未来规划/待创建资源。
- Telegram、在线支付、真实通知、对象存储媒体管线和生产恢复演练尚未实现。

## 模块边界

- 客户端不得导入后台页面、后台权限或后台任务逻辑；后台不得依赖客户端页面组件完成业务写入。
- 可以共享纯领域类型、稳定枚举、本地化结构、金额格式化和无副作用校验，不共享页面状态。
- 页面组件不直接决定业务成功。真实写入必须通过 API，由 API 返回稳定结果和错误码。
- 数据访问、业务规则和界面表现分层；不得在 JSX 文案或 CSS 类名中编码业务状态判断。
- 外部集成通过明确适配层接入，失败、重试和未连接状态不能伪装为成功。
- 订单领域集中在 `apps/api/src/orders`：公开下单与后台订单管理使用独立 Controller，共享联系方式保护和订单持久化，但后台路由不再堆放在通用 `admin` 服务中。
- 后台订单界面集中在 `apps/admin/src/features/orders`：API 客户端、筛选、单行表、详情、时间线和敏感联系方式各自负责单一职责，页面入口只组合模块并传入权限。
- 订单状态机的唯一可信来源是 API；后台通过 `allowedTransitions` 渲染下一步，不复制一份可写状态转换表。
- `/admin/disputes` 是订单模块上的人工售后投影视图，只筛选 `REFUND_PENDING`、`REFUNDED`、`DISPUTED` 订单，并复用订单详情、负责人、时间线、`orders.read` / `orders.write`、CAS 和事务审计；它不建立第二套售后状态机。
- 独立退款申请、部分退款、申请金额、证据、双人审批、支付商事件和真实资金流水属于未来独立领域。未批准数据库与权限设计前，不得把这些字段塞入订单状态原因或前端本地数据。
- `/admin/payments` 是订单状态历史上的只读人工事件投影：只选择 `OrderStatusHistory.toStatus` 为 `PAID`、`REFUND_PENDING`、`REFUNDED`、`DISPUTED` 的记录，使用状态历史 ID 作为稳定事件 ID，不提供事件更新或删除能力。
- 人工收款列表复用订单领域的金额快照、汇率快照、操作者和 `orders.read` 权限；详情入口仍进入订单模块并执行原有订单权限。该投影视图不得反向成为订单状态、支付结果或财务余额的可信来源。
- 支付流水、会计分录、实际到账、部分或多次付款退款、费用税额、支付方式、外部事件、凭证、结算批次、对账与跨币种报表仍属于未实现领域；`/admin/reconciliation` 继续使用明确标识的设计预览。
- Telegram 新订单通知准备复用现有 `SiteSetting`，以 `notifications.telegram.new-order` 保存版本化非密钥配置；不新增 Prisma 模型，不把 Bot Token、Chat ID 或发送记录编码进 JSON 配置。
- 服务端是连接真实性的唯一来源：无论 `requestedEnabled` 为何，都固定派生 `NOT_CONNECTED`、`effectiveEnabled: false`、`tokenConfigured: false`、`externalDeliveryVerified: false`。未来真实适配器接入前，前端不得覆盖这些字段。
- 模拟预览是无外部副作用的服务端纯投影，只接受配置字段并使用固定虚构订单；它不复用真实订单查询，不创建事件、队列、重试或发送记录。`/admin/notifications` 继续走设计预览模块。

## 语言与迁移策略

- 新增业务模块使用 `.ts`/`.tsx` 并纳入工作区类型检查。
- 遗留 `.js`/`.jsx` 只在维护兼容原型时逐步迁移；不与主平台反向耦合。
- 类型必须覆盖公共函数参数、接口请求与响应、稳定状态码和持久化数据；避免无边界的 `any`。
- 样式继续使用现有 CSS 体系。除非明确批准，不更换 UI 框架或引入新的样式系统。

## 管理后台导航迁移规范

根目录遗留原型与正式主平台 `apps/admin` 采用同一九入口结构。设计优先阶段允许正式后台展示全部 24 个已批准页面，但未接入 API 的页面必须显示持续可见的“界面设计预览 / Interface design preview”标识，只使用模拟数据，并明确不修改服务器。设计可点击不等于功能已实现。

| 一级入口 | 类型 | 页面 ID |
|---|---|---|
| 工作台 / Workspace | 直接入口 | `dashboard` |
| 订单与售后 / Orders & after-sales | 单开分组 | `orders`、`disputes` |
| 商品管理 / Catalog management | 单开分组 | `products`、`categories` |
| 内容与展示 / Content & storefront | 单开分组 | `banners`、`media`、`translations` |
| 客服与通知 / Support & notifications | 单开分组 | `contacts`、`notifications`、`telegram-bot` |
| 财务与结算 / Finance & settlement | 单开分组 | `currencies`、`payments`、`reconciliation` |
| 成员与权限 / Team & access | 单开分组 | `team`、`roles` |
| 安全与合规 / Security & compliance | 单开分组 | `security`、`security-events`、`data-security`、`secrets` |
| 系统与运维 / Systems & operations | 单开分组 | `logs`、`backups`、`integrations`、`settings` |

- 24 个页面 ID 各出现一次，一级入口按日常使用频率排序，每组最多四项。
- 工作台直接进入 `/admin/dashboard` 并关闭已展开分组；进入其他页面时自动展开其唯一所属分组，同一时间最多展开一组。
- 保持页面 ID、`/admin/:page` 路由、固定工作台标签、会话内工作区标签、权限边界和接口契约不变。
- 导航结构属于界面层信息架构，不得反向写入共享领域类型、API、数据库或权限判断。
- 桌面端保持 276px/72px 展开与收起结构；移动端复用同一信息架构，选择入口后关闭抽屉，所有一级、二级和工作区标签完整显示且不使用省略号。

## 计划中的公共数据约定

```ts
type LocalizedText = {
  zh: string;
  en: string;
};

type Money = {
  amount: string;
  currency: string;
};
```

- `LocalizedText` 两种语言必须同时存在，当前语言缺失时不得回退显示另一种语言。
- `Money.amount` 是十进制字符串；币种代码使用稳定的大写代码。
- 订单、付款、库存、通知和集成状态使用稳定英文枚举码，显示文案另行本地化。
- 列表 API 在数据规模需要时统一支持 `page`、`pageSize`、`search`、`sortBy` 和 `sortOrder`；小型固定配置不得为了形式强加无意义分页。

## AWS 目标拓扑

```text
Route 53 / ACM → WAF → ALB → ECS Fargate（客户端 / 后台 / API，各至少 2 任务）
                              ├→ RDS MySQL 8.4 Multi-AZ
                              ├→ ElastiCache Valkey 双节点（会话与 TOTP 登录/绑定流程）
                              ├→ Secrets Manager（数据库、会话、字段加密）
                              ├→ S3（ALB 访问日志）
                              └→ CloudWatch（应用日志、指标与告警）
```

- `infra/` 已实现以上 staging 模板并通过本地 `cdk synth`；这不代表 AWS 资源存在。
- ALB、应用任务、数据库、缓存和队列位于受控网络边界；RDS 不暴露公网入口。
- 管理员认证使用邮箱与密码，管理员可选择开启 TOTP 第二步；会话使用 `HttpOnly`、`Secure`、`SameSite` Cookie，浏览器存储不得持有后台 Token。
- 数据库启用静态加密、自动备份、时间点恢复和定期隔离恢复演练；备份成功不等于恢复可用。
- 机密值只存入 Secrets Manager，并由 KMS、最小权限 IAM、轮换策略和审计事件保护。
- 部署前必须提供新加坡区域 ACM 证书、staging 域名、受控首位管理员创建流程，并确认月度费用。
