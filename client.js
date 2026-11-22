// Remielle Dan theme — 浏览器半边。
//
// 接入方式：package.json 的 dsh.client 声明 + 本文件作为 ./client 导出，
// 由客户模块系统装载。装载即生效（immediately: true），没有"试穿/应用"这一步。
//
// 三件事：
//   1. 在 <html> 上打 data-remielle-dan，作为全部样式的总开关；
//   2. 挂一张样式表 /remielle-dan/theme.css（token 重映射 + 玻璃质感）；
//   3. 铺一层背景：固定定位的 -1 层，图 + 可读性遮罩。
//
// 每个副作用都通过 ctx.effect 注册销毁函数：禁用插件后页面能干净回到原生外观。
window.__ModuleLoader__.load({
  id: 'dsh-remielle-dan',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const inject = [];
    const ATTR = 'data-remielle-dan';
    const CSS_URL = '/remielle-dan/theme.css';
    const ART_URL = '/remielle-dan/art.jpg';

    // 背景层：遮罩在上、图在下（CSS 多重背景，写在前的在上层）。
    // 遮罩沿用作者选定的 A 方案：竖直 0.28 / 0.22 / 0.32。
    const BASE_CSS = `
html[${ATTR}],
html[${ATTR}] body {
  background-color: transparent !important;
  background-image: none !important;
}
#remielle-dan-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    linear-gradient(
      rgba(7, 19, 33, 0.28) 0%,
      rgba(7, 19, 33, 0.22) 45%,
      rgba(7, 19, 33, 0.32) 100%
    ),
    url("${ART_URL}");
  background-repeat: no-repeat, no-repeat;
  background-size: cover, cover;
  background-position: center center, center center;
}
`;

    const apply = (ctx) => {
      const root = document.documentElement;
      root.setAttribute(ATTR, 'on');
      ctx.effect(() => () => root.removeAttribute(ATTR));

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS_URL;
      link.setAttribute('data-remielle-dan-asset', '');
      link.addEventListener('error', () => {
        console.error(`[remielle-dan] 样式表加载失败：${CSS_URL}`);
      });
      document.head.appendChild(link);
      ctx.effect(() => () => link.remove());

      const base = document.createElement('style');
      base.setAttribute('data-remielle-dan-asset', '');
      base.textContent = BASE_CSS;
      document.head.appendChild(base);
      ctx.effect(() => () => base.remove());

      const bg = document.createElement('div');
      bg.id = 'remielle-dan-bg';
      bg.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bg);
      ctx.effect(() => () => bg.remove());

      console.log('[remielle-dan] 浏览器半边已激活');
    };

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
