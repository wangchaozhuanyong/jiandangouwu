# CloudBridge 测试、证据与发布规则

## 证据等级

| 证据 | 可以证明 | 不能证明 |
| --- | --- | --- |
| 静态检查 | 规则、结构和部分代码约束成立 | 页面可用、业务真实成功 |
| 单元测试 | 被覆盖函数在测试输入下符合预期 | 完整用户流程或外部系统可用 |
| 本地构建 | 当前源码可以生成静态产物 | 已部署、生产配置正确 |
| 本地浏览器验收 | 指定设备和语言下的界面行为 | 生产性能、真实支付或通知 |
| 测试环境联调 | 指定环境中的前后端流程 | 生产环境已发布 |
| 生产可见证据 | 已核对的生产结果 | 未覆盖路径长期无故障 |

报告只能使用实际达到的证据等级。缺失、过期或仅模拟的数据不能写成通过。

## 当前自动检查

```bash
npm run check:rules
npm run test:catalog
npm run test:i18n
npm run test:ux
npm run test:security
npm run test:admin-tables
npm run test:brand
npm run test:platform
npm run test:api
npm run test:storefront
npm run build
npm run test:sites
npm run typecheck:platform
npm run build:platform
npm run synth --workspace @cloudbridge/infra -- --no-lookups
npm audit --omit=dev
npm run check
```

GitHub 上的 `.github/workflows/ci.yml` 对所有指向 `main` 的 PR、`main` 推送和手动触发执行以下门禁：

- 使用 Node.js 24 和锁文件执行 `npm ci`、`npm run check` 与无查找的 CDK `synth`。
- `npm audit --omit=dev --audit-level=critical` 阻止新增 critical 运行依赖漏洞，同时在日志中持续公开现有 high 公告。
- 分别构建 API、管理后台和客户端的生产容器镜像，防止源码构建通过但 Dockerfile 已失效。
- GitHub 官方 Actions 固定到已核对的提交 SHA，工作流权限保持为只读。

CI 通过仍不表示可以直接上线。现有 high 公告继续由下面的 AWS staging 发布门禁阻断，不能因为 CI 只对 critical 设置自动失败阈值而被视为接受风险。

- `check:rules`：检查规则文件、文档链接、技术栈约束和环境变量示例。
- `test:catalog`：检查商品搜索、分类组合、顺序和浏览器存储容错。
- `test:i18n`：检查双语键完整性及固定文案不串用。
- `test:ux`：检查联系信息、订单摘要、页面恢复和可取消异步逻辑。
- `test:security`：检查公开订单查询已移除、后台认证/MFA 边界、托管支付无卡片字段和机密值脱敏。
- `test:admin-tables`：检查后台结构化数据表的单行记录、独立字段列和移动端横向滚动约束。
- `test:brand`：检查前后台所有品牌区域复用同一 Logo、移除副标题并保持原始宽高比。
- `test:platform`：检查主平台技术栈、MySQL 约束、双语订单、认证安全边界和 AWS 高可用模板。
- `test:api`：检查 DTO、领域服务、权限依赖、幂等、并发条件写入、事务审计和敏感字段边界。
- `test:storefront`：检查联系渠道动作、接单可用性、订单输入边界及客户端纯逻辑。
- `prepare:platform`：先构建共享契约并生成 Prisma Client，保证新克隆仓库没有依赖本机遗留构建产物。
- `build`：生成遗留 Vite 与 Sites 兼容产物。
- `build:sites`：构建 `apps/sites` 的完整 Vinext/D1/R2 平台，并把该产物同步到根级 `dist/` 作为唯一正式 Sites 发布包；发布前必须确认其中包含后台客户端和全部 D1 migration，禁止直接打包遗留 Vite 产物。
- `test:sites`：检查静态 Worker 路由以及构建产物完整性；应在构建后运行。
- `typecheck:platform`：检查共享契约、API、Next.js 客户端、Vite 后台和 CDK。
- `build:platform`：构建全部主平台工作区。
- `cdk synth`：只生成 CloudFormation 模板，不创建 AWS 资源。
- `npm audit --omit=dev`：检查运行依赖安全公告；只要仍有 high/critical 就不得把本地通过描述为可直接上线。
- `check`：按安全顺序执行遗留门禁、主平台架构测试、类型检查和主平台构建。

