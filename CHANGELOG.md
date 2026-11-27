# 变更记录

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。
已发布过 `0.1.6`，此后按语义化版本递进：改视觉/修 bug 走 `0.1.x`，
新增能力走 `0.2.x`，破坏性变更走 `0.x.0` 并在此说明。

## [0.3.2] — 2026-11-27

过程行不再裸奔：一轮里的工具调用、搜索、思考读作**一整块圆角深底**，而这块底是半透明的。

本次改动本身是**纯 CSS**：改 `patches.css` 后重新生成 `theme.css`，走
`/remielle-dan/theme.css`（`no-store`），**刷新页面即生效、不必重启**。
发版时随 0.3.2 一并升版本号，`client.js` 的 `BUILD_TAG` 同步更新。

### 为什么改

作者报聊天区的灰色辅助文字看不清，点名三处：「已完成」、「执行了命令、已读取文件、已调用工具等」、
以及过程行本身。给的参照是 kimino 主题的截图：它把一轮里散落的过程行包进同一块圆角深底。
作者要求照这个**形状**做，唯一的区别是**底不做实心**：要保留透明度，透的程度对齐他自己的
用户消息气泡（也就是 `--remielle-bubble-alpha` 的 0.62）。

### 做了什么

只改了 `zzz-remielle-dan/patches.css` 一个源文件，另重新生成 `styles/theme.css`。

- **过程组底**：选择器 `html[data-remielle-dan] [data-step-process]`。底色
  `rgba(29, 51, 79, var(--remielle-bubble-alpha, 0.62))`、
  `border: 1px solid rgba(103, 220, 231, 0.16)`、`border-radius: 14px`、`padding: 8px 12px`、
  `box-sizing: border-box`，这些属性都带 `!important`。另在这个作用域内覆盖两个 token：
  `--dsw-alias-label-tertiary: #AEBECD`、`--dsw-alias-label-secondary: #D8E1EA`（这两行不带 `!important`）。
- **轮尾与过程头提亮**：选择器
  `html[data-remielle-dan] :is([data-chat-flow-kind="turn-tail"], [data-chat-flow-kind="turn-process"])`，
  只覆盖上面同样那两个 token，**不加底**。

### 为什么这样落

- 组的根是 `ChatGroupSeat.tsx:194` 的 `[data-step-process]`。该属性在源码里只出现一次，与
  `data-step-process-body` / `-content` / `-icon` / `-chevron` 是不同的属性名，不会互相命中。
- 组的 `.root` 原本只有 `min-width: 0`（`ChatGroupSeat.module.css:1-3`），没有底、边、圆角、内边距。
- 分组与轮是否结束无关：`conversation-nodes/process-groups.ts:120-142` 的 `rebuild()` 把过程节点
  收进 group 后 `emit(first.key, { kind: 'group' })`，`closed` 只是 group 数据的属性。
- 「已完成，用时…」那一行**不在组里**：它由 `TurnProcessNodeView` 渲染、kind 是
  `turn-process`，以 `groupTree: 'turn'` 建立（`turn-process.ts:334-340`），按
  `isAtOrOutside(node,'process')` 被判为组外，所以组的底盖不到它。那一行改用提亮处理、不套底：
  它是一整行操作栏，套底会成一条横带。规则里同时写了 `turn-tail`，那是冗余保险，不是这一行。
- 未加 `overflow: hidden`：折叠体 `[data-step-process-body]` 自带
  `max-height: min(400px,50vh)` + `overflow-y: auto`，滚动内容已被裁。
- 未加 `backdrop-filter`：作者要透明，不要毛玻璃。

### 兼容

- `package.json`、`client.js`、`host.js` 一个字没动；版本号仍是 0.3.1。
- 只有 `zzz-remielle-dan/patches.css` 与生成产物 `styles/theme.css` 变了。
- 主题关闭态：这条规则随 `theme.css` 一起被摘掉，不需要额外处理。

### 验证

- `node scripts/build-theme-css.mjs`：生成 `styles/theme.css`，token 定义 396 条（含两遍），
  总长 33,872 字符。
- 静态：`theme.css` 花括号 42/42 配平；`[data-step-process]` 规则在产物里一处（另一处出现在
  注释文本里）；`turn-tail` 三处（选择器一、注释两）。
- 线上：`http://127.0.0.1:30973/remielle-dan/theme.css` 返回 **200、43,448 字节**，
  两条新规则内容与源文件一致。
- 真机观感：作者原话「我刷新过了。很好，效果我很满意。」——验收通过。

## [0.3.1] — 2026-11-27

设置页那一栏重做：**照官方设置页的视觉语言来**，并且主题关闭时也有样子。

### 为什么改

0.3.0 的分区样式并进 `theme.css`，主题一关就整份失效，那一栏只剩裸文字
（标题 24px、正文全平铺、按钮像系统默认控件）。作者看过之后要求「做好看一点、贴合官方」。

### 做了什么

- 分区样式拆成独立的 `zzz-remielle-dan/settings.css`：`host.js` 直发
  `/remielle-dan/settings.css`，`client.js` 挂**常驻** `<link>`，主题开还是关都在。
  它只选择 `.remielle-set*`，不碰宿主全局选择器，所以「关掉主题 = 整页原生外观」没被破坏。
- 结构换成官方设置页的「标题 + 引导语 + 卡片 + 行」：标题 16/24/500、卡片
  `0.5px settings-card-stroke` + `radius-xl` + `padding 12/14`、行名 14/22、
  行说明 12/18、按钮 36px 高 `radius-md`。规范出处写在 `settings.css` 顶部注释里。
