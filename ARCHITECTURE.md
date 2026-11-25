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
        │   0. 读 localStorage['remielle-dan:enabled']（0.2.0 起）
        │   1. <html> 打 data-remielle-dan
        │   2. <link rel=stylesheet href=/remielle-dan/theme.css>
        │   3. <style> 背景层的基础规则
        │   4. <div id=remielle-dan-bg>
        │   5. 向官方设置页注册 settings.section 分区（id remielle-dan）
        ▼
  样式生效

第 0 步决定第 1–4 步做不做：存的是「关」就一件都不建，界面直接是原生的。
第 1–4 步由设置页那个开关统一装卸，见第十节。
```

**副作用都挂在 `ctx.effect` 上**：0.2.0 起只留一条总销毁（`theme.dispose()`，内部把四件一起摘），
另有自报定时器与跨窗口监听的销毁。禁用插件后页面能干净退回原生外观。

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
| 1px 紫细边 + 圆角 20 | 卡片上直接写 `border: 1px` 与 `border-radius: 20px`，投影用 `var(--dsw-shadow-lv2)`；0.2.1 起没有光晕 | `[data-composer-card]` |

两个容易踩的点：

1. **卡片原本没有边框宽度。** DSH 的 `.card` 写着 `border: 0`，细线由 elevation 系统的
   发丝描边画。0.2.1 起直接给卡片写 `border: 1px`（`box-sizing: border-box`，外层尺寸
   不变），那条发丝就不需要了；`--dsw-elevation-stroke-color` 仍留着给别处读。
2. **作用域不能挂 `data-phase="active"`。** `phase` 有三个值（`settling` / `hero` / `active`），
   新会话是 `hero`；挂 `active` 会让欢迎页的大输入框不生效。卡片属性
   `[data-composer-card]` 才是三种状态共有的。

## 六、卸载与回滚

| 目标 | 动作 |
|---|---|
| 临时关掉外观 | 设置页 → Remielle Dan → 「关闭主题外观」（0.2.0 起，即时、不重启） |
| 整个插件停用 | 从 `dsh.profile.bundles` 删 `"dsh-remielle-dan"` → 重启 |
| 彻底卸载 | 再删 `dependencies` 里那条 → profile 目录跑 `pnpm install` |
| 只回退视觉 | 纯 CSS 改动：改源（`skin.css` / `patches.css`）后跑 `node scripts/build-theme-css.mjs`，刷新即可（路由 `no-store`）。`client.js` 改动要重启 DSH；背景层与设置页分区都在 `client.js`。 |
| 回退整个 profile 配置 | `package.json.bak-remielle-20261122-1900` |

## 七、已验证与仍未知

原先列的三件"未验证"，在 2026-11-22 已全部实证：

1. ✅ **token 双写压住了宿主定义**——界面整体确实换了色。
2. ✅ **背景 `-1` 层没被界面容器挡住**——背景图可见。
3. ✅ **`immediately: true` 装载即生效**——没在设置里点任何开关，界面就是主题外观。

2026-11-24 又补上两件：

4. ✅ **运行时开关能真正装卸**——自报里 `themeEnabled` 翻转六次，`layer` 每次都跟它同步，
   关闭态下 `body` 与外壳底色回到原生值，没有出现半脱。
5. ✅ **关闭态能跨重启保持**——21:31 / 22:08 / 22:19 三次重启的自报都是关，
   且启动时一件都不建（`layer=false`、`veilTop="(无背景层)"`）。

仍未未知的只剩一件：**DSH 升级后这些耦合点会不会断**。断了不会崩，表现是"某块不生效"，
清单见 `AGENTS.md` 的「已知耦合点」。

另外，消息区的形状（用户气泡 + 消息板）见下一节。

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

### 本项目怎么接（0.2.1 起）

0.1.5 把 `--dsw-alias-bg-base` 改成 `transparent`（为了让壁纸透上来），
缝就露成壁纸，一轮被读成几片。0.1.6 把那一层补回正文区；0.2.1 又往下挪了一层：

```css
[data-conversation-region="chat"] { background-color: transparent; }

