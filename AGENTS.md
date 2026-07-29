# CloudBridge 项目开发规则

本文件是当前项目的最高级开发入口。项目路径固定为 `/Users/wangchao/Desktop/源码文件夹/简易购物网站`；它是独立项目，不得直接套用其他网站的业务模型、目录、接口、数据库、角色或部署方案。

## 项目现状与目标技术栈

- 当前主平台已经按 npm workspaces 分层：`apps/storefront` 为 Next.js 16 + React 19 + TypeScript，`apps/admin` 为 React 19 + Vite 8 + TypeScript，`apps/api` 为 NestJS 11 + Prisma 7 + MySQL 8.4，`packages/contracts` 保存共享领域类型，`infra` 保存 AWS CDK。
- 根目录 `src/` 仍保留原 React 19 + Vite 6 + JavaScript/JSX 设计原型，作为迁移对照与 Sites 兼容构建；新增生产功能不得继续写入该原型。
- Node.js 开发基线为 24.x，使用 `package-lock.json` 锁定依赖。
- 业务代码默认使用 TypeScript/TSX；遗留 JSX 只在维护旧原型时做最小修改，不做无关的全量重写。
- 数据库固定为 MySQL 8.4；本地使用 Docker Compose，AWS 目标使用 RDS MySQL Multi-AZ。金额使用 Prisma Decimal 与十进制字符串。
- 客户端、管理后台与 API 已是独立构建和权限边界；共享内容只允许通过 `packages/contracts` 或明确的 API 契约。
- 不默认引入新的 UI 框架、支付、队列、对象存储或第三方集成；新增大型依赖和修改基础设施前仍须确认。

## 能力真实性

- 本地平台已实现 MySQL 持久化的商品、分类、轮播、币种、汇率、联系渠道和人工订单；后台使用邮箱与密码登录，TOTP 双重验证默认关闭并可由管理员开启或关闭，同时保留 Valkey 服务端会话、RBAC 与审计接口。
- 根目录遗留 Vite 原型仍是模拟能力；Telegram、在线支付、真实通知、生产域名、云资源和生产数据仍未接通。
- 本地 API、构建或 CDK `synth` 成功不代表 AWS 资源已创建、已发布或生产可用。
- 文档和交付报告必须明确区分“当前已实现”“当前模拟”“未来规划”，缺少真实证据时不得写成“已接通”“已发布”或“生产可用”。
- 长任务、外部操作和保存动作必须依据真实执行状态展示结果，禁止用计时器或前端状态直接伪造成功。

## 开发与变更边界

- 开始修改前先阅读本文件、相关 `docs/` 文档、`package.json`、目标源码和对应测试。
- 每次只处理清晰、可验收的任务；优先最小范围修改，不重构无关文件，不删除用户资源。
- 代码标识、接口字段和未来数据库字段使用英文；需求和规则文档以简体中文为主；可见界面文案必须提供完整的 `{ zh, en }`。
- 金额不得使用二进制浮点进行业务计算。未来 API 使用十进制字符串传递金额，后端使用 Decimal。
- 业务状态使用稳定枚举码，样式和流程不得依赖中文或英文显示文案。
- 新增环境变量时必须同步 `.env.example`；`VITE_` 前缀变量视为公开信息，不得放入密钥、Token、密码或私有地址。
- 不得擅自初始化 Git、提交、推送、创建 PR、部署或修改生产环境。

## 工作流与完成定义

1. 在 `docs/ROADMAP.md` 中确认任务范围、依赖、风险和验收标准。
2. 修改前复核当前实现；涉及接口、数据库、登录、支付、部署或新增大型依赖时先请求确认。
3. 实现加载、错误、空状态、表单校验、移动端和基础无障碍，并补充与风险匹配的测试。
4. 至少运行受影响测试；交付前运行 `npm run check`。
5. 完成报告必须列出改动内容、修改文件、检查命令与结果、未验证风险和后续事项。

## 规则文档索引