- 不再用「外观 · 开关」这类小标题，改成三张卡：主题外观 / 壁纸 / 当前值。
- 主按钮（开启主题外观）用 `button-primary-fill`，其余只描边；禁用统一 `opacity .4`。
- 拖放悬停改成给卡片换虚线边，不再给整栏套内阴影。
- 用到的 token 逐个核对过：全部在 `skin-center/contracts/official-tokens-v1.json` 的 329 条里。

### 兼容

- `patches.css` 里那 95 行 `.remielle-set*` 整段删除。`theme.css` 从 34,087 字符降到 31,699，
  不再含任何 `.remielle-set` 规则。
- `package.json` 的 `files` 补上 `settings.css`（漏了打包就 404）。
- 壁纸逻辑、主题开关四件套、聊天区视觉**一个字没动**。

### 验证

- 宿主冒烟 **32 项**、浏览器冒烟 **21 项**全过（新增两条断言：分区样式表常驻、
  渲染用到的 14 个分区类在 `settings.css` 里都有规则）。
- 静态：`node --check` 两侧通过；`settings.css` 花括号 24/24；`theme.css` 40/40。
- **未做**：真机观感。需要作者重启后看两态。

## [0.3.0] — 2026-11-27

设置页可以换壁纸了。**新增能力，走 0.3.x。**

### 用户看到什么

- 设置 → Remielle Dan → 「外观 · 壁纸」：当前壁纸一行、「选择壁纸…」、「恢复默认壁纸」。
  选一张本机图片（JPEG / PNG / WebP）点完当场生效，F5 仍在；恢复默认一键退回插画。
- 也可以把图直接拖进这一块。桌面端的文件对话框没验证过，所以留了这条旁路。
- 超过 2560 像素的图会自动缩小，并告诉你前后尺寸
  （如 `3840×2160 3.2 MB → 2560×1440 780 KB`）。
- 关闭主题外观时这一组只显示一行「先开启主题外观才能更换壁纸」，按钮不渲染。

### 图存在哪

`<DSH_HOME>/remielle-dan/wallpaper.<ext>` 与 `wallpaper.json`。不写插件目录、不进 git。
本机是 `D:\DSH\home\remielle-dan\`（`~/.dsh` 是它的 Junction）。

理由：插件目录属于程序，升级会整体替换；用户数据必须放用户那边。
生态里的先例是 mylife 的 `~/.dsh/mylife/` 与记忆系统的 `~/.dsh/dsh-memento/`。

### 宿主半边

- 新增 `/remielle-dan/wallpaper`：GET 读状态、POST 换图、DELETE 恢复默认，一条 exact route。
- `/remielle-dan/art.jpg` 改成动态：用户图优先，没有就发默认插画。
  自定义图 `no-cache` + ETag（命中回 304），默认图仍是 `max-age=3600`。
- 上传不校验 `Content-Type`（Electron IPC 桥接是否保留该 header 未验证），
  改用 magic bytes 判真实类型；请求体 28MB、解码后 20MB 两道上限。
- 超限不 `destroy()`，把流读完再回 413：destroy 会把 `res` 一起废掉，前端只能看到网络错误。
- `findWallpaper()` 在 json 缺失或它指的文件不在时，用 `readdir` 兜底认
  `wallpaper.jpg|png|webp`，所以手工把图拷进目录也能生效。

### 浏览器半边

- 背景层的图源改成 CSS 变量 `--remielle-bg-image`，fallback 是默认插画。
  `createThemeRuntime` 新增 `bgImage` / `applyBgImage()` / `setBgImage()`；
  **`attach()` 末尾补一次 `applyBgImage()`**，否则关掉主题再开，用户图会丢。
- 缩图三条判据：不超门槛就原样上传；超像素缩到 2560；像素够但文件重只换编码。
  2560 与 q0.86 取自 `jeweis/dsh-skin-lab` 的 `src/shrink.js`。
- 壁纸的 `storage` 监听放在设置页组件里，不放 `apply()`：换图要同时改外观与那行 UI。
- 自报新增 `wallpaper: { custom, bytes, name }`（不含 `dir`）。

### 修掉的 bug

- 清理旧壁纸文件时把刚写好的 `.tmp` 一起删了，`rename` 报 ENOENT。
  冒烟测试抓到，是本次唯一一个真 bug。

### 验证

- 宿主半边：临时假 `webServer` + 真 HTTP，**32 项断言全过**
  （默认态、上传、落盘、换格式、ETag/304、坏数据、DELETE、手工丢图、405）。
- 浏览器半边：假 DOM + 假 React，**18 项断言全过**
  （含「关掉主题再开，自定义壁纸仍在」这条）。
- 静态：`node --check` 两侧通过；`theme.css` 重新生成，花括号 55/55，`.remielle-set-file` 落地。
- **未做**：真机观感、桌面端文件对话框、Electron 大 body 的实际承载。需要作者重启后看一眼。

## [0.2.1] — 2026-11-25

三处向 kimino 靠齐：**形照搬、色不改、不学毛玻璃**。

### 消息区：板从正文区外壳挪到消息流本身

- 0.1.6 把底画在 `[data-conversation-region="chat"]` 上。那一层把滚动区与输入座位
  一起包住，输入卡被关在板里。这一版把板移到 `[data-chat-flow]`（`ChatView.tsx:244`
  的 `.column`），输入座位在板外，板外直接是壁纸。
- 板：`rgba(11,18,30,0.30)` + 1px `rgba(103,220,231,0.12)` + 圆角 20 +
  内边距 12/14/20 + `--dsw-shadow-lv2`；**没有 `backdrop-filter`**。
- `[data-chat-flow]` 还有一个落点是 `ChatGroupSeat.tsx:202` 的组内容层，选择器用
  `:not([data-step-process-content])` 排除，否则过程组会各长一圈框。
- `[data-conversation-region="chat"]` 改成 `transparent`，避免两层叠加。

### 左栏与输入卡

- `--dsw-specific-sidebar-fill`：0.10 → 0.42（向 kimino 的侧栏实度靠齐）。这个 token
  还画着 Windows 标题栏条、任务页信息框、轨迹表头、拖拽预览，会一起变实。
- 窗口底：Windows 标题栏形态下 AppFrame 的 `.frame` 也拿这个 token 给整个窗口垫底，
  0.42 会把聊天区四周的留白一起压暗。补一条
  `[data-windows-titlebar] div:has(> [data-shell-bottom]) { background: transparent }`，
  聊天区留白回到原生壁纸；侧栏列与标题栏条仍保留 0.42。
- 输入卡：1.5px 紫边 + 光晕 → 1px `rgba(123,90,163,0.55)` + 圆角 20 +
  `--dsw-shadow-lv2`；底色显式写回 `var(--dsw-specific-input-major)`，去掉模糊。
- 用户气泡：透明度 0.55 → 0.62，描边 0.1 → 0.35（青）。

### 字标与徽章：墨色/填充配对修正

- `--dsw-alias-label-primary-inverted`：`#F8F3F5` → `#071321`；
  `--dsw-alias-button-contrast-fill`：`#1e6069` → `#F8F3F5`。
