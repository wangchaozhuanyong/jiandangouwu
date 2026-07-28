# CloudBridge 完整设计补全 QA

## 2026-07-28 商品卡片辅助标签移除

### 实现范围

- 目标区域：客户端商品卡片内、商品名称上方的 `kicker` 辅助标签槽位。
- 已删除示例：“多模态协作”“通用智能助手”，以及其他商品卡片中同构的辅助标签区域。
- 保留内容：商品图片、商品名称、价格、参考价、库存、购买操作、分类筛选、详情页和订单凭证。
- 非目标：不修改主平台 `apps/storefront`、API、数据库、商品或分类数据。

### 自动与静态证据

- `ProductCard` 不再引用 `product.kicker`，常规与紧凑卡片共用的标签节点已彻底移除。
- 桌面标题上边距归零；移动端身份区由带标签的 62px 双行结构收紧为仅标题的 40px 单行结构，卡片内容高度同步由 254px 调整为 232px。
- `npm run test:ux`：8/8 通过，包含商品卡片不再引用标签节点或数据的回归测试。
- `npm run build`：通过，遗留 Vite 生产构建与 Sites 兼容产物生成成功。
- `npm run check`：完整通过；全部遗留测试与构建、Sites 测试、主平台架构测试、五个工作区类型检查和全部主平台构建均通过。

### 浏览器验收

- 当前会话未暴露 Browser 技能所需的 Node REPL 浏览器控制工具，无法取得 1440 × 1024、390 × 844、320 × 844 的实现截图或执行同屏视觉比较。
- 待复验：中文与英文、常规商品网格、搜索发现紧凑卡片、两列对齐和页面横向溢出。

### 结果

- P0：未发现，但缺少浏览器证据。
- P1：未发现，但缺少浏览器证据。
- P2：真实响应式视觉与卡片对齐仍待 Browser 控制恢复后复验。

final result: blocked

## 2026-07-28 正式管理后台完整任务流程设计

### 视觉真值与范围

- 视觉真值：正式 `apps/admin` 当前浅色运营后台、九入口导航、面板、表格、弹窗与既有响应式设计。
- 实现范围：24 个后台页面的任务流程设计；共享三步流程、状态切换、订单工作台、商品库存发布、分类影响、币种历史、账户安全、审计详情与工作台下钻。
- 真实性边界：新增流程只使用弹窗内本地状态，不调用新增 API；最终状态明确说明服务器数据未改变。
- 目标视口：1440 × 1024、390 × 844、320 × 844；中文与英文。

### 自动与静态证据

- `apps/admin/src/design-workflows.tsx` 为全部设计页和关键真实页面提供三步流程，并覆盖正常、加载、空数据、离线、失败、无权限和保存冲突。
- 订单、商品、分类、币种、安全、审计、工作台和管理员账户均提供明确设计入口，不替代原有真实能力。
- 弹窗复用既有焦点锁定、Escape、关闭后焦点返回与页面滚动锁定。
- `tests/admin-design-workflows.test.mjs` 固定完整页面映射、状态覆盖、无服务器写入和响应式点击目标。

### 浏览器与视觉验收阻断

- 当前会话未暴露 Browser 控制所需的 JavaScript 工具；按 Browser 技能执行工具发现后仍不可调用。
- 未生成本轮 1440、390、320 实现截图，未执行真实点击、键盘焦点、滚动边界或控制台检查。
- 构建、类型检查和源码测试不能代替响应式视觉、真实弹窗高度、长英文文案与移动端底部操作区验收。

### Findings

- [P2] 缺少完整任务流程的浏览器渲染证据
  - Location：正式管理后台全部设计流程，重点为订单工作台、角色权限、网站设置和异常状态。
  - Evidence：静态结构、类型检查与构建可验证，但没有同视口真实截图与交互记录。
  - Impact：无法确认 320px 下状态标签横向滚动、弹窗操作区、最长英文名称和真实焦点顺序是否无视觉回归。
  - Fix：Browser 控制恢复后，在三个视口依次捕获工作台、订单详情、成员权限、网站设置、无权限和冲突状态，再检查控制台。

### 结果

- P0：未发现，但缺少浏览器证据。
- P1：未发现，但缺少浏览器证据。
- P2：真实视觉、键盘交互和窄屏重排仍待浏览器复验。

final result: blocked

## 2026-07-28 正式后台 24 页面设计覆盖

### 设计目标与视觉真值

- 目标产品：正式管理后台 `apps/admin`。
- 用户目标：先完成全部后台页面的视觉、信息结构和前端交互设计，再单独开发业务功能。
- 视觉真值：沿用现有正式后台的深海军蓝侧栏、青色选中态、浅灰工作区、细边框白色面板和 Phosphor 图标；页面结构参考 `design-qa/evidence/admin-dashboard-1440.png`、`admin-roles-1440.png`、`admin-notifications-1440.png` 与 `fullsite-ux-20260728-final/16-admin-dashboard-1440-zh.png`。

### 实现范围

- 正式后台导航已覆盖固定九个一级入口和 24 个唯一页面 ID。
- 七个现有真实页面继续使用原 API 与缓存：运营总览、订单中心、商品中心、商品分类、币种与汇率、安全中心、日志与监控。
- 十七个缺失页面新增独立前端设计：退款与争议、首页轮播、媒体资源、语言与内容、联系方式、通知中心、Telegram 机器人、支付与收款、支付对账、员工账户、角色与权限、安全事件、数据安全、密钥与机密、备份与恢复、系统与集成、网站设置。
- 所有未接通页面持续显示“界面设计预览 / Interface design preview”，使用模拟数据并明确不修改服务器；交互按钮只显示预览反馈，不伪造保存、发送、支付、权限或恢复成功。
- `/admin/audit` 保留兼容并归一到正式 `/admin/logs`。

### 自动与构建证据

- `npm run typecheck --workspace @cloudbridge/admin`：通过。
- `npm run test:platform`：16/16 通过，覆盖 24 页面唯一性、17 个设计页面、设计预览标识、无新增 API 调用、分组导航和移动布局规则。
- `npm run test:admin-navigation`：15/15 通过。
- `npm run build --workspace @cloudbridge/admin`：通过；设计页面单独生成按需块，不阻塞现有真实页面模块。

### 浏览器与视觉验收阻断

- 当前会话没有暴露 Browser 技能要求的浏览器控制工具，无法在用户已登录的 in-app Browser 中捕获当前实现。
- 本轮没有生成 1440 × 1024、390 × 844、320 × 844 的实现截图，无法执行同视口同状态的视觉真值对比。
- 尚未通过浏览器验证全部九组展开、17 个设计页面切换、移动抽屉关闭、内部表格横向滚动、英文最长标签、实际点击目标、焦点顺序、页面级横向溢出和控制台错误。
- HTTP 200、源码热更新、类型检查和生产构建只证明路由与代码可用，不能替代视觉验收。

### Findings

- [P2] 缺少当前正式后台的浏览器渲染证据
  - Location：`/admin/:page` 全部 24 个页面，重点为 17 个新增设计预览页面。
  - Impact：页面已实现并可编译，但实际字体、留白、表格滚动、移动堆叠和视觉一致性仍需真实截图确认。
  - Fix：Browser 控制恢复后，在中文和英文下按 1440、390、320 三个视口捕获导航、角色权限、通知、媒体、支付、安全、备份和设置代表页面，与上述视觉真值进行同屏比较并修复 P0/P1/P2。

final result: blocked

## 2026-07-28 正式客户端关键交互与视觉回归修复

### 视觉真值与实现范围

