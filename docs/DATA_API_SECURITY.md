# 数据、接口与安全

## 数据

- D1：商品、内容、设置、订单、审计、Telegram 投递、汇率同步、隐私请求和密钥版本。
- R2：媒体与加密备份。
- 联系方式：AES-256-GCM 版本密文；查询值使用独立派生 HMAC。
- 密钥：`CLOUDBRIDGE_DATA_KEY` 为当前根密钥，`CLOUDBRIDGE_DATA_KEY_NEXT` 只用于受审计轮换。

## Telegram

- Secret：`TELEGRAM_BOT_TOKEN`、`TELEGRAM_ORDER_CHAT_ID`。
- 真实连接状态：`MISSING_SECRETS`、`UNVERIFIED`、`CONNECTED`、`ERROR`。
- 重试：即时、1 分钟、5 分钟、30 分钟、2 小时、12 小时。
- 消息仅包含订单白名单和脱敏联系方式。

## 汇率

- ECB：EUR 参考汇率交叉换算 MYR/CNY/USD/SGD/EUR/GBP/JPY/IDR。
- Coinbase：USDT/MYR。
- 非正数、缺币种、未来时间、超过 10% 波动或不完整批次拒绝写入。
- 法币超过 120 小时、USDT 超过 48 小时后相关订单返回 `RATE_STALE` 或 `RATE_UNAVAILABLE`。

## 数据治理

- 草案：联系方式 180 天匿名化、订单 2 年、审计 1 年、Telegram 90 天、备份 30 天。
- 当前只预览，不自动删除。
- 隐私访问、更正和删除申请由管理员核验并登记；不可逆匿名化要求二次确认。
- D1 恢复保持人工批准的新库导入、验证、切换与回滚，不提供无人确认覆盖。
