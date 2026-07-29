# CloudBridge 架构与技术路线

## 当前架构

- `apps/sites`：当前 Sites 生产运行面，使用 Vinext/Next、D1、R2 与 ChatGPT 登录。公开商品、人工订单和管理后台共用 D1；R2 保存媒体对象以及 AES-256-GCM 加密的 D1 快照。
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
- MySQL 主平台的 Telegram、在线支付、真实通知、对象存储媒体管线和生产恢复演练尚未实现；Sites 的 R2 媒体与加密 D1 恢复证据属于另一运行面。

## MySQL 与 Sites 订单预留

- MySQL `Order` 以 `inventoryReserved` 明确保存该订单是否真实扣过有限库存，并以 `inventoryReleasedAt` 作为只返一次的释放门禁；迁移对历史订单默认写入 `false`，不会根据商品当前库存模式猜测历史扣减。
- 新有限库存订单的扣减、预留标记和初始历史保持在同一 Serializable 事务。商品列表/详情、下单、后台总览及订单读写会先扫描最多 100 条到期 `MANUAL_PENDING` 预留；每张订单通过 Serializable 事务和条件更新竞争唯一取消权，取消、返库、历史和 `order.reservation.expired` 审计共同提交或回滚。
- 自动核对采用保守范围：只处理仍为 `MANUAL_PENDING` 的有限库存预留；`CONTACTED`、`AWAITING_PAYMENT`、`PAYMENT_PROCESSING` 及后续状态不因截止时间自动取消。管理员通过合法状态机人工取消仍未释放的预留时，同一事务最多返还一次。
- MySQL 当前采用请求驱动核对，不把它描述为 Cron、队列或无人值守后台任务。最多 100 条的批次让请求延迟有界，后续商品或订单访问继续处理剩余候选。

- 有限库存下单会立即扣减并记录 30 分钟 `reserved_until`。Sites 在商品列表、商品详情、下单、后台总览和订单访问前核对到期的 `MANUAL_PENDING` 订单；状态历史、取消、库存返还和审计使用唯一历史事件作为幂等门禁，同一订单不会重复返库。
- Sites 不依赖尚未开放的 Cron 触发器。只要新的商品或订单请求到达，到期预留会先完成核对，因此用户看到和再次下单使用的是已释放后的库存。
- 每日 D1 备份由前台配置或后台就绪请求触发并使用 `daily:YYYY-MM-DD` 唯一键去重。固定业务表通过单个 D1 batch 读取，序列化后在 Worker 内加密并写入 R2；成功记录包含记录数、字节数、SHA-256 与校验时间。
- 备份下载始终是密文。后台“重新校验”证明 R2 对象可读取、校验和一致、密钥可解密且逐表记录数一致；“验证恢复包”进一步检查主键、外键式关联、JSON 文档和订单联系方式密文，但不会向当前 D1 写入任何业务记录。
- 备份异常状态由最近 26 小时已验证备份、今日自动备份、七日失败/卡住记录和七日恢复包逻辑验证四个门禁派生。它是管理页内的运行信号，外部邮件、短信和 Telegram 告警仍未连接；逻辑验证也不代表已执行隔离 D1 恢复，覆盖恢复仍要求独立数据库、维护窗口和回滚批准。

## 模块边界

