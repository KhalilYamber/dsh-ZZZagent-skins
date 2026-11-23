# 夏沫琉璃 / Summer Liquid Glass

> **本目录已不再是可安装的皮肤。** 这份说明是上游皮肤的原始文档，保留下来的唯一用途是溯源。
>
> - 本项目在 2026-11-22 整体转为 **DSH 插件**（不再依赖皮肤中心），请读仓库根目录的 `README.md`。
> - 本目录只提供样式源（`skin.css` / `patches.css` / `assets/`），由 `scripts/build-theme-css.mjs` 合成运行时样式。
> - `preview/` 已删除（画的是已不存在的旧背景）；`skin.json` 仅为承载 `attribution`（权利归属）保留，不要装回皮肤中心。
> - 背景插画的权利归属与处置约定见仓库根目录的 `NOTICE`。

[English](README.md) | 中文

dsh-web-ui v2 皮肤：日系夏祭背景 + iOS 26 液态玻璃表面。冰青作主要交互、
玫瑰粉作选中、琥珀金作运行中、黄绿作成功，深海军蓝底。

## 调色板

深夜底 `#071321`、玻璃基底 `#111927`、主文字 `#F8F3F5`、次级 `#C0CAD5`、
弱化 `#8997A7`；冰青 `#67DCE7`、玫瑰粉 `#DD8FAC`、琥珀金 `#F3B75F`、
黄绿 `#CBE77D`、珊瑚红 `#F1717F`。

## 目录结构

- `skin.json` — v2 清单（backgroundMedia 声明日系夏祭背景图与可读性遮罩）。
- `skin.css` — token 重映射（`--dsw-*` + `--aion-*`）。
- `patches.css` — 玻璃质感（背景模糊、内缘高光、输入区渐隐）。
- `assets/` — 背景插画。
- `preview/` — 亮/暗画廊预览图。

## 许可证

BSD-3-Clause。背景插画由用户提供、仅限本地使用；发布前请重新核查再分发权利。
