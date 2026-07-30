# CloudBridge Sites-only 架构

```text
匿名访客 / ChatGPT 管理员
            |
        Sites Worker
       /      |      \
 Storefront  Admin   /v1 API
                 /        \
               D1          R2
              /  \
   Telegram queues    Exchange sync runs
   (orders + alerts)
```

## 代码边界

- `apps/sites`：唯一服务端运行时、D1 迁移、备份恢复、通知、汇率与治理。
- `apps/storefront`：客户站 UI。
- `apps/admin`：管理后台 UI。
- `packages/contracts`：跨端稳定契约。
- 根 `src` 与 `worker`：现有 Sites 兼容发布链，仍需保留。

生产不依赖 MySQL、Valkey、Prisma、Docker 或 AWS。管理员密码不由应用保存。

## 运行原则

- 业务金额和汇率使用十进制字符串与 BigInt 整数运算。
- D1 迁移只从 `apps/sites/drizzle/` 执行。
- 外部通知失败不回滚订单；订单与待投递事件在一个 D1 批次中写入。
- 高优先级审计信号与备份异常写入独立告警队列；投递失败不删除审计或备份记录，六档重试耗尽后等待有原因的人工重试。
- 外部汇率失败保留旧值；达到陈旧阈值后只关闭相关订单，不关闭公开浏览。
- 发布只使用 `.openai/hosting.json` 中的既有 Sites 项目 ID。