- 客户端不得导入后台页面、后台权限或后台任务逻辑；后台不得依赖客户端页面组件完成业务写入。
- 可以共享纯领域类型、稳定枚举、本地化结构、金额格式化和无副作用校验，不共享页面状态。
- 页面组件不直接决定业务成功。真实写入必须通过 API，由 API 返回稳定结果和错误码。
- 数据访问、业务规则和界面表现分层；不得在 JSX 文案或 CSS 类名中编码业务状态判断。
- 外部集成通过明确适配层接入，失败、重试和未连接状态不能伪装为成功。
- 订单领域集中在 `apps/api/src/orders`：公开下单与后台订单管理使用独立 Controller，共享联系方式保护和订单持久化，但后台路由不再堆放在通用 `admin` 服务中。
- 后台订单界面集中在 `apps/admin/src/features/orders`：API 客户端、筛选、单行表、详情、时间线和敏感联系方式各自负责单一职责，页面入口只组合模块并传入权限。
- 成员与角色权限集中在 `apps/api/src/access` 和 `apps/admin/src/features/access`：复用现有 RBAC 关系表，不引入第二套角色数据；成员列表使用显式安全投影，不返回密码派生、TOTP 密钥、锁定计数或其他认证内部字段。
- access 写入使用最近认证、业务原因、客户端确认、`updatedAt` CAS、Serializable 事务和同事务审计；自改角色、最后一名正常超级管理员降权及 `SUPER_ADMIN` 权限变更在服务端失败关闭。
- 后台会话仍存于 Valkey，但守卫在每次受保护请求从 MySQL 重新派生账号状态与权限，并在变化时同步会话快照；权限缓存不能成为撤销授权后的继续访问依据。
- 双语内容工作台集中在 `apps/admin/src/features/translations`：前端按当前账号已有读取权限聚合商品、分类、首页轮播、客服渠道和站点设置，并将编辑结果交回各自所属 API；不新增后端聚合接口、通用翻译表或跨领域写权限。
- 翻译条目保留所属实体与版本快照，保存继续使用各模块 CAS 和安全约束。列表完整度、筛选与搜索只是前端派生状态，不是新的持久化数据源。
- 工作台真实性模型集中在 `apps/admin/src/features/dashboard`：只从现有 `Overview` 响应派生未启用商品、最近订单样本与最近订单时间，并以固定能力码声明未采集或未开发的提醒边界；不新增聚合 API、告警表或后台任务。
- 工作台任务入口只导航到现有订单、商品、通知和安全事件页面。目标页的权限与证据边界保持独立，导航成功不能反向证明提醒、检测或投递服务已经运行。
- 分类影响模型集中在 `apps/admin/src/features/categories`：只从现有 `AdminCategory[]` 派生启用/非启用数量、已加载商品关联、空分类、重复顺序和双语缺失信号，不创建第二套排序状态或商品影响接口。
- 分类列表读权限继续使用 `catalog.read`，新增和编辑入口只在会话拥有 `catalog.write` 时挂载；服务端 POST/PATCH 权限仍是最终边界。分类状态变化不会级联修改商品，页面必须在保存前说明公开筛选导航与关联商品的不同影响。
- 商品影响模型集中在 `apps/admin/src/features/products`：只从当前 `AdminProduct[]` 搜索切片和可用的 `AdminCategory[]` 派生在售、库存模式、售罄、前台低库存标签、双语/库存冲突、分类导航状态和重复顺序，不创建库存聚合、告警、发布或流水接口。
- 商品页面读权限继续使用 `catalog.read`，新增和编辑入口只在会话拥有 `catalog.write` 时挂载；服务端 POST/PATCH 权限仍是最终边界。商品 GET 与分类 GET 是独立读取，页面不得将其描述为事务快照或全库库存。
- 媒体引用清单集中在 `apps/admin/src/features/media`：前端按权限调用现有分页商品 API 与首页轮播 API，读取全部获准记录后按精确 `imageKey` 聚合；不新增媒体表、共享契约、后端聚合端点或存储依赖。
- 媒体页面只接受 `/assets/` 下的安全栅格路径作为可预览本地资源，并由浏览器报告本次加载与像素尺寸。它不扫描文件系统、文件字节、未引用资源、对象存储或 CDN，且没有上传、替换、删除和优化管线。
- 审计日志查询与 URL 模型集中在 `apps/admin/src/features/audit`，页面入口只组合服务端分页元数据、筛选、目标类型分面、单行表与安全详情。通用 `AdminService.auditEvents` 使用 Prisma `where` 和显式字段投影，Sites 使用参数绑定的 D1 查询；禁止依赖前端 TypeScript 类型隐藏数据库中的 `beforeData`、`afterData`、`ipHash` 或内部操作者 ID。
- 审计读取支持完整匹配历史的服务端分页、关键词、结果、来源、目标类型和时间范围筛选；商品管理读取支持完整目录的服务端分页、字面关键词和状态筛选。两者都要求 MySQL 计数与列表复用同一条件，并由 Sites 返回相同语义。安全事件和数据安全页面仍只读取第一页最多 100 条作为近期投影；差异授权、导出、不可变归档和保留策略需要单独设计。
- 安全事件工作台集中在 `apps/admin/src/features/security-events`：复用受 `audit.read` 保护的现有审计 API，在前端以确定性规则筛选和分级最近 100 条审计记录；不新增安全事件表、检测服务、写接口或权限码。
- 安全事件投影只把登录、授权、敏感数据查看、关键配置和所有拒绝记录视为安全信号。分级用于人工复核排序，不能反向成为攻击、阻止、处置或外部核验的证据。
- 数据安全就绪中心集中在 `apps/admin/src/features/data-security`：模型组合当前管理员安全投影、现有审计 GET 和仓库已实现代码控制；没有 `audit.read` 时审计证据失败关闭，但非敏感代码边界仍可见。
- 数据安全模块不拥有 API、数据库表、权限码或写入。它把代码控制与治理门禁分离，不得从本地环境变量、普通 MySQL 审计或前端文案推断已批准保留期、删除完成、不可变存储、KMS、备份或合规认证。
- 机密配置就绪中心集中在 `apps/admin/src/features/secrets`：纯前端模型只映射 `.env.example`、API 代码和 CDK 中的稳定机密名称、来源、ECS 注入边界与上线门禁，不读取环境变量、Secrets Manager、值、后缀、版本或轮换时间，也不新增后端接口、权限码、表或写操作。
- 当前 CDK 定义 RDS 生成凭据、Valkey 认证、会话和应用加密四个机密来源，并把六个生产绑定只注入 API ECS 任务、只向其 Task Role 授予读取权限；管理后台和客户端任务没有机密绑定。该定义不是 AWS 已部署证据，运行时元数据、轮换、密钥数据域分离、客户管理 KMS 和处置回滚仍是关闭门禁。
- 备份就绪中心集中在 `apps/admin/src/features/backups`：纯前端模型只映射 Compose 命名卷、Valkey AOF 和 CDK 中 RDS/Valkey 保护定义，不调用 API、Docker、文件系统或 AWS，不新增数据库表、权限码、依赖、环境变量或写操作。
- 备份模型把“持久化配置”“备份运行状态”和“恢复证据”拆成独立枚举。同机命名卷固定为 `NOT_A_BACKUP`，未部署的 AWS 定义固定为 `NOT_DEPLOYED`；只有未来受保护运行清单与隔离演练可以改变运行和恢复结论。
- 系统集成就绪中心集中在 `apps/admin/src/features/integrations`：页面组合公开 `GET /v1/health`、受 `catalog.read` 保护的币种 GET、受 `settings.read` 保护的 Telegram 配置 GET 和纯前端仓库边界模型，不新增聚合接口、表、权限码、依赖或写操作。
- `GET /v1/health` 并行执行 MySQL `SELECT 1` 与 `SessionService.assertAvailable()`，复用管理员会话已有的唯一 Valkey 客户端而不创建第二条连接；每项探测都有 1500ms 响应等待上限，任一失败或超时统一返回 503。
- 集成模型把运行探测、仓库配置、外部连接、后台任务和云部署拆成稳定状态。API、MySQL 与 Valkey 只有本次请求可标记 `RUNTIME_VERIFIED`；Telegram 为 `NOT_CONNECTED`，本地媒体为 `IMPLEMENTED_LOCAL`，AWS 为 `NOT_DEPLOYED`，缺少运行时的任务为 `NOT_IMPLEMENTED`。
- 订单状态机的唯一可信来源是 API；后台通过 `allowedTransitions` 渲染下一步，不复制一份可写状态转换表。
- `/admin/disputes` 是订单模块上的人工售后投影视图，只筛选 `REFUND_PENDING`、`REFUNDED`、`DISPUTED` 订单，并复用订单详情、负责人、时间线、`orders.read` / `orders.write`、CAS 和事务审计；它不建立第二套售后状态机。
- 独立退款申请、部分退款、申请金额、证据、双人审批、支付商事件和真实资金流水属于未来独立领域。未批准数据库与权限设计前，不得把这些字段塞入订单状态原因或前端本地数据。
- `/admin/payments` 是订单状态历史上的只读人工事件投影：只选择 `OrderStatusHistory.toStatus` 为 `PAID`、`REFUND_PENDING`、`REFUNDED`、`DISPUTED` 的记录，使用状态历史 ID 作为稳定事件 ID，不提供事件更新或删除能力。
- 人工收款列表复用订单领域的金额快照、汇率快照、操作者和 `orders.read` 权限；详情入口仍进入订单模块并执行原有订单权限。该投影视图不得反向成为订单状态、支付结果或财务余额的可信来源。
- `/admin/reconciliation` 是相同人工事件 API 上的只读前端准备投影：在 `orders.read` 边界内遍历全部分页，按事件类型和原始币种统计记录数，最多展示八条最近内部记录，并把缺失外部证据与未开发基础设施分开呈现；它不新增 API、表、写入或财务计算。
- 支付流水、会计分录、实际到账、部分或多次付款退款、费用税额、支付方式、外部事件、凭证、结算批次、外部对账、差异处理与跨币种报表仍属于未实现领域。
- Telegram 新订单通知准备复用现有 `SiteSetting`，以 `notifications.telegram.new-order` 保存版本化非密钥配置；不新增 Prisma 模型，不把 Bot Token、Chat ID 或发送记录编码进 JSON 配置。
- 服务端是连接真实性的唯一来源：无论 `requestedEnabled` 为何，都固定派生 `NOT_CONNECTED`、`effectiveEnabled: false`、`tokenConfigured: false`、`externalDeliveryVerified: false`。未来真实适配器接入前，前端不得覆盖这些字段。
- 模拟预览是无外部副作用的服务端纯投影，只接受配置字段并使用固定虚构订单；它不复用真实订单查询，不创建事件、队列、重试或发送记录。
- `/admin/notifications` 是 `settings.read` 保护的只读前端投影，复用 Telegram 配置 API 与会话缓存，把当前配置映射为真实路由快照、阻塞门禁和 `NOT_COLLECTED` 投递证据状态；它不新增后端领域、写接口或投递能力。

## 语言与迁移策略

- 新增业务模块使用 `.ts`/`.tsx` 并纳入工作区类型检查。
- 遗留 `.js`/`.jsx` 只在维护兼容原型时逐步迁移；不与主平台反向耦合。
- 类型必须覆盖公共函数参数、接口请求与响应、稳定状态码和持久化数据；避免无边界的 `any`。
- 样式继续使用现有 CSS 体系。除非明确批准，不更换 UI 框架或引入新的样式系统。

## 管理后台导航迁移规范

根目录遗留原型与正式主平台 `apps/admin` 采用同一九入口结构。正式后台全部 24 个批准页面现已由专属真实页或明确受限页承载，独立设计预览组件已删除；没有后端能力的页面直接展示稳定的未开发、未连接、未部署或无权限状态，不得用模拟成功补齐功能。

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
