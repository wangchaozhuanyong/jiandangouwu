# 数据、接口与安全

## 数据

- D1：商品、内容、设置、订单、审计、员工预授权、Telegram 投递、汇率同步、隐私请求和密钥版本。
- R2：商品/轮播/微信客服二维码媒体与加密备份。
- 联系方式：AES-256-GCM 版本密文；查询值使用独立派生 HMAC。
- 密钥：`CLOUDBRIDGE_DATA_KEY` 为当前根密钥，`CLOUDBRIDGE_DATA_KEY_NEXT` 只用于受审计轮换。

## 员工访问

- CloudBridge 只保存管理员邮箱、显示名称、状态和预设角色权限，不保存 ChatGPT 密码、Cookie 或会话凭据。
- 新员工初始状态为 `INVITED`，表示“等待同邮箱首次登录”，不表示已经发送邮件。`/v1/admin/auth/me` 只在精确邮箱匹配时原子激活；停用账号和未预授权邮箱失败关闭。
- 员工创建、角色修改和启停要求当前 Sites 身份具备 `team.manage` 与 `roles.manage`，提交前重新读取身份，并校验当前所有者邮箱、业务原因和成员版本。
- 所有者角色系统保护，不允许自我修改、降级、停用或通过员工表单分配。

## 微信二维码与分享设置

- 微信二维码复用 `merchant_channels.direct_target` 保存 `/media/uploads/...` R2 路径；公开接口只返回 `qrImageUrl`，微信 `directTarget` 始终为 `null`。
- 上传仅接受文件签名匹配的 PNG、JPEG 或 WebP，最大 5MB；版本冲突、R2 或 D1 失败均不得提示成功，新 R2 对象在提交失败时补偿删除。
- 媒体引用统计包含微信渠道；仍被渠道引用的二维码不能从媒体库删除。移除渠道引用不会自动永久删除 R2 文件。
- 分享模板存入 `storefront.settings`，只允许 `{productName}` 和 `{price}`；旧设置读取时补安全默认值，商品网址由客户端按当前路径生成并移除查询参数与锚点。

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