- 宿主把这两个当一对用：浅底 + 深字。原来两个都翻成了「浅字 / 深底」，
  附件关闭按钮能看，但官方字标里的 HARNESS 徽章变成白底白字。
- 覆盖四处：字标徽章、侧栏版本徽章、liveshare 版本徽章、附件卡片关闭按钮。
- 副作用：附件关闭按钮由深青底浅字改为浅底深字（回到宿主原本的方向）。

### 与 kimino 的关系

- 两套是**两个独立 bundle**。同一时刻两套都挂载时，页面由两边规则共同决定；
  kimino 当前不在 `dsh.profile.bundles` 里，所以本版没有为共存加对压规则。
- 版本 `0.2.1`，`BUILD_TAG` 同步。

## [0.2.0] — 2026-11-24

按本文件自己的规则，新增能力走 `0.2.x`：这一版加的是一样**能力**（运行时开关），不是视觉微调。

### 设置页新增「主题外观」运行时开关

- 起因是作者的一句话：不要每次不想用这套外观时，都特地叫 agent 来拔插件效果。
  于是在已有分区的顶部放了一个真按钮：「关闭主题外观 / 开启主题外观」，
  点击即时生效——不刷新、不重启、不改 profile。
- **关 = 四件一起摘**：`html[data-remielle-dan]` 属性、`theme.css` 的 `<link>`、
  `BASE_CSS` 的 `<style>`、`#remielle-dan-bg`。少摘一件都会「半脱」，
  逐条原因写在 `ARCHITECTURE.md` 第十节。
- `client.js` 新增 `createThemeRuntime()`：`attach()` 按 1→4 建、`detach()` 按 4→1 拆
  （先撤壁纸、再撤透明规则、最后撤样式表与属性）；`setEnabled()` 写存储并通知订阅方；
  `dispose()` 供插件禁用时总清。`apply()` 里原来的四条 `ctx.effect` 合并成一条。
- 状态存 `localStorage['remielle-dan:enabled']`，值 `'1'` / `'0'`，缺省按「开」。
  读不到（隐私模式、配额）就当开。跨窗口用 `storage` 事件同步，只跟状态、不回写存储。
- 关闭态**根本不创建**节点，所以关着启动不会先闪一下主题，也不会发那次样式表请求。
- 分区组件改用 `React.useState` / `useEffect`（宿主 Builtins 目录有登记；
  同版本另有实证：记忆系统插件的槽组件就在用）。关闭态隐藏「当前值」三行——
  那三个数是现读计算样式拿的，主题一关就全退到兜底值，显示出来是错数字。
- 关闭态的分区没有自定义样式（`.remielle-set*` 随 `theme.css` 一起被摘掉），
  以原生元素显示。这是刻意的：注册与样式解耦，开关才不会把「开回主题」的钥匙锁在里面。
- 自报新增 `themeEnabled`、`hasUseState`；`layer` 语义改为「背景层此刻在不在」；
  每次切换延后 400ms 补一条自报（等样式表落地再采，否则会把「开了」记成「没生效」），
  `.client-report.log` 里能直接看到翻转记录。
- 版本 `0.2.0`，`BUILD_TAG` 同步。

### 样式

- `patches.css` 的 `.remielle-set-btn` 拆成两条：基础态可点（`cursor: pointer`、主文字色），
  `[disabled]` 保留原有占位观感（次要色、`not-allowed`、`opacity: .55`）。
  「导出配置」仍是禁用占位，不受影响。
- `styles/theme.css` 重新生成：31,375 字符、花括号 48/48。

### 验证

- `node --check`（按 ESM 复制成 `.mjs`）：`client.js`、`host.js` 均通过。
- `package.json` 解析通过：`0.2.0` / `main=./host.js` / `immediately=true`。
- 生成幂等：连跑两次 `build-theme-css.mjs`，文件哈希一致。
- `theme.css` 自检：`.remielle-set-btn` 2 处、`[disabled]` 1 处、行首裸 `:root` 0 处、裸 `body` 0 处。
- 线上 `/remielle-dan/theme.css` 返回 200（38,455 字节）且含新按钮规则。
- 冒烟：把 `client.js` 放进假 DOM 里跑一遍（临时脚本，不随仓库分发），28 项断言全过——
  启动挂四件且不写存储、`storage` 事件能卸干净再装回、点按钮真的写 `'0'`/`'1'` 并摘/装、
  关闭态不渲染「当前值」、关闭态的自报能正常发出（`bg` 为 null 也不崩）、
  `dispose()` 后四件全清。