- 用户问题截图：
  - `/var/folders/y2/73zzsdhn3d78m_qqhkb2lrq80000gn/T/codex-clipboard-1e32367f-021f-48e7-82c2-2c4bc8fe162f.png`，币种原生弹层文字不可读。
  - `/var/folders/y2/73zzsdhn3d78m_qqhkb2lrq80000gn/T/codex-clipboard-515703ab-1b46-49b8-b67a-fd0c0a14457a.png`，移动端页脚二维网格结构破碎。
- 既有设计基线：
  - `design-qa/evidence/fullsite-ux-20260728-final/09-client-home-390-zh.png`，右上角客服入口与移动端品牌层级。
  - `design-qa/evidence/fullsite-ux-20260728-final/03-client-detail-1440-zh.png`，详情页客服入口与夜航画廊视觉语言。
- 实现范围：正式客户端 `apps/storefront` 的币种选择器、全站客服抽屉、响应式页脚和商品详情订单操作栏。
- 目标 CSS 视口：1440 × 1024、390 × 844、320 × 844，中文与英文。
- 实现截图：缺失；当前 Browser 插件没有暴露所需控制工具。

### 自动、构建与运行证据

- 新币种选择器使用 `combobox / listbox / option` 语义，支持方向键、Home、End、Enter、Space、Escape、Tab、点击外部关闭和焦点返回。
- 客服按钮在桌面端显示完整文案，移动端保留 44px 图标入口；抽屉按需读取正式 API 的真实渠道，支持焦点锁定、Escape、关闭后焦点返回、滚动锁定、加载、失败、空配置及复制失败状态。
- 移动页脚使用单列命名区域，不再依赖 `nth-child` 推导分隔线；订单操作栏在移动端固定到安全区上方，桌面端在订单区域内粘附。
- `npm run test:ux`：9/9 通过。
- `npm run test:platform`：12/12 通过，包含本轮币种、客服、页脚和订单操作栏专项回归。
- `npm run typecheck --workspace @cloudbridge/storefront`：通过。
- `npm run build --workspace @cloudbridge/storefront`：通过。
- `npm run check`：完整通过；规则检查、全部遗留测试与构建、Sites 测试、12 项平台测试、五个工作区类型检查和全部平台生产构建均通过。
- `http://localhost:3000/zh` 与 `http://localhost:3000/zh/products/gemini` 均返回 HTTP 200；服务端输出中可确认客服入口、三段页脚、币种触发器和订单操作栏已经挂载。

### 全视图、聚焦区域与五项视觉表面

- 全视图比较：阻断。缺少本轮浏览器渲染截图，不能把视觉真值与同视口实现放入同一比较输入。
- 聚焦比较：阻断。币种展开态、客服抽屉、移动端完整页脚和固定订单栏仍需真实截图核对。
- 字体与排版：继续使用项目既有宋体展示字与 Inter、SF Pro Text、Noto Sans SC、苹方回退栈；真实字形、英文换行和抗锯齿待 Browser 复验。
- 间距与布局：源码已约束 44/48/52/54px 点击目标、移动端单列页脚、320px 菜单宽度和安全区底栏；实际溢出与遮挡待浏览器测量。
- 颜色与视觉变量：全部复用深海军蓝、青色强调和既有语义状态色；币种菜单不再使用浏览器白色原生弹层。
- 图片与素材：继续复用 `/assets/cloudbridge-logo.png` 和现有商品图片；本轮未新增或伪造图片资产。
- 文案与内容：新增客服、政策分组、失败与空状态均提供完整中英文；渠道账号来自正式 API，不硬编码到客户端组件。

### Findings

- [P2] 缺少三个目标视口的真实浏览器渲染与交互证据
  - Location：正式客户端首页、客服抽屉、页脚和商品详情订单表单。
  - Evidence：源码、自动测试、类型检查、生产构建和 HTTP 输出均通过，但 Browser 控制入口未暴露，无法生成实现截图、测试键盘焦点、读取控制台或测量页面横向溢出。
  - Impact：不能把构建成功当作币种菜单实际对比度、抽屉光学层级、320px 页脚排版和固定订单栏遮挡问题已经视觉通过。
  - Fix：Browser 控制恢复后，在 1440、390、320 三个视口依次复验中英文首页币种展开、客服抽屉、完整页脚和详情页固定提交栏；将同状态截图与上述视觉真值放入同一比较输入。

### 结果

- P0：未发现，但缺少浏览器证据。
- P1：未发现，但缺少浏览器证据。
- P2：真实响应式视觉、焦点顺序、页面溢出和控制台状态仍待 Browser 复验。

final result: blocked

## 2026-07-28 全站丝滑体验真实浏览器复验

### 审核范围

- 使用用户明确授权的独立 Playwright 与本机 Chrome，重新执行本轮真实浏览器验收。
- 遗留交互基准：客户端首页、搜索、详情、订单表单、校验、失败恢复、成功凭证；后台登录、MFA、九入口导航、商品搜索、编辑保存与移动抽屉。
- 正式平台：客户端 API 不可用错误状态；后台安全登录与 API 不可用错误反馈。
- 视口：1440 × 1024、390 × 844、320 × 844；覆盖中文、英文与减少动态效果。
- 非目标：不修改 API、数据库、权限、支付、认证、基础设施、生产配置，不提交、不推送、不部署。

### 本轮修复

- 遗留后台登录入口改为首屏直接挂载，消除首次进入时只显示加载提示、主体空白的过渡。
- 正式客户端首次加载增加独立的请求中键，开发模式卸载或取消请求后不会被错误地当作已经完成。
- 客户端、后台、登录、轮播、工作区标签、Toast、页脚及预览控制统一补足至少 44 × 44px 点击区域。
- 320px 英文页头在保持完整品牌和 44px 控件的同时消除 1px 页面横向溢出。
- 三个入口补齐 CloudBridge 图标声明，消除缺失 favicon 的 404 噪声。

### 有序证据

- `01–08`：客户端桌面首页、搜索、详情、下单、错误校验、订单复核、失败重试和成功凭证。
- `09–12`：390px 中文和 320px 英文首页、分类导航与两列商品结构。
- `13–20`：后台登录、登录校验、MFA、工作台、商品中心、搜索、编辑抽屉和保存反馈。
- `21–22`：390px 中文与 320px 英文九入口移动抽屉。
- `23–24`：正式客户端桌面与移动端 API 不可用错误状态和重新连接入口。
- `25–28`：正式后台桌面与移动端登录页、请求失败后错误保留。
- 原始截图：`design-qa/evidence/fullsite-ux-20260728-final/01-*.png` 至 `28-*.png`。
- 汇总检查图：`contact-sheet-1.png` 至 `contact-sheet-4.png`；四张汇总图已逐张打开检查。
- 机器可读结果：`audit-results.json`，34 个步骤、44 项断言、0 项失败。

### 验收结果

- 页面级横向溢出：1440、390、320 均为 0。
- 点击目标：本轮截图内所有可见 `button` 和 `a` 均达到至少 44px 宽和高。
- 客户端：搜索结果正确；弹窗支持 Escape 和焦点返回；错误字段获得焦点；订单失败保留内容并可用同一流程重试；成功只在确认后出现。
- 后台：登录错误使用 `alert`；九入口在中英文移动抽屉完整显示；手风琴一次只展开一组；页面切换后焦点进入主内容；编辑保存返回触发按钮。
- 正式平台：API 不可用时客户端退出骨架并显示重新连接；后台保留邮箱并显示明确错误。
- 自动检查：`npm run check` 完整通过；63 项 Node 测试、五个工作区类型检查及全部生产构建通过。

### 证据限制

- 正式 API 因项目没有本地 `.env`，缺少 `DB_HOST` 等配置，不能验证正式客户端成功订单和正式后台已认证编辑流程。
- 此处原 Passkey 验收记录已被 2026-07-28 的密码登录与可选 TOTP 方案取代；真实验证器、Slow 4G、4 倍 CPU、8 秒服务端延迟与 Core Web Vitals 仍需在完整测试环境执行。
- 浏览器开发环境需使用 `localhost`；以 `127.0.0.1` 打开 Next.js 开发服务器会触发其开发资源来源保护，这不是产品页面的线上失败状态。

