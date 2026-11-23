# ARCHITECTURE

本文件回答：DSH 怎么把一套视觉装进去、这个插件在哪几个点上接住它、以及哪些地方会坏。

## 一、为什么是插件而不是皮肤

DSH 本体不认识"皮肤"。它认识的扩展单位只有插件（bundle + 客户端模块）。

"皮肤"是皮肤中心插件（`@linxin666/dsh-client-ui-skin-center`）自己定义的一套格式：
`skin.json` 清单、三层覆盖契约、`$DSH_HOME/skins/<id>/` 目录扫描。用它就等于依赖它。

两条路的差别：

| | 皮肤 | 插件（本项目） |
|---|---|---|
| 生效方式 | 设置里点"应用" | 装载即生效（`immediately: true`） |
| 生效时机 | 刷新页面 | **重启 DSH** |
| 依赖 | 必须有皮肤中心 | 无第三方依赖 |
| 视野 | 只能改颜色与背景 | 能改颜色、背景、层叠、加动画 |
| 抗宿主改版 | 皮肤中心挡了一层 | 直接贴页面结构，更脆 |
| 卸载 | 换一个皮肤 | 从 bundles 移除 + 重启 |

## 二、两半结构

一个 DSH bundle 由宿主半边与浏览器半边组成，用一个 `package.json` 挂在一起：

```
package.json
  main:    "./host.js"      → 宿主半边（Node 里跑）
  exports["./client"]: "./client.js"  → 浏览器半边
  dsh.bundle.patch: "./cordis.patch.yml" → 装载声明
  dsh.client: { platform: "web", immediately: true }
```

三处契约同时成立才算"能装"：

1. `cordis.patch.yml` 插入的那一行，`name` 必须等于包名；
2. 包名必须等于 `client.js` 里 `__ModuleLoader__.load({ id })` 的 `id`；
3. `client.js` 的 factory 最后必须 `exports.apply` / `exports.inject` / `return module.exports`。

任何一处写错，表现都是"装了但没反应"。

## 三、加载链路

```
profile 的 package.json
  dependencies: dsh-remielle-dan = link:<仓库>
  dsh.profile.bundles: [..., "dsh-remielle-dan"]
        │
        ▼  重启时
  宿主 host.js → apply(ctx)
        │   ctx.webServer.register 注册三条 exact 路由：
        │     /remielle-dan/theme.css、/remielle-dan/art.jpg、
        │     /remielle-dan/report（前端自报，写 .client-report.log）
        │   ctx.effect(() => dispose) 登记销毁
        ▼
  浏览器加载 client.js → factory → apply(ctx)
        │   1. <html> 打 data-remielle-dan
        │   2. <link rel=stylesheet href=/remielle-dan/theme.css>
        │   3. <style> 背景层的基础规则
        │   4. <div id=remielle-dan-bg>
        │   5. 向官方设置页注册 settings.section 分区（id remielle-dan）
        ▼
  样式生效
```

**每一步副作用都挂在 `ctx.effect` 上**，注册对应的销毁函数。禁用插件后理论上页面能干净退回原生外观。

## 四、背景层

皮肤中心用 `contributes.backgroundMedia` 交背景，铺法由宿主决定；插件得自己画：

```
<div id="remielle-dan-bg">   position: fixed; inset: 0; z-index: -1;
  background-image:
      linear-gradient(遮罩),        ← 写在前的在上层
      url(/remielle-dan/art.jpg);
```

同时 `html` 与 `body` 的 `background-color` / `background-image` 被强制 `transparent`，
让这层能透出来。

**层叠风险**（已实测通过，但仍是潜在风险）：`z-index: -1` 只有在父元素不创建层叠上下文时才稳。
若 DSH 的界面容器自带不透明背景或建立了层叠上下文，这层会被整个盖住，表现是"背景没出来"。
上游 `patches.css` 里的 `[id="root"] { background: none; }` 正是为了缓解这类问题。

## 五、CSS 分层与 token 为什么写两遍

`styles/theme.css` 由三部分组成：

1. **token 重映射**（约 196 个 `--dsw-*` 自定义属性）—— 同一份声明写两遍：
   `html[data-remielle-dan] { … }` 与 `html[data-remielle-dan] body { … }`。
   原因：宿主在 `body[data-ds-dark-theme]` 上也定义同名变量。自定义属性按**最近的祖先**
   生效，只写 `:root` 会被 body 上的声明盖掉，颜色不生效。
2. **body 级规则**（滚动条、选中色、暗色底）—— 全部挂了作用域前缀。
3. **`patches.css` 全文** —— 原样保留，选择器是全局的（设计如此：注入即生效、移除即复原）。

## 五·补、输入区的三处覆盖

输入区是本题材改动最集中的地方，三处互相独立：

