# 变更记录

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。
已发布过 `0.1.6`，此后按语义化版本递进：改视觉/修 bug 走 `0.1.x`，
新增能力走 `0.2.x`，破坏性变更走 `0.x.0` 并在此说明。

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
