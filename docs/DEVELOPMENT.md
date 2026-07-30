# 开发工作流

## 基线

- Node.js 24.x，npm 11.x。
- 安装：`npm ci`
- 本地完整运行：`npm run dev:sites`
- 类型：`npm run typecheck:platform`
- 完整门禁：`npm run check`
- Sites 打包：`npm run build:sites`

## 变更规则

1. 先确认当前分支、状态、目标文件与 D1 迁移影响。
2. 接口或表结构变更先更新 `packages/contracts` 与 `apps/sites/db/schema.ts`。
3. 使用 `npm run db:generate --workspace @cloudbridge/sites` 生成迁移并审查 SQL。
4. 补充成功、拒绝、异常、并发与移动端状态。
5. 运行受影响测试，最后运行完整门禁。

生产密钥只由 Sites 管理；`.env.example` 只能包含空值或占位值。
