# 分类影响概览与写权限验收

日期：2026-07-29

## 结论

- `/admin/categories` 已删除旧“影响与排序设计”演示流程，改为只读取现有分类 API 的真实影响概览。
- 当前概览显示 4 个已加载非归档分类、4 个启用分类、8 个已加载商品关联和 0 个需要复核的信号；没有执行分类写入。
- 一次性 `catalog.read` 账号仍可查看真实列表和影响概览，但页面不挂载新增、编辑或保存入口；服务端 `catalog.write` 继续是最终写权限边界。
- 非启用分类退出公开筛选导航，但不会自动隐藏、移动或删除关联商品；归档分类会退出当前管理 GET。
- 未新增 API、Prisma 模型、数据库迁移、权限码、依赖或环境变量。

## 浏览器验收

| 视口 | 语言 | 页面横向溢出 | H1 | 新增/编辑入口 | 可见按钮小于 44px | 标题/语言重叠 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1280 × 900 | 英文 | 0px | 1 | 0 / 0 | 0 | 无 |
| 390 × 844 | 中文 | 0px | 1 | 0 / 0 | 0 | 无 |
| 320 × 844 | 英文 | 0px | 1 | 0 / 0 | 0 | 无 |

- 桌面影响弹窗为 900 × 551.8px；四项摘要和四行真实分类完整显示。影响表 `clientWidth=860px`、`scrollWidth=1120px`，只在自身容器横向滚动。
- 390px 弹窗左右边界为 10px / 380px，`clientHeight=783px`、`scrollHeight=821px`；影响表 `clientWidth=327px`、`scrollWidth=1120px`。
- 320px 弹窗左右边界为 10px / 310px，`clientHeight=783px`、`scrollHeight=850px`；影响表 `clientWidth=257px`、`scrollWidth=1120px`，标题与关闭按钮重叠面积为 0。
- `Escape` 可关闭弹窗，焦点返回“Category impact overview”入口。
- 浏览器控制台 warning/error 为 0。
- 一次性 QA 管理员、角色与关联记录已退出并删除，复核计数为 `0 / 0 / 0`。

## 自动检查

- 分类模型 4 项测试通过。
- 管理后台与平台流程专项测试通过。
- 根目录 `npm run check` 在本阶段代码完成后通过，覆盖遗留原型、Sites、五个工作区类型检查和全部生产构建。
- `git diff --check` 与项目规则检查通过。

## 视觉证据

- `01-desktop-en-readonly.png`
- `02-desktop-en-impact.png`
- `03-mobile-390-zh-readonly.png`
- `04-mobile-390-zh-impact-top.png`
- `05-mobile-390-zh-impact-table.png`
- `06-mobile-320-en-readonly.png`
- `07-mobile-320-en-impact.png`
