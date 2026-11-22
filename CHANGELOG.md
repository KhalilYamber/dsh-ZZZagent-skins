# 变更记录

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。
版本号在动刀产生第一份自有产物前不启用语义化，统一用 `0.0.x` 递进；
第一次对外发布时再定 `0.1.0` 起点。

## [Unreleased]

### 计划

- 首次重启验证（`runtime-001`）：token 是否生效、背景层是否被挡、`immediately` 是否真起作用
- `accent` 仍是冰青 `#67DCE7`，与这张图的玫红主调冲突，待定
- 删掉 `zzz-remielle-dan/preview/` 两张过期旧截图（约 8.8 MB）

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