html[data-remielle-dan] [data-chat-flow]:not([data-step-process-content]) {
  background-color: rgba(11, 18, 30, 0.30);
  border: 1px solid rgba(103, 220, 231, 0.12);
  border-radius: 20px;
  padding: 12px 14px 20px;
}
```

- 挂载点 `[data-chat-flow]` 是 `ChatView.tsx:244` 的 `.column`（`max-width:
  var(--dsh-chat-content-width)`、`margin: 0 auto`），只包消息流；输入座位是它的
  兄弟分支，所以板外就是壁纸。kimino 画板用的也是这一层。
- 为什么换层：`[data-conversation-region="chat"]` 把滚动区与 composer 座位一起包住
  （`ConversationContent.tsx:196-204`），底画在那里，输入卡永远在板里。
- **同一属性有两个落点**：`ChatGroupSeat.tsx:202` 的组内容层也带 `data-chat-flow`，
  同元素还有 `data-step-process-content`。所以选择器必须带
  `:not([data-step-process-content])`；不带的话每个过程组各长一圈框。
- 不加 `backdrop-filter`：要的是透明，不是毛玻璃。
- 板的内边距是 12/14/20；`.textInteraction` 是绝对定位的兄弟面，加内边距后
  选区浮层可能偏移，验收时要专门选一段正文看。

### 用户气泡

- 选择器：`[data-chat-flow-kind="user"]`、`[data-chat-flow-kind="steering"]`、
  `[data-pending-steering]`、`[data-submission-echo]`。
- 前两类是 durable flowItem；后两类是 pending 回显的 `userRow`。
  `/plan` 之后的消息没气泡，就是漏了后两类。
- 底、边、圆角、阴影都在 `patches.css` 的同一条规则里；不要只改其中一类。
- 0.1.7 起上底的是内层 `[data-message-bubble]`（`UserContent.tsx:47`）；外层只在
  没有内层气泡时兜底，用 `:not(:has([data-message-bubble]))` 判。

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

## 九、设置页分区（0.1.7 建，0.2.0 加开关）

0.1.7 删掉了右下角的透明度浮窗，改为向 DSH 官方设置页注册一个分区。分区最初是**只读占位**：
先把位置占住，可调的控件留待后续版本。0.2.0 给它装了第一个真控件——主题外观开关
（四件套怎么摘、状态存哪、关闭态长什么样，见第十节）；剩下的仍是只读展示。

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

`configForms` 存的是插件配置，读写在宿主侧，改完要重启或重载才生效；
而这里要的是一个「点一下立刻换外观」的界面状态，落在这一页的浏览器存储里就够。
注册了却要重启才认的控件，看起来像坏了，比没有更糟。（0.2.0 起的开关详见第十节。）

三个值是**渲染时现读**页面计算样式拿到的（`--remielle-bubble-alpha`、消息板背景色、
输入文字颜色），读不到才退到写死的兜底 `0.62` / `rgba(11, 18, 30, 0.3)` / `rgb(255, 77, 77)`。
自报里 `board` 字段就是这块板（0.2.1 起）；`chatRegion` 只剩「外壳是否透明」这一个用途。
这样以后改 CSS，设置页不会显示旧数字；代价是这行数字反映的是「当前页面」而非「配置里的值」。

### 失败降级

整段注册放在 `apply()` 的**末尾**，并包在独立的 `try/catch` 里。它是本轮唯一可能连累
整体的地方，所以放在最后：失败只会少一个设置分区，主题照常生效。
结果会写进前端自报：`settingsSection` 为 `ok` 或 `failed: …`，另有 `bubblePanel: 'removed'`。

顺带：浮窗当年写的 localStorage 键 `remielle:bubble-alpha` 在启动时 `removeItem` 清掉，
免得以后有人以为还有东西在读它。气泡透明度本身固定在 `patches.css` 的
`html[data-remielle-dan] { --remielle-bubble-alpha: 0.62; }`（0.2.1 从 55% 调到 62%），
运行时没有东西再改写它。

### 样式放在哪

分区的样式类 `.remielle-set*` 全部写在 `patches.css`，`client.js` 只写结构。
两个原因：样式仍旧归生成产物管（改源 → 跑生成脚本）；也不把一大段 CSS 塞进 JS。

### 依据

契约抄自本机已在工作的 yammory-system 插件 `D:\GitHub_place\plugins\记忆系统\client\client.js`
（同版本 DSH，非猜测）：它的注册在 `2449–2455` 行，`require('react')` 在 `26` 行。

## 十、运行时开关（0.2.0）

作者原话是：不要每次想用原生外观时都要叫 agent 去拔插件。所以要一个按钮，
点完即时卸掉外观，再点即时装回来，不重启、不动 profile。

### 关掉的是哪四件

| # | 东西 | 谁在用 |
|---|---|---|
| 1 | `<html data-remielle-dan>` | `theme.css` 的 token 块、气泡透明度变量都以它为作用域 |
| 2 | `<link href=/remielle-dan/theme.css>` | token 重映射 + `patches.css` 全文（后者是**全局**的） |
| 3 | `<style>` 里的 `BASE_CSS` | 把 `html` / `body` 的底色强制透明，好让壁纸透上来 |
| 4 | `<div id="remielle-dan-bg">` | 壁纸那一层 |

### 为什么必须同进同退

- 只摘 1：token 回原生，但 `patches.css` 那部分是全局的，气泡、红字、紫描边全留着 → 半脱。
- 只摘 2：第 3 件还在强制透明，第 4 件也已无处可画 → 整页透出浏览器画布。
- 只摘 4：第 3 件仍强制透明，壁纸却没画 → 同一种透底。
- 只摘 3：壁纸层还在、底色也还在，两套背景叠在一起。

所以开关的实现是**一个运行时对象**（`client.js` 的 `createThemeRuntime`）：
`attach()` 按 1→4 建，`detach()` 按 4→1 拆：先撤壁纸，再撤「把底色变透明」的那条规则，
最后才让 token 回原生。整段是同一个任务里同步跑完的，浏览器不会在中间重绘；
这个顺序的价值在于「万一以后有人在中间插了 await」，那时也不会出现半脱的一帧。

### 状态存在哪

`localStorage['remielle-dan:enabled']`，值 `'1'` / `'0'`，缺省按「开」。
选它是因为要求「点完立刻生效」：禁用插件要重启，`configForms` 的配置落在宿主侧、
改完也不是这一页的事。本插件 0.1.6 之前的浮窗本来就写过 localStorage，没有新依赖。

两个边界：

- 按 **origin** 各存一份。桌面端是 `dsh-app://app`，浏览器访问是 `http://127.0.0.1:<port>`，
  两边各记各的；换端口也算换了一份。
