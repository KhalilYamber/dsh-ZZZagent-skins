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
    const REPORT_URL = '/remielle-dan/report';
    // 改动这个标记，就能在 .client-report.log 里认出「页面跑的是哪一版」。
    const BUILD_TAG = '0.1.6';

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

    // 气泡透明度面板：插件自带，不依赖 DSH 设置页的 DOM。
    // 它只做一件事：把 --remielle-bubble-alpha 写到 <html> 的内联样式上。
    // 0.1.6 起只有用户气泡读这一个变量（AI 那侧不画块，形状由面板的底给出）。
    // 值存在 localStorage，刷新后还在。
    const ALPHA_KEY = 'remielle:bubble-alpha';
    const ALPHA_DEFAULT = 55;
    const ALPHA_MIN = 20;
    const ALPHA_MAX = 90;

    const readAlpha = () => {
      try {
        const raw = window.localStorage.getItem(ALPHA_KEY);
        const value = raw === null ? Number.NaN : Number(raw);
        if (!Number.isFinite(value)) return ALPHA_DEFAULT;
        return Math.min(Math.max(Math.round(value), ALPHA_MIN), ALPHA_MAX);
      } catch (e) {
        return ALPHA_DEFAULT;
      }
    };

    const writeAlpha = (value) => {
      try {
        window.localStorage.setItem(ALPHA_KEY, String(value));
      } catch (e) {
        /* 隐私模式或配额满时只在本次页面生效 */
      }
    };

    const installBubbleControl = (root) => {
      let alpha = readAlpha();
      const applyAlpha = (next) => {
        alpha = Math.min(Math.max(Math.round(next), ALPHA_MIN), ALPHA_MAX);
        root.style.setProperty('--remielle-bubble-alpha', String(alpha / 100));
        const value = document.getElementById('remielle-bubble-value');
        if (value !== null) value.textContent = `${alpha}%`;
        const slider = document.getElementById('remielle-bubble-slider');
        if (slider !== null && Number(slider.value) !== alpha) slider.value = String(alpha);
      };
      applyAlpha(alpha);

      const style = document.createElement('style');
      style.setAttribute('data-remielle-dan-asset', '');
      style.textContent = `
        #remielle-bubble-control { position: fixed; right: 16px; bottom: 92px; z-index: 2147483000; font: 12px/1.4 system-ui, sans-serif; color: #F8F3F5; }
        #remielle-bubble-toggle { width: 34px; height: 34px; padding: 0; border-radius: 50%; border: 1px solid rgba(103,220,231,0.35); background: rgba(13,22,39,0.72); color: #67DCE7; cursor: pointer; backdrop-filter: blur(12px); }
        #remielle-bubble-panel { position: absolute; right: 0; bottom: 44px; width: 220px; padding: 12px 14px; border-radius: 14px; background: rgba(13,22,39,0.9); border: 1px solid rgba(103,220,231,0.22); box-shadow: 0 10px 30px rgba(0,7,18,0.35); backdrop-filter: blur(18px); }
        #remielle-bubble-panel[hidden] { display: none; }
        #remielle-bubble-panel .row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        #remielle-bubble-panel .hint { display: flex; justify-content: space-between; margin-top: 6px; opacity: 0.6; }
        #remielle-bubble-slider { width: 100%; accent-color: #7B5AA3; }
        #remielle-bubble-reset { width: 100%; margin-top: 10px; padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(103,220,231,0.22); background: rgba(29,51,79,0.5); color: #C0CAD5; cursor: pointer; }
      `;
      document.head.appendChild(style);

      const box = document.createElement('div');
      box.id = 'remielle-bubble-control';
      box.innerHTML = `
        <button id="remielle-bubble-toggle" type="button" title="气泡透明度" aria-label="气泡透明度">◐</button>
        <div id="remielle-bubble-panel" hidden>
          <div class="row"><span>气泡透明度</span><span id="remielle-bubble-value">${alpha}%</span></div>
          <input id="remielle-bubble-slider" type="range" min="${ALPHA_MIN}" max="${ALPHA_MAX}" step="5" value="${alpha}" />
          <div class="hint"><span>更透</span><span>更实</span></div>
          <button id="remielle-bubble-reset" type="button">恢复默认 ${ALPHA_DEFAULT}%</button>
        </div>
      `;
      document.body.appendChild(box);

      const panel = box.querySelector('#remielle-bubble-panel');
      const toggle = box.querySelector('#remielle-bubble-toggle');
      const slider = box.querySelector('#remielle-bubble-slider');
      const reset = box.querySelector('#remielle-bubble-reset');
      toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; });
      slider.addEventListener('input', () => {
        applyAlpha(Number(slider.value));
        writeAlpha(alpha);
      });
      reset.addEventListener('click', () => {
        applyAlpha(ALPHA_DEFAULT);
        writeAlpha(alpha);
      });

      return () => {
        style.remove();
        box.remove();
      };
    };

    const apply = (ctx) => {
      const root = document.documentElement;
      root.setAttribute(ATTR, 'on');
      ctx.effect(() => () => root.removeAttribute(ATTR));

      const disposeBubbleControl = installBubbleControl(root);
      ctx.effect(() => disposeBubbleControl);

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

      console.log(`[remielle-dan] 浏览器半边已激活（build ${BUILD_TAG}）`);
    };

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