### 结论

- P0：0。
- P1：1，遗留后台首次登录空白外壳，已修复并复验。
- P2：1，关键控制点击区域不足，已修复并复验。
- 本轮可访问范围：passed。
- 完整正式平台发布验收：blocked，等待可用 API 测试环境与真实性能数据。

final result: blocked

## 2026-07-28 全站丝滑体验系统

### 实现范围

- 遗留原型：统一 120ms 导航反馈参数，错误 Toast 保持到用户关闭，并补充完整异步状态解析测试；不向原型继续加入生产业务。
- 正式客户端：`SiteShell` 移入 locale 持续布局，增加路由加载、错误和全局错误边界；首页与详情服务端获取首屏数据，客户端刷新保留旧内容。
- 正式客户端连续性：分类和搜索写入 URL，币种保存到会话状态，联系方式与订单草稿只保存在根级内存；返回列表恢复条件和滚动位置。
- 正式订单：同一草稿失败重试复用幂等键；修改联系方式、渠道或币种后才创建新草稿键；收到服务端订单凭证后才展示成功。
- 正式后台：七个真实页面拆为独立懒加载块，原生 History API 同步 `/admin/:page`，页面查询使用 30 秒内存缓存并后台刷新。
- 正式后台交互：首次加载使用结构骨架，刷新保留缓存数据；弹窗支持初始焦点、Tab 循环、Escape、背景关闭、焦点返回、滚动锁定和未保存提醒。
- 响应式：后台表格继续保持单行记录与内部横向滚动，行操作达到 44px，主导航达到 48px；未改成卡片或隐藏关键列。

### 自动与构建证据

- `npm run test:ux`：9/9 通过，新增 initial-loading、refreshing、ready、empty、offline、error 状态测试。
- `npm run test:platform`：10/10 通过，覆盖持续壳层、路由边界、URL/草稿连续性、幂等重试、后台懒加载、30 秒缓存和弹窗焦点行为。
- `npm run check`：完整通过；遗留与主平台共 62 项 Node 测试通过，Sites 打包、五个工作区类型检查及全部平台构建成功。
- 正式客户端 Next.js 生产构建通过，`/[locale]`、政策和商品详情保持动态服务端路由。
- 正式后台 Vite 生产构建通过；主入口为 270.00kB / gzip 84.14kB，七个页面与共享表格生成独立按需块。原实现主入口约 296kB / gzip 87.89kB。
- 本地 HTTP 冒烟检查：正式客户端 `/zh`、`/zh/policies/terms`，正式后台 `/admin/dashboard`、`/admin/products` 均返回 200。
- 本轮没有新增依赖、API、数据库、权限、支付、认证、基础设施或生产配置，也没有提交、推送或部署。

### Browser 验收阻断

- 已按 Browser 插件技能要求搜索两次控制入口；当前会话没有暴露所需的浏览器控制工具。
- 因此未生成本轮 1440 × 1024、390 × 844、320 × 844 新截图，未执行中英文真实切页、Slow 4G、离线、8 秒延迟、图片失败、前进后退、订单响应丢失重试或后台弹窗键盘序列。
- 旧截图和旧审计没有被当作本轮实现证据；类型检查、测试和构建不能代替视觉、网络和真实焦点验收。

### Findings

- [P2] 缺少正式客户端与后台的本轮浏览器交互和响应式视觉证据
  - Location：`apps/storefront` 首页、详情与订单；`apps/admin` 登录、导航、表格与编辑弹窗。
  - Evidence：源码结构、状态测试、类型检查和生产构建全部通过，但没有 Browser 控制连接。
  - Impact：尚不能确认三个目标视口的真实字形、布局稳定性、动画手感、焦点顺序、页面级横向溢出与网络节流表现。
  - Fix：Browser 恢复后按客户端六步和后台五步流程重新截图，检查控制台、网络、焦点、减少动态效果与同状态前后对照。

### 结果

- P0：未发现，但缺少浏览器证据。
- P1：未发现，但缺少浏览器证据。
- P2：真实视觉、网络节流和键盘交互仍待 Browser 复验。

final result: blocked

## 验收范围

- 项目：`/Users/wangchao/Desktop/源码文件夹/简易购物网站`
- 类型：React/Vite 纯前端交互原型，仅模拟数据
- 桌面视口：1440 × 1000
- 移动视口：390 × 844
- 语言：中文为主，并核对中英文键完整性
- 非目标：后端、数据库、真实认证、真实支付、AWS 部署

## 同屏对照证据

