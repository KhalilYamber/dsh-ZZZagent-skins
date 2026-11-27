# dsh-remielle-dan

Remielle Dan — 一个**自建的 DSH Web 主题插件**。

不依赖皮肤中心，不用在设置里点"应用"：装进 profile，重启，DSH 就是这个样子。

**当前状态**（0.3.1）：0.2.0 的五项仍成立（第五项是设置页分区，2026-11-24 晚实测：
关了又开、翻转六次，三次重启都保持关闭态）。0.2.1 把消息板、左栏实度、输入卡三处
向 kimino 的形状靠齐，2026-11-25 作者已在真机确认观感良好。0.3.0 加了**可替换壁纸**，
0.3.1 把设置页那一栏照官方重做，并在主题关闭时也保留自己的样式。

- **主题底座与背景图**：深蓝玻璃、壁纸铺到窗口最底、侧栏透出画。
- **壁纸可换**：设置页「壁纸」那一行点「选择壁纸…」选一张本机图片（JPEG / PNG / WebP），
  也可以直接把图拖进那一块；点完当场换、F5 仍在、「恢复默认壁纸」一键退回插画。
  超过 2560 像素的图会自动缩小，并告诉你前后尺寸。
  图落在 `<DSH_HOME>/remielle-dan/`（本机为 `D:\DSH\home\remielle-dan\`），
  不写进插件目录、不进 git；桌面端与浏览器端共用同一份，
  手工把图拷进那个目录、甚至删掉 json 也能被认出来。
- **消息板（30%）**：底画在消息流本身 `[data-chat-flow]` 上，只包消息、不包输入卡；
  1px 青描边、圆角 20，**背景不模糊**（透明，不是毛玻璃）。AI 一轮回复读作一整片，
  行间不露亮缝；它不是逐轮画的框——DSH 原生没有「轮容器」。
- **用户消息气泡**：独立圆角气泡，宽度贴着字；`/plan` 之后的回显也接住了。
- **过程组**：一轮里的工具调用、搜索、思考被包进**同一块半透明圆角深底**（2026-11-27 起），
  组内的灰色辅助文字提亮一档，块底仍能看见壁纸（透度与用户气泡同档）。
  轮尾那行「已完成，用时…」不在组里，只提亮、不套底。
- **输入区**：文字与光标鲜红 `#FF4D4D`，卡片 1px 紫细边、圆角 20、无光晕、无模糊。
- **设置页 + 开关**：DSH 官方设置里「Remielle Dan」分区（`settings.section` 槽，id `remielle-dan`）。
  0.3.1 起整栏照官方设置页重做：标题 16px、卡片 + 行、36px 圆角按钮，
  与「账号与余额」「模型」两页同一条视觉线。分区样式是单独一份 `settings.css`、**常驻**，
  所以关掉主题外观时这一栏照样有卡片与排版，不会退成一屏裸文字。
  顶上是「关闭 / 开启主题外观」按钮：点一下界面立刻回到 DSH 原生外观，插件仍装着，随时可以再打开；
  选择记在当前界面的浏览器存储里。下面是「壁纸」卡与三行只读当前值。
  右下角的气泡透明度浮窗早已删除，气泡透明度定为 62%，写在 `patches.css` 里，运行时不再改写。

「一轮一纸」的旧实验（给每轮画一张绝对定位的纸）已整段删除，定位过程与结论见
`SNAPSHOT-一轮一纸-20261123.md`。

## 为什么是插件，不是皮肤

DSH 本体只认插件。"皮肤"（`skin.json` + 皮肤中心）是第三方插件
`@linxin666/dsh-client-ui-skin-center` 定义的一套格式——用它就等于依附它。

本项目最初做的是一套皮肤，后来整体转成插件：样式和素材原样搬过来，只换注入方式。
皮肤形态已退役，仓库里不再安装任何皮肤。

## 目录

```
package.json          插件清单：main=host.js，exports 带 ./client，dsh.client.immediately=true
cordis.patch.yml      bundle patch：往宿主插件树插一行 remielle-dan-theme
host.js               宿主半边：五条路由（样式表、分区样式、当前壁纸、壁纸状态与换图、自报日志）；
                      换上的壁纸落在 <DSH_HOME>/remielle-dan/，不进仓库
client.js             浏览器半边：打标记 → 挂样式 → 铺背景层 → 向官方设置页注册 Remielle Dan 分区
                      （分区里有主题开关；对聊天区只读不写：不插节点、不挂 class、不装观察器）
styles/theme.css       运行时样式，**生成产物**（勿手改；跑 scripts/build-theme-css.mjs 重生成）
scripts/build-theme-css.mjs  生成 theme.css 的脚本：改完源文件跑它
scripts/smoke-host-wallpaper.mjs    冒烟：宿主半边（假 webServer + 真 HTTP，32 项断言）
scripts/smoke-client-wallpaper.mjs  冒烟：浏览器半边（假 DOM + 假 React，18 项断言）

zzz-remielle-dan/     源文件与素材（不是可安装的皮肤，别往皮肤中心放）
  skin.css               token 源文件
  patches.css            DOM 质感源文件
  settings.css           设置页分区样式；常驻，由 host.js 直发，不随主题开关卸载
  assets/                背景图（host.js 直接读这里）
  skin.json              上游皮肤的退役清单；保留是因为它承载 attribution（权利归属）。
                         不要装回皮肤中心，也不要恢复成可加载形态

LICENSE               BSD-3-Clause（含上游版权行与本项目衍生版权行）
NOTICE                来源与授权溯源，含受限素材的处置约定
AGENTS.md             工作规则：目录职责、改动边界、验证方式
ARCHITECTURE.md       插件结构、加载链路、token 为什么写两遍
CHANGELOG.md          变更记录
SNAPSHOT-一轮一纸-20261123.md  一次失败实验的定位全过程与结论（已解决，留作参照）
.gitignore / .gitattributes
```