- **实测（2026-11-24 21:22–22:19，真机，取自 `.client-report.log`）**：
  `themeEnabled` 在 21:22–21:23 之间翻转 6 次，每次 `layer` 都跟它同步
  （开 = `true/true`，关 = `false/false`），没出现过「有底色没壁纸」那种半脱；
  关闭态下 `body` 与外壳底色回到原生 `rgb(21, 21, 23)` / `rgb(27, 27, 28)`。
  21:31、22:08、22:19 三次重启的自报都是 `themeEnabled=false`、`layer=false`：
  「关」被记住，关着启动时一件都不建。`hasUseState` 全程为 `true`。
  作者随后一直在关闭态使用，功能正常、未报异常。
- 环境记录：本工作区的 `pwsh` 一开始因沙箱 ACL 授权失败无法启动
  （`grantWrite(D:\GitHub_place\plugins\dsh-ZZZagent-skins)`），
  生成脚本与自检改用放宽权限执行。

## [0.1.7] — 2026-11-23

### 气泡透明度定值：55%，浮窗撤掉

- 删除右下角的**气泡透明度浮窗**：`client.js` 里 `installBubbleControl`、`ALPHA_KEY`、
  `readAlpha`、`writeAlpha` 全部移除。原先可调 20–90%，值存在 localStorage 的
  `remielle:bubble-alpha` 键。
- 启动时 `localStorage.removeItem('remielle:bubble-alpha')` 清掉旧键，不在用户机器上
  留一个再也没人读的残留。
- `patches.css` 的 `html[data-remielle-dan] { --remielle-bubble-alpha: 0.55; }` 成为唯一
  取值来源，运行时不再有任何东西改写它。
- 判定理由：这是一个只需要定一次的值。做成滑杆等于把一个一次性决定长期挂在界面上，
  还多一套读写 localStorage 的分支要维护。**设一个数就够了，不再做滑杆。**

### 新增官方设置页分区（只读占位）

- `client.js` 用 `ctx.slots.inject('settings.section', ...)` + `ctx.slots.register(...)`
  注册一个分区：`{ name: 'settings.section', id: 'remielle-dan', order: 40,
  label: 'Remielle Dan' }`。组件是普通 React 函数组件，`require('react')` 取自宿主内置
  模块，**不需要构建步骤**。
- 模块级 `inject` 由 `[]` 改为 `['slots']`。
- 分区内容只读：标题、一段说明、三行「外观 · 当前值」（用户气泡透明度 55% /
  正文区底 `rgba(11, 18, 30, 0.3)` / 输入文字颜色 `rgb(255, 77, 77)`，运行时读计算样式，
  读不到用兜底值）、两个禁用按钮（恢复默认外观 / 导出配置）、一行版本号。
- **不接 `configForms`，不保存任何设置。** 这一版只是把分区挂上去，让人在官方设置页里
  就能看见当前值，不必再为了看一眼状态去开浮窗。
- 样式类 `.remielle-set*` 写在 `patches.css`，颜色全部走主题 token。
- 注册放在 `apply()` 末尾并套独立 `try/catch`：失败只少一个设置分区，主题照常。
  自报新增 `settingsSection`（`ok` / `failed: ...`）与 `bubblePanel: 'removed'`。
- 契约依据：本机 `D:\GitHub_place\plugins\记忆系统\client\client.js`（yammory-system 插件，
  同版本 DSH）的注册写法在 2449–2455 行，`require('react')` 在 26 行。照实证写，不照文档猜。
- `BUILD_TAG` 同步 `0.1.7`。

### 验证

- `node --check`：`client.js` 通过。
- `theme.css` 重新生成：31,158 字符、花括号 47/47、`.remielle-set` 规则 10 处。
- 线上 `/remielle-dan/theme.css` 返回 200 且含新样式。
- **验收（2026-11-23 20:0x，作者重启后）**：自报日志 `build=0.1.7`、
  `settingsSection="ok"`、`bubblePanel="removed"`、`chatRegion=rgba(11, 18, 30, 0.3)`、
  `paperCount=0`。即分区注册成功、浮窗代码确实没在跑、正文区底照旧。
  `settings-001` 据此标 `passing`（分区内部排版细节未逐条核对，观感有异再调）。

## [0.1.6] — 2026-11-23

### 改变判定：一轮一纸退役，改为「正文区一层底」

查了 DSH 前端源码（`app.asar` 内带完整 TypeScript）后确认：一轮 AI 回复在 DOM 里
**没有容器**，是一排同级行，行间留 4 / 12 / 16px 的缝；缝看不见，是因为正文面板
本身有一层不透明的底（`ConversationRoot.module.css` 的
`.root: background: var(--dsw-alias-bg-base)`）。0.1.5 把该 token 改成 `transparent`，
缝就露成壁纸，一轮被读成几片。

- `patches.css` 新增一条规则，把那一层补回正文区：

  ```css
  [data-conversation-region="chat"] { background-color: rgba(11, 18, 30, 0.30); }
  ```

  挂载点来自 `ConversationContent.tsx`（包住滚动区与 composer 座位）；
  DSH 自己的样式表没有规则挂它，且 `stop-shortcut.ts` 依赖它（Esc 停止）。
- `client.js` 删除整段 `installTurnPaper()` 与 `.remielle-turn-paper` /
  `.remielle-flow-anchor` 的 CSS（共 172 行，文件从 506 行降到 330 行）。
  插件从此对聊天区只读不写：不插节点、不挂 class、不装观察器。
- `patches.css` 删除 0.1.5 为「纸」服务的三段规则：AI 气泡、全链路压透明、
  过程行 14px 内边距与文字抬色。
- 自报新增 `chatRegion.bg` 与 `paperCount` 两项，让「底有没有生效」可以用数字核对。
- `BUILD_TAG` 同步 `0.1.6`。

