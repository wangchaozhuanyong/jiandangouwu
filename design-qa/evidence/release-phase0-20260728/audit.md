# CloudBridge 发布阶段 0 设计与运行审计

审计日期：2026-07-28

审计分支：`codex/modular-cloudbridge-platform`

审计范围：正式客户端 `apps/storefront`、正式管理后台 `apps/admin`、正式 API `apps/api`，以及本地 MySQL / Valkey 集成环境。

## 结论

- P0 阻断问题：0
- P1 高优先级问题：3，均已修复并复验
- P2 一般问题：0 个仍阻断本阶段
- 24 个后台路由在 1440px 与 320px 下均只有一个 H1，无页面级横向溢出，无运行时 `alert` 错误。
- 客户端在 1440px、390px、320px 下无页面级横向溢出；商品详情固定购买栏未遮挡最终表单内容。
- 本地真实链路“创建订单 → 后台查看 → 分配负责人 → 更新为已联系”执行成功。
- `npm run check` 完整通过。

当前结果只证明本地发布候选通过设计与集成验收，不代表 AWS 已部署、外部支付已接通、Telegram 已发送或生产环境已上线。

## 已修复问题

### P1：移动端客服图标缺少可访问名称

- 位置：正式客户端移动端页头。
- 影响：屏幕阅读器只能识别为无名称按钮。
- 修复：为按钮增加当前语言对应的 `aria-label`。
- 复验：320px 中文页面可访问树显示为 `button "联系支持"`。

### P1：后台认证页缺少统一品牌锁定

- 位置：正式后台首次管理员创建、登录与 TOTP 界面。
- 影响：认证入口与后台侧栏、客户端品牌不一致。
- 修复：复用 `/assets/cloudbridge-logo.png`，只显示一个 CloudBridge 主品牌名，并保持图片比例。
- 复验：桌面认证卡片布局通过；没有增加“管理中心”副标题。

### P1：320px 英文工作台运营提醒标题区发生重叠

- 位置：`/admin/dashboard` 英文移动端。
- 影响：长标题、副文案与操作按钮竞争同一横向空间。
- 修复：440px 以下将该面板标题区改为纵向排列，按钮占满可用宽度。
- 复验：320px 页面 `scrollWidth` 小于视口宽度，标题、副文案和按钮不再重叠。

## 真实运行验收

- 使用隔离的临时 MySQL 与 Valkey 环境执行全部迁移和种子。
- 创建仅用于本地 QA 的管理员与虚构订单，不使用生产账号或真实客户数据。
- 客户端成功创建订单：`CB-260729-1569A8`。
- 后台订单列表成功读取该订单。
- 订单成功分配给本地 QA 管理员。
- 订单状态通过正式服务端状态机从“待处理”更新为“已联系”。
- 订单详情与时间线同步显示新负责人和新状态。
- `/admin/reconciliation` 持续显示“界面设计预览”，并明确使用模拟数据、服务器数据未改变。
- 浏览器控制台警告与错误：0。

临时 QA 数据库、管理员和订单在验收完成后删除，不进入仓库或生产环境。

## 页面与响应式证据

1. `01-storefront-home-desktop.png`：客户端桌面首页。
2. `02-storefront-home-mobile.png`：客户端 390px 首页。
3. `03-product-detail-mobile.png`：客户端移动商品详情。
4. `05-admin-first-setup-desktop.png`：后台首次设置修复前证据。
5. `06-admin-dashboard-desktop.png`：后台桌面工作台。
6. `07-admin-dashboard-mobile.png`：后台移动工作台。
7. `08-storefront-home-320.png`：客户端 320px 首页。
8. `09-storefront-order-success-mobile.png`：客户端真实下单成功凭证。
9. `10-admin-orders-mobile.png`：后台移动订单列表。
10. `11-admin-order-processed-mobile.png`：后台订单负责人和状态流转结果。
11. `12-admin-reconciliation-preview-desktop.png`：对账设计预览真实性边界。
12. `13-admin-dashboard-english-320.png`：修复后的英文 320px 工作台。

## 自动检查

- `npm run check`：通过。
- 平台回归测试：33/33 通过。
- API 测试：55/55 通过。
- 客户端测试：6/6 通过。
- 五个工作区 TypeScript 检查：全部通过。
- 遗留 Vite、Sites、storefront、admin、API、contracts 与 CDK 构建：全部通过。
- `git diff --check`：通过。

## 未完成与发布门禁

- `npm audit --omit=dev` 当前仍报告 6 个 high、0 个 critical；涉及 Nest Swagger / `js-yaml`、AWS CDK / `brace-expansion`、Next.js 间接依赖等。进入 AWS staging 前必须逐项升级、缓解或形成明确风险接受记录。
- 仓库尚未建立 GitHub Actions 持续集成与受保护分支证据。
- 尚未进行 AWS staging 部署、域名、证书、RDS、ECS、回滚演练或真实流量验收。
- 在线支付、Telegram 真实发送、真实通知与生产数据仍未接通。
- 设计预览页面只代表前端流程设计，不代表后端功能已经实现。
- 还需要在 staging 执行真实网络条件、Core Web Vitals、备份恢复、权限矩阵与故障回滚验收。