`claude-progress.md` 与 `feature_list.json` 属本地工程面，刻意不进版本库。

## 怎么装

已经装在 `desktop` profile 里了。原理是两处改动：

1. `~/.dsh/profiles/desktop/package.json` 的 `dependencies` 加
   `"dsh-remielle-dan": "link:D:/GitHub_place/plugins/dsh-ZZZagent-skins"`
2. 同一文件的 `dsh.profile.bundles` 加 `"dsh-remielle-dan"`

改完必须 **重启 DSH**（插件在启动时装载，与皮肤不同）。

## 怎么卸

删掉 `bundles` 里那一行 → 重启。

想连依赖一起清掉，再删 `dependencies` 里那条，然后在 profile 目录跑一次 `pnpm install`。

## 开关：临时关掉主题

设置 → **Remielle Dan** → 「关闭主题外观」。界面立刻回到 DSH 原生外观：壁纸、玻璃底、
红字与紫描边、用户气泡一起退场；再点「开启主题外观」就都回来了。不重启，不改 profile。

- 状态记在当前界面的浏览器存储里（键 `remielle-dan:enabled`）。桌面端 `dsh-app://app`
  与浏览器访问 `http://127.0.0.1:<端口>` 是两个存储，各记各的。
- 关着的时候主题样式表与背景层**根本不加载**，所以关着启动不会先闪一下主题。
- 关掉只摘外观，插件仍然装着：设置页那一栏还在，按钮还点得动。
- 想连插件一起停用，仍然走上面的「怎么卸」。

## 怎么改

| 想改什么 | 改哪里 |
|---|---|
| 颜色、透明度、玻璃质感 | 改源：`zzz-remielle-dan/skin.css` 或 `patches.css` → 跑 `node scripts/build-theme-css.mjs`（`theme.css` 是生成产物，手改会被覆盖） |
| 设置页那一栏的样子（卡片、按钮、字号） | 改 `zzz-remielle-dan/settings.css`，**不用重启**（路由 `no-store`，刷新即可）。它常驻，不随主题开关卸载 |
| 默认壁纸（用户没换过时显示的那张） | 替换 `zzz-remielle-dan/assets/remielle-dan-art.jpg` |
| 用户已经换过壁纸，想再换 | 设置页「壁纸」那一行 →「选择壁纸…」；或者把图拷进 `<DSH_HOME>/remielle-dan/`，命名成 `wallpaper.jpg`（也认 png / webp），刷新即生效 |
| 缩图的门槛 | `client.js` 顶部 `MAX_EDGE`（2560）、`JPEG_QUALITY`（0.86）、`MAX_ORIGINAL_BYTES`（8MB） |
| 应用底板（压暗壁纸的主因） | `skin.css` 的 `--dsw-alias-bg-base`（现 `transparent`；上游是 `rgba(18,25,39,0.46)`，铺满窗口的一层黑） |
| 侧栏底色 | `skin.css` 的 `--dsw-specific-sidebar-fill`（现 `rgba(17,25,39,0.42)`；0.2.1 从 `0.10` 调上来）。注意它同时画 Windows 标题栏条、任务页信息框、轨迹表头、拖拽预览，改一个全变；窗口底那一层已在 `patches.css` 单独撤掉 |
| 背景遮罩（壁纸上的「纱」） | `skin.css` 的三个变量 `--remielle-veil-top/mid/bot`（现为全透明 = 不要纱；原值是 `rgba(7,19,33,0.28 / 0.22 / 0.32)`）。`client.js` 只负责读它们，兜底值仍是原值 |
| 背景位置 | `client.js` 里 `background-position`（插件形态可以控，皮肤形态不能） |
| 输入框底色透明度 | `skin.css` 的 `--dsw-specific-input-major`（现 `0.44`，越小越透；0.1.1 曾是 0.32，0.1.4 调回偏实） |
| 输入区文字 / 光标颜色 | `patches.css` 里 `[data-composer-card]` 那段，把 `#FF4D4D`（鲜红，2026-11-23 起）换掉。卡片描边仍走下面那条 |
| 输入框描边 / 圆角 | `patches.css` 里 `[data-composer-card]` 的 `border`（`1px`，0.2.1 起没有光晕）与 `border-radius`（`20px`）；投影走 `--dsw-shadow-lv2` |
| 输入框背后那道暗带 | 已删除。原规则在 `patches.css` 的 `composerSeat:before`（保留注释说明为什么删） |
| 消息气泡 | `patches.css` 里 `[data-message-bubble]` 那条（气泡本体）；没有内层气泡的 pending 回显走 `:not(:has([data-message-bubble]))` 那条兜底 |
| 消息板底色 | `patches.css` 里 `[data-chat-flow]:not([data-step-process-content])` 的 `background-color`，只改 alpha：`0.18` 偏画 / `0.30` 现状 / `0.45` 偏字。正文区外壳 `[data-conversation-region="chat"]` 是 `transparent`，不要在那层上底 |
| 过程组那块底 | `patches.css` 里 `[data-step-process]` 那条：底色复用 `--remielle-bubble-alpha`（0.62，与用户气泡同档），组内两个灰字 token 也在同一处覆盖。轮尾与过程头只有提亮，见 `:is([data-chat-flow-kind="turn-tail"], [data-chat-flow-kind="turn-process"])` 那条 |