### 用户气泡左边界多出一截（作者报告「每一条都这样」）

- 原因：底色与圆角原先画在外层 flowItem 上。外层宽度由 max-content 决定，而内层
  `.userStack` 带 `max-width: min(列宽 × 0.702, 82%)` 把这个 max-content 截在上限上，
  于是 flowItem 恒定偏宽；真正装字的 `[data-message-bubble]` 被
  `.userStack` 的 `align-items: flex-end` 靠右放。两者宽度不等，多出的空白全落左边。
- 改法：气泡画到内层 `[data-message-bubble]` 上（它正好包住文字，宽度贴着字）；
  外层只留给「没有内层气泡」的 pending 回显，用 `:not(:has([data-message-bubble]))` 区分，
  避免内外两层同时上底。
- 依据：`MessageItem.module.css` 的 `.userRow` / `.userStack`，以及
  `UserContent.tsx:22` 把 `.userStack` 作为根、`[data-message-bubble]` 是它的直接子元素。
- **作者验收**：2026-11-23 晚刷新后确认「效果看起来，修好了」。

### 输入区文字改色（作者要求「鲜红、显眼」）

- 文字与光标：`#7B5AA3` → `#FF4D4D`。取 `#FF4D4D` 而不是正红 `#FF0000`：
  纯红相对亮度只有 0.21，压在暗底上反而发闷；`#FF4D4D` 约 0.26，视觉上更跳。
- 卡片描边与光晕**仍是紫 `#7B5AA3`**（作者只要求改字，未动边框）。
- 先试过给文字加白色微光晕（贴边 1px / 外扩 8px），作者判定「没什么用」，已撤。
  原因记在 `patches.css` 那段注释里，免得再试一次。
- **作者验收**：2026-11-23 晚确认「效果很不错。我能看清了」。

### 删掉的两条死规则

`[data-disclosure-header]` 在当前 DSH 版本（`0.2.2-rc.5`）源码里**不存在**，
挂在上面的两条规则从未生效。同类教训此前已踩过一次（`assistant` 不是 DOM 取值，
见 0.1.4 段）：源码里看到的属性，不等于运行时 DOM 上一定有。

### 验证

- `node --check`：`client.js` / `host.js` 通过。
- `theme.css` 重新生成：花括号 37/37，`remielle-turn-paper` 残留 0，
  `[data-conversation-region="chat"]` 规则 1 处、`rgba(11, 18, 30, 0.30)` 1 处。
- 视觉观感与自报数字待重启后确认（未确认前不标通过）。

## [已撤回 · 未发布] — 2026-11-23 一轮一纸实验（0.1.6 起作废）

### 实验 · 未通过

- **`/plan` 后用户消息无气泡**：用户气泡选择器扩到 `[data-chat-flow-kind="steering"]`、
  `[data-pending-steering]`、`[data-submission-echo]`。CSS 已生成，尚未单独验收。
- **一轮一个 AI 外框**：
  - `client.js` 新增 `installTurnPaper()`，按连续 AI 节点画 `.remielle-turn-paper`
    背景层；不把聊天节点搬进新父节点。
  - `patches.css` 去掉 AI 节点的逐行底、边框、圆角、阴影；恢复原生 4 / 12 / 16px margin；
    工具行内部、折叠头、leading 托底透明；过程文字抬到次级灰。
  - 分组不再按 `data-chat-turn` 切，只按用户消息、steering、command、pending 回显断开。
- **当前结果**：作者重启后截图仍是一块块深色圆角区域，块间露壁纸；
  一轮一纸目标未达成。失败点与接手步骤见 `SNAPSHOT-一轮一纸-20261123.md`。
- 验证：`node --check client.js` 通过；`theme.css` 花括号 48/48，长度 30,548 字符；
  视觉验收**未通过**。

## [0.1.5] — 2026-11-23

### 未完成 · 实验性（作者要求先停手，未做视觉确认）

- **消息气泡**：`patches.css` 里新增两块规则，把每条消息包成圆角块
  （用户靠右、AI 靠左，深色底，不换配色）。
- 选择器的取值**不是从源码猜的**，是运行时 dump 出来的。页面实际存在的
  `data-chat-flow-kind` 取值只有这些：

  ```
  user · turn-process · assistant-step · tool-call · turn-tail · context · command · steering
  ```

  **注意：没有 `assistant`。** AI 的正文块叫 `assistant-step`
  （源码里 `assistant.ts` 的 `kind: 'assistant'` 是节点内部的类型，不等于 DOM 上的取值）。
- 现状：`user` 选择器实测命中 7 个元素；`assistant-step` 刚改完、未确认。
- **未验证**：气泡是否真的渲染出来、长什么样。要撤掉只需删除
  `patches.css` 里「消息气泡」那一块并重跑生成脚本。

### 「黑纱」的真正原因（先前判断错了一次，记在这里防止再错）

- 第一轮判断：以为是 `client.js` 背景层上那条 `0.28 / 0.22 / 0.32` 的深色渐变。
  去掉它之后作者反馈「没变化」。
- 加了前端自报（见下）后，把**页面实际算出来的**值取回来：那条渐变的 alpha 已是
  `0`，确认改动生效，但仍看不出变化 → 说明它不是主因。
- 自报顺带列出「盖住整个窗口且确实画了东西」的层，只有一个：

  ```
  <div class="_boot_so0he_3"> background-color: rgba(18, 25, 39, 0.46)
  ```

  即 DSH 应用外壳的底板，来自 token `--dsw-alias-bg-base`。
  **这才是压暗整张壁纸的那一层**（46%，比那条渐变的 28% 更重，且覆盖全部区域）。
- 结论：壁纸之上有两层暗色，量级不同。去掉小的那层几乎看不出来；
  真正要动的是 `--dsw-alias-bg-base`。

