# dsh-remielle-dan

Remielle Dan — 一个**自建的 DSH Web 主题插件**。

不依赖皮肤中心，不用在设置里点"应用"：装进 profile，重启，DSH 就是这个样子。

**当前状态**：0.1.6 起，下面五项都在真机上验收通过。

- **主题底座与背景图**：深蓝玻璃、壁纸铺到窗口最底、侧栏透出画。
- **正文区一层底（30%）**：AI 一轮回复读作一整片，行间不露亮缝。这一层是**面板的底**，
  不是逐轮画的框——DSH 原生没有「轮容器」。
- **用户消息气泡**：独立圆角气泡，宽度贴着字；`/plan` 之后的回显也接住了。
- **输入区**：文字与光标鲜红 `#FF4D4D`，卡片紫描边加粗 + 光晕。
- **气泡透明度面板**：右下角滑杆，值存 localStorage。

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
host.js               宿主半边：三条路由（样式表、背景图、自报日志）
client.js             浏览器半边：打标记 → 挂样式 → 铺背景层 → 气泡透明度面板
                      （对聊天区只读不写：不插节点、不挂 class、不装观察器）
styles/theme.css       运行时样式，**生成产物**（勿手改；跑 scripts/build-theme-css.mjs 重生成）
scripts/build-theme-css.mjs  生成 theme.css 的脚本：改完源文件跑它

zzz-remielle-dan/     源文件与素材（不是可安装的皮肤，别往皮肤中心放）
  skin.css               token 源文件
  patches.css            DOM 质感源文件
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

## 怎么改

| 想改什么 | 改哪里 |
|---|---|
| 颜色、透明度、玻璃质感 | 改源：`zzz-remielle-dan/skin.css` 或 `patches.css` → 跑 `node scripts/build-theme-css.mjs`（`theme.css` 是生成产物，手改会被覆盖） |
| 背景图 | 替换 `zzz-remielle-dan/assets/remielle-dan-art.jpg`，或改 `host.js` 的路由指向 |
| 应用底板（压暗壁纸的主因） | `skin.css` 的 `--dsw-alias-bg-base`（现 `transparent`；上游是 `rgba(18,25,39,0.46)`，铺满窗口的一层黑） |
| 侧栏底色 | `skin.css` 的 `--dsw-specific-sidebar-fill`（现 `rgba(17,25,39,0.10)`；上游 `0.36`） |
| 背景遮罩（壁纸上的「纱」） | `skin.css` 的三个变量 `--remielle-veil-top/mid/bot`（现为全透明 = 不要纱；原值是 `rgba(7,19,33,0.28 / 0.22 / 0.32)`）。`client.js` 只负责读它们，兜底值仍是原值 |
| 背景位置 | `client.js` 里 `background-position`（插件形态可以控，皮肤形态不能） |
| 输入框底色透明度 | `skin.css` 的 `--dsw-specific-input-major`（现 `0.44`，越小越透；0.1.1 曾是 0.32，0.1.4 调回偏实） |
| 输入区文字 / 光标颜色 | `patches.css` 里 `[data-composer-card]` 那段，把 `#FF4D4D`（鲜红，2026-11-23 起）换掉。卡片描边仍走下面那条 |
| 输入框描边粗细 / 光晕 | `patches.css` 里 `[data-composer-card]` 的 `box-shadow` 三层：`0 0 0 1.5px` 是粗细，`20px -4px` 是光晕范围，`0.65` 是浓度 |
| 输入框背后那道暗带 | 已删除。原规则在 `patches.css` 的 `composerSeat:before`（保留注释说明为什么删） |
| 消息气泡 | `patches.css` 里 `[data-chat-flow-kind="user"]` 那三条选择器（user / steering / pending 回显），颜色与圆角同一处 |
| 正文区那一层底 | `patches.css` 里 `[data-conversation-region="chat"]` 的 `background-color`，只改 alpha：`0.18` 偏画 / `0.30` 现状 / `0.45` 偏字 |

## 已知边界

- **一轮回复的形状来自面板的底，不是来自气泡**：DSH 原生没有包住一轮的容器，
  AI 回复是一排同级行，行间 4 / 12 / 16px 的缝靠正文面板的底才看不见。
  0.1.6 起由 `[data-conversation-region="chat"]` 那一条规则提供这层底。
  「一轮一纸」的旧实验已整段删除，过程记在 `SNAPSHOT-一轮一纸-20261123.md`。
- **已实测**：装载、路由、token 覆盖、背景层、正文区一层底、用户气泡、输入区改色与红字，
  都在真机上验过。唯一没验的是「DSH 升级之后还能不能用」——这件事只能升级时才知道。
- **比皮肤脆**：皮肤中心是一层适配，帮使用者挡了宿主改版；插件直接贴着页面结构写，
  DSH 升级后可能失配。已知耦合点集中在 `[data-composer-card]` 与
  `--dsw-elevation-stroke-color`（见 `AGENTS.md`）。
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
