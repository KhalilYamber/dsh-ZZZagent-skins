# AGENTS.md

`dsh-remielle-dan` 是一个**DSH Web 主题插件**：装进 profile、重启、界面就变成它。
它不依赖皮肤中心，也不再是皮肤。

改任何文件前先读 `README.md`（对外说明）与 `ARCHITECTURE.md`（结构与坑）。

## 仓库布局

```
package.json            插件清单。name=包名=client 模块 id；main=host.js；
                        exports 必须带 "./client"；dsh.client.immediately=true
cordis.patch.yml        bundle patch：insert 一行 {id, name}
host.js                 宿主半边。export default { inject:['webServer'], apply(ctx) }
                        五条路由：/remielle-dan/theme.css、/remielle-dan/settings.css（分区样式，常驻）、
                        /remielle-dan/art.jpg（当前壁纸）、
                        /remielle-dan/wallpaper（GET/POST/DELETE 换壁纸）、
                        /remielle-dan/report（前端自报，写 .client-report.log）
                        换上的壁纸落在 <DSH_HOME>/remielle-dan/，**不写仓库**
client.js               浏览器半边。window.__ModuleLoader__.load({id, factory})，
                        最后 exports.apply / exports.inject / return module.exports。
                        除背景层外，向官方设置页注册 Remielle Dan 分区（0.2.0 起有主题开关，
                        0.3.0 起有壁纸组，0.3.1 起分区样式单独常驻）。
                        **不碰聊天区 DOM**：不插节点、不挂 class、不装观察器（0.1.6 起）
styles/theme.css        ★ 运行时样式，**生成产物**（勿手改）。token 块 + body 规则 + patches 全文
scripts/build-theme-css.mjs   生成 theme.css 的脚本（改完源文件跑它）
scripts/smoke-host-wallpaper.mjs    冒烟：宿主半边（假 webServer + 真 HTTP，32 项）
scripts/smoke-client-wallpaper.mjs  冒烟：浏览器半边（假 DOM + 假 React，21 项）
zzz-remielle-dan/       源文件与素材（不是可安装皮肤）
  skin.css               token 源（生成 theme.css 用）
  patches.css            DOM 质感源
  settings.css           设置页分区样式；**常驻**，由 host.js 直发，不随主题开关卸载
  assets/                背景图；host.js 直接读这里，别挪

LICENSE / NOTICE        许可与授权溯源
README / AGENTS / ARCHITECTURE / CHANGELOG
```

## 消息区的形状（2026-11-25 定案，0.2.1）

- **一轮 AI 回复没有容器**。它是一排同级行，行间 4 / 12 / 16px 的缝天生透明；
  缝看不见是因为面板有底。所以「一轮一整块」靠**底**，不靠画框。
- 现在的做法：板画在消息流本身 `[data-chat-flow]` 上（即 `ChatView` 的 `.column`，
  `ChatView.tsx:244`）：底 `rgba(11, 18, 30, 0.30)`、1px 青描边、圆角 20、
  内边距 12/14/20。深浅只改 alpha。**不加 `backdrop-filter`**：要透明，不要毛玻璃。
- `[data-conversation-region="chat"]`（包住滚动区与输入座位）现在是
  `background-color: transparent`。板画在它上面会把输入卡一起关进去，所以必须留空。
- **一个属性两个落点**：`data-chat-flow` 也出现在 `ChatGroupSeat.tsx:202` 的组内容层
  （同一元素带 `data-step-process-content`）。选择器必须写成
  `[data-chat-flow]:not([data-step-process-content])`，否则每个过程组各长一圈框。
- **不要重复**：逐节点背景 band、`margin: 0` 强压、DOM 包裹 React 节点、
  给每轮画绝对定位的纸。四条都试过，代价写在 `ARCHITECTURE.md` 第八节。
  注意区分：2026-11-27 起过程组有一块半透明圆角底（挂在 `[data-step-process]` 上），
  那是给**真容器**加底，不是拿节点背景去拼一轮的形状，两者不是一回事。