### 变更

- `--dsw-alias-bg-base`：`var(--dsw-glass-normal)`（= `rgba(18,25,39,0.46)`）→ **`transparent`**。
  面板与卡片仍由 `--dsw-alias-bg-layer-1/2/3` 提供底色，不依赖这一层。
  副作用待观察：代码块顶部小条、附件小格子也用这个 token，会一起变透。
- `--dsw-specific-sidebar-fill`：`rgba(17,25,39,0.36)` → **`rgba(17,25,39,0.10)`**。
  侧栏是另一处独立底色，不归 `bg-base` 管；作者要求左栏也透出壁纸。
  想全透改 `transparent`，觉得字发飘回到 `0.18` 左右。
- 壁纸背景层的那条渐变（上一条里说的「纱」）同时收成三个 CSS 变量
  `--remielle-veil-top/mid/bot`，当前全透明；`client.js` 保留原值兜底。

### 为什么不用 `calc()` 乘系数

期间试过 `rgba(7,19,33, calc(0.28 * var(--x)))` 的写法，**已放弃**：
若浏览器不接受 `rgba()` 内套算式，整条 `background-image` 会被丢弃——
结果是「壁纸消失」，比「纱没去掉」严重得多。改为直接放颜色、由变量提供。

### 新增（诊断）

- `client.js` 加载后把**计算样式**（三个遮罩变量的实际值、背景层是否在、视口尺寸）
  POST 到新路由 `/remielle-dan/report`，`host.js` 追加写入 `.client-report.log`
  （已 gitignore）。用途：改样式的人能确认「浏览器跑的是哪一版、纱解析成什么颜色」，
  不必反复请人截图。写失败不影响外观，路由注册失败也有独立 try/catch，不牵连资产路由。

### 验证

- `node --check client.js` / `host.js` 通过；`theme.css` 花括号 33/33、注释成对
- 线上 `/remielle-dan/theme.css` 含三个变量（两处 token 块各一份），无 `calc` 残留
- **观感待作者确认**：需重启一次 DSH（`client.js` 与 `host.js` 都是启动时装载）

## [0.1.4] — 2026-11-23

### 变更

- **输入卡底色加重，让输入区与正文区分开**（作者要求）：`--dsw-specific-input-major`
  由 `rgba(13, 22, 39, 0.32)` 改为 `rgba(10, 17, 31, 0.44)`。
  作者原话的诉求是「底色变深，但不要实，还是要透的，方便我看到背后的壁纸图」＋
  「略微能看出来这是一块区域」。
  仍留 56% 透明度，壁纸照常透出；只改了不透明度与底色深度，没有动边框与光晕。

### 背景（为什么会糊）

0.1.1 同时做了两件朝「更透」方向的事：底色 `0.5 → 0.32`，以及删掉输入区背后的托底暗带。
两件叠加后，输入卡片失去了与正文的层级差。本次是往回走半步——只把底色补回来一部分，
托底暗带仍然不复原（那条被删是因为作者要求「壁纸铺到窗口最底」，与本次诉求不冲突）。

### 已知边界

- 若 0.44 仍然分不出边界，下一个该调的**不是**继续加不透明度，而是
  `patches.css` 里 `[data-composer-card]` 的 `1.5px #7B5AA3` 描边与光晕——
  分不清是「边」的问题，不是「面」的问题。
- 0.1.1 的说明里留过往回调到 `0.40` 的备选；本次直接定 0.44，不再分两步。

### 验证

- 源文件改 `zzz-remielle-dan/skin.css` 一处 → 跑 `node scripts/build-theme-css.mjs` 重新生成
- `styles/theme.css` 两处 token 块同步为新值，旧值 0 残留，花括号 33/33 配平
- 运行中的服务器 `/remielle-dan/theme.css` 已返回新值（路由 `no-store`，**刷新页面即可，无需重启**）
- **观感未验证**：需要作者刷新后看效果

## [Unreleased]

### 计划

- `accent` 仍是冰青 `#67DCE7`，与背景图的玫红主调冲突，待定

## [0.1.3] — 2026-11-22

### 新增

- **输入卡片描边加粗 + 紫色光晕**：接管整条 `box-shadow`，三层叠加——
  `0 0 0 1.5px #7B5AA3`（实心描边）/ `0 0 20px -4px rgba(123,90,163,.65)`（外发光）/
  `var(--dsw-shadow-lv2)`（原有柔和投影，改用主题自己的 token，避免引用可能不存在的宿主变量）。
  原因：细线本来是 elevation 系统一次性画出的，粗细嵌在它的阴影值里，只改变量改不了厚度。

### 修复（文档）

- 四处文档指向「手改 `styles/theme.css`」，与「`theme.css` 是生成产物」的约定自相矛盾：
  `README.md`（两处：目录树、怎么改表）、`AGENTS.md`（改动分级）、`ARCHITECTURE.md`（卸载与回滚表）。
  已统一改为「改源 → 跑 `scripts/build-theme-css.mjs`」。

## [0.1.2] — 2026-11-22

### 新增

- **输入区改色**（作者指定）：输入框内的文字、光标、卡片描边统一换成 `#7B5AA3`
  （最初指定 `#6C216D`，因对比度过低改为现色）。

### 修复

- **文字规则作用域挂错了**：原来挂在 `[data-phase="active"]` 下。源码
  `ConversationMainPanel.tsx` 里 `phase` 有三个值（`settling` / `hero` / `active`），
  新会话是 `hero`——挂 `active` 会让欢迎页的大输入框不变色、发第一条消息才突然变紫。
  改为挂在输入卡片自己的 `[data-composer-card]`（三种 phase 下同一个 InputBar 渲染）。
