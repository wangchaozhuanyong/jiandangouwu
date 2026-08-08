# CloudBridge V3 生产迁移方案

> 状态：Stage 6 迁移设计。本文只定义从现有 V2 正式前台迁移到 V3 的技术路径，不授权替换正式路由、合并 `main` 或部署生产。

## 1. 目标

V3 的生产迁移原则不是“把预览页面复制到正式目录”，而是：

1. 保留现有 API、合同、安全校验与人工订单语义。
2. 用 V3 替换展示层、信息架构与交互表现。
3. 删除 V3 预览中的静态商品、模拟 Transit 状态、独立 localStorage 购物车等假数据逻辑。
4. 在 dev-only live-data 预览中完成真实数据合同验证后，再按路由分阶段切换。
5. 任一阶段都允许回退到现有 V2 正式组件。

## 2. 当前正式架构基线

### 全站基础

- Root layout 已由 `ExperienceProvider` 包裹全站。
- Locale layout 负责读取 `StorefrontConfig`，并提供 SEO title / description。
- 当前 `V2LiveShell` 已经处理：
  - 语言切换；
  - 主题；
  - 客服抽屉；
  - 购物车数量；
  - 订单查询入口；
  - 中转站外链配置；
  - 移动端底部导航；
  - footer / policy 入口。

### Catalog surfaces

以下三个正式路由共用 `getV2CatalogData()`：

| Route | ProductSurface |
| --- | --- |
| `/{locale}` | `HOME` |
| `/{locale}/ai-recharge` | `AI_RECHARGE` |
| `/{locale}/transit-subscriptions` | `TRANSIT_SUBSCRIPTIONS` |

该聚合函数并行读取：

- `StorefrontConfig`
- 分类树
- 对应 placement 的 banners
- 对应 surface 的商品

### Skills

`/{locale}/skills` 独立读取：

- `getSkillCategories(locale)`
- `getSkills({ locale })`

Skills 不应该被强行塞进 Product catalog contract。

### Product detail

`/{locale}/products/{slug}` 并行读取：

- `getProduct(slug, locale, currency)`
- `getConfig(locale)`

产品 API 返回 404 时必须继续使用真正的 `notFound()`。

### Cart and manual order

正式 Cart 使用 `ExperienceProvider.cartItems`，不是 V3 preview 的独立 localStorage cart。

提交订单时必须保留：

- `productId`
- `expectedPrice`
- `currency`
- `contactChannel`
- `contactValue`
- `acceptedPolicyVersion`
- `idempotency-key`

成功后：

- 保存 `OrderReceipt` 的安全摘要；
- 清空 cart；
- 不引入在线支付或自动履约声明。

### Order lookup

继续保持：

- 完整订单号通过 POST body 查询；
- 不把订单号写入 URL、history 或 query string；
- 单独联系方式查询在缺乏所有权验证前保持关闭；
- 本机会话摘要不应被误描述为服务器历史订单列表。

## 3. V3 生产架构

建议最终结构：

```text
app/[locale]/layout.tsx
  -> V3LiveShell
      -> existing ExperienceProvider (root layout)
      -> StorefrontConfig
      -> theme / language / support / cart / orders

app/[locale]/page.tsx
  -> getV2CatalogData(HOME)
  -> V3LiveCatalogPage

app/[locale]/ai-recharge/page.tsx
  -> getV2CatalogData(AI_RECHARGE)
  -> V3LiveCatalogPage

app/[locale]/transit-subscriptions/page.tsx
  -> getV2CatalogData(TRANSIT_SUBSCRIPTIONS)
  -> V3LiveTransitPage

app/[locale]/products/[slug]/page.tsx
  -> getProduct + getConfig
  -> V3LiveProductDetail

app/[locale]/skills/page.tsx
  -> getSkillCategories + getSkills
  -> V3LiveSkills

app/[locale]/cart/page.tsx
  -> getConfig + recommendations
  -> V3LiveCart
  -> existing createOrder()

app/[locale]/orders/lookup/page.tsx
  -> V3 skin over existing lookupOrder() semantics
```

## 4. ViewModel 适配层

已新增：

`apps/storefront/lib/v3-live-adapter.ts`

职责：

- `ProductSummary` → V3 product card ViewModel；
- `ProductDetail` → V3 product detail ViewModel；
- 统一 Money 显示；
- 统一 ACTIVE / FINITE / UNLIMITED / low stock / sold out 判断；
- 平台名称映射；
- Transit plan type 映射；
- 始终保留原始 `source` 对象供 cart/order 使用。