## 按改动选择测试

- 文案、本地化、标题和无障碍标签：`test:i18n` 加中英文浏览器检查。
- 商品、分类和搜索：`test:catalog` 加桌面与移动端商品区检查。
- 媒体引用清单：验证商品全分页、轮播聚合、相同路径去重但保留全部数据库引用、安全本地栅格路径、类型与双语搜索、局部读取权限、图片加载错误和详情内部表格滚动；断言页面没有上传、替换、删除、文件字节或对象存储操作。
- 管理员账号生命周期：验证 `team.manage`、最近认证、原因、确认、`updatedAt` CAS、Serializable 事务与同事务审计；覆盖自操作拒绝、最后一名正常超级管理员保护、无密码账号不能启用、状态转换、TOTP 密钥不进入响应/审计，以及目标成员全部 Valkey 会话和 TOTP 登录/绑定流程撤销。真实闭环运行 `npm run verify:admin-lifecycle --workspace @cloudbridge/api`，并要求随机 QA 用户、审计和认证状态最终清理为 0。
- 角色生命周期：验证 `roles.manage`、最近认证、原因、确认、角色键规范化与不可变、真实权限存在性、`updatedAt` CAS、Serializable 事务和同事务审计；覆盖 `SUPER_ADMIN` 全生命周期保护、有成员角色删除失败、空角色删除和外键权限关系清理。真实闭环运行 `npm run verify:role-lifecycle --workspace @cloudbridge/api`，依次创建、修改资料、修改权限、验证成员门禁并删除随机 QA 角色，最终要求 QA 用户、角色和审计全部清理为 0。
- 下单、联系渠道和订单凭证：`test:ux` 加成功、失败、取消和恢复流程。
- 人工售后订单视图：验证 `/admin/disputes` 只展示 `REFUND_PENDING`、`REFUNDED`、`DISPUTED`，读取要求 `orders.read`、写入要求 `orders.write`，合法状态来自服务端，并覆盖 CAS 冲突、事务历史与审计、只读降级、空状态和错误状态。
- 人工收款记录：验证 `/admin/payments` 只投影 `OrderStatusHistory.toStatus` 为 `PAID`、`REFUND_PENDING`、`REFUNDED`、`DISPUTED` 的稳定事件，读取要求 `orders.read`，所有事件返回 `externalActionVerified: false`，页面和 API 均无事件写入、删除或补写入口。
- Telegram 新订单通知准备：验证 `notifications.telegram.new-order` 只保存非密钥白名单配置；GET 使用 `settings.read`，PUT 使用 `settings.write`、五分钟最近认证、原因、CAS 与 Serializable 事务审计；服务端始终派生未连接、未有效启用、未配置 Token 和未外部核验。
- 通知就绪中心：验证 `/admin/notifications` 只有 `settings.read` 才请求现有 Telegram 配置，页面只显示真实未连接状态、未来意向、白名单与上线门禁；断言旧虚构通知、未读数、追踪编号、处理按钮和预览工作流已经删除，未建立投递事件存储时使用 `NOT_COLLECTED` 而不是零。
- 数据安全就绪中心：验证 `/admin/data-security` 只组合当前会话、已实现代码控制和受 `audit.read` 保护的最近审计 GET；无权限时不得请求或泄露审计记录，旧 30/365/90 天保留值、设备数据、运行日志、不可变结论和策略检查流程必须删除，治理缺口分别使用 `NOT_DEFINED`、`NOT_IMPLEMENTED`、`NOT_CONNECTED`。
- 审计日志工作台：验证 `GET /v1/admin/audit` 的 Prisma 计数与列表复用同一服务端筛选条件，使用显式白名单投影且不选择 `beforeData`、`afterData`、`ipHash` 或 `actorId`；Sites 使用真实 SQLite migration 覆盖分页、关键词字面匹配、结果/来源/目标/时间筛选、目标类型分面、无缓存和非法参数失败。`POST /v1/admin/audit/export` 额外覆盖 `audit.read`、CSRF、8–500 字符原因、精确确认、MySQL 五分钟最近认证、5,000 条上限、成功/拒绝审计、UTF-8 BOM、引号转义和公式注入防护；Sites 身份必须标记为 ChatGPT 平台托管而不是伪造应用内重新认证时间。后台覆盖 URL 恢复、30 条分页、双语、安全导出弹层、不可逆影响说明、超限与错误状态。
- 本地 MySQL 审计导出闭环运行 `npm run verify:audit-export --workspace @cloudbridge/api`：脚本创建随机 QA 管理员与含公式前缀/隐藏快照的审计事件，真实生成 CSV，确认隐藏载荷不进入文件、公式前缀被中和、成功与最近认证拒绝审计可回读，并在 `finally` 精确删除 QA 管理员和全部关联审计，最终残留必须为 0。
- 工作台真实性：验证 `/admin/dashboard` 只使用 `Overview` 响应，未启用商品不出现负数，最近订单样本与时间来自已加载记录；到期预留显示 `IMPLEMENTED_REQUEST_DRIVEN`。库存风险必须由 MySQL 和 Sites 服务端全库查询返回 `IMPLEMENTED_LIVE_QUERY`，覆盖 `ACTIVE` 商品总数、固定阈值 3、库存数据冲突/售罄/低库存计数、前六项稳定优先样本和移动端内部表格滚动；通知和安全告警仍保持 `NOT_COLLECTED` 或 `NOT_IMPLEMENTED`。
- 分类影响与权限：验证 `/admin/categories` 只从现有分类响应统计关联商品、非启用、空分类、重复顺序和双语缺失；`catalog.write` 缺失时不挂载新增、编辑或保存入口，旧 `categories` 设计流程已删除。非启用/归档分类不能被描述为自动隐藏、移动或删除关联商品。
- 商品目录与库存影响：验证 `/admin/products` 在 MySQL 与 Sites 中使用相同的 30 条服务端分页、字面关键词、状态白名单、默认非归档范围、稳定排序和分页元数据；覆盖 URL 恢复、规范化序列化、前后页、越界页回正、空/错状态和非法参数失败。库存影响只统计当前结果页并与可用分类列表交叉检查，覆盖前台既有 0 售罄、1–3 低库存边界、双语缺失、库存数据冲突、分类导航状态和在售顺序重复。`catalog.write` 缺失时不挂载新增、编辑或保存入口，旧 `inventory-center` 设计流程必须删除，页面不得宣称全库库存、告警、库存流水、预留返库或发布历史。
- 机密配置就绪中心：验证 `/admin/secrets` 只投影 `.env.example`、API 和 CDK 中的六个稳定服务端绑定；断言前端绑定为 0、运行与轮换门禁保持关闭、旧 Stripe/数据库/Telegram 假密钥名、伪造后缀与轮换天数、查看/新增/轮换工作流已删除，并静态核对每个绑定都来自 `ecs.Secret.fromSecretsManager`。
- 备份就绪中心：验证 `/admin/backups` 只投影 Compose 中两个同机命名卷、Valkey AOF 与 CDK 中 RDS/Valkey 保护定义；断言本地卷为 `NOT_A_BACKUP`、AWS 为 `NOT_DEPLOYED`、恢复为 `NOT_PERFORMED`，旧 `BKP-*`、假容量/时间/健康/恢复结论、创建快照和恢复演练工作流已删除，且 1500px 单行表只在自身容器内横向滚动。
- 系统集成就绪中心：验证 `/admin/integrations` 只调用健康、币种和 Telegram 三个现有 GET；无 `catalog.read` / `settings.read` 时不发起对应受保护请求，API/MySQL/Valkey 只在本次探测标记 `RUNTIME_VERIFIED`，Telegram 为 `NOT_CONNECTED`、AWS 为 `NOT_DEPLOYED`，外部连接与后台任务均为 0；健康测试覆盖两个依赖并行、复用既有 Valkey 客户端、1500ms 超时和失败关闭；断言旧 99.99%、邮件重试、30 分钟汇率同步、假追踪编号/时间/成功和预览工作流已删除，1420px 单行表只在自身容器内横向滚动。
- 后台认证、支付、机密和敏感操作设计：`test:security` 加桌面与移动端浏览器检查。
- 后台数据表、记录列表和列结构：`test:admin-tables` 加桌面与 390px 浏览器检查。
- Worker、路由或构建：`build` 后运行 `test:sites`。
- Sites 订单预留：使用真实 SQLite migration 验证到期 `MANUAL_PENDING` 订单只取消一次、有限库存只返还一次、状态历史和审计各写一条，未到期预留不变。
- MySQL 订单预留：验证迁移将历史订单安全默认为未预留；新有限库存订单在扣减事务中写入预留标记；候选扫描最多 100 条；条件更新竞争失败不得返库、写历史或审计；自动到期和人工取消只返一次；状态、库存、历史和审计使用同一 Serializable 事务。使用隔离的本地 QA 数据完成真实扣减、到期、触发、返库和清理闭环。
- 本地 MySQL 闭环命令：在应用 migration 后运行 `npm run verify:order-reservations --workspace @cloudbridge/api`。脚本只创建带随机 `qa-reservation-*` 标识的分类、商品和订单，回读取消、库存、历史和审计后再次核对幂等，并在 `finally` 中按精确 ID 清理全部 QA 记录。
- 本地 MySQL 库存风险命令：运行 `npm run verify:inventory-risk --workspace @cloudbridge/api`。脚本先读取真实基线，再创建随机 `qa-inventory-*` 数据冲突、售罄、低库存和安全库存商品，验证全库计数增量、固定优先级和样本上限，并在 `finally` 中按精确 ID 清理且复核残留为 0。
- Sites 备份：使用真实 SQLite migration 与内存 R2 验证每日唯一快照、AES-GCM 密文、R2 回读、SHA-256、解密、逐表记录数、重新校验和禁止缓存下载。恢复测试必须覆盖主键/关联/JSON/加密联系方式逻辑验证、一次性 RSA-OAEP 转移包、内存 SQLite 全表导入与回读、`foreign_key_check`、限时令牌和 HMAC 完成证明；可选新 D1 候选必须核对 `0700/0600`、拒绝覆盖、SQL/验证文件 SHA-256、逐表清单，并把生成的 `restore.sql` 重新导入空 SQLite 验证。损坏关联、篡改记录数、错误证明或过期转移必须失败关闭，测试输出不得显示密钥或明文联系方式。五项异常门禁中，外部告警未真实送达时必须保持失败。
- 管理后台写入、权限或敏感信息：必须检查 API 权限、CSRF、审计、重新认证与失败路径。
- 管理员会话：单元测试必须覆盖旧记录兼容、损坏记录失败关闭、账号隔离、当前会话保护、单独撤销、批量撤销、审计和 `SCAN` 非 `KEYS`；本地交付还要运行 `npm --workspace @cloudbridge/api run verify:admin-sessions`，在真实 Valkey 创建随机 QA 会话、完成撤销闭环并复核残留为 0。测试和输出不得显示 Cookie Token。
- 金额、汇率、库存和人工订单：必须检查精度、边界、并发、幂等和非法状态转换。
- 售后页面不得用模拟申请金额、部分退款、证据、双人审批、支付商状态或资金成功补齐现有订单模型；自动检查应断言这些未实现能力没有被包装成真实结果。
- 人工收款页面必须断言没有实际到账、部分或多次付款退款、手续费税费、支付方式、外部 ID、凭证、结算批次、外部对账和跨币种总额；订单详情权限保持不变。
- 对账准备中心必须断言无 `orders.read` 时不发请求、全部分页去重、所有事件外部未核验、只按币种统计记录数、外部证据显示未采集、基础设施显示未开发，且不存在提供商批次、结算金额、差异、导出或任何写 API。
- Telegram simulation 必须断言只使用固定虚构订单和脱敏字段、`deliveryAttempted: false`、不接收或返回 Bot Token/Chat ID、不请求外部网络、不排队重试、不写发送记录；通知中心不得把 simulation 解释为真实发送证据。

