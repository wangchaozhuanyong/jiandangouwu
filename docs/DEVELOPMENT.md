# CloudBridge 开发工作流

## 环境基线

- Node.js：24.x
- 包管理器：npm，依赖以 `package-lock.json` 为准
- 客户端：Next.js 16 + React 19 + TypeScript
- 管理后台：React 19 + Vite 8 + TypeScript
- API：NestJS 11 + Prisma 7 + MySQL 8.4
- 基础设施：AWS CDK，区域固定 `ap-southeast-1`
- 遗留原型：React 19 + Vite 6 + JavaScript/JSX，仅保留兼容

常用命令：

```bash
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:storefront
npm run dev:admin
npm run check:rules
npm run test:catalog
npm run test:i18n
npm run test:ux
npm run build
npm run test:sites
npm run typecheck:platform
npm run build:platform
npm run synth --workspace @cloudbridge/infra -- --no-lookups
npm run check
```

## 开发前

1. 确认工作目录、项目身份、技术栈、包管理器和 Git 状态。
2. 阅读 `AGENTS.md`、相关规则文档、目标代码与测试。
3. 在 `docs/ROADMAP.md` 中确认任务的范围、非目标、风险和验收标准。
4. 复核当前能力是已实现、模拟还是规划，禁止在错误前提上开发。
5. 涉及新增依赖、框架、数据库、登录、支付、部署或生产配置时先获得确认。

## 实现规则

- 优先最小修改，遵循现有组件、命名、状态管理和 CSS 写法。
- 共享逻辑只有在出现真实复用时才抽取，不为简单需求预建复杂抽象。
- 组件必须覆盖与风险相称的加载、错误、空、禁用和提交状态。
- 表单在客户端提供即时反馈；未来服务端仍必须重新验证。
- 所有提交动作防重复点击。异步任务应可显示处理中、成功和失败，取消后不得继续更新界面。
- 不硬编码密钥、Token、密码、私有 URL 或真实个人信息。
- 不删除用户资源、不重写无关文件、不修改部署配置，除非任务明确授权。

## 命名与文案

- 文件、变量、类型、接口字段和未来数据库字段使用清晰英文。
- React 组件使用 PascalCase，函数和变量使用 camelCase，稳定常量使用 UPPER_SNAKE_CASE。
- 业务状态值使用稳定英文枚举，不使用翻译文本作为代码分支。
- 用户界面文案进入统一本地化数据，保证 `zh` 和 `en` 同键、非空。
- 注释解释原因、约束和风险，不重复描述代码表面行为。

## 环境变量

- 所有环境变量必须在 `.env.example` 中提供无敏感信息的占位值或说明。
- 前端只允许读取可公开的 `VITE_` 变量；任何 `VITE_` 值都可能出现在浏览器构建产物中。
- 服务端密钥只能由服务端进程读取；AWS 使用 Secrets Manager，前端构建不得接收密钥。
- 新增变量时同时说明用途、必填性、开发默认值和缺失时行为。

## 完成与交接

- 修改后先运行最相关的测试，再运行 `npm run check`。
- 构建、测试或本地截图只能证明对应层级，不代表生产部署和外部集成成功。
- 交接必须列出：改了什么、修改文件、运行命令与结果、未验证风险、后续事项。
- 不擅自初始化 Git、提交、推送、创建 PR 或部署。