| 效果 | 机制 | 依赖的选择器 |
|---|---|---|
| 去掉那道暗带 | 删掉 `composerSeat:before` 的 `linear-gradient` + `backdrop-filter`，保留 `background: none`（压宿主自己的底色） | `[class*="composerSeat"]` |
| 文字与光标变鲜红 `#FF4D4D` | 直接给编辑元素上 `color` / `caret-color` | `[data-composer-card]` |
| 描边加粗 + 光晕 | 整条接管 `box-shadow`：`0 0 0 1.5px` 实边 + `0 0 20px -4px` 外发光 + `var(--dsw-shadow-lv2)` | `[data-composer-card]` |

两个容易踩的点：

1. **卡片没有边框宽度。** DSH 的 `.card` 写着 `border: 0`，那条细线是 elevation 系统的
   发丝描边。所以只能改 `--dsw-elevation-stroke-color`，或者像现在这样整条接管
   `box-shadow`；改 `border-color` 永远不会有任何效果。
2. **作用域不能挂 `data-phase="active"`。** `phase` 有三个值（`settling` / `hero` / `active`），
   新会话是 `hero`；挂 `active` 会让欢迎页的大输入框不生效。卡片属性
   `[data-composer-card]` 才是三种状态共有的。

## 六、卸载与回滚

| 目标 | 动作 |
|---|---|
| 临时关掉 | 从 `dsh.profile.bundles` 删 `"dsh-remielle-dan"` → 重启 |
| 彻底卸载 | 再删 `dependencies` 里那条 → profile 目录跑 `pnpm install` |
| 只回退视觉 | 纯 CSS 改动：改源（`skin.css` / `patches.css`）后跑 `node scripts/build-theme-css.mjs`，刷新即可（路由 `no-store`）。`client.js` 改动要重启 DSH；背景层与设置页分区都在 `client.js`。 |
| 回退整个 profile 配置 | `package.json.bak-remielle-20261122-1900` |

## 七、已验证与仍未知

原先列的三件"未验证"，在 2026-11-22 已全部实证：

1. ✅ **token 双写压住了宿主定义**——界面整体确实换了色。
2. ✅ **背景 `-1` 层没被界面容器挡住**——背景图可见。
3. ✅ **`immediately: true` 装载即生效**——没在设置里点任何开关，界面就是主题外观。

仍未未知的只剩一件：**DSH 升级后这些耦合点会不会断**。断了不会崩，表现是"某块不生效"，
清单见 `AGENTS.md` 的「已知耦合点」。

另外，消息区的形状（用户气泡 + 正文区一层底）见下一节。

## 八、消息区：为什么是「一层底」而不是「一轮一框」

### 先说 DSH 原生的结构

一轮 AI 回复在 DOM 里**没有容器**。依据 `dsh-client-ui-chat/src/client/chat/ChatFlow.tsx:25`
的注释（"Render the flow without adding a DOM parent"）：它返回一个数组，所以过程头、
工具调用组、正文、耗时行是同一列里的**兄弟节点**，直接挂在正文列下。

- 每个兄弟节点是一个 `div`，带 `data-chat-flow-kind`（种类）、`data-chat-turn`（第几轮）
  等稳定属性（`ChatNodeSeat.tsx:153-164`）；工具调用组的外壳同样带 `data-chat-turn`
  （`ChatGroupSeat.tsx:191-194`）。
- 兄弟之间的缝由外边距给出：默认 4px、回答段 12px、过程头之后 16px
  （`ChatView.module.css:82-143`）。**这些缝天生透明。**
- 缝之所以看不见，是因为正文面板本身有一层底：`ConversationRoot.module.css:7`
  写着 `background: var(--dsw-alias-bg-base)`，原生值是 `rgb(21, 21, 23)`。

所以「一轮看起来是一整块」不是靠容器画出来的，是靠**底**托出来的。

### 本项目怎么接

0.1.5 把 `--dsw-alias-bg-base` 改成 `transparent`（为了让壁纸透上来），
缝就露成壁纸，一轮被读成几片。0.1.6 的接法是只把那一层补回正文区：

```css
[data-conversation-region="chat"] { background-color: rgba(11, 18, 30, 0.30); }
```

- 挂载点 `data-conversation-region="chat"` 来自 `ConversationContent.tsx:191-207`，
  它包住滚动区与 composer 座位。
- DSH 自己的样式表里**没有规则挂这个属性**，而 `stop-shortcut.ts` 依赖它（Esc 停止），
  属于承重属性，不易被随手改名。
- 该容器（`.body`）自身没有背景声明（`ConversationRoot.module.css:458-475`），
  所以这条规则同权重就够，不需要 `!important`。
- 不恢复上游那层 0.28 的渐变纱，也不动整窗外壳，所以比上游明显更亮。

### 用户气泡

- 选择器：`[data-chat-flow-kind="user"]`、`[data-chat-flow-kind="steering"]`、
  `[data-pending-steering]`、`[data-submission-echo]`。