## 完成定义

- 需求范围和非目标明确，未混入其他项目规则或无关重构。
- 当前已实现、当前模拟和未来规划没有混淆。
- 代码、文档、测试和 `.env.example` 保持一致。
- 受影响自动检查通过；界面改动完成桌面、390px、中英文和关键状态验收。
- 无硬编码秘密、真实个人信息或未经批准的新依赖。
- 最终报告列出改动、文件、命令结果、风险和后续事项。

## 发布门禁

- 当前已有本地后端和 AWS staging 模板，但尚未创建云资源；本地检查与 `synth` 通过不构成上线批准。
- Sites 生产 D1/R2 已创建并验证加密恢复点；恢复运行器可把真实生产快照导入一次性内存 SQLite，核对 15 张业务表、逐表记录数和外键，并用服务器验证的签名结果归档演练证据，也能生成面向新 D1 的受保护导入候选。候选仍不等于新 D1 已创建或远程导入，也不证明管理员登录、生产流量切换和回滚；开放真实订单前至少还要接通外部告警，并在执行覆盖恢复前完成独立 D1 切换演练。
- 2026-07-29 生产验收使用最新已验证快照完成隔离恢复：15 张表、77 条记录全部回读，`PRAGMA foreign_key_check` 返回 0；管理页恢复演练门禁为通过，外部告警门禁仍为失败，整体保持 `ATTENTION`。验收后必须删除本机临时私钥、请求、转移和完成证明文件。
- 2026-07-29 已升级 `@cloudflare/vite-plugin` 1.48.0、`wrangler` 4.115.0、`tsx` 4.23.1、根级 `esbuild` 0.28.1、`postcss` 8.5.25 与 `aws-cdk-lib` 2.262.2，消除了 Cloudflare 开发链中的 `ws`、`undici`、旧 `miniflare/sharp` 和错误 esbuild 去重；随后用受支持的 npm override 把 Nest Swagger 的 `js-yaml` 从 5.2.1 提升到 5.2.2。依赖审计现有 4 项 high：Next.js 16.2.12 稳定最新版内部锁定的 `postcss` 8.4.31 / `sharp` 0.34.5，以及 AWS CDK bundle 中的 `brace-expansion` 5.0.7。Next 与 CDK 当前均无可直接升级的稳定补丁，bundled 依赖也不能由 npm override 替换；不得破坏性降级或强制覆盖来伪造清零。Sites 已停用当前 Logo 的 Next 图片优化并只处理仓库自有 CSS，这属于暴露面缓解而不是漏洞修复；继续公开运营期间必须跟踪稳定上游补丁或完成逐项风险批准。
- AWS staging 创建前必须确认费用、域名、证书、迁移命令、删除保护和回滚；生产前再单独完成恢复、权限、安全、监控和真实集成验收。
- 提交、推送、创建 PR、部署和生产变更只在用户明确授权后执行。