- **边框原来改不动**：卡片源码写着 `border: 0`，没有宽度可画；那条细线由 elevation
  系统的 `--dsw-elevation-stroke-color` 决定。改为接管该变量，而不是改 `border-color`。

### 依据（源码，tag `dsh-v0.2.2-rc.5`）

- `packages/client/ui-conversation/src/client/skeleton/InputBar.module.css` 的 `.card`：
  `border: 0` / `border-radius: var(--dsw-radius-panel)` /
  `--dsw-elevation-stroke-color: var(--dsw-alias-border-l2)` /
  `background: var(--dsw-specific-input-major)`。
- `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx` L462：卡片带
  `data-composer-card` 属性。
- `ConversationMainPanel.tsx` L35–38：`phase = settling ? 'settling' : hero ? 'hero' : 'active'`。

### 说明

- 本次仍然**不改** `client.js` / `host.js`：只改了源 CSS 并重新生成，刷新即可。
- 灰色占位提示文字未染色（作者未要求）。

## [0.1.1] — 2026-11-22

### 变更

- **去掉输入区暗带**：删除 `patches.css` 里 `[data-phase="active"] [class*="composerSeat"]:before`
  整条规则（`linear-gradient` 压底 + `backdrop-filter: blur(34px)`）。作者要求壁纸铺到窗口最底。
  保留同一元素上的 `background: none !important`——那是压住宿主自己画的 seat 底色。
- **输入框更透**：`--dsw-specific-input-major` 由 `rgba(13,22,39,0.5)` 改为 `0.32`
  （两处 token 块同步）。磨砂由卡片自身承担，未改动。

### 新增

- `scripts/build-theme-css.mjs`：把"由 `skin.css` 的 `:root` 块 + `patches.css` 合成
  `styles/theme.css`"固化成一个可重跑的脚本。`theme.css` 从此是**生成产物**，
  改样式一律「改源 → 重跑脚本」，不手改产物。
- 顺带修掉一处作用域泄漏：`@supports not (backdrop-filter)` 回退块里的 `:root`
  原来没挂作用域（旧生成逻辑只处理行首 `body`），现在一并挂到 `html[data-remielle-dan]`。

### 未完成

- **统计条玻璃托底**：那条栏是 DSH 内置的聊天统计条（`dsh-session-stats` 投影，
  `dsh-client-ui-chat` 渲染），不是插件，不能"改本体"；只能由主题用 CSS 覆盖。
  其 DOM 无公开契约，需一次运行时探针确定选择器后再做。

### 说明

- 删掉 `:before` 的同时也删掉了它提供的 `blur(34px)`：输入框背后的壁纸会从模糊变清晰。
  这是本次改动想要的效果，但意味着输入框文字会直接对着图片细节——若读不清，
  把 `--dsw-specific-input-major` 回调到 `0.40`。
- 本次不改 `client.js` / `host.js`：产物路径与路由都没变，**刷新页面即可生效**，不需要重启。

## [0.1.0] — 2026-11-22

### 架构转向：皮肤 → 插件

作者要求「不依附皮肤中心，独立出来」，本项目由皮肤形态整体转为 **DSH 插件**。

- 新增插件四件套：
  - `package.json` —— `name` 即包名，也必须是 client 模块 id；
    `main` / `exports["./client"]` / `dsh.client.immediately: true`
  - `cordis.patch.yml` —— insert 一行 `remielle-dan-theme`
  - `host.js` —— 宿主半边，两条 exact 静态路由（样式表、背景图）
  - `client.js` —— 浏览器半边：打 `data-remielle-dan`、挂样式表、铺背景层
- 新增 `styles/theme.css`：由 `skin.css` 的 `:root` 块 + `patches.css` 合成。
  **token 块同时写在 `html[data-remielle-dan]` 与 `html[data-remielle-dan] body` 上**——
  宿主在 `body[data-ds-dark-theme]` 也定义同名变量，自定义属性按最近祖先生效，
  只写 `:root` 会被盖掉，颜色不生效。
- 背景改为插件自绘：`position: fixed; z-index: -1` 的一层，
  `linear-gradient(A 方案遮罩) + url(art.jpg)`。皮肤形态下铺法由宿主决定，现在由本项目决定。

### 修复

- `package.json` 的 `files` 白名单补入 `zzz-remielle-dan/assets`。
  复审时发现：`host.js` 运行时从该目录读背景图，但白名单没列它——
  现在是 `link:` 整目录安装所以没暴露，一旦打包发布，背景图会 404。
- **修掉一个既有隐患**：profile 里 `yammory_system` 的 `link:` 路径是乱码
  （`D:\GitHub_place\plugins\璁板繂绯荤粺`，即「记忆系统」被编码破坏），
  任何一次 `pnpm install` 都会按它重写连接、把记忆系统指到不存在的目录。
  已改正为 `D:/GitHub_place/plugins/记忆系统`，连接目标校验存在。

### 安装与接线

- 接入 `desktop` profile：`dependencies` 加 `link:` 依赖，`dsh.profile.bundles` 加一条。
- 备份：`package.json.bak-remielle-20261122-1900`、`pnpm-lock.yaml.bak-remielle-20261122-1900`。

### 删除