- [产品范围与能力状态](docs/PRODUCT.md)
- [架构与技术路线](docs/ARCHITECTURE.md)
- [开发工作流](docs/DEVELOPMENT.md)
- [数据、接口与安全](docs/DATA_API_SECURITY.md)
- [交互与确认规则](docs/INTERACTION_RULES.md)
- [全站体验与交互系统](docs/UX_INTERACTION_SYSTEM.md)
- [测试、证据与发布](docs/TESTING_AND_RELEASE.md)
- [AWS staging 与费用门禁](docs/AWS_STAGING.md)
- [路线图与开放问题](docs/ROADMAP.md)

## 主平台与遗留原型

- 主平台分别使用 `npm run dev:storefront`、`npm run dev:admin`、`npm run dev:api`，依赖本地 MySQL 与 Valkey。
- 数据库迁移必须使用已审查的 Prisma migration；本地执行 `npm run db:migrate`，AWS 使用一次性 ECS migration task，禁止在每个 API 实例启动时并发迁移。
- AWS 资源定义固定在 `infra/`，区域固定新加坡 `ap-southeast-1`。`cdk synth` 和 `cdk diff` 是只读规划证据；任何 `cdk deploy` 都必须在费用、域名、证书、迁移和回滚确认后单独授权。

## 遗留原型运行与 Sites 交付

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

遗留 Sites 兼容界面仍在 `src/`。保持 `.openai/hosting.json`、`worker/index.js`、`scripts/prepare-sites-build.mjs` 和 `tests/sites-worker.test.mjs` 完整；这部分不等于主平台。Sites 交付前运行 `npm run build` 与 `npm run test:sites`。

## Durable CloudBridge design decisions