- 客户端下单对照：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/simple-shop-design-implementation-20260728/checkout-comparison.jpg`
- 后台安全中心对照：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/simple-shop-design-implementation-20260728/security-comparison.jpg`
- 客户端移动首页对照：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/simple-shop-design-implementation-20260728/mobile-home-comparison.jpg`
- 登录桌面：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/simple-shop-design-implementation-20260728/03-admin-login-desktop-1440.jpg`
- 支付重新认证桌面：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/simple-shop-design-implementation-20260728/05-admin-payment-reauth-desktop-1440.jpg`
- 移动端下单：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/simple-shop-design-implementation-20260728/07-checkout-mobile-390x844.jpg`
- 移动端后台安全中心：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/simple-shop-design-implementation-20260728/08-admin-security-mobile-390x844.jpg`
- 移动端后台登录：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/simple-shop-design-implementation-20260728/09-admin-login-mobile-390x844.jpg`
- 移动端支付后台：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/simple-shop-design-implementation-20260728/10-admin-payments-mobile-390x844.jpg`

## 视觉一致性

- 客户端继续使用原有深色“夜航画廊”视觉：品牌舞台、展示字体、青蓝色节点、边框、图片和间距节奏保持一致。
- 后台继续使用原有浅色运营台：深色侧栏、浅灰工作区、白色数据面板和现有图标体系保持一致。
- 下单弹层在原有结构上扩展支付关闭提示、五种联系渠道、隐私同意与第二步确认，没有改变原有视觉语言。
- 安全中心移除装饰性 92 分，改成带证据时间的“需要处理、正常、待复核”状态。
- 新增登录、支付、数据安全、备份、机密和事件页面都复用现有字体、颜色、圆角、阴影和 Phosphor 图标。
- 没有新增低清图片、占位图、Emoji、手绘 SVG 或不一致的 UI 框架。

## 交互验证

- 后台受登录门禁保护；完成员工邮箱、密码、MFA 通行密钥流程后才进入安全中心。
- 登录、找回密码统一使用模糊错误设计；邀请、锁定、新设备、链接失效、账户禁用和会话过期状态均可预览。
- 客户端下单完成联系方式校验、隐私勾选、第二步确认、重复提交禁止和“待人工处理”订单凭证。
- 公开订单查询入口和活动路由已移除。
- 支付关闭时只生成人工订单；未来托管支付预览覆盖选择、跳转、处理中、3DS、成功、失败、取消、超时、重复支付和金额变化。
- 支付启用、联系方式揭示、退款、导出、恢复和密钥操作进入原因、动态码、确认与审计的重新认证弹层。
- 数据安全、备份恢复、密钥状态、安全事件、支付对账和争议页面均可打开。
- 弹层支持焦点锁定、Escape 关闭、关闭后返回触发点；提交中按钮禁用。
- 浏览器控制台错误和警告：0。

## 响应式与无障碍

- 1440 × 1000 客户端和后台无横向溢出。
- 390 × 844 首页、下单、登录、安全中心、支付后台及所有新增客户端/后台路由已检查。
- 移动端导航、语言、通知、主操作和会话退出按钮点击高度达到 44px；后台导航项达到 48px。
- 图标按钮具有可读名称；系统集成箭头不再是无名称按钮。
- 状态同时使用图标、文本和颜色；错误靠近字段显示。
- 支付演示页首次检查出现 471px 横向溢出，原因是订单摘要网格的最小内容宽度；已给网格子项设置 `min-width: 0` 并允许订单号换行。复验宽度为 375px 可视内容，无横向溢出。
- 安全中心会话退出按钮首次测得 33px 高；已修正为 44px，复验 4 个相关操作均为 44px。

## 自动检查

- `npm run check:rules`：通过
- `npm run test:catalog`：5/5 通过
- `npm run test:i18n`：3/3 通过
- `npm run test:ux`：6/6 通过
- `npm run test:security`：4/4 通过
- `npm run build`：通过
- `npm run test:sites`：4/4 通过
- 合计：22 项测试通过，生产构建通过

## 已知边界

- 登录、MFA、会话、权限、支付、Webhook、数据库、备份和 AWS 状态全部是设计模拟，不是生产证据。
- 政策内容已补齐信息架构与正式版文案草案，但上线前仍需运营主体和法律负责人审核。
- 支付卡信息必须继续由第三方托管页收集，正式开发不得在本站新增卡号/CVV 字段。

## 2026-07-27 服务陈列标题响应式复验

- 视觉真值：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/source-heading-side-by-side.png`，1140 × 133 px。
- 修改前证据：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/before-heading-stacked.png`，469 × 121 px。
- 修改后全屏证据：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/client-heading-mobile-469-after.png`，454 × 817 px，CSS 视口 469 × 844。
- 320px 回归证据：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/client-heading-mobile-320-after.png`，305 × 804 px，CSS 视口 320 × 844。
- 聚焦证据：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/client-heading-mobile-469-focus.png`，454 × 88 px。
- 同屏比较：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/comparison-heading-side-by-side.png`，1208 × 88 px。
- 状态：首页中文、深色主题、滚动到商品陈列标题区；浏览器设备像素比保持默认，未做高密度缩放。
- 归一化说明：视觉真值是桌面标题区裁切图，不是 469px 移动稿；同屏比较仅将两张图等高到 88px，用于判断“主标题左、副标题右、竖线分隔”的结构关系。移动端字号按现有响应式体系保留紧凑比例，不对桌面字号做错误的像素级套用。

### 比较历史

- 首次发现 `[P2]`：`max-width: 760px` 规则把 `.section-heading` 强制改为单列，同时移除副标题左边框，导致 469px 下主副标题上下堆叠。
- 修复：移动端改为 `max-content minmax(0, 1fr)` 双列网格，恢复竖线与左内边距；320px 下把标题降到 25px、副标题降到 11px。
- 修改后：469px 与 320px 均保持标题在左、副标题在右，副标题允许自然换行；标题区没有超出 `.client-main` 容器。
- 浏览器控制台错误与警告：0。
- 自动检查：`npm run check` 通过，22 项测试与生产构建全部通过。

### 高度平衡复验

- 新增发现 `[P2]`：469px 下副标题两行总高 40.78px，高于主标题的 34.22px；320px 下副标题总高 37.38px，高于主标题的 29.50px。
- 修复：移动端副标题行高从 `1.7` 收紧到 `1.4`，340px 以下进一步收紧到 `1.3`，保持原有字号、文案和左右结构不变。
- 469px 修改后：主标题高 34.22px，副标题高 33.59px；上下边界差均小于 0.32px。
- 320px 修改后：主标题高 29.50px，副标题高 28.59px；上下边界差均小于 0.46px。
- 修改后全屏证据：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/client-heading-mobile-469-balanced.png`，454 × 817 px；`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/client-heading-mobile-320-balanced.png`，305 × 804 px。
- 修改后聚焦证据：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/client-heading-mobile-469-balanced-focus.png`，454 × 74 px。
- 修改后同屏比较：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/comparison-heading-height-balanced.png`，1088 × 74 px。
- 浏览器控制台错误与警告：0；`npm run check` 再次通过，22 项测试与生产构建全部通过。

### 五项视觉表面

- 字体与排版：继续使用项目的宋体展示字体；469px 为 29px / 12px，320px 为 25px / 11px，层级和换行符合移动端密度。
- 间距与布局：双列结构、垂直居中、响应式间距和副标题内边距均已恢复；未改变商品网格及其上下节奏。
- 颜色与视觉变量：竖线继续使用 `var(--line)`，没有引入新颜色。
- 图片质量与素材：本次目标区没有图片素材，未新增或替换任何资源。
- 文案内容：主标题与副标题保持原有中英文数据，中文截图文案与视觉真值一致。

## 2026-07-28 移动端服务陈列标题光学校正

- 用户截图复核发现：网格行盒已经垂直居中，但宋体主标题与小号副标题的字形墨迹中心不同，右侧两行副标题视觉上仍略高。
- 修复：仅在 `max-width: 760px` 的既有移动端规则中，将 `.section-heading__copy` 下移 `2px`；未改变字号、行高、分隔线、左右间距、文案和桌面布局。
- 469px 复验：主标题行盒中心为 `202.11px`，副标题应用光学校正后中心为 `204.11px`；CSS 变换为 `matrix(1, 0, 0, 1, 0, 2)`，对视口横向溢出为 0。
- 320px 复验：主标题行盒中心为 `199.75px`，副标题应用光学校正后中心为 `201.75px`；CSS 变换为 `matrix(1, 0, 0, 1, 0, 2)`，对视口横向溢出为 0。
- 视觉证据：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/client-heading-mobile-469-optical.png`；`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/client-heading-mobile-320-optical.png`。
- 浏览器控制台：0 个警告、0 个错误。
- 自动检查：`npm run check:rules`、`npm run test:i18n`、`npm run test:ux` 单独通过；`npm run check` 全量通过，共 40 项自动测试，所有平台类型检查与构建成功。
- 证据边界：结果只证明当前本地源码和指定视口通过，未部署或修改生产环境。

## 2026-07-27 商品结果数量提示删除复验

- 视觉真值：Browser Comment 1，页面 `http://127.0.0.1:5174/#/home`，目标 selector 为 `main#products > section.product-section.page-section:nth-of-type(2) > div.catalog-tools:nth-of-type(2) > p.discovery-result`；源图是对话内联标注截图，没有本地文件路径。
- 修改后证据：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/client-result-count-removed-496.png`，481 × 965 px，CSS 视口 496 × 995。
- 复验状态：首页中文、深色主题、`图像创作` 分类选中，过滤后保留 1 个商品。
- 初始发现 `[P2]`：结果计数行额外占用一行，且用户明确要求彻底删除。
- 修复：删除 JSX 节点、`resultLabel` 计算、中文和英文 `resultCount` 文案键及三处专用 CSS；更新项目约束，防止计数提示回归。
- 修改后：`.discovery-result` 节点数为 0；中英文计数文本均不存在；分类过滤仍返回 1 张商品卡片；分类栏到商品网格间距为 28px；无结果空状态继续保留。
- 浏览器控制台错误与警告：0；`npm run check` 通过，22 项测试与生产构建全部通过。
- 字体与排版：计数文字节点已彻底移除，不再参与页面排版。
- 间距与布局：删除后的筛选栏到商品网格保持 28px 正常间距，无残留空行。
- 颜色与视觉变量：搜索框、分类栏和商品卡片颜色保持不变。
- 图片质量与素材：商品素材未改动。
- 文案与交互：中英文计数文案均已删除；搜索、分类过滤和明确的无结果状态保持可用。
- 对比边界：源标注图只存在于对话内，无法生成本地同屏比较文件；已在同一路由、同一 CSS 视口和同一筛选状态下复现并检查修改后截图。

## 结果

- P0：0
- P1：0
- P2：0（先前 2 个发现、本轮 2 个响应式发现及本次结果数量提示均已修复并复验）

final result: passed

## 2026-07-28 管理后台导航重设计

### 视觉真值与同屏对照

- 已选方案 1：`/Users/wangchao/.codex/generated_images/019fa72d-a830-79a3-96a2-cf39ee78e508/call_SMgI31wqx0s2PfCm3C6WmnSn.png`，1487 × 1058。
- 桌面实现：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/admin-navigation-desktop-1440x1024.png`，CSS 视口 1440 × 1024。
- 同状态对照：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/admin-navigation-reference-vs-implementation.png`；实现图仅等比归一化到视觉真值尺寸后并排，没有修改页面内容。
- 390px 抽屉：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/admin-navigation-mobile-390x844-drawer.png`。
- 390px “更多”底部面板：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/admin-navigation-mobile-390x844-more.png`。
- 320px 英文长名称：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/design-qa/evidence/admin-navigation-mobile-320x844-english.png`。
- 桌面对照状态：商品中心、中文、内容与商品展开、工作区存在溢出并显示“更多 2”。视觉真值中的页面指标卡不是本轮范围；按方案约束保留了现有商品页面、路由和数据。