- 历史过程：`SNAPSHOT-一轮一纸-20261123.md`（已解决，留作参照）。
- 未单独验收：`/plan` 之后的用户气泡（steering / pending 回显）。

## 会话工作循环

**开工**：读 `claude-progress.md` 的「当前已验证状态」与最近一节；读
`feature_list.json` 里 `in_progress` 的那条。一次推进一条。

**收尾**：`claude-progress.md` 追加 `Session NNN`（目标 / 已完成 / 跑过的验证 /
证据 / 更新文件 / 风险 / 下一步）；结果同步回 `feature_list.json`。
没跑过验证的条目不许标 `passing`——这个项目里"跑过验证"至少意味着**重启过一次并看到了界面**。

## 改样式的边界

1. **`styles/theme.css` 是生成产物，不要手改。** 它由
   `zzz-remielle-dan/skin.css` 的 `:root` 块 + `patches.css` 合成。
   改样式的正确姿势：改源文件 → 跑 `node scripts/build-theme-css.mjs`。
   手改产物会在下次重新生成时被覆盖，且改了什么失去来源。
2. **不要恢复 `skin.json`。** 皮肤形态已退役；恢复它会让这套东西又能被皮肤中心当皮肤读，
   于是同一套视觉有两个入口，互相打架。
3. **不要把本仓库拷进 `~/.dsh/skins`。** 那是皮肤目录，插件不从那加载。
4. **token 块为什么写两遍**（`html[data-remielle-dan]` 和 `html[data-remielle-dan] body`）：
   宿主自己在 `body[data-ds-dark-theme]` 上也定义 `--dsw-*`。自定义属性按最近的祖先生效，
   只写 `:root` 会被 body 上的声明盖掉，颜色根本不生效。`html ... body` 权重更高，能压住。
   **这是踩过的坑，不要"优化"掉其中一份。**
5. **patches.css 里的选择器是全局的**（`[id="root"]`、`a`、`:focus-visible` 等）。
   这是上游设计：注入即生效、移除即复原。0.2.0 起「生效」由设置页的运行时开关管，
   关掉时把**四件一起摘**：`html` 上的属性、`theme.css` 的 `<link>`、`BASE_CSS` 的 `<style>`、
   `#remielle-dan-bg`。只摘一部分会「半脱」，原因写在 `ARCHITECTURE.md` 第十节；
   那条边界不要绕过（比如在主题关闭态下再挂一条全局规则）。
6. **设置页分区的样式类 `.remielle-set*` 写在 `zzz-remielle-dan/settings.css`，不要写进
   `client.js`，也不要并回 `patches.css`。** `client.js` 只写结构（`require('react')` +
   `createElement`），颜色走主题 token（`--dsw-alias-*`，取值范围见
   `skin-center/contracts/official-tokens-v1.json`）。
   这份样式**常驻**、不随主题开关卸载：关闭态下 `theme.css` 被整个摘掉，分区若没有自己的样式
   就只剩裸文字。它只选择 `.remielle-set*`，不碰宿主全局选择器，所以关掉主题整页仍是原生外观。
7. **墨色与填充成对改。** 本主题是暗色：`label-primary` 是浅墨，
   `label-primary-foreground` / `label-primary-inverted` 是深墨，`button-contrast-fill`
   是浅底。宿主把它们当「填充 ↔ 墨色」成对用（字标徽章、版本徽章、附件关闭按钮），
   单改一个就会出现白底白字或深底深字。0.2.1 修的就是这一对。

## 已知耦合点（改之前先读）

这些地方是"贴着 DSH 内部写的"，DSH 升级时最可能先断。断了不会崩，只会"某块不生效"。

