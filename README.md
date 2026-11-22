# dsh-remielle-dan

Remielle Dan — 一个**自建的 DSH Web 主题插件**。

不依赖皮肤中心，不用在设置里点"应用"：装进 profile，重启，DSH 就是这个样子。

**当前状态**：已装载并验证生效——界面换肤、背景图、输入区改色（`#7B5AA3` + 加粗描边 + 光晕）都已实测通过。逐条见 `CHANGELOG.md`。

## 为什么是插件，不是皮肤

DSH 本体只认插件。"皮肤"（`skin.json` + 皮肤中心）是第三方插件
`@linxin666/dsh-client-ui-skin-center` 定义的一套格式——用它就等于依附它。

本项目最初做的是一套皮肤，后来整体转成插件：样式和素材原样搬过来，只换注入方式。
皮肤形态已退役，仓库里不再安装任何皮肤。

## 目录

```
package.json          插件清单：main=host.js，exports 带 ./client，dsh.client.immediately=true
cordis.patch.yml      bundle patch：往宿主插件树插一行 remielle-dan-theme
host.js               宿主半边：两条静态路由（样式表、背景图）
client.js             浏览器半边：打标记 → 挂样式 → 铺背景层
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
| 背景遮罩 | `client.js` 里 `BASE_CSS` 的 `linear-gradient(...)`（当前是 A 方案 0.28 / 0.22 / 0.32） |
| 背景位置 | `client.js` 里 `background-position`（插件形态可以控，皮肤形态不能） |
| 输入框底色透明度 | `skin.css` 的 `--dsw-specific-input-major`（现 `0.32`，越小越透） |
| 输入区文字 / 光标颜色 | `patches.css` 里 `[data-composer-card]` 那段，把 `#7B5AA3` 换掉 |
| 输入框描边粗细 / 光晕 | `patches.css` 里 `[data-composer-card]` 的 `box-shadow` 三层：`0 0 0 1.5px` 是粗细，`20px -4px` 是光晕范围，`0.65` 是浓度 |
| 输入框背后那道暗带 | 已删除。原规则在 `patches.css` 的 `composerSeat:before`（保留注释说明为什么删） |

## 已知边界

- **已实测**：装载、路由、token 覆盖、背景层、输入区改色（含新会话状态）都在真机上验过。
  唯一没验的是「DSH 升级之后还能不能用」——这件事只能升级时才知道。
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
