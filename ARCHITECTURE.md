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
  宿主导入 host.js → apply(ctx)
        │   ctx.webServer.register 注册两条 exact 路由
        │   ctx.effect(() => dispose) 登记销毁
        ▼
  浏览器加载 client.js → factory → apply(ctx)
        │   1. <html> 打 data-remielle-dan
        │   2. <link rel=stylesheet href=/remielle-dan/theme.css>
        │   3. <style> 背景层基础规则
        │   4. <div id=remielle-dan-bg>
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
| 文字与光标变紫 `#7B5AA3` | 直接给编辑元素上 `color` / `caret-color` | `[data-composer-card]` |
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
| 只回退视觉 | 改源（`skin.css` / `patches.css`）后跑 `node scripts/build-theme-css.mjs`；背景层在 `client.js` 的 `BASE_CSS`。刷新即可（路由 `no-store`） |
| 回退整个 profile 配置 | `package.json.bak-remielle-20261122-1900` |

## 七、已验证与仍未知

原先列的三件"未验证"，在 2026-11-22 已全部实证：

1. ✅ **token 双写压住了宿主定义**——界面整体确实换了色。
2. ✅ **背景 `-1` 层没被界面容器挡住**——背景图可见。
3. ✅ **`immediately: true` 装载即生效**——没在设置里点任何开关，界面就是主题外观。

仍未未知的只剩一件：**DSH 升级后这些耦合点会不会断**。断了不会崩，表现是"某块不生效"，
清单见 `AGENTS.md` 的「已知耦合点」。
