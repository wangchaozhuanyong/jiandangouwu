# CloudBridge 云桥

CloudBridge 是一个中英文 AI 工具服务商城。生产平台只使用 Sites：Worker 提供接口，D1 保存结构化数据，R2 保存媒体，管理后台由 ChatGPT 身份保护。

## 目录

- `apps/sites`：唯一生产 Worker、D1 迁移、备份恢复与服务端业务逻辑。
- `apps/storefront`：Next.js 16 客户站源码。
- `apps/admin`：React 19 + Vite 8 管理后台源码。
- `packages/contracts`：前后端共享领域类型。
- `src`、`worker`：Sites 兼容界面与根构建发布链，仍由测试和发布使用。

旧 MySQL、Valkey、Prisma、Docker Compose 与 AWS CDK 平台已归档到 Git 标签 `archive/mysql-aws-pre-removal-20260729`，不再属于当前运行架构。

## 当前能力

- 公开浏览商品、分类、双语内容和币种价格。
- 后台维护商品、内容、联系方式、客服、接单开关、订单和审计。
- Telegram 新订单可靠队列、幂等发送、六档重试和人工重试。
- ECB 法币与 Coinbase USDT/MYR 自动汇率，支持 1/6/12/24 小时间隔与逐币种 AUTO/MANUAL。
- D1 备份与人工批准恢复；数据保留只预览不自动删除。
- 隐私访问、更正、删除申请工作流；版本化密文、HMAC 查询哈希与双密钥轮换。

在线支付、自有域名、无人确认的 D1 自动切换、管理员邀请和跨账号会话暂不开发。正式联系方式未配置前，网站保持公开浏览、关闭客服与接单。

## 本地开发

要求 Node.js 24.x 与 npm 11.x。

```bash
npm ci
npm run dev:sites
```

本地 Sites 运行时会统一提供客户站、管理后台和 `/v1` 接口。环境变量占位见 `.env.example`；Token、密钥、Cookie 和生产地址不得提交。

## 验证与发布

```bash
npm run check
npm run build:sites
```

本地通过不代表已上线。生产完成必须同时具备：精确 Git 提交、Sites 已保存版本、成功部署状态、匿名访客浏览验证和后台受保护验证。

## 文档

- [产品范围与能力状态](docs/PRODUCT.md)
- [架构与技术路线](docs/ARCHITECTURE.md)
- [开发工作流](docs/DEVELOPMENT.md)
- [数据、接口与安全](docs/DATA_API_SECURITY.md)
- [测试、证据与发布](docs/TESTING_AND_RELEASE.md)
- [路线图](docs/ROADMAP.md)
