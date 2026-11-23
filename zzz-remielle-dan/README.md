# 夏沫琉璃 / Summer Liquid Glass

> **本目录已不再是可安装的皮肤。** 这份说明是上游皮肤的原始文档，保留下来的唯一用途是溯源。
>
> - 本项目在 2026-11-22 整体转为 **DSH 插件**（不再依赖皮肤中心），请读仓库根目录的 `README.md`。
> - 本目录只提供样式源（`skin.css` / `patches.css` / `assets/`），由 `scripts/build-theme-css.mjs` 合成运行时样式。
> - `preview/` 已删除（画的是已不存在的旧背景）；`skin.json` 仅为承载 `attribution`（权利归属）保留，不要装回皮肤中心。
> - 背景插画的权利归属与处置约定见仓库根目录的 `NOTICE`。

English | [中文](README.zh.md)

A dsh-web-ui v2 skin: a Japanese summer-festival backdrop under an iOS 26
liquid-glass surface. Ice-cyan interaction, rose selection, amber running, and
yellow-green success over a deep-night palette.

## Palette

Deep night `#071321` base, glass base `#111927`, primary text `#F8F3F5`,
secondary `#C0CAD5`, dim `#8997A7`; ice cyan `#67DCE7`, rose `#DD8FAC`, amber
`#F3B75F`, yellow-green `#CBE77D`, coral `#F1717F`.

## Structure

- `skin.json` — v2 manifest (backgroundMedia declares the night-festival art and its readability scrim).
- `skin.css` — token remap (`--dsw-*` + `--aion-*`).
- `patches.css` — glass polish (backdrop blur, inner highlights, composer fade).
- `assets/` — the backdrop art.
- `preview/` — light/dark gallery previews.

## License

BSD-3-Clause. The backdrop art is provided by the user for local use; re-check
redistribution rights before publishing.