### 实现与交互复验

- 六个主导航均使用稳定 ID、Phosphor 线性图标、完整名称与展开箭头；二级导航以缩进和竖向节点轨道区分。
- 手风琴始终最多展开一个分组；点击已展开分组可收起，打开其他分组会关闭上一分组；路由和顶部标签切换会同步展开所属分组。
- 整栏折叠后宽度为 72px，只保留六个主导航图标；点击图标会恢复 276px 侧栏并展开对应分组。
- 运营总览固定且无关闭按钮；左侧二级导航打开标签时不会重复；关闭当前标签后实际切换到其左侧相邻标签。
- 桌面 1440px 下固定标签与当前标签始终可见，溢出项进入“更多 2”；菜单项名称完整显示，可切换和关闭。
- 390px 与 320px 下只显示当前标签，其余标签进入底部面板；选择二级导航后抽屉自动关闭。
- “更多”支持 Escape 关闭并把焦点返回触发按钮；标签支持 ArrowLeft、ArrowRight、Home、End，并在移动端跨越溢出项切换。
- 导航按钮具有 `aria-expanded`、`aria-controls`、`aria-current`；标签使用 `tablist`、`tab`、`aria-selected`，当前页焦点可见。
- 展开组与工作区标签仅存在 React 会话状态，未写入 localStorage；刷新或退出登录后重置。

### 响应式与缺陷修复历史

- 桌面 1440 × 1024：文档 `clientWidth` 与 `scrollWidth` 均为 1440px；主导航、标签和页面级布局无横向溢出。
- 390 × 844：实际内容宽度 375px，文档宽度 375px；侧栏宽度 320px，中文主、二级导航没有省略号、裁切或横向滚动。
- 320 × 844：实际内容宽度 305px，文档宽度 305px；英文 `Systems & integrations`、`Operations & customer` 等长名称完整显示，页面无法水平滚动。
- 首轮发现 `[P2]`：移动端标签容器的 `backdrop-filter` 形成 fixed 包含块，导致“更多”面板定位到视口上方。修复为移动端关闭该滤镜，底部面板实际矩形落在视口内。
- 首轮发现 `[P2]`：固定标签是菜单行唯一按钮，同时命中关闭按钮的 `:last-child` 样式，被压成 44px。修复为只匹配相邻的第二个按钮。
- 首轮发现 `[P2]`：全局 `body { min-width: 320px }` 在 320px 视口带滚动条时产生 15px 页面横向滚动。修复为仅在后台挂载时把 body 最小宽度清零并裁切页面级横向溢出，内部数据表滚动不受影响。
- 首轮发现 `[P2]`：移动端只渲染当前标签，原键盘算法在可见标签内循环，ArrowLeft 无法切换。修复为按完整会话标签顺序导航，并在新标签渲染后恢复焦点。

### 五项视觉表面

- 字体与排版：沿用现有后台字体体系；主导航 14px 半粗，二级导航 12px；移动端名称允许自然换行，未使用 `text-overflow: ellipsis`。
- 间距与布局：276px 侧栏、58px 主导航触点、44px 二级触点、50px 桌面标签栏与 58px 移动标签栏保持明确层级；参考图的深色侧栏/浅色工作区结构已复现。
- 颜色与视觉变量：继续使用原有后台海军蓝、青色激活态、浅灰工作区与现有状态色，没有引入第二套配色。
- 图片质量与素材：复用现有 CloudBridge 品牌标和商品素材；导航只使用项目已安装的 Phosphor 图标，不含 Emoji、手绘 SVG、CSS 图形或占位素材。
- 文案与内容：保留全部现有中英文路由名称和页面内容；工作区“更多”数量、固定标签、关闭名称及移动端面板文案均与语言同步。

### 自动检查与边界

- `npm run check`：通过。
- 导航专项：5/5 通过，覆盖单开手风琴、标签去重、固定标签、关闭后的左邻选择、固定/当前标签优先可见。
- 全量 Node 测试：40 项通过；遗留 Vite 构建、Sites 打包、平台 TypeScript 检查、Next.js 客户端构建、管理后台 Vite 构建和基础设施构建全部通过。
- 浏览器交互、路由切换和视觉检查未出现页面错误叠层。当前 in-app Browser 不提供控制台历史日志导出能力，因此没有把无法导出的原始 console 计数伪报为 0。
- 本轮没有修改公开路由、API、数据库、权限模拟或页面组件接口，也没有提交、推送或部署。

### 结果

- P0：0
- P1：0
- P2：0（首轮 4 个响应式/交互问题均已修复并复验）

final result: passed

## 2026-07-28 管理后台数据表全局单行设计

### 范围与统一规则

- 订单、商品、分类、翻译、币种、团队、审计日志、支付映射、Webhook、对账、争议、会话、数据保留、恢复点、安全事件和 Telegram 发送记录统一采用“一个字段一列、一条记录一行”。
- 订单中心固定拆分为订单号、订单时间、商品、金额、联系渠道、联系账号、状态、支付状态、负责人和操作；USDT 与金额在同一单元格内横向显示。
- 联系账号继续默认脱敏，不因拆列而暴露完整客户资料。
- 桌面端优先同屏展示；移动端保留完整表头和记录行，通过表格容器横向滑动查看，不再切换成多行卡片。
- 本轮仍是模拟数据的设计原型，没有连接后端、数据库、真实支付或 Telegram Bot API。

### 同屏对照证据

- 修改前订单桌面端：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/admin-single-line-table-audit-20260728/01-orders-current-1440.png`
- 修改后订单桌面端：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/admin-single-line-table-implementation-20260728/01-orders-implemented-1440.png`
- 桌面端修改前后对照：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/admin-single-line-table-implementation-20260728/09-orders-desktop-source-vs-implemented.png`
- 修改前订单移动端：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/admin-single-line-table-audit-20260728/05-orders-current-mobile-390x844.png`
- 修改后订单移动端：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/admin-single-line-table-implementation-20260728/02-orders-implemented-mobile-390x844.png`
- 移动端修改前后对照：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/admin-single-line-table-implementation-20260728/10-orders-mobile-source-vs-implemented.png`
- 移动端币种、团队、安全事件与 Telegram 发送记录代表性页面：`05-currencies-mobile-390x844.png`、`06-team-mobile-390x844.png`、`07-security-events-mobile-390x844.png`、`08-telegram-delivery-mobile-390x844.png`，均位于本轮实现证据目录。

### 浏览器与响应式验证