| 耦合点 | 是什么 | 断了的表现 |
|---|---|---|
| `[data-composer-card]` | 输入卡片上的**稳定属性**（DSH 源码 `InputBar.tsx` 给卡片自己加的）；0.2.1 起底色/1px 描边/圆角都由本主题接管 | 输入卡回退成宿主默认（半透明底 + 发丝描边），红字仍在 |
| `--dsw-specific-input-major` | 输入卡底色的 token（`InputBar.module.css` 的 `.card` 读它） | 卡片底色回退成宿主值 |
| `[class*="composerSeat"]` | 输入座位容器（上游皮肤就依赖这个类名片段） | 暗带相关规则失效 |
| `[data-chat-flow]` | 消息流列（`ChatView.tsx:244` 的 `.column`）；**组内容层也带这个属性**（`ChatGroupSeat.tsx:202`，同元素有 `data-step-process-content`） | 板消失；若漏掉 `:not([data-step-process-content])`，每个过程组各长一圈框 |
| `[data-step-process]` | 过程组的根（`ChatGroupSeat.tsx:194` 的 `.root`）；源码里只出现一次，与 `-body` / `-content` / `-icon` / `-chevron` 是不同的属性名，互不命中 | 过程组那层半透明圆角底消失，过程行与灰字回到裸奔状态 |
| `data-phase` 三值 | `settling` / `hero` / `active`；新会话是 `hero` | 若按 `active` 限作用域，新会话里样式不生效 |
| `[data-conversation-region="chat"]` | 正文区容器（`ConversationContent.tsx` 挂在 `.body` 上，包住滚动区与 composer 座位）；0.2.1 起只放 transparent；`stop-shortcut.ts` 依赖它 | 若被别的主题画上底，会与消息板叠成双层；不会崩 |
| `[data-chat-flow-kind]` | 消息节点的种类属性（`ChatNodeSeat.tsx`） | 用户气泡选择器不命中 |
| `[data-shell-bottom]` | AppFrame 的底栏标记（`AppFrame.tsx:325`）；frame 是唯一直接包含它的 div，用它锁定 Windows 下的 `.frame`，不必写哈希类名 | 窗口底那层撤不掉，聊天区四周留白被侧栏填充色压暗 |
| `data-pending-steering` / `data-submission-echo` | pending 用户回显的 `userRow` | `/plan` 后的消息没有气泡 |
| `settings.section` 槽 | 设置页分区注册点（`ctx.slots.inject(...)` + `ctx.slots.register(...)`） | 分区不出现，主题不受影响 |
| 槽组件里的 `React.useState` / `useEffect` | 0.2.0 的主题开关靠它保持标签与状态同步；Builtins 目录有登记，同版本另有实证 | 开关点得动但标签不更新；自报里 `hasUseState` 会是 false |

依据来源：DSH 仓库 `deepseek-ai/deepseek-harness`，tag **`dsh-v0.2.2-rc.5`**（与本机版本一致）。
关键文件：`packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`、
同目录 `InputBar.module.css`、`ConversationMainPanel.tsx`（`phase` 计算）、
`ConversationRoot.module.css`（`composerSeat` 与 `.body` 定义）、
`ConversationContent.tsx`（`data-conversation-region` / `.scrollBody`）、
`packages/client/ui-chat/src/client/chat/ChatFlow.tsx`（flow 无父节点）、
同目录 `ChatNodeSeat.tsx` / `ChatGroupSeat.tsx`（`data-chat-turn` 等属性）、
`ChatView.module.css`（行间 4 / 12 / 16px 的 `--dsh-chat-flow-gap`）。
注意：本机 `app.asar` 里这些包的 `src/` 源码是随包发布的，可直接解出核对，
不必去 GitHub 翻。解包位置（2026-11-23 实测，别再猜偏移）：

```
文件：D:\DSH\app\resources\app.asar            （单文件，约 209 MB）
[0..3]   uint32 = 4
[4..7]   headerPickleSize                     ← 头 pickle 载荷长度
[8..11]  pickle 载荷首 4 字节
[12..15] jsonSize                             ← 目录树 JSON 的长度
[16..15+jsonSize]  目录树 JSON（{files:{name:{offset,size}|{files}}}}）
数据起点 = 8 + headerPickleSize；文件偏移相对数据起点
```

目录树里按 `dsh/node_modules/@deepseek-ai/<包名>/src/...` 就能拿到未编译的 `.tsx`。
`lib/client.js` 是打包产物（各包自带上百 KB），读源码没用，以 `src/` 为准。

## 改动分级