- `C:\Users\杨安秋\.dsh\skins\zzz-remielle-dan\` —— 按作者要求从皮肤中心清除，
  避免同一套视觉有两个入口。插件不读该目录，删除不影响运行。

### 文档

- `README.md` / `AGENTS.md` / `ARCHITECTURE.md` 按插件形态重写。旧版讲的
  `skin.json`、皮肤中心、`$DSH_HOME/skins` 已不成立。

### 未验证

- 插件从未重启装载过。静态检查通过（JSON 可解析、`node --check` 两个 JS 通过、
  CSS 花括号配平、引用路径全在），但视觉效果、token 覆盖是否生效、
  背景层会不会被界面容器挡住，均未实测。

## [0.0.4] — 2026-11-22

### 新增

- `skin.json` 增加溯源字段：`license`（`BSD-3-Clause`）、`sourceUrl`（上游皮肤路径）、
  `attribution`（代码来源 + 背景图权利归属）。这些字段随皮肤本身分发，不依赖读者
  是否去翻仓库根目录的 `NOTICE`。
  - 校验依据：`license` / `licenseUrl` / `noticeUrl` / `sourceUrl` / `attribution`
    五个字段在 v2 清单里都是「可选字符串」，不校验 URL 格式。

### 决策

- **作者知情选择路线③**：把蕾米埃尔插画保留在仓库内，按「夏沫琉璃」的形态以声明
  标注权利归属，不替换素材。
- 性质：这是**风险接受**，不是**授权取得**。本项目未获得任何再分发许可。
  完整记录见 `NOTICE` 第 2.3 节与 `claude-progress.md` Session 004。
- 影响：功能清单里 `publish-001`（对外发布前置条件）由「待做」转为「已知未解决」。

### 修复（同版本复审）

- `skin.json` 的 `version` 由 `0.1.0`（上游值）改为 `0.0.4`，与 `CHANGELOG` 对齐。
- `README.md` 两处过期表述：目录树原写「仅 id/name 已改」，实际已换背景、删素材、
  加溯源字段；上游一节原写「8 文件 SHA-256 逐一校验一致」，现在只有
  `skin.css` 与 `patches.css` 仍与上游一致。均已按现况改写。
- `AGENTS.md` 目录布局里 `assets/` 原写「发布前必须替换」，与路线③的决定矛盾，
  改为指向 `NOTICE` 2.3。
- `.gitignore` 注释仍指向旧目录名 `summer-liquid-glass/`，已更新。

### 说明

- 该决定不改变本机的使用方式。若仓库被平台下架，本地已安装的皮肤不受影响
  ——皮肤是本地目录，与仓库只是来源关系。
- 若日后改为合规形态：替换 `assets/` 下的图 + 改 `skin.json` 的两处 `src`，两步即可。

## [0.0.3] — 2026-11-22

### 新增

- 背景图替换为作者提供的《绝区零》蕾米埃尔插画 `assets/remielle-dan-art.jpg`
  （2197×1280，797 KB）。`contributes.backgroundMedia.{light,dark}.src` 双档指向该图。
- 暗色档遮罩重设。作者在四套候选中选定 **A（沿用原图的竖直渐变 0.28 / 0.22 / 0.32）**。
- 亮色档遮罩改为一层浅色纱（0.90 / 0.80 / 0.72 / 0.72）：浅色外观下文字为深色，
  需要亮底才可读。

### 删除

- `assets/summer-liquid-glass-art.jpg` —— 上游受限素材，换图后不再被引用，
  按作者指示删除。留档说明见 `NOTICE` 第 2.2 节。

### 说明

- **选 A 的代价**：左侧边栏区域的有效亮度为 101.5，而原设计校准值约 68.6，
  侧边栏文字可能发糊。若实际使用中影响阅读，可切回 C 方案（左栏 74.0，
  中右栏保留 81 / 87）。参数只需改 `skin.json` 的 `dark.scrim` 一行。
- `preview/` 两张截图仍对应旧背景，尚未重截（见 `preview-001`）。
- 新背景图同样是游戏美术，不随 BSD-3-Clause 授权，详见 `NOTICE` 第 2.1 节。

## [0.0.2] — 2026-11-22

### 变更

- **身份层改名**（`identity-001` 第一部分）：
  - `skin.json` 的 `id`：`summer-liquid-glass` → `zzz-remielle-dan`
  - `skin.json` 的 `name`：`夏沫琉璃` → `Remielle Dan`
  - 目录名同步改为 `zzz-remielle-dan/`
- 文档同步：`README.md`、`AGENTS.md`、`NOTICE`、`claude-progress.md`、
  `feature_list.json` 中指向旧目录名的「当前状态」描述已改写；历史记录与上游
  路径**保持原样**，不作篡改。

### 说明

- 作者原名 `zzz-Remielle-Dan` 含大写字母，不满足清单校验
  `/^[a-z][a-z0-9-]{0,31}$/`（插件源码 L831 直接 `test()`，无小写归一化），
  故落为全小写；大写形式保留在 `name` 显示名中。
- 本轮只改名字，不改外观。`nameEn`、`tagline`、`description`、`author`、
  `accent`、`order` 六个字段仍是上游值，待下一步处理。
- 除 `skin.json` 外，其余 7 个文件与上游逐字节一致。

## [0.0.1] — 2026-11-22

### 新增

- 引入基线皮肤 `summer-liquid-glass`（夏沫琉璃 / Summer Liquid Glass，`0.1.0`），
  取自上游 `zhu1090093659/dsh-skins` 的 `skins/summer-liquid-glass/`。
  整目录复制，8 个文件逐字节 SHA-256 校验一致，**内容未做任何修改**。
- 建立项目说明骨架：`README.md`、`AGENTS.md`、`ARCHITECTURE.md`、`CHANGELOG.md`。
- 建立许可与溯源：`LICENSE`（BSD-3-Clause，含上游版权行）、`NOTICE`（来源、
  授权边界、不随许可证授权的素材声明）。
- 建立版本库卫生文件：`.gitignore`、`.gitattributes`。
- 建立本地工程面（不进版本库）：`claude-progress.md`、`feature_list.json`。

### 说明

- 本次只做"立项"，不涉及任何外观改动。当前基线目录与上游字节完全一致，
  可作为后续任何改动的对照物。
- 背景插画 `assets/summer-liquid-glass-art.jpg` 按上游声明仅限本地使用，
  对外发布前必须替换。详见 `NOTICE` 第二节。