- The selected visual direction is option 3, "夜航画廊": a continuous deep-navy gallery canvas with restrained cyan bridge lines, large editorial type, premium product art, and quiet, intentional motion.
- The storefront home must retain its original structure: full-width hero first, capability rail directly below it, then the product gallery. Product-name search, single-select categories, and the explicit no-results state belong inside the product gallery only; never turn the hero or capability rail into a sidebar, move them below the catalog, or reorder products for a generated mock. The admin owns bilingual category naming, visibility, order, and product assignment.
- The storefront capability rail has no standalone heading or reserved label column. Its four items span the full content width in the operational order currency coverage, dual pricing, single-contact ordering, then human support.
- The storefront product gallery must not display a matching-result count after search or category filtering. Keep the filtered grid and the explicit no-results state, but do not reintroduce text such as `为你找到 N 项服务` or `N services found for you`.
- The client and admin are independent experiences. Do not add a preview switcher inside either product.
- The storefront supports Chinese and English independently from currency selection.
- Product grids remain two columns from desktop down to 320px mobile.
- Storefront product cards and product detail headings do not show kicker or category micro-labels such as “开发工作流 / Developer workflow” or “多模态协作 / Multimodal work” above product names. Keep category meaning in the filter navigation and preserve the hierarchy as product image, product name, price, stock, and purchase action.
- Mobile product cards keep a fixed rhythm for identity, price, and a 72px purchase group containing a left-aligned stock state above the 44px full-width action so bilingual titles and currencies align across each row.
- Storefront stock is auxiliary purchase guidance, not a floating card annotation. Product cards group it with the purchase action: stock sits left of the compact desktop action and left-aligned immediately above the full-width mobile action. Product details keep stock beside response time in one left-aligned metadata row. Normal stock shows only “现货 / Available”; exact quantity appears only for low stock. Prices remain complete.
- The mobile capability rail is a symmetric 2 × 2 grid with one continuous 1px cross divider; never derive its separators from DOM child indexes or pseudo-elements.
- Storefront hero carousels never show a page fraction, progress line, or previous/next arrow capsule at any viewport. Keep timed rotation, clickable pagination, and horizontal swipe or drag navigation, and show only a quiet semi-transparent dot group in the lower-right corner to indicate the active slide.
- The mobile header must retain the Chinese `云桥` wordmark down to 320px; compact English and tagline content first, then tighten utility-control spacing instead of dropping the brand name.
- Mobile section spacing follows relationship-based tiers instead of one repeated large gap: 12px for hero-to-capability, about 52px for capability-to-products, 56px for products-to-support, and about 52px for support-to-footer.
- On product detail pages at every viewport, the purchase action row stays fixed to the viewport bottom throughout vertical scrolling, respects the device safe area, and the page reserves enough bottom space that it never covers the final content. Product detail routes do not render the storefront footer.
- The storefront footer uses the restored legacy editorial dock: one brand area, one navigation panel, and one full-width legal strip. Mobile turns each navigation item into a full-width row; do not replace it with separate service, support, and policy content columns.
- All client editorial and instructional numbered sections, including product service notes and policy pages, use one shared pattern: each `01 / 02 / 03` stays in a dedicated column directly left of its heading at every breakpoint, with the heading and body grouped together. Progress indicators and status timelines keep their own flow-specific layout.
- Currency identity uses CloudBridge currency tokens, never emoji flags or generic coin icons.
- The client has no account, login, cart, or quantity selector. Checkout asks only for a contact channel and contact value.
- Merchant contact behavior is channel-specific: WhatsApp opens a `wa.me` chat with a preset message, QQ attempts a direct app jump and keeps copy fallback, while WeChat never claims direct web jump and uses QR/copy only.
- Admin pages must have one page title only. The top bar owns the sole current-page H1; content starts directly with data or task controls and never repeats an English eyebrow, translated title, or persistent page description.
- The admin sidebar uses exactly nine task-oriented primary entries in this order: direct `工作台 / Workspace`, then the eight accordion groups `订单与售后 / Orders & after-sales`, `商品管理 / Catalog management`, `内容与展示 / Content & storefront`, `客服与通知 / Support & notifications`, `财务与结算 / Finance & settlement`, `成员与权限 / Team & access`, `安全与合规 / Security & compliance`, and `系统与运维 / Systems & operations`. The dashboard link clears any expanded group; the remaining groups may expose at most one group at a time and each contains no more than four unique pages. Child pages use an indented navigation rail. Selected admin pages also open as session-only workspace tabs, with the dashboard pinned and overflow placed under `更多 / More`. Non-pinned workspace tabs can be reordered through pointer, touch, or keyboard handles; the complete order is manageable from the overflow panel, remains session-only, and resets on refresh or sign-out. On mobile, show the full active tab plus one useful companion whenever both fit beside the overflow entry; fall back to the full active label only when space is genuinely insufficient. Never truncate any primary, secondary, or workspace navigation label with an ellipsis.
- `apps/admin` may expose all 24 approved routes during the design-first phase, but every page without a real API must display the persistent `界面设计预览 / Interface design preview` notice, use mock data only, and state that server data is unchanged. A clickable design preview is not implementation evidence and must not display fake save, send, payment, backup, permission, or integration success.
- 根目录遗留原型仍是纯前端；`apps/` 主平台中的目录、订单、认证、权限和审计已接入本地后端。两者的证据不得混用。
- Telegram new-order notifications belong to the admin operations experience. The design targets an internal order-management group, sends masked order summaries only, keeps Bot Tokens server-side, and must label all frontend test and retry results as simulated until a real backend exists.
- All structured admin data tables use strict single-line records. Time, currency, account, group, event ID, and trace details must be separate columns instead of second-line copy inside a cell. Mobile keeps the same table in an internal horizontal scroller; never replace it with multiline cards, hide critical columns, or overflow the page. Row actions must keep at least a 44 × 44px target.
- All storefront and admin logo regions reuse the same `/assets/cloudbridge-logo.png` artwork and horizontal brand anatomy. Preserve the source aspect ratio with `object-fit: contain`; only the frame dimensions may vary by header, sidebar, authentication, footer, or preview context. Logo lockups contain one primary brand name and no secondary tagline or “管理中心 / Admin” subtitle.
- The storefront transit-service entry is a separate external action, never a support shortcut. It uses a translucent bronze glass capsule that remains distinct from the storefront's navy/cyan canvas without clashing, with a network icon, breathing signal and outward arrow; shows the full `中转站服务 / Transit Service` label without truncation; and is visible by default. Without a configured URL it shows a localized notice when clicked, with a valid HTTPS URL it opens a safe new tab, and only an explicit admin disable hides it. Mobile product detail raises it above the fixed purchase bar.
- On mobile non-detail storefront routes, the transit-service capsule stays in normal document flow immediately before the footer instead of floating over hero, capability, catalog, policy, or support content. Product detail remains the only mobile route where it may float, and it must stay above the fixed purchase bar.