- **视觉微调**（颜色、遮罩、透明度）→ 改 `zzz-remielle-dan/skin.css` 或 `patches.css`，
  再跑 `node scripts/build-theme-css.mjs`；`client.js` 的 `BASE_CSS` 只放背景层相关。
- **换默认背景图** → 替换 `zzz-remielle-dan/assets/remielle-dan-art.jpg`，文件名不变就不用改代码。
  用户换的那张走设置页，落在 `<DSH_HOME>/remielle-dan/`，**不要写进仓库**（那是用户数据，
  且升级会整体替换插件目录）。
- **改结构**（换行位置、加新层、加动画）→ 先读 `ARCHITECTURE.md` 的「层叠风险」一节。

## 验证方式

插件没有端到端自动化测试；0.3.0 起有两个能复跑的冒烟脚本，但它们证明不了观感。
每条改动按三步验：

0. **冒烟（可选，几秒钟）**：`node scripts/smoke-host-wallpaper.mjs`（32 项）与
   `node scripts/smoke-client-wallpaper.mjs`（21 项）。前者起假 `webServer` + 真 HTTP，
   落盘指向临时 `DSH_HOME`，不碰真实数据；后者用假 DOM + 假 React，覆盖
   「关掉主题再开，壁纸仍在」与「分区样式表常驻、主题样式表被摘」。
   只证明逻辑没断，不证明好看。
1. **静态**：`package.json` 可解析；`host.js` / `client.js` 过 `node --check`（复制成 `.mjs`）；
   `styles/theme.css` 花括号配平；`host.js` 依赖的文件都在。
2. **装载**：只改样式（`zzz-remielle-dan/*.css` → 重新生成 `styles/theme.css`）时，
   刷新页面即可：`/remielle-dan/theme.css` 的路由是 `no-store`。改了 `client.js` /
   `host.js` / profile 才必须重启。
3. **观感**：四处各看一眼——侧边栏文字、设置页、代码块、明暗外观切换。
   设置页里把主题开关两个方向各点一次：关掉后整页应当是原生外观，不允许「有底色没壁纸」
   或「有壁纸没底色」那种半脱；再点回来应当完整复原。
   消息区另看一眼：用户消息有气泡、AI 一轮读作一整片（行间不露亮缝）、
   对话板有 1px 青边与圆角 20，且**背景不模糊**（隔着板看壁纸是清晰的）、
   过程组是一整块半透明圆角底（2026-11-27 起），不是板套板。

第 3 步只能人眼。观感问题不要靠猜，先要现象（报错文本 / 截图 / 哪个区域不对）。

## 不要做的事

- 不要给 DSH 本体打补丁，也不要改 `app.asar` 里的东西。
- 不要在 `host.js` 里做重活：它只该发文件，外加一件「把用户选的那张图落盘」。
  不要在里面塞会话、缓存、定时任务这类东西。
- 不要往 `client.js` 里塞业务逻辑（它只该改外观）。
- 不要用逐个节点的背景去拼一整轮气泡，结果一定是一摞卡片。
  （给过程组的**真容器**加一块底不算这一类，见「消息区的形状」。）
- 不要用 `margin: 0` 强行压平聊天原生间距，那会丢掉 DSH 自己的 4 / 12 / 16px。
- 不要用 DOM 包裹 React 聊天节点，也不要在聊天区加容器层：流式更新时 React 的插入/删除会错位。
  一轮的形状由面板的底给出，不需要再画框。
- 不要为了"看起来更整齐"去合并 `styles/theme.css` 与 `zzz-remielle-dan/` 下的源文件——
  两者的关系是"生成产物 / 源"，合并了就没法追溯改动来自哪。
- 不要让「关闭主题」只摘一部分：四件同进同退，理由见 `ARCHITECTURE.md` 第十节。
  也不要给开关加第二种「关法」（隐藏、`pointer-events: none`、把整页透明度调低）——
  两种关法一定会走出两种外观，以后没人说得清用户看到的是哪一种。

## 编辑本文件

本文件只描述**当前已成立的事实**。目录变了、边界变了才改它，并同步
`README.md` 与 `ARCHITECTURE.md`；三处不许互相矛盾。