### 重要规则

UI 不允许自己根据字符串猜测商品是否可购买。

只有适配层产出的 `canAddToCart` 才作为 V3 add-to-cart 的可用状态。

加入正式 cart 时必须使用 `viewModel.source`，不能重新拼一个只有 name/price 的伪商品对象。

## 5. Preview 逻辑与 Production 逻辑的边界

以下逻辑只能留在 `/preview/v3`：

- `V3_COMMERCE_PRODUCTS` 静态商品；
- `cloudbridge:v3-preview-cart`；
- Preview localStorage 数量 cart；
- 固定 `$20 / $100 / $500` Transit 方案；
- 固定 `99.99% / Operational` 网络状态；
- Preview-only checkout / manual review disabled 按钮；
- 用静态数组模拟 Skills。

正式 V3 必须改为：

- 商品来自 API；
- cart 来自 `ExperienceProvider`；
- 价格来自 `ProductSummary.price`；
- 库存来自 `stockMode + stockQuantity + status`；
- Transit 商品来自 `TRANSIT_SUBSCRIPTIONS` surface；
- Skills 来自 skills API；
- order submit 使用现有 `createOrder()`；
- order lookup 使用现有 `lookupOrder()`。

## 6. Shell 迁移要求

V3 Live Shell 必须继承现有正式 Shell 的全部能力，而不是只复制视觉：

### 必须保留

- config siteName；
- config SEO metadata；
- theme persistence；
- same-route locale switching；
- support drawer；
- cart count；
- order lookup；
- policy links；
- transit external URL enable / safe HTTPS validation；
- mobile navigation；
- safe fallback when config temporarily unavailable。

### V3 可替换

- Header 视觉；
- nav 信息层级；
- Command Search；
- Cart Peek；
- mobile dock 视觉；
- footer 视觉；
- loading / error / offline feedback。

## 7. Catalog 迁移要求

### HOME

保留真实：

- banners；
- category tree；
- product list；
- search/filter；
- currency；
- cart actions。

V3 视觉可以把它们重新组织为：

- Command Center hero；
- capability stack；
- curated/trending product grid；
- service surface cards。

但“Trending”如果没有后端排序语义，只能作为视觉标题，不得声称实时热门排名。

### AI Recharge

直接消费 `AI_RECHARGE` surface。

平台筛选必须使用真实 `platformKey`：

- OPENAI
- ANTHROPIC
- GOOGLE
- MIDJOURNEY
- PERPLEXITY
- CURSOR
- OTHER

禁止继续使用 `name.includes("Claude")` 这类 preview 筛选。

### Transit

正式 V3 Transit 必须以 `TRANSIT_SUBSCRIPTIONS` 商品为核心。

`transitPlanType`：

- SUBSCRIPTION
- USAGE
- TEAM

除非后端未来提供真实 health/status API，否则不得显示会被理解为实时监控的 `Operational`、延迟、uptime 或 99.99%。

如果只做视觉，可使用明确标注的“服务类型 / 可办理状态 / plan type”，而不是“network status”。

## 8. Product Detail 迁移要求

V3 Purchase Console 保留，但数据替换为真实 ProductDetail。

必须显示/处理：

- name；
- kicker；
- description；
- category；
- imageUrl；
- price；
- compareAtPrice/referencePrice（存在时）；
- stock/status；
- platform/transit type；
- config contact channels；
- policy boundary。

### Add to cart

- 使用 `ExperienceProvider.addCartItem(productSummary)`；
- sold out / inactive 禁止加入；
- 不允许以 V3 local quantity model 改变现有“不同服务去重”的订单语义，除非后端合同先正式支持 quantity。

## 9. Cart / Order 迁移要求

生产 V3 Cart 第一版必须保持当前业务语义：

- 每种 service 最多一项；
- 不增加 quantity；
- 小计使用 decimal-safe 计算；
- contact channel 来自 config；
- contact 做现有 validation；
- submit 有 `submitting/error/success` 状态；
- createOrder 使用 idempotency key；
- success receipt 必须显示并可复制订单号；
- success 后清空购物车；
- checkout 文案仍是人工订单，而不是支付。

### 为什么不直接迁 Preview 数量购物车

当前订单合同只有 item 级 `productId + expectedPrice`，没有 quantity 字段。

如果 V3 UI 允许数量 2/3/4，但提交层仍只发送一次 productId，会形成 UI 与订单语义不一致，因此 production v1 禁止数量控制。