- 存储不可用（隐私模式、配额）时退化为「只管这一次」，界面照常。

跨窗口用 `storage` 事件同步：另一个窗口动了开关，这个窗口跟着动，但**不回写**存储。

### 关闭态的分区长什么样

关掉之后 `theme.css` 被摘掉，`.remielle-set*` 那套样式也就没了，分区会以**原生元素**显示：
标题、说明、状态行、按钮、版本号，只是没有卡片底与行距。

这是刻意的取舍：分区注册与样式解耦，所以**开关本身永远点得动**——
它不会把开回主题的那把钥匙一起锁在里面。代价是关闭态那一栏看起来就是普通设置项。

关闭态还**隐藏**了「三行当前值」。那三个数是渲染时现读计算样式得到的，主题一关就全退到
写死的兜底值（例如气泡透明度仍显示 62%，而气泡根本不存在）。宁可不显示，也不给错数字。

### 为什么不走 configForms，也不靠禁用插件

`configForms` 管的是「插件配置」，读写在宿主侧，改动要重启或重载才生效；
禁用插件则要改 profile 再重启。两者都满足不了「点一下就好」。
这里存的其实是**界面状态**（这一页要不要穿主题），不是需要审批的配置。

### 会不会闪

不会。`immediately: true` 让浏览器半边在启动时就跑，读到「关」就一件都不建——
连样式表请求都不发。重新打开时才插 `<link>`，`no-store` 会重新取一次，
那几十毫秒里页面仍是原生外观，不是「卡住」。

### 证据

自报 JSON 新增两个字段：`themeEnabled`（开关状态）与 `hasUseState`（hooks 前提是否成立），
`layer` 的语义变成「背景层此刻在不在」。切一次开关就补一条自报，所以
`.client-report.log` 里能直接看到 `themeEnabled` 的两次翻转，不必只靠肉眼。
那条自报**延后 400ms 才采**：插入 `<link>` 到样式生效是异步的，立刻读完会拿到应用前的值
（veil 变量还是「未定义」、正文区还是原生底色），日志就会把「开了」记成「没生效」。