- 前两类是 durable flowItem；后两类是 pending 回显的 `userRow`。
  `/plan` 之后的消息没气泡，就是漏了后两类。
- 底、边、圆角、阴影都在 `patches.css` 的同一条规则里；不要只改其中一类。
- 内层 `[data-message-bubble]` 被压成透明，否则里外两层会叠。

### 已经作废的路线（不要再捡回来）

- **逐节点加背景**：结果是一摞卡片。
- **`margin: 0` 压平行距**：破坏 DSH 自己的 4 / 12 / 16px。
- **用 DOM 包裹 React 节点**：流式更新时 React 的插入/删除可能报错或错位。
- **给每轮画一张绝对定位的纸（`installTurnPaper`）**：0.1.6 整段删除。
  它必须靠测量去追 React 的每一次重排，而原生结构里根本没有容器可依。
  历史过程见 `SNAPSHOT-一轮一纸-20261123.md`。

### 两条踩过的坑

1. **源码里看到的属性，不等于运行时 DOM 上一定有。** 0.1.4 按 `assistant` 写选择器，
   实测命中 0 个（AI 正文的 kind 是 `assistant-step`）；0.1.6 发现
   `[data-disclosure-header]` 在当前版本源码里根本不存在，挂在它上面的两条规则从未生效。
2. **删规则前先确认它有没有在起作用。** 0.1.5 为「纸」写的那批透明规则，
   在纸退役后只剩副作用（抹掉原生悬停、让排版偏离原生），所以整段删除而非保留。

## 九、设置页分区（0.1.7）

0.1.7 删掉了右下角的透明度浮窗，改为向 DSH 官方设置页注册一个分区。分区目前是
**只读占位**：先把位置占住，可调的控件留待后续版本。

### 槽与注册形状

```
ctx.slots.inject('settings.section', () => ctx.slots.register({
  name: 'settings.section',
  id: 'remielle-dan',
  order: 40,
  label: 'Remielle Dan',
}, RemielleSection));
```

组件是**普通 React 函数组件**，作为 `register` 的第二个参数传入；它不是配置、也不用构建。

| 字段 | 取值 | 理由 |
|---|---|---|
| `name` | `settings.section` | 官方设置页的分区槽，写别的名字不会出现在设置里 |
| `id` | `remielle-dan` | 与包名、client 模块 id、patch name 同一串，出问题好对照 |
| `order` | `40` | 设置页按 order 升序排；yammory-system 用 `16`，我们排在它后面，不插队 |
| `label` | `Remielle Dan` | 设置页里显示的分区名 |

模块级 `inject` 也从 `[]` 改成 `['slots']`——注册要用到 slots 服务。

### React 从哪来

`require('react')` 由宿主的模块系统提供（同版本 DSH 实证，不是打包进来的），
拿到的就是宿主那份 React，所以可以直接 `createElement`、不需要 JSX、也没有构建步骤。

### 为什么不接 configForms

分区现在是只读的：三行「外观 · 当前值」+ 两个禁用按钮 + 一行版本号，不保存任何东西。
既然存不住，就不注册 `configForms`——注册了却写不回去，看起来像坏了，比没有更糟。

三个值是**渲染时现读**页面计算样式拿到的（`--remielle-bubble-alpha`、正文区背景色、
输入文字颜色），读不到才退到写死的兜底 `0.55` / `rgba(11, 18, 30, 0.3)` / `rgb(255, 77, 77)`。
这样以后改 CSS，设置页不会显示旧数字；代价是这行数字反映的是「当前页面」而非「配置里的值」。

### 失败降级

整段注册放在 `apply()` 的**末尾**，并包在独立的 `try/catch` 里。它是本轮唯一可能连累
整体的地方，所以放在最后：失败只会少一个设置分区，主题照常生效。
结果会写进前端自报：`settingsSection` 为 `ok` 或 `failed: …`，另有 `bubblePanel: 'removed'`。

顺带：浮窗当年写的 localStorage 键 `remielle:bubble-alpha` 在启动时 `removeItem` 清掉，
免得以后有人以为还有东西在读它。气泡透明度本身固定在 `patches.css` 的
`html[data-remielle-dan] { --remielle-bubble-alpha: 0.55; }`，运行时没有东西再改写它。

### 样式放在哪

分区的样式类 `.remielle-set*` 全部写在 `patches.css`，`client.js` 只写结构。
两个原因：样式仍旧归生成产物管（改源 → 跑生成脚本）；也不把一大段 CSS 塞进 JS。

### 依据

契约抄自本机已在工作的 yammory-system 插件 `D:\GitHub_place\plugins\记忆系统\client\client.js`
（同版本 DSH，非猜测）：它的注册在 `2449–2455` 行，`require('react')` 在 `26` 行。

