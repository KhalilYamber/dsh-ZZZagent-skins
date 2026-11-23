// Remielle Dan theme — 浏览器半边。
//
// 接入方式：package.json 的 dsh.client 声明 + 本文件作为 ./client 导出，
// 由客户模块系统装载。装载即生效（immediately: true），没有"试穿/应用"这一步。
//
// 三件事：
//   1. 在 <html> 上打 data-remielle-dan，作为全部样式的总开关；
//   2. 挂一张样式表 /remielle-dan/theme.css（token 重映射 + 玻璃质感）；
//   3. 铺一层背景：固定定位的 -1 层，图 + 可读性遮罩。
// 另加一处：向官方设置页注册「Remielle Dan」分区（0.1.7 起，目前只读占位）。
//
// 每个副作用都通过 ctx.effect 注册销毁函数：禁用插件后页面能干净回到原生外观。
window.__ModuleLoader__.load({
  id: 'dsh-remielle-dan',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    // 0.1.7 起要往官方设置页挂分区，需要 slots 服务；它由客户端核心提供，
    // 与 yammory-system 插件的用法一致（那个插件同样 inject: ['slots']）。
    const inject = ['slots'];
    const ATTR = 'data-remielle-dan';
    const CSS_URL = '/remielle-dan/theme.css';
    const ART_URL = '/remielle-dan/art.jpg';
    const REPORT_URL = '/remielle-dan/report';
    // 改动这个标记，就能在 .client-report.log 里认出「页面跑的是哪一版」。
    const BUILD_TAG = '0.1.7';

    // 背景层：遮罩在上、图在下（CSS 多重背景，写在前的在上层）。
    //
    // 「纱」= 盖在壁纸上的那层深色渐变。它的三个颜色由 theme.css 的三个变量给出，
    // 变量不存在时用下面的兜底值（= 原始外观），所以缺变量不会坏成白屏/黑屏。
    // 特意不把数字写进 calc()：万一浏览器不接受 rgba() 里套算式，整条
    // background-image 会被丢弃 —— 那是"壁纸消失"，比"纱没去掉"严重得多。
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
      var(--remielle-veil-top, rgba(7, 19, 33, 0.28)) 0%,
      var(--remielle-veil-mid, rgba(7, 19, 33, 0.22)) 45%,
      var(--remielle-veil-bot, rgba(7, 19, 33, 0.32)) 100%
    ),
    url("${ART_URL}");
  background-repeat: no-repeat, no-repeat;
  background-size: cover, cover;
  background-position: center center, center center;
}
`;

    // ── 设置页分区（0.1.7）─────────────────────────────────────────────────
    // 0.1.7 起气泡透明度定为 55%（写在 patches.css 的 --remielle-bubble-alpha），
    // 原来那个右下角浮窗整套删除。这里改为向官方设置页注册一个分区，先把位置占住。
    //
    // 契约来自本机已在工作的 yammory-system 插件（同版本 DSH，非猜测）：
    //   ctx.slots.inject('settings.section', () => ctx.slots.register({
    //     name: 'settings.section', id, order, label, /* inject?: hooks */
    //   }, Component))
    // 组件是普通 React 函数组件，React 由宿主模块系统提供（require('react')），
    // 不需要构建步骤。我们不接 configForms：占位分区不保存任何东西。
    //
    // 安全性：整段在 apply() 末尾单独 try/catch。它失败只会少一个设置分区，
    // 主题照常生效——这是本轮唯一可能连累整体的地方，所以放在最后。
    const SETTINGS_SLOT = 'settings.section';
    const SETTINGS_ID = 'remielle-dan';
    let settingsState = 'pending';

    const installSettingsSection = (ctx) => {
      const react = require('react');
      const h = react.createElement;

      const readVar = (name, fallback) => {
        try {
          return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
        } catch (e) {
          return fallback;
        }
      };
      const computedOf = (selector, prop, fallback) => {
        try {
          const el = document.querySelector(selector);
          return el === null ? fallback : (getComputedStyle(el)[prop] || fallback);
        } catch (e) {
          return fallback;
        }
      };

      // 展示当前生效值：每次渲染现读页面算出来的值，读不到才用写死的兜底。
      // 这样以后改 CSS，设置页不会显示旧数字。
      const liveBubblePct = () => {
        const alpha = readVar('--remielle-bubble-alpha', '0.55');
        return `${Math.round(Number(alpha) * 100)}%`;
      };
      const liveChatBg = () => computedOf('[data-conversation-region="chat"]', 'backgroundColor', 'rgba(11, 18, 30, 0.3)');
      const liveInputColor = () => computedOf(
        '[data-composer-card] textarea, [data-composer-card] [contenteditable="true"]',
        'color',
        'rgb(255, 77, 77)',
      );

      const row = (k, v) => h('div', { className: 'remielle-set-row' },
        h('span', { className: 'remielle-set-k' }, k),
        h('span', { className: 'remielle-set-v' }, v));

      /** 设置页分区组件。目前只读：展示值 + 两个禁用按钮占位。 */
      function RemielleSection() {
        return h('div', { className: 'remielle-set' },
          h('h2', { className: 'remielle-set-title' }, 'Remielle Dan'),
          h('p', { className: 'remielle-set-desc' },
            '主题插件的外观设置。下面是当前生效的值；可调的控件留待后续版本补上。'),
          h('div', { className: 'remielle-set-group' }, '外观 · 当前值'),
          row('用户气泡透明度', liveBubblePct()),
          row('正文区底', liveChatBg()),
          row('输入文字颜色', liveInputColor()),
          h('div', { className: 'remielle-set-group' }, '预留'),
          h('div', { className: 'remielle-set-actions' },
            h('button', { className: 'remielle-set-btn', type: 'button', disabled: true }, '恢复默认外观'),
            h('button', { className: 'remielle-set-btn', type: 'button', disabled: true }, '导出配置')),
          h('p', { className: 'remielle-set-note' },
            '这两个按钮是占位。等可调项多起来，再逐项接上真正的控件。'),
          h('p', { className: 'remielle-set-note' }, `Remielle Dan 主题插件 · ${BUILD_TAG}`));
      }

      return ctx.slots.inject(SETTINGS_SLOT, () => ctx.slots.register({
        name: SETTINGS_SLOT,
        id: SETTINGS_ID,
        order: 40,
        label: 'Remielle Dan',
      }, RemielleSection));
    };

    const apply = (ctx) => {
      const root = document.documentElement;
      root.setAttribute(ATTR, 'on');
      ctx.effect(() => () => root.removeAttribute(ATTR));

      // 0.1.7：右下角那个透明度浮窗已删，它当年写的 localStorage 键也一并清掉——
      // 留着只会让以后的人以为还有东西在读它。
      try {
        window.localStorage.removeItem('remielle:bubble-alpha');
      } catch (e) {
        /* 隐私模式或配额满时取不到，忽略 */
      }

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

      // ── 自报：把「页面里实际算出来的值」回传给宿主，写进 .client-report.log ──
      // 目的：改样式的人（包括 agent）能确认三件事，而不用反复请用户截图——
      //   ① 浏览器跑的是哪一版前端代码；② 背景层到底有没有被画出来；
      //   ③ 「纱」最终解析成什么颜色（变量生效了没有）。
      // 完全失败也不影响外观：这里的异常全部吞掉。
      const report = () => {
        try {
          const cs = getComputedStyle(bg);
          // 找「盖住大部分窗口、并且真的画了东西」的层——真正的暗色遮罩躲在其中。
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const overlays = [];
          for (const el of document.querySelectorAll('html, body, body *')) {
            if (el === bg) continue;
            const r = el.getBoundingClientRect();
            if (r.width < vw * 0.6 || r.height < vh * 0.6) continue;
            const s = getComputedStyle(el);
            const bgc = s.backgroundColor;
            const bgi = s.backgroundImage;
            const bf = s.backdropFilter || s.webkitBackdropFilter || 'none';
            const fl = s.filter;
            const paints =
              (bgc && bgc !== 'rgba(0, 0, 0, 0)' && bgc !== 'transparent') ||
              (bgi && bgi !== 'none') ||
              (bf && bf !== 'none') ||
              (fl && fl !== 'none') ||
              Number(s.opacity) < 0.999;
            if (!paints) continue;
            overlays.push({
              t: el.tagName.toLowerCase(),
              c: String(el.className || '').slice(0, 40),
              bg: bgc,
              bgi: bgi.slice(0, 60),
              bf,
              fl,
              op: s.opacity,
              z: s.zIndex,
              p: s.position,
            });
            if (overlays.length >= 14) break;
          }
          // 消息节点的真实结构：验证气泡选择器是否命中。
          const kinds = new Set();
          document.querySelectorAll('[data-chat-flow-kind]').forEach((el) => {
            kinds.add(el.getAttribute('data-chat-flow-kind'));
          });
          const describeNode = (kind) => {
            const el = document.querySelector(`[data-chat-flow-kind="${kind}"]`);
            if (el === null) return null;
            const s = getComputedStyle(el);
            const first = el.firstElementChild;
            return {
              tag: el.tagName.toLowerCase(),
              cls: String(el.className || '').slice(0, 40),
              display: s.display,
              width: Math.round(el.getBoundingClientRect().width),
              children: el.children.length,
              firstChild: first === null
                ? null
                : `${first.tagName.toLowerCase()}.${String(first.className || '').slice(0, 24)}`,
            };
          };
          // 消息区真实结构：不猜属性名，把容器和子节点身上真实带的 data-* 全 dump 回来。
          const probeChat = () => {
            const candidates = [
              '[data-chat-flow]',
              '[data-conversation-scroll]',
              '[class*="chatFlow"]',
              '[class*="scrollBody"]',
            ];
            let el = null;
            let matched = null;
            for (const sel of candidates) {
              el = document.querySelector(sel);
              if (el !== null) { matched = sel; break; }
            }
            const out = {
              matched,
              exists: el !== null,
              dataNames: [],
              nodes: [],
              bodyTextLen: (document.body.innerText || '').length,
            };
            if (el === null) return out;
            const names = new Set();
            const kids = Array.from(el.children).slice(0, 6);
            for (const k of kids) {
              const attrs = [];
              for (const a of k.attributes) {
                if (a.name.startsWith('data-')) { attrs.push(a.name); names.add(a.name); }
              }
              out.nodes.push({
                tag: k.tagName.toLowerCase(),
                cls: String(k.className || '').slice(0, 36),
                attrs,
                kids: k.children.length,
                textLen: (k.textContent || '').trim().length,
              });
            }
            out.dataNames = [...names];
            return out;
          };
          // 正文区那层底是否真的生效（0.1.6）：给「观感」留一个可以对数的证据。
          // 观感有争议时先看这两个数，别猜。
          const region = document.querySelector('[data-conversation-region="chat"]');
          const regionBox = region === null ? null : region.getBoundingClientRect();
          const payload = {
            build: BUILD_TAG,
            layer: bg.isConnected,
            veilTop: cs.getPropertyValue('--remielle-veil-top').trim() || '(未定义)',
            veilMid: cs.getPropertyValue('--remielle-veil-mid').trim() || '(未定义)',
            veilBot: cs.getPropertyValue('--remielle-veil-bot').trim() || '(未定义)',
            bgImage: cs.backgroundImage.slice(0, 300),
            bgSize: `${vw}x${vh}`,
            overlays,
            chatRegion: region === null
              ? null
              : {
                bg: getComputedStyle(region).backgroundColor,
                width: Math.round(regionBox.width),
                height: Math.round(regionBox.height),
              },
            paperCount: document.querySelectorAll('.remielle-turn-paper').length,
            settingsSection: settingsState,
            bubblePanel: 'removed',
            chatKinds: [...kinds].slice(0, 12),
            userNode: describeNode('user'),
            assistantNode: describeNode('assistant'),
            chat: probeChat(),
            selCounts: {
              user: document.querySelectorAll('[data-chat-flow-kind="user"]').length,
              assistant: document.querySelectorAll('[data-chat-flow-kind="assistant"]').length,
            },
          };
          fetch(REPORT_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        } catch (e) {
          /* 自报失败不影响外观 */
        }
      };
      // 采两次：1.2 秒时页面可能还没渲染完消息，5 秒再补一次。
      const reportTimer = setTimeout(report, 1200);
      const reportTimer2 = setTimeout(report, 5000);
      ctx.effect(() => () => {
        clearTimeout(reportTimer);
        clearTimeout(reportTimer2);
      });

      // ── 设置页分区：放在最后 ──────────────────────────────────────────────
      // 失败只会少一个设置分区，主题照常。这是本轮唯一可能连累整体的动作，
      // 所以排在所有外观动作之后，并且单独 try/catch。
      // 写法与 yammory-system 插件一致：把注册塞进 ctx.effect 的回调——
      // 该回调会立即执行（注册同步发生），返回的销毁函数被 effect 接管。
      try {
        ctx.effect(() => installSettingsSection(ctx), 'remielle-dan: settings section');
        settingsState = 'ok';
      } catch (e) {
        settingsState = `failed: ${e && e.message ? e.message : e}`;
        console.warn('[remielle-dan] 设置分区未注册（不影响主题）：', e);
      }

      console.log(`[remielle-dan] 浏览器半边已激活（build ${BUILD_TAG}）`);
    };

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
