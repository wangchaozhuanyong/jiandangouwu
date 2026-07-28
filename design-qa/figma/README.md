# CloudBridge Figma 验收板

此目录用于把 `fullsite-ux-20260728-final` 的 28 张浏览器验收截图整理为 Figma 可导入验收板。

生成：

```bash
node design-qa/figma/generate-acceptance-board.mjs
```

输出：

- `output/CloudBridge-UX-Acceptance-Board.svg`：包含 28 张原始截图、测试尺寸、分组、通过状态和验收注释。
- `output/board-manifest.json`：结构化验收清单与当前限制。

Figma 直接写入能力可用时，应创建一个 Figma Design 文件，将 SVG 导入后用 Section 包裹两个验收区，并按清单复核：

- 截图编号 01–28 顺序完整。
- 每行最多 15 张，卡片横向间距 200px，行间距 600px。
- 28 张截图均清晰可见，注释位于对应截图下方。
- 预期错误状态使用黄色标识，不误报为正式成功链路通过。
- 正式 API 成功链路与真实用户性能数据继续标记为待验证。
