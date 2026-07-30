# CloudBridge 员工、微信二维码与商品详情设计验收报告

## 最终结论

**final result: passed**

本报告只证明当前工作树与本地 Sites 预览的界面和交互验收结果，不代表已提交、已部署或已在真实手机相册完成保存。

## 设计基准与实现证据

- 原始问题截图：
  - `/var/folders/y2/73zzsdhn3d78m_qqhkb2lrq80000gn/T/codex-clipboard-2fdc031e-f9e2-4f72-9057-95b0eb56eb25.png`
  - `/var/folders/y2/73zzsdhn3d78m_qqhkb2lrq80000gn/T/codex-clipboard-1c0bd1d1-4b36-4b46-9510-e2342f922391.png`
  - `/var/folders/y2/73zzsdhn3d78m_qqhkb2lrq80000gn/T/codex-clipboard-bae3e06f-08ae-459a-af48-d6330dbce9c5.png`
- 对照图：
  - `artifacts/design-qa/comparison-roles.png`
  - `artifacts/design-qa/comparison-picker.png`
  - `artifacts/design-qa/comparison-detail-top.png`
- 重点实现截图：
  - `artifacts/design-qa/team-1440.png`
  - `artifacts/design-qa/roles-1440.png`
  - `artifacts/design-qa/wechat-admin-dialog-1440.png`
  - `artifacts/design-qa/share-settings-1440.png`
  - `artifacts/design-qa/detail-390-top.png`
  - `artifacts/design-qa/detail-390-scrolled.png`
  - `artifacts/design-qa/contact-sheet-390.png`
  - `artifacts/design-qa/detail-1440-menu.png`
  - `artifacts/design-qa/support-no-qr-390.png`

## 浏览器环境

- 本地 Sites：`http://localhost:3001`
- 视口：1440 × 1000、390 × 844、320 × 700
- 语言：简体中文和英文
- 像素密度：浏览器默认密度
- 主题：CloudBridge 深色客户端、浅色管理端
- 控制台：最终检查没有 `error` 或 `warn`

## 视觉与交互检查

### 角色与员工

- 原始权限码墙已改为四张业务角色卡，先显示角色职责、能做什么、不能做什么和成员数。
- 所有者、运营员工、客服员工、只读员工的层级和限制可直接阅读；技术权限保留为折叠详情。
- 员工页只有一个页面标题，桌面内容不设居中窄宽上限，移动端没有页面级横向溢出。
- 1440px 下表格完整展示；390px 下表格保留内部滚动边界，页面宽度等于视口宽度。
- 本地浏览器真实完成了“添加员工 → 等待首次登录 → 相同邮箱首次登录激活 → 无权限直接路由回到工作台”的流程，并在验收后清理本地测试成员和审计数据。

### 微信二维码

- 微信编辑框明确区分账号、二维码、操作原因、扫码确认和网页直跳边界。
- 上传区保留真实文件选择、预览/替换/移除状态，不显示虚假的“已扫码”或“已保存”结果。
- 客服面板在微信无二维码时仍保留复制账号能力；390px 下弹层贴合安全区且没有横向溢出。
- 自动化覆盖二维码签名、大小、R2 失败补偿和媒体引用保护；真实相册写入仍需 HTTPS 环境下的 iOS Safari 与 Android Chrome 实机检查。

### 联系方式选择弹层

- 390px 下列表框尺寸为 390 × 256，固定在视口底部；打开时页面滚动锁定。
- 初始焦点落在当前选项，Escape 关闭后焦点返回触发框，`aria-expanded` 恢复为 `false`。
- 1440px 下菜单与触发框同宽（约 511px），顶部位于触发框下方 8px。
- 渠道图标、服务时间、选中态、拖动提示和关闭按钮均清晰可见。

### 商品详情与分享

- 390px 与 320px 下主内容和首图都从 `top: 0` 开始，全站页头数量为 0，返回和分享按钮覆盖在首图上。
- 320px 与 390px 均无页面级横向溢出，固定购买栏没有覆盖最终内容。
- 顶部哨兵离开后出现 56px 高的不透明深蓝导航栏，背景为 `rgb(6, 24, 39)`，带青色底线和居中商品名。
- 1440px 保持双栏详情结构；390px 和 320px 使用全宽无顶部圆角首图。
- 中英文商品名、价格、说明和固定购买栏均通过浏览器检查。
- 管理后台分享模板支持 `{productName}`、`{price}`，界面直接提示未知占位符会被拒绝；商品网址由系统自动附加。

## 对照检查历史

1. 原角色页：技术权限码直接平铺，信息密度失控。
   - 调整：四张业务角色卡 + 业务能力/限制 + 折叠技术详情。
   - 结果：通过。
2. 原联系方式下拉：移动端使用浏览器原生弹框，样式、层级和触控反馈不一致。
   - 调整：移动端底部弹层、桌面锚定菜单，共用数据和键盘逻辑。
   - 结果：通过。
3. 原商品详情：全站页头和返回区占据首图上方空间。
   - 调整：详情路由移除全站页头，首图顶到顶部，覆盖返回/分享，滚动后显示独立不透明导航。
   - 结果：通过。

## 剩余真实设备验收

- 手机相册是否最终写入由浏览器与操作系统决定，自动化只能确认文件分享调用、原图下载和长按保存回退。
- 发布到 HTTPS 环境后，应分别使用 iOS Safari 和 Android Chrome 扫码、分享、保存一次。