- 1440px 桌面端：页面宽度与文档宽度均为 1440px；订单表格 10 列全部同屏可见，无页面级横向溢出，记录行高 53px。
- 390 × 844 移动端：页面宽度与文档宽度均为 390px；订单表格容器可视宽度 353px、内部表格宽度 1088px，横向滑动正常，记录保持 53px 单行。
- 移动端订单号列和操作列固定，操作按钮为 44 × 44px；卡片式订单节点数量为 0。
- 商品、币种、团队、安全事件和 Telegram 发送记录的移动端记录行分别保持 52–56px 单行，页面本身均无横向溢出。
- 中文与英文订单表头均已验证；语言切换不会改变币种或破坏列结构。
- 浏览器控制台错误与警告：0。

### 自动检查

- `npm run check:legacy`：通过。
- 规则检查：10 个基线文件、104 个源码文件通过。
- `test:catalog` 5/5、`test:i18n` 3/3、`test:ux` 6/6、`test:security` 5/5、`test:admin-tables` 3/3、`test:sites` 4/4，共 26 项通过。
- Vite 生产构建与 Sites 打包：通过。
- 顶层 `npm run check` 已执行：上述前端检查、5 项平台架构测试和平台 TypeScript 检查均通过；最终在 `apps/storefront` 的 Next.js 构建阶段因 TypeScript 7 不提供 Next.js 所需 compiler API 而失败。该后期平台工作区兼容性问题不属于本轮纯前端表格设计范围，未擅自修改框架或 TypeScript 版本。

### 结果

- P0：0
- P1：0
- P2：0

final result: passed

## 2026-07-28 Telegram 新订单机器人后台设计

### 范围与边界

- 新增后台路由：`/admin/telegram-bot`，位于“运营与客户”分组的通知中心之后。
- 本轮只补设计和模拟交互：不连接 Telegram Bot API、不保存 Bot Token、不创建后端、数据库或消息队列。
- 默认目标是内部 `CloudBridge 订单管理群`；消息只包含订单号、商品、金额、币种、状态、创建时间、联系渠道和脱敏联系方式。

### 同屏对照证据

- 现有后台通知中心（视觉基准，1440 × 1000）：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/telegram-bot-design-20260728/02-source-admin-notifications-1440.png`
- Telegram 连接与事件（1440 × 1000）：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/telegram-bot-design-20260728/03-telegram-setup-desktop-1440.png`
- Telegram 脱敏消息模板（1440 × 1000）：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/telegram-bot-design-20260728/04-telegram-template-desktop-1440.png`
- 移动端连接配置（390 × 844）：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/telegram-bot-design-20260728/05-telegram-setup-mobile-390x844.png`
- 移动端事件开关（390 × 844）：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/telegram-bot-design-20260728/06-telegram-events-mobile-390x844.png`
- 移动端消息模板（390 × 844）：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/telegram-bot-design-20260728/07-telegram-template-mobile-390x844.png`
- 移动端脱敏消息预览（390 × 844）：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/telegram-bot-design-20260728/08-telegram-preview-mobile-390x844.png`
- 现有后台与新增页面同屏比较：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/telegram-bot-design-20260728/09-source-vs-telegram-desktop.png`

### 交互与安全验证

- 管理员登录与 MFA 门禁保持生效；未认证时不能直接看到 Telegram 页面。
- “设计连接流程”进入现有重新认证弹层，要求操作原因、动态码/恢复码和风险确认。
- 连接页没有 Token 输入框，只显示“未配置”“未来由服务端从 Secrets Manager 读取”和末尾脱敏 Chat ID。
- 消息模板禁止完整联系方式、内部备注、付款凭据、登录信息、Token 和未脱敏个人数据。
- 模拟测试可切换成功/失败结果；两种结果都明确说明没有请求 Telegram。
- 发送记录区覆盖模拟已发送、排队、失败、重试和恢复状态；重试后尝试次数与待重试数量同步更新。
- 中英文界面可切换，语言与订单币种保持独立。
- 浏览器控制台错误和警告：0。

### 响应式与可用性

- 1440 × 1000 页面宽度为 1440px，无横向溢出。
- 390 × 844 实际内容宽度为 375px，文档宽度不超过可视区域。
- 首次移动端检查发现三个标签按钮总宽度导致可见横向滚动条；已改为三等分网格并复验，标签区 `clientWidth` 与 `scrollWidth` 均为 349px。
- 移动端三个标签按钮、三个事件开关和模拟测试按钮高度均为 44px。
- 桌面与移动端均保留现有深色侧栏、浅灰工作区、白色面板、字体、圆角、线条和 Phosphor 图标体系。

### 自动检查

- `npm run check:legacy`：通过。
- 规则检查通过，14 个源码文件纳入检查。
- `test:catalog` 5/5、`test:i18n` 3/3、`test:ux` 6/6、`test:security` 5/5、`test:sites` 4/4，共 23 项通过。
- Vite 生产构建通过，Sites 打包文件生成成功。
- 顶层 `npm run check` 已执行，但后续平台工作区检查被 `apps/admin/tsconfig.app.json` 没有任何 `src` 输入阻断；该目录不属于本轮 Telegram 纯前端设计改动，本轮未扩展范围修复。

### 比较结果

- 新页面沿用现有后台的密度、组件层级、状态色和操作位置，没有引入第二套 UI 语言。
- Telegram 品牌蓝只用于机器人图标与消息预览，未改变 CloudBridge 后台的主色和导航结构。
- 桌面端的配置与事件双栏、模板与消息双栏，移动端均按自然任务顺序堆叠。
- 没有新增图片占位、Emoji、手绘 SVG、完整机密或真实客户数据。

### 结果

- P0：0
- P1：0
- P2：0（移动端标签栏横向滚动已修复并复验）

final result: passed

## 2026-07-28 全站 Logo 区域统一

### 视觉真值与范围

- Logo 视觉真值：`/Users/wangchao/Desktop/源码文件夹/简易购物网站/public/assets/cloudbridge-logo.png`，349 × 176，透明 PNG。
- 用户确认的统一规则：客户端和后台使用同一 Logo 与横向品牌结构，只允许页头、侧栏、登录、页脚和品牌预览采用不同容器尺寸；不重新绘制后台专用 Logo。
- 范围：客户端页头与页脚、后台侧栏、后台认证页、网站设置品牌预览。
- 非目标：不替换 Logo 资产、不调整导航信息架构、不改变业务流程、登录逻辑、数据库、服务器或支付。

### 同屏对照证据

- 后台订单页修改前：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/admin-single-line-table-implementation-20260728/01-orders-implemented-1440.png`，1440 × 1000。
- 后台订单页修改后：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/brand-logo-redesign-20260728/04-admin-brand-after-1440.png`，1440 × 1024。
- 后台全屏并排对照：`/Users/wangchao/.codex/visualizations/2026/07/28/019fa6f1-fb2c-7f90-90f5-afe9dedbcbbf/brand-logo-redesign-20260728/11-admin-full-before-after.png`；两图等比归一化到 850px 高后并排，未修改页面内容。
- 后台 Logo 聚焦对照：`12-admin-logo-focus-before-after.png`，左右各为同一页面左上角 320 × 100px 裁切。
- 客户端 Logo 聚焦对照：`13-client-logo-focus-before-after.png`，左右各为同一首页左上角 440 × 90px 裁切。
- 后台登录 Logo 聚焦对照：`14-auth-logo-focus-before-after.png`，左右各为登录页左上角 360 × 100px 裁切。
- 移动端客户端页头：`06-client-brand-after-mobile-390x844.png`。
- 移动端后台登录：`07-admin-auth-after-mobile-390x844.png`。
- 移动端后台侧栏：`08-admin-sidebar-after-mobile-390x844.png`。
- 移动端客户端页脚：`09-client-footer-after-mobile-390x844.png`。
- 后台品牌设置预览：`10-admin-settings-brand-after-1440.png`。
- 未单独生成新 Logo 资产；以上聚焦对照均实际复用同一 349 × 176 源文件。