## 已知边界

- **一轮回复的形状来自消息板的底，不是来自气泡**：DSH 原生没有包住一轮的容器，
  AI 回复是一排同级行，行间 4 / 12 / 16px 的缝靠板的底才看不见。
  0.2.1 起由 `[data-chat-flow]:not([data-step-process-content])` 提供这层底；
  这个属性在组内容层也有一份，所以必须排除。
  「一轮一纸」的旧实验已整段删除，过程记在 `SNAPSHOT-一轮一纸-20261123.md`。
- **已实测**：装载、路由、token 覆盖、背景层、用户气泡、输入区改色与红字、
  以及 0.2.0 的主题开关（2026-11-24：翻转六次、跨三次重启保持关闭），都在真机上验过。
  0.2.1 的消息板与三处形状改动已在真机确认（2026-11-25）。
  壁纸与设置页两条链路在两边各跑过一遍冒烟（宿主 32 项、浏览器假 DOM 21 项，全过）；
  0.3.1 的设置页观感作者已看过，**壁纸的桌面端文件对话框仍未验证**。
  唯一没验的是「DSH 升级之后还能不能用」——这件事只能升级时才知道。
- **关掉主题后，设置页那一栏仍有自己的样子**：0.3.1 起分区样式单独放在 `settings.css`，
  由 `host.js` 直发、`client.js` 常驻挂载，摘掉 `theme.css` 不会连它一起摘。
  只省掉「当前值」那张卡（那三个数是现读计算样式拿的，关了主题会显示错数字）。
  分区仍依赖 `settings.section` 槽，DSH 升级后可能失配——断了只是少一个分区，主题不受影响。
- **比皮肤脆**：皮肤中心是一层适配，帮使用者挡了宿主改版；插件直接贴着页面结构写，
  DSH 升级后可能失配。已知耦合点集中在 `[data-composer-card]` 与
  `--dsw-elevation-stroke-color`（见 `AGENTS.md`）。
- **壁纸存在数据目录，不随插件走**：换上的图落在 `<DSH_HOME>/remielle-dan/`，
  升级或重装插件不会动它，换一台机器也不会带走。桌面端与浏览器端读的是同一个文件，
  但各自要刷新一次才看得见对方换的图——跨窗口靠 `localStorage` 的
  `remielle-dan:wallpaper` 信标，跨 origin 收不到。
- **同时装 `dsh-wallpaper-engine` 可能叠两层壁纸**：本插件自己铺
  `#remielle-dan-bg`（`z-index:-1`），那个插件走 DSH 的装饰层，两者互不知道对方。
  本版不处理。
- **不能再当皮肤用**：不要把这套东西放进 `~/.dsh/skins`，也不要恢复 `skin.json`。
  皮肤形态已退役，同时启用两套会打架。

## 许可

代码 BSD 3-Clause，上游版权 `Copyright (c) 2026, zhu1090093659`。

**背景插画是《绝区零》素材，不在此许可范围内。** 作者知情选择保留，权利归属写在
`NOTICE` 第 2.1 节，以及源文件 `zzz-remielle-dan/skin.json` 的 `attribution` 字段中——
这是风险接受，不是授权取得。详见 [NOTICE](NOTICE)。

## 上游

- 仓库：https://github.com/zhu1090093659/dsh-skins
- 路径：`skins/summer-liquid-glass/`，版本 `0.1.0`
- 关系：本项目的 `styles/theme.css` 与 `patches.css` 由上游皮肤样式改造而来