## 10. Error / loading / offline

必须保留当前正式容错：

- Catalog API 失败：Shell 仍可打开，目录进入明确空/错误态；
- Product 404：真正 404；
- Product 非 404 API 失败：允许 recover/retry；
- Config 失败：使用安全本地 fallback，不假造服务器设置；
- createOrder 失败：保留 cart 和 contact，不清空；
- Offline：允许阅读已经加载的数据，但 order submit 必须 fail closed。

V3 skeleton / transition 可以替换表现，不改变这些语义。

## 11. SEO 与索引

正式切换后：

- `/{locale}` 和正式业务路由继续可索引；
- metadata 继续来自 StorefrontConfig；
- `/preview/v3` 与所有 live migration preview 必须 `noindex`；
- 不允许把 dev preview URL 暴露成 canonical；
- slug 路由保持不变，避免商品 SEO URL 迁移成本。

## 12. 分阶段上线顺序

### Wave 0 — 当前 Stage 6

- [x] 完成正式数据流审计。
- [x] 建立 Product → V3 ViewModel adapter。
- [x] 固定 preview/production 边界。
- [ ] 建立 dev-only V3 live-data preview。

### Wave 1 — Live Shell pilot

在 dev-only route 验证：

- config siteName；
- theme；
- locale；
- support；
- cart count；
- order link；
- policy；
- mobile dock。

不切正式 layout。

### Wave 2 — Catalog pilot

在 dev-only route 验证真实：

- HOME；
- AI_RECHARGE；
- TRANSIT_SUBSCRIPTIONS；
- category/search/platform filters；
- image fallback；
- currency display；
- empty/error state。

### Wave 3 — Product + Cart

接入真实：

- ProductDetail；
- ExperienceProvider cart；
- contact channel；
- createOrder；
- receipt。

使用非生产环境 API 做完整订单流程验证。

### Wave 4 — Skills + Order Lookup

- Skills API；
- category/search；
- Skill detail/GitHub destination（若真实合同提供）；
- order lookup V3 skin。

### Wave 5 — Browser visual QA

强制：

- 1440
- 1024
- 768
- 390
- 320px
- zh/en
- dark/light（若 V3 正式保留双主题）
- keyboard
- reduced motion
- offline/reconnect
- empty/error/sold-out/low-stock

### Wave 6 — Route cutover（需要明确批准）

建议按风险从低到高：

1. Skills
2. AI Recharge
3. Transit
4. Home
5. Product Detail
6. Cart
7. Order Lookup / Locale Shell

每个 route 独立提交，确保可单独 revert。

## 13. 上线阻断条件（P0）

任何一项未满足，不允许替换 production route：

- CI full gate 非绿色；
- runtime high/critical audit 非绿色；
- 商品价格不是 API 真值；
- sold-out/inactive 仍能加入 cart；
- createOrder 没有 expectedPrice；
- createOrder 没有 policyVersion；
- 没有 idempotency key；
- order number 被放进 URL；
- contact-only lookup 被无验证开放；
- cart UI 数量与后端 quantity 语义不一致；
- preview-only 99.99%/Operational 被当成真实状态；
- preview static product 被带入 production；
- zh/en 任一可见正式文案缺失；
- mobile 核心触控小于 44px；
- 320px 出现页面级横向滚动；
- 商品 404 不再是 HTTP/Next 404；
- order submit 失败后 cart 被误清空。

## 14. 回滚策略

迁移期间禁止一次性删除 V2 Live 实现。

正确顺序：

1. V3 Live 在 dev-only preview 验证；
2. route-by-route 切换；
3. 每一波 CI + browser QA；
4. 稳定观察后再清理对应 V2 view；
5. `ExperienceProvider`、API client、contracts、order validation 不因视觉切换而删除。

任何 production route 出现问题，优先把该 route 的 view import 回退到 V2，不回滚数据库或 API。

## 15. Stage 6 决策结论

### 保留

- API contracts
- `getV2CatalogData`
- `getProduct/getConfig/getSkills`
- `ExperienceProvider`
- `createOrder/lookupOrder`
- order validation
- resilient image strategy
- theme/storage utilities
- support/config/policy semantics

### 重做视觉

- Live Shell
- Catalog
- AI Recharge
- Transit
- Product Detail
- Skills
- Cart
- Order Lookup
- loading/error/empty states

### 永不带入正式版

- Preview static products
- Preview localStorage commerce store
- fake uptime/status
- fake plan pricing
- disabled mock checkout semantics
- duplicate commerce provider
