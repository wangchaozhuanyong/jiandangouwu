# CloudBridge 语言完整显示与圆角边框清晰度验收

## 范围

- 实现：`apps/storefront/app/globals.css`
- 参考图：
  - `/var/folders/y2/73zzsdhn3d78m_qqhkb2lrq80000gn/T/codex-clipboard-3f4f3f7c-1219-4d0b-a6cc-fbabf80a58a5.png`
  - `/var/folders/y2/73zzsdhn3d78m_qqhkb2lrq80000gn/T/codex-clipboard-c883406f-8056-4323-8fc0-e80c198fe401.png`
- 视口：451 × 844、390 × 844、320 × 844
- 语言：中文、英文

## 响应式测量

| 视口 | 语言控件 | 地球图标 | 当前语言 | 四宫格列宽 | 页面溢出 |
| --- | --- | --- | --- | --- | --- |
| 451 | 128 × 44 | 显示 | `English` 完整，52/52px | 202px + 203px | 0 |
| 390 | 94 × 44 | 隐藏 | `English` 完整，53/53px | 174px + 174px | 0 |
| 320 | 94 × 44 | 隐藏 | `English` 完整，53/53px | 139px + 139px | 0 |

四宫格实测为真实 `1px solid rgba(128, 218, 239, 0.42)` 外框、`padding: 0`、`gap: 1px`、`background-clip: padding-box` 和 `18px` 圆角。移动端列宽使用整数像素分配，451px 下不再出现 202.5px 双列。

## 同屏视觉比较

- `comparison-header-source-vs-fixed.png`：左侧为用户问题图，右侧为同宽修复结果；`Engl...` 已变为完整 `English`。
- `comparison-capability-source-vs-fixed.png`：左侧为用户问题图，右侧为同状态修复结果；外角闭合、描边连续，十字分隔保持克制亮度。
- 全页证据：`en-451-full.jpg`、`en-390-full.jpg`、`en-320-full.jpg`、`zh-451-full.jpg`、`zh-320-full.jpg`。
- 客服抽屉证据：`zh-390-support.jpg`。

## 交互与内容

- 语言菜单：方向键展开，Enter 切换，Escape 关闭并把焦点返回触发器；点击页面外部关闭。
- 币种菜单：方向键、Escape 和焦点返回通过；中文选项只显示本地化中文名称且无 `USD/CNY/MYR` 可见代码。
- 从 `/en?q=Gemini` 切换到中文后保留 `q=Gemini`，当前 `CNY` 保持不变，可见名称从 `Chinese Yuan` 更新为 `人民币`。
- 客服抽屉：390px 下完整落入视口，无横向溢出；Escape 关闭后焦点返回客服按钮。
- 浏览器控制台：没有 warning 或 error。

## 自动检查

- Storefront 专项：10/10。
- 平台视觉规则：12/12。
- Storefront 类型检查：通过。
- `npm run check`：通过。

## Findings

- P0：0
- P1：0
- P2：0

final result: passed
