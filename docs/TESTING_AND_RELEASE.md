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
- `test:sites`：检查静态 Worker 路由以及构建产物完整性；应在构建后运行。
- `typecheck:platform`：检查共享契约、API、Next.js 客户端、Vite 后台和 CDK。
- `build:platform`：构建全部主平台工作区。
- `cdk synth`：只生成 CloudFormation 模板，不创建 AWS 资源。
- `npm audit --omit=dev`：检查运行依赖安全公告；只要仍有 high/critical 就不得把本地通过描述为可直接上线。
- `check`：按安全顺序执行遗留门禁、主平台架构测试、类型检查和主平台构建。

## 按改动选择测试

- 文案、本地化、标题和无障碍标签：`test:i18n` 加中英文浏览器检查。
- 商品、分类和搜索：`test:catalog` 加桌面与移动端商品区检查。
- 下单、联系渠道和订单凭证：`test:ux` 加成功、失败、取消和恢复流程。
- 人工售后订单视图：验证 `/admin/disputes` 只展示 `REFUND_PENDING`、`REFUNDED`、`DISPUTED`，读取要求 `orders.read`、写入要求 `orders.write`，合法状态来自服务端，并覆盖 CAS 冲突、事务历史与审计、只读降级、空状态和错误状态。
- 人工收款记录：验证 `/admin/payments` 只投影 `OrderStatusHistory.toStatus` 为 `PAID`、`REFUND_PENDING`、`REFUNDED`、`DISPUTED` 的稳定事件，读取要求 `orders.read`，所有事件返回 `externalActionVerified: false`，页面和 API 均无事件写入、删除或补写入口。
- Telegram 新订单通知准备：验证 `notifications.telegram.new-order` 只保存非密钥白名单配置；GET 使用 `settings.read`，PUT 使用 `settings.write`、五分钟最近认证、原因、CAS 与 Serializable 事务审计；服务端始终派生未连接、未有效启用、未配置 Token 和未外部核验。
- 后台认证、支付、机密和敏感操作设计：`test:security` 加桌面与移动端浏览器检查。
- 后台数据表、记录列表和列结构：`test:admin-tables` 加桌面与 390px 浏览器检查。
- Worker、路由或构建：`build` 后运行 `test:sites`。
- 管理后台写入、权限或敏感信息：必须检查 API 权限、CSRF、审计、重新认证与失败路径。
- 金额、汇率、库存和人工订单：必须检查精度、边界、并发、幂等和非法状态转换。
- 售后页面不得用模拟申请金额、部分退款、证据、双人审批、支付商状态或资金成功补齐现有订单模型；自动检查应断言这些未实现能力没有被包装成真实结果。
- 人工收款页面必须断言没有实际到账、部分或多次付款退款、手续费税费、支付方式、外部 ID、凭证、结算批次、对账和跨币种总额；订单详情权限保持不变，`/admin/reconciliation` 继续显示设计预览标识。
- Telegram simulation 必须断言只使用固定虚构订单和脱敏字段、`deliveryAttempted: false`、不接收或返回 Bot Token/Chat ID、不请求外部网络、不排队重试、不写发送记录；`/admin/notifications` 继续显示设计预览标识。

## 完成定义

- 需求范围和非目标明确，未混入其他项目规则或无关重构。
- 当前已实现、当前模拟和未来规划没有混淆。
- 代码、文档、测试和 `.env.example` 保持一致。
- 受影响自动检查通过；界面改动完成桌面、390px、中英文和关键状态验收。
- 无硬编码秘密、真实个人信息或未经批准的新依赖。
- 最终报告列出改动、文件、命令结果、风险和后续事项。

## 发布门禁

- 当前已有本地后端和 AWS staging 模板，但尚未创建云资源；本地检查与 `synth` 通过不构成上线批准。
- 2026-07-28 依赖审计在升级 Nest 配置、Swagger 与 Vite 的可用补丁后，仍有 6 项 high：Next.js 16.2.12 稳定最新版锁定的 `postcss`/`sharp`、Nest Swagger 11.4.6 稳定最新版锁定的 `js-yaml`，以及 AWS CDK 链路锁定的 `brace-expansion`。不得通过降级 Next、使用 canary 或强制跨主版本覆盖来伪造清零；AWS 创建前必须重新审计，并等待稳定上游修复或单独完成兼容性验证与风险批准。
- AWS staging 创建前必须确认费用、域名、证书、迁移命令、删除保护和回滚；生产前再单独完成恢复、权限、安全、监控和真实集成验收。
- 提交、推送、创建 PR、部署和生产变更只在用户明确授权后执行。