### 缺陷与修复历史

- 首轮发现 `[P2]`：后台登录页把约 1.98:1 的 Logo 强制渲染为 38 × 38px，造成明显纵向拉伸；侧栏、页头、页脚和设置预览也各自维护不一致的方形图片框。
- 修复：新增共享 `BrandMark`，全部位置复用同一 Logo；图片统一使用 `object-fit: contain`，由 `client / admin / auth / footer / preview` 五个修饰类只控制容器尺寸。
- 首轮发现 `[P2]`：客户端 Logo 下方“连接全球 AI 服务”、后台“云桥管理中心 / Operations console”、登录页后台副标题和页脚说明形成不一致的两行品牌结构。
- 修复：所有 Logo 区只保留主品牌名称。中文移动页头继续按既有规则保留“云桥”，英文和后台使用 CloudBridge；副标题节点数量均为 0。
- 修改后桌面后台侧栏 Logo 框为 46 × 27px，登录页为 50 × 29px，客户端页头为 48 × 28px，页脚为 56 × 32px，品牌预览为 50 × 29px。
- 390 × 844 下客户端页头 Logo 框为 44 × 26px，后台移动侧栏为 46 × 27px；文档宽度与可视宽度相同，没有页面级横向溢出。

### 五项视觉表面

- 字体与排版：保留现有中英文品牌主名称及字体体系；客户端和后台均取消第二行小字，品牌视觉中心与操作区重新对齐。
- 间距与布局：所有品牌区使用同一“Logo + 主名称”横向结构；不同场景只改变 Logo 框尺寸和相邻间距，移动端没有挤压语言、币种或菜单按钮。
- 颜色与视觉变量：继续使用原有蓝青 Logo、深色客户端页头、深蓝后台侧栏和浅色认证页，没有新增配色或装饰性渐变。
- 图片质量与素材：直接复用 349 × 176 原始 PNG，使用 `object-fit: contain`，没有拉伸、裁切、手绘 SVG、CSS 图形、Emoji 或新生成的替代标志。
- 文案与内容：客户端品牌副标题、后台“云桥管理中心 / Operations console”、登录页 Admin 品牌副标题、页脚和品牌预览副标题均已删除；页面其他业务文案不变。

### 自动检查与边界

- `npm run check`：通过。
- Logo 专项：3/3 通过。
- 全量 Node 测试：40 项通过；规则检查、遗留 Vite 构建、Sites 打包、平台 TypeScript 检查、Next.js 客户端构建、管理后台 Vite 构建和基础设施构建全部通过。
- 浏览器复验覆盖客户端页头与页脚、后台侧栏与登录、后台品牌预览、桌面端和 390 × 844。
- 页面没有出现错误叠层。控制台历史导出被当前浏览器 URL 安全策略阻止，因此未把原始 console 计数伪报为 0。
- 本轮没有提交、推送、部署，也没有修改真实后端、数据库、支付或 Telegram 集成。

### 结果

- P0：0
- P1：0
- P2：0（Logo 拉伸和品牌副标题不统一均已修复并复验）

final result: passed

## 2026-07-28 中转站服务悬浮入口

### 视觉真值与实现范围

- 视觉真值：`/Users/wangchao/.codex/generated_images/019fa72d-a830-79a3-96a2-cf39ee78e508/call_E0JdGEAveEAcZI3MvzGZhq5M.png`，1672 × 941。
- 选定结构：方案 1 的右下角胶囊、网络节点图标、完整双语标题和外跳箭头；用户后续将表面收敛为半透明暖铜金玻璃质感，在区别深蓝/青色背景的同时保持整体协调。
- 实现范围：根目录遗留 Vite 原型的客户端悬浮入口、后台网站设置、HTTPS 校验、本地浏览器存储和移动端购买栏避让。
- 非目标：主平台 `apps/`、真实 API、数据库、生产配置、提交、推送和部署。

### 自动与静态证据

- `npm run test:transit-service`：4/4 通过。
- `npm run check`：通过；遗留原型测试与构建、Sites 打包、主平台测试、全部 TypeScript 检查及工作区构建均通过。
- Vite 当前预览：`http://127.0.0.1:5174/`；首页和新增组件源码均通过 HTTP 返回。
- 安全边界：只接受 HTTPS，拒绝危险协议、嵌入账号或密码的网址；外跳使用新标签页和 `noopener noreferrer`。
- 默认显示；未配置网址时点击给出本地化提示，后台明确关闭后隐藏，保存有效网址后安全外跳。
- 动态包含青色节点呼吸、整体缓慢漂浮、悬停抬升和箭头移动、按压缩放；`prefers-reduced-motion` 会停用持续动画。

### 浏览器与视觉比较阻断

- 实现截图：缺失。
- 目标视口：1440 × 1024、390 × 844、320 × 844。
- 状态：中文客户端已启用入口、英文客户端已启用入口、商品详情移动端、后台设置有效/无效网址。
- Browser 插件控制连接在实现后不可用，无法取得同视口实现截图、执行后台保存与外跳交互、核对控制台或完成参考图与实现图的同屏比较。
- 因缺少浏览器渲染证据，字体与排版、间距与布局节奏、颜色变量、图标质量以及完整双语文案只能通过源码与构建检查，不能作为视觉通过证据。
- 聚焦区域比较同样因缺少实现截图而无法执行。

### 结果

- P0：未发现，但缺少浏览器证据。
- P1：未发现，但缺少浏览器证据。
- P2：移动端位置、真实换行和选定方案视觉一致性尚待浏览器复验。

final result: blocked

## 2026-07-28 管理后台工作区标签拖拽排序

### 实现范围

- 实现位置：根目录遗留 Vite 原型的工作区标签、纯排序函数、响应式样式和导航专项测试。
- 非目标：正式 `apps/admin`、路由、页面数据、权限、API、数据库、本地持久化、提交、推送和部署。
- 排序约束：工作台固定首位且不可拖动；其他标签按当前会话排序，刷新或退出后重置。

### 自动与静态证据

- 新增纯函数覆盖目标前后插入、固定标签、无效移动、去重、跨溢出顺序和排序后关闭当前标签选择左邻。
- 桌面可见标签提供 Phosphor 拖拽手柄、半透明拖动源和青色插入线；“更多”面板改为包含全部已打开页面的排序管理列表，但按钮数字仍表示隐藏数量。
- 移动端面板使用 44px 手柄和 220ms 长按启动，纵向拖动靠近边缘时自动滚动；标签名称继续自然换行且没有省略号。
- 键盘支持 Space/Enter 开始与完成、方向键移动、Home/End 跳到允许范围首尾、Escape 取消，并通过 `aria-live` 播报结果和恢复手柄焦点。
- `npm run test:admin-navigation`：15/15 通过，包含排序纯函数及指针、触摸、键盘和完整管理面板的静态回归约束。
- `npm run build`：遗留 Vite 生产构建和 Sites 兼容产物生成通过。
- `npm run check`：完整通过；全部遗留测试与构建、Sites 测试、平台架构测试、五个工作区类型检查和全部平台构建均通过。

### 浏览器验收阻断

- 本地预览 `http://127.0.0.1:5174/` 返回 HTTP 200。
- 已按 Browser 技能要求检索两次浏览器控制入口，但当前会话没有暴露所需的浏览器控制工具；没有改用未获授权的独立 Playwright。
- 因此尚未生成 1440 × 1024、390 × 844 和 320 × 844 实现截图，也未执行真实鼠标拖动、触摸长按、自动滚动、键盘焦点和页面横向溢出测量。

### Findings

