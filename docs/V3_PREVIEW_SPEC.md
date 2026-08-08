# CloudBridge V3 设计预览规范

> 状态：仅 `design/v3-preview` 分支的开发预览规范。V3 不代表生产能力，不得据此宣称订单、支付、API 状态、自动履约或服务器持久化已经上线。

## 1. 设计目标

V3 的产品定位是 `Intelligent Commerce Interface / AI Digital Commerce OS`。视觉方向使用深色、低噪音、高对比、精确空间和克制的光谱色，避免传统商城、赛博朋克、满屏玻璃拟态和无目的动画。

核心原则：

- 90% 极简 + 10% 惊艳。
- 动效用于解释状态、层级和操作反馈，不用于装饰堆砌。
- 首页强调品牌与能力地图；内页快速进入任务，不重复大型 Hero。
- AI 服务、API / Transit、Skills 保持不同内容语义，但共享设计系统与全局体验层。
- 所有 V3 页面持续保留开发预览真实性边界。

## 2. 当前预览路由

- `/preview/v3/{locale}`：首页 / Intelligent Commerce landing。
- `/preview/v3/{locale}/ai-recharge`：AI 软件服务平台筛选。
- `/preview/v3/{locale}/transit-subscriptions`：API / Transit 基础设施与套餐矩阵概念。
- `/preview/v3/{locale}/skills`：Developer Skill Marketplace。
- `/preview/v3/{locale}/cart`：仅本地概念购物车。
- `/preview/v3/{locale}/products/{slug}`：购买控制台式商品详情。

支持 `zh` 与 `en`。

## 3. 全局 Experience Layer

所有 V3 路由必须由一个共享体验层覆盖：

- `⌘K / Ctrl+K` 打开 Command Search。
- Command Search 支持模糊查询、上下方向键、Enter 和 ESC。
- 桌面端提供克制的 Command 快捷入口。
- 760px 及以下使用 safe-area-aware 固定底部导航。
- 网络断开时显示非阻塞离线提示；网络恢复显示短时恢复 Toast。
- 路由切换使用 180–240ms 轻量淡入与 5px 以内位移。
- `prefers-reduced-motion: reduce` 下关闭非必要动画。

## 4. 视觉 Token

基础方向：

- Canvas：`#050507`
- Panel：约 `#0B0D12`
- Text：约 `#F7F8FB`
- Muted：约 `#8F95A3`
- Hairline：`rgba(255,255,255,.08–.11)`
- Success / online：薄荷绿，仅用于状态，不作为大面积品牌色。
- Electric violet / cyan：仅用于环境光、强调态和少量互动反馈。

圆角按层级变化，不全站统一为大圆角：

- Button / Input：10–13px
- Product / utility card：16–20px
- Hero / immersive media：22–28px

## 5. 动效标准

- Button / hover：90–160ms。
- Drawer / palette：180–280ms。
- Route transition：180–240ms。
- Ambient motion：8–20s 循环，且不得阻塞主线程任务。
- Hover 位移不超过 4px；不使用大幅 3D tilt。
- 禁止持续动画 `box-shadow`；使用 opacity / transform / pseudo elements。

## 6. 响应式验收

强制检查宽度：1440、1024、768、390、320px。

### Desktop

- 不出现页面级横向滚动。
- Command Search 宽度最多约 680px。
- 商品详情保持视觉区 + sticky purchase console。
- AI 商品卡桌面可四列，但信息不得被截断。

### Tablet

- 900px 以下商品详情、Transit 和 Cart 收为单列。
- 商品目录最多两列。
- sticky console 降级为文档流，避免滚动冲突。

### Mobile

- 760px 以下显示四项底部导航，并正确处理 `env(safe-area-inset-bottom)`。
- 所有核心触控目标不小于 44px。
- 商品列表优先横卡或单列，不允许缩成不可读多列。
- Header 不得与底部 Dock 重复堆放无价值功能。
- 页面为底部 Dock 预留空间，不遮挡最后一个可操作元素。

## 7. 加载、错误与异常状态

- 页面加载使用结构化 Skeleton，不使用大 Spinner。
- 图片加载应优先保留尺寸，避免 CLS。
- Error state 必须允许重试，不使用只有一句 `Something went wrong` 的死路。
- V3 具有专属 404 / Signal Lost 状态，并提供首页和 Command Search 返回路径。
- Offline 不阻止已加载内容阅读，但任何真实提交能力仍必须失败关闭。

## 8. 真实性边界

当前 V3 中以下均属于界面概念或本地交互：

- 购物车内容与小计。
- 套餐选择。
- Transit `Operational / 99.99%` 状态。
- Continue / checkout / manual review 按钮。
- Skill install command 展示。

它们不得创建服务器订单、支付、订阅、履约记录或持久化数据，也不得被文档描述为真实生产状态。

## 9. 视觉 QA 优先级

P0：无横向溢出、文字不截断、44px 触控、路由可达、错误状态可恢复。

P1：排版节奏、卡片高度、视觉焦点、Header / Dock 稳定、Command Search 键盘行为。

P2：光效、hover、细粒度 easing、背景纹理、品牌动效。

只有 P0 与 P1 稳定后再增加 P2 动效。
