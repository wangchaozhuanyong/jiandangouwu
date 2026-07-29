# CloudBridge 云桥

CloudBridge 是一个中英文双语的 AI 工具服务商城项目。当前仓库同时保存正式全栈主平台、共享契约、AWS staging 模板，以及仍用于 Sites 兼容交付的遗留前端原型。

## 当前状态

- `apps/storefront`：Next.js 16 客户端，已接入本地目录、分类、搜索、币种、库存和人工订单 API。
- `apps/admin`：React 19 + Vite 8 管理后台，24 个路由均使用真实数据或明确受限的能力边界；已接入登录、RBAC、审计、内容、客服、订单与系统就绪页面，不用模拟成功代替未连接能力。
- `apps/api`：NestJS 11 + Prisma 7 + MySQL 8.4 API，使用 Valkey 管理后台会话。
- `packages/contracts`：前后端共享领域类型。
- `infra`：AWS CDK staging 模板；仓库中的模板不代表云资源已经创建。
- `apps/sites`：已发布的 Sites Worker 运行时，使用 D1、R2 与 ChatGPT 管理员身份授权。
- `src`：遗留 Vite 设计原型，仅用于迁移对照和旧 Sites 兼容构建，不承载新增生产功能。

当前设计方向为“夜航画廊”：深海军蓝连续画布、克制的青色桥接线、大字号编辑式排版和安静的动效。产品能力、模拟能力与未来规划的边界以 [`docs/PRODUCT.md`](docs/PRODUCT.md) 为准。

## 本地开发

环境要求：

- Node.js 24.x
- npm 11.x
- Docker Desktop

安装依赖并启动本地基础服务：

```bash
npm install
npm run db:up
npm run db:migrate
npm run db:seed
```

分别启动 API、客户站和管理后台：

```bash
npm run dev:api
npm run dev:storefront
npm run dev:admin
```

本地入口：

- 客户站：`http://localhost:3000/zh`
- 管理后台：`http://localhost:5176`
- API 文档：`http://localhost:3001/v1/docs`

首次配置请复制 `.env.example` 为本地 `.env` 并填写仅用于本机开发的值。不要提交 `.env`、Token、密码、Cookie 或生产地址。

## 检查

提交前运行：

```bash
npm run check
```

该命令覆盖规则、遗留原型、Sites Worker、主平台测试、TypeScript 类型检查和生产构建。AWS 模板可额外使用以下只读命令检查：

```bash
npm run synth --workspace @cloudbridge/infra -- --no-lookups
```

本地构建、测试和 `cdk synth` 只证明对应的本地层级，不代表已经部署或生产可用。

## 文档

- [产品范围与能力状态](docs/PRODUCT.md)
- [架构与技术路线](docs/ARCHITECTURE.md)
- [开发工作流](docs/DEVELOPMENT.md)
- [数据、接口与安全](docs/DATA_API_SECURITY.md)
- [全站体验与交互系统](docs/UX_INTERACTION_SYSTEM.md)
- [测试、证据与发布](docs/TESTING_AND_RELEASE.md)
- [路线图与开放问题](docs/ROADMAP.md)