- [P2] 缺少拖拽排序的真实浏览器交互与响应式视觉证据
  - Location：管理后台右侧顶部工作区标签和“更多”面板。
  - Evidence：排序纯函数、专项测试、构建和全量检查通过，但当前无法控制浏览器执行指针与触摸序列。
  - Impact：不能把可编译性和状态测试等同于真实拖动手感、插入线位置、移动端长按阈值和自动滚动体验。
  - Fix：Browser 控制恢复后，在三个目标视口分别复验中英文、可见标签排序、完整面板排序、Escape 取消、键盘顺序和刷新重置。

### 结果

- P0：未发现，但缺少浏览器证据。
- P1：未发现，但缺少浏览器证据。
- P2：真实拖拽手感、移动端长按和响应式布局仍待 Browser 复验。

final result: blocked

## 2026-07-28 管理后台九入口信息架构重构

### 实现范围

- 实现位置：根目录遗留 Vite 原型 `src/AdminApp.jsx`、`src/admin-navigation.js`、`src/styles.css`。
- 导航模型：一个直接入口 `工作台 / Workspace`，以及八个 `group` 类型的单开手风琴；页面 ID 和 `/admin/:page` 路由保持不变。
- 分组顺序：订单与售后、商品管理、内容与展示、客服与通知、财务与结算、成员与权限、安全与合规、系统与运维。
- 非目标：不修改正式主平台 `apps/admin`、权限、API、数据库、工作区标签逻辑、提交、推送或部署。

### 自动与静态证据

- `npm run test:admin-navigation`：10/10 通过，覆盖九入口固定顺序、工作台直接入口、24 个页面 ID 各出现一次、无空组、每组最多四项、任务分组、三个既有数字角标、单开手风琴和工作区标签行为。
- `npm run build`：遗留 Vite 生产构建与 Sites 兼容产物生成通过。
- `npm run check`：完整通过；遗留测试与构建、Sites 测试、平台架构测试、五个工作区类型检查及全部平台构建均通过。
- 工作台点击与品牌入口都会把展开分组设为 `null`；进入其他页面时按唯一页面映射自动展开所属组；侧栏收起时点击分组仍先恢复 276px 侧栏并打开该组。
- 移动端继续选择入口后关闭抽屉；导航名称保留自然换行和完整显示，没有引入 `text-overflow: ellipsis`。
- `AGENTS.md` 与 `docs/ARCHITECTURE.md` 已记录同一九入口迁移规范；正式 `apps/admin` 后续只显示真实实现页面，不创建空入口或虚假功能。

### 浏览器与视觉验收阻断

- 实现截图：缺失。
- 目标视口：1440 × 1024、390 × 844、320 × 844。
- 待验状态：中文和英文、全部九个一级入口、最长英文名称、左栏滚动、工作台清空展开组、单开手风琴、72px 收起后打开分组、移动抽屉关闭、工作区标签、数字角标、键盘焦点和 44/48px 点击目标。
- Browser 插件在本轮无法取得可调用的控制连接；按 Browser 技能规范重试后仍不可用，因此未生成实现截图、未执行真实点击、未读取渲染后的布局尺寸或控制台状态。
- 构建和源码检查只能证明模型、静态交互路径与可编译性，不能代替响应式视觉、真实焦点顺序和抽屉行为验收。

### Findings

- [P2] 缺少本轮信息架构的浏览器渲染与交互证据
  - Location：遗留原型管理后台左侧导航。
  - Evidence：导航专项与全量检查均通过，但没有 1440/390/320 实现截图和真实点击记录。
  - Impact：无法确认九个一级入口在窄屏英文状态下的真实换行、滚动边界、光学层级和键盘焦点是否无回归。
  - Fix：Browser 插件恢复后，在三个目标视口分别复验中文与英文，并补充抽屉、折叠、手风琴、工作台和角标截图。

### 结果

- P0：未发现，但缺少浏览器证据。
- P1：未发现，但缺少浏览器证据。
- P2：响应式视觉、真实交互和键盘焦点仍待 Browser 插件复验。

final result: blocked

## 2026-07-28 客户端分类导航胶囊选中态

### 视觉真值与实现范围

- 视觉真值：`/Users/wangchao/.codex/generated_images/019fa888-d1e2-7771-a3cd-4b92505b2677/exec-056e38c7-087f-4a87-90a1-7e79d1ff7864.png`，1872 × 840 px。
- 选定状态：Product Design 方案 1；深色横向分类导航，当前分类使用青色低对比胶囊，禁止底部横线。
- 实现范围：根目录遗留 Vite 客户端 `src/App.jsx`、`src/client-ux.js`、`src/styles.css` 和 `tests/client-ux.test.mjs`。
- 非目标：主平台 `apps/storefront`、分类数据、API、数据库、管理后台、提交、推送和部署。
- 本地实现 URL：`http://127.0.0.1:5175/#/home`，HTTP 200。
- 目标 CSS 视口：1440 × 1024、390 × 844、320 × 844，设备像素比 1。
- 状态：中文与英文首页；首项、中间项和末项选中；横向滚动起点、中段和末端；减少动态效果。

### 自动与静态证据

- 旧的 `button::after` 底部横线已移除；选中态改为 44px 点击目标、999px 圆角、青色半透明填充、细边框和高对比文字。
- 横向导航监听真实 `scrollLeft / clientWidth / scrollWidth`，只在对应方向仍有内容时显示边缘渐隐。
- 点击分类调用 `scrollIntoView({ block: "nearest", inline: "center" })`；系统开启减少动态效果时使用即时滚动。
- `npm run test:ux`：7/7 通过，其中溢出方向覆盖无溢出、起点、中段和末端。
- `npm run test:i18n`：3/3 通过。
- `npm run build`：通过，Sites 兼容产物生成成功。
- `npm run check`：完整通过；规则检查、全部遗留测试、Sites 测试、平台架构测试、五个工作区类型检查及全部平台构建均通过。

### 全视图与聚焦比较

- 实现截图：缺失。
- 全视图同屏比较：阻断；没有浏览器渲染截图，无法把视觉真值与同视口实现放入同一比较输入。
- 聚焦导航比较：阻断；无法核对胶囊实际高度、字重、边框透明度、选中项光学居中和边缘渐隐是否与视觉真值一致。
- 交互证据：阻断；无法在真实页面点击首项、中间项和末项并读取滚动位置，也无法核对页面级横向溢出和控制台错误。

### 五项视觉表面

- 字体与排版：源码沿用项目的 Inter、SF Pro Text、Noto Sans SC、苹方和微软雅黑字体栈，14px 桌面、12px 窄屏；真实字形、抗锯齿和字重仍需截图复验。
- 间距与布局：源码使用 44px 点击高度、8–14px 项间距、14–16px 水平内边距；320px、390px 和 1440px 的真实裁切及页面溢出仍需浏览器测量。
- 颜色与视觉变量：选中态复用现有 `--cyan` 色系，未引入新的品牌色；真实对比度和背景融合仍需渲染复验。
- 图片质量与素材：该组件不包含图片、Logo、插画或非标准图标，不需要新增图像资产。
- 文案与内容：保留现有中英文分类数据及“全部 / All”本地化键，没有新增硬编码业务文案。

### Findings

- [P2] 缺少浏览器渲染和交互证据
  - Location：客户端首页商品分类导航。
  - Evidence：视觉真值可读取，本地服务 HTTP 200，但当前会话没有可调用的 Browser 控制工具，无法生成实现截图或执行真实点击。
  - Impact：自动检查能证明逻辑和构建正确，不能证明窄屏渐隐、自动居中、实际字形和视觉一致性。
  - Fix：恢复 Browser 插件控制，或在用户明确授权后使用独立 Playwright；按 1440、390、320 三个视口捕获同状态实现图，完成同屏比较并复测控制台。

### 结果

- P0：未发现，但缺少浏览器证据。
- P1：未发现，但缺少浏览器证据。
- P2：真实视觉一致性、滚动位置和窄屏页面溢出尚待浏览器复验。

final result: blocked
