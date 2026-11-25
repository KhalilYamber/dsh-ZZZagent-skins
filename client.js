// Remielle Dan theme — 浏览器半边。
//
// 接入方式：package.json 的 dsh.client 声明 + 本文件作为 ./client 导出，
// 由客户模块系统装载。装载即生效（immediately: true），没有"试穿/应用"这一步；
// 想要「脱下来」用设置页那个开关（0.2.0 起）。
//
// 三件事（「开启」状态下）：
//   1. 在 <html> 上打 data-remielle-dan，作为全部样式的总开关；
//   2. 挂一张样式表 /remielle-dan/theme.css（token 重映射 + 玻璃质感）；
//   3. 铺一层背景：固定定位的 -1 层，图 + 可读性遮罩。
// 另加一处：向官方设置页注册「Remielle Dan」分区。0.2.0 起那栏有一个真开关，
// 能即时卸掉/装回上面三件——不必禁用插件，也不必重启 DSH。
//
// 每个副作用都通过 ctx.effect 注册销毁函数：禁用插件后页面能干净回到原生外观。
// 「关」的时候这三件必须一起摘（见 createThemeRuntime 的注释与 ARCHITECTURE.md 第十节）。
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
    // 运行时开关的存盘点。值只有 '1' / '0'，缺省按「开」。
    // 为什么用 localStorage：要求是「点完立刻生效」，而禁用插件要重启、
    // configForms 的配置也在宿主侧，都满足不了即时；本插件 0.1.6 之前的浮窗
    // 就用过 localStorage，属既有做法，不引入新依赖。
    const STORE_KEY = 'remielle-dan:enabled';
    // 改动这个标记，就能在 .client-report.log 里认出「页面跑的是哪一版」。
    const BUILD_TAG = '0.2.1';

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

    // ── 运行时开关（0.2.0）─────────────────────────────────────────────────
    // 「关掉主题外观」= 把下面四件一起摘掉，一件都不能少：
    //   1. <html data-remielle-dan>              token 块与气泡变量的作用域
    //   2. <link href=/remielle-dan/theme.css>   token + patches（patches 是全局的）
    //   3. <style> BASE_CSS                      把 html/body 的底色强制透明
    //   4. <div id="remielle-dan-bg">            壁纸层
    // 少摘一件都会「半脱」：只摘 1 → patches 还在（气泡、红字、紫描边都不退）；
    // 只摘 2 → 3 仍在，整页透底；只摘 4 → 3 强制透明却无处可画。
    // 所以四件同进同退，不允许只摘一部分。
    const readStoredEnabled = () => {
      try {
        return window.localStorage.getItem(STORE_KEY) !== '0';
      } catch (e) {
        return true; // 读不到（隐私模式、配额、被禁用）就当「开」，与旧版行为一致
      }
    };

    const createThemeRuntime = (initialEnabled) => {
      let enabled = false;
      let attached = false;
      let link = null;
      let base = null;
      let bg = null;
      const listeners = new Set();

      const emit = () => {
        for (const fn of [...listeners]) {
          try {
            fn();
          } catch (e) {
            /* 订阅方自己的问题，不许连累外观 */
          }
        }
      };

      const attach = () => {
        if (attached) return;
        attached = true;
        document.documentElement.setAttribute(ATTR, 'on');

        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = CSS_URL;
        link.setAttribute('data-remielle-dan-asset', '');
        link.addEventListener('error', () => {
          console.error(`[remielle-dan] 样式表加载失败：${CSS_URL}`);
        });
        document.head.appendChild(link);

        base = document.createElement('style');
        base.setAttribute('data-remielle-dan-asset', '');
        base.textContent = BASE_CSS;
        document.head.appendChild(base);

        bg = document.createElement('div');
        bg.id = 'remielle-dan-bg';
        bg.setAttribute('aria-hidden', 'true');
        document.body.appendChild(bg);
      };

      // 拆的顺序与建相反：背景层 → 基础规则 → 样式表 → 属性。先撤壁纸，再撤
      // 「把底色变透明」的那条规则，最后才让 token 回原生。整段同步跑完，
      // 浏览器不会在中间重绘；这个顺序是给「将来有人在中间插了 await」留的余量。
      const detach = () => {
        if (!attached) return;
        attached = false;
        if (bg !== null) { bg.remove(); bg = null; }
        if (base !== null) { base.remove(); base = null; }
        if (link !== null) { link.remove(); link = null; }
        try {
          document.documentElement.removeAttribute(ATTR);
        } catch (e) {
          /* 文档已卸载，忽略 */
        }
      };

      // 启动时按存储值决定建不建。关闭态「根本不创建」而不是「创建后隐藏」：
      // 省一次请求，重启时也不会先闪一下主题再消失。这一步不写存储。
      if (initialEnabled === true) {
        enabled = true;
        attach();
      }

      return {
        isEnabled: () => enabled,
        bg: () => bg,
        subscribe(fn) {
          listeners.add(fn);
          return () => { listeners.delete(fn); };
        },
        // persist=false 用于跨窗口同步：那边已经写过存储了，这边只跟状态、不回写。
        setEnabled(next, persist) {
          const want = next === true;
          if (want === enabled) return;
          enabled = want;
          if (want) attach(); else detach();
          if (persist !== false) {
            try {
              window.localStorage.setItem(STORE_KEY, want ? '1' : '0');
            } catch (e) {
              /* 存不住：只影响下次启动，本次照常 */
            }
          }
          emit();
        },
        dispose() {
          detach();
          listeners.clear();
        },
      };
    };

    // ── 设置页分区（0.1.7 起，0.2.0 加开关）───────────────────────────────
    // 0.1.7 起气泡透明度定为定值（0.2.1 从 55% 调到 62%，写在 patches.css 的
    // --remielle-bubble-alpha），原来那个右下角浮窗整套删除，改向官方设置页注册
    // 一个分区；0.2.0 在那栏顶部装了主题开关，其余仍是只读展示。
    //
    // 契约来自本机已在工作的 yammory-system 插件（同版本 DSH，非猜测）：
    //   ctx.slots.inject('settings.section', () => ctx.slots.register({
    //     name: 'settings.section', id, order, label, /* inject?: hooks */
    //   }, Component))
    // 组件是普通 React 函数组件，React 由宿主模块系统提供（require('react')），
    // 不需要构建步骤。仍然不接 configForms：这里存的是「这一页要不要穿主题」，
    // 属于界面状态，不是需要宿主审批或重启才生效的配置。
    //
    // 安全性：整段在 apply() 末尾单独 try/catch。它失败只会少一个设置分区，
    // 主题照常生效——这是本轮唯一可能连累整体的地方，所以放在最后。
    const SETTINGS_SLOT = 'settings.section';
    const SETTINGS_ID = 'remielle-dan';
    let settingsState = 'pending';

    const installSettingsSection = (ctx, theme) => {
      const react = require('react');
      const h = react.createElement;
      // 0.2.0 起这个分区有了真开关，需要 hooks。宿主内置的 React 暴露了
      // useState / useEffect（client Builtin 目录有登记），本机同版本另有实证：
      // D:\GitHub_place\plugins\记忆系统\client\client.js 的槽组件就在用。
      const useState = react.useState;
      const useEffect = react.useEffect;

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
        const alpha = readVar('--remielle-bubble-alpha', '0.62');
        return `${Math.round(Number(alpha) * 100)}%`;
      };
      // 0.2.1 起底画在消息板上，不再看正文区外壳（外壳现在是 transparent）。
      const liveChatBg = () => computedOf(
        '[data-chat-flow]:not([data-step-process-content])',
        'backgroundColor',
        'rgba(11, 18, 30, 0.3)',
      );
      const liveInputColor = () => computedOf(
        '[data-composer-card] textarea, [data-composer-card] [contenteditable="true"]',
        'color',
        'rgb(255, 77, 77)',
      );

      const row = (k, v) => h('div', { key: k, className: 'remielle-set-row' },
        h('span', { className: 'remielle-set-k' }, k),
        h('span', { className: 'remielle-set-v' }, v));

      /** 设置页分区组件。0.2.0 起顶部是主题开关，下面才是只读的当前值。 */
      function RemielleSection() {
        const [enabled, setEnabled] = useState(() => theme.isEnabled());
        // 订阅运行时的状态：按钮自己点、另一个窗口改、将来别处改，标签都跟着走。
        useEffect(() => theme.subscribe(() => setEnabled(theme.isEnabled())), []);

        // 关闭态不显示这三行：它们是现读计算样式拿的，主题一关就全退到兜底值，
        // 显示出来就是错数字（比如气泡透明度仍写 62%，而气泡根本不存在）。
        const values = enabled
          ? [
            h('div', { key: 'cur', className: 'remielle-set-group' }, '外观 · 当前值'),
            row('用户气泡透明度', liveBubblePct()),
            row('消息板底', liveChatBg()),
            row('输入文字颜色', liveInputColor()),
          ]
          : [h('p', { key: 'off', className: 'remielle-set-note' },
            '关闭状态下这些着色不生效，所以当前值从略。')];

        return h('div', { className: 'remielle-set' },
          h('h2', { className: 'remielle-set-title' }, 'Remielle Dan'),
          h('p', { className: 'remielle-set-desc' },
            '主题外观的运行时开关：关掉后界面立刻回到 DSH 原生外观，插件仍然装着，随时可以再打开。'),
          h('div', { className: 'remielle-set-group' }, '外观 · 开关'),
          row('主题外观', enabled ? '已开启（Remielle Dan）' : '已关闭（DSH 原生）'),
          h('div', { className: 'remielle-set-actions' },
            h('button', {
              key: 'toggle',
              className: 'remielle-set-btn',
              type: 'button',
              'aria-pressed': enabled,
              onClick: () => theme.setEnabled(!theme.isEnabled()),
            }, enabled ? '关闭主题外观' : '开启主题外观'),
            h('button', {
              key: 'export',
              className: 'remielle-set-btn',
              type: 'button',
              disabled: true,
            }, '导出配置')),
          ...values,
          h('p', { className: 'remielle-set-note' },
            '这个选择记在当前界面的浏览器存储里（桌面端与浏览器端各存一份）；关掉只摘外观，不卸载插件。'),
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
      // 0.1.7：右下角那个透明度浮窗已删，它当年写的 localStorage 键也一并清掉——
      // 留着只会让以后的人以为还有东西在读它。
      try {
        window.localStorage.removeItem('remielle:bubble-alpha');
      } catch (e) {
        /* 隐私模式或配额满时取不到，忽略 */
      }

      // 运行时：按上次的选择决定这一页要不要穿主题。
      // 开 → 建四件；关 → 一件都不建（所以关着启动时一点主题都不会闪）。
      const theme = createThemeRuntime(readStoredEnabled());

      // 只用来核对前提：宿主的 React 里到底有没有 useState。
      // 没有的话开关会退化成「点不动的标签」，这件事要能进自报。
      let hasHooks = false;
      try {
        hasHooks = typeof require('react').useState === 'function';
      } catch (e) {
        hasHooks = false;
      }
      // 插件被禁用、或页面卸载时，把还挂着的四件一起摘掉，退回原生。
      ctx.effect(() => () => theme.dispose());

      // 跨窗口同步：另一个窗口动了开关，这个窗口跟着动。
      // 只跟状态、不回写存储——storage 事件本来就不会回到写入方，但没必要冒险。
      const onStorage = (ev) => {
        if (ev.key !== STORE_KEY) return;
        theme.setEnabled(ev.newValue !== '0', false);
      };
      ctx.effect(() => {
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
      });

      // ── 自报：把「页面里实际算出来的值」回传给宿主，写进 .client-report.log ──
      // 目的：改样式的人（包括 agent）能确认三件事，而不用反复请用户截图——
      //   ① 浏览器跑的是哪一版前端代码；② 背景层到底有没有被画出来；
      //   ③ 「纱」最终解析成什么颜色（变量生效了没有）。
      // 完全失败也不影响外观：这里的异常全部吞掉。
      const report = () => {
        try {
          // 关闭态下背景层根本不存在，这里必须容忍 null——否则自报会抛异常，
          // 而自报是「关掉之后还能不能核对」的唯一证据来源。
          const bg = theme.bg();
          const cs = bg === null ? null : getComputedStyle(bg);
          const cssVar = (name) => (cs === null ? '(无背景层)' : cs.getPropertyValue(name).trim() || '(未定义)');
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
          // 0.2.1 起底画在消息板上：chatRegion 只用来确认外壳仍是透明的，
          // board 才是真正要对数的那个。观感有争议时先看 board.bg 与尺寸，别猜。
          const region = document.querySelector('[data-conversation-region="chat"]');
          const regionBox = region === null ? null : region.getBoundingClientRect();
          const board = document.querySelector('[data-chat-flow]:not([data-step-process-content])');
          const boardBox = board === null ? null : board.getBoundingClientRect();
          const payload = {
            build: BUILD_TAG,
            // 0.2.0 的两个新字段：themeEnabled 证明开关切过去了，
            // layer 证明背景层此刻在不在；hasUseState 只用来核对 hooks 前提还成立。
            themeEnabled: theme.isEnabled(),
            hasUseState: hasHooks,
            layer: bg !== null && bg.isConnected,
            veilTop: cssVar('--remielle-veil-top'),
            veilMid: cssVar('--remielle-veil-mid'),
            veilBot: cssVar('--remielle-veil-bot'),
            bgImage: cs === null ? '(无背景层)' : cs.backgroundImage.slice(0, 300),
            bgSize: `${vw}x${vh}`,
            overlays,
            chatRegion: region === null
              ? null
              : {
                bg: getComputedStyle(region).backgroundColor,
                width: Math.round(regionBox.width),
                height: Math.round(regionBox.height),
              },
            board: board === null
              ? null
              : {
                bg: getComputedStyle(board).backgroundColor,
                width: Math.round(boardBox.width),
                height: Math.round(boardBox.height),
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

      // 每次切换开关补一条自报：这样「关掉了」这件事在 .client-report.log 里有据可查，
      // 不必只靠肉眼。report 自己吞异常，不会把开关搞坏。
      //
      // 但要**延后 400ms 再采**：插入 <link> 到样式真正生效是异步的，开关打开时
      // 立刻读完拿到的是应用前的值（veil 变量还是「未定义」、正文区还是原生底色），
      // 那样的日志会自相矛盾，把「开了」误记成「没生效」。关掉方向也一起延后，
      // 两条路径共用一套逻辑。连点多下只留最后一条。
      ctx.effect(() => {
        let timer = 0;
        const unsubscribe = theme.subscribe(() => {
          clearTimeout(timer);
          timer = setTimeout(report, 400);
        });
        return () => {
          unsubscribe();
          clearTimeout(timer);
        };
      });

      // ── 设置页分区：放在最后 ──────────────────────────────────────────────
      // 失败只会少一个设置分区，主题照常。这是本轮唯一可能连累整体的动作，
      // 所以排在所有外观动作之后，并且单独 try/catch。
      // 写法与 yammory-system 插件一致：把注册塞进 ctx.effect 的回调——
      // 该回调会立即执行（注册同步发生），返回的销毁函数被 effect 接管。
      try {
        ctx.effect(() => installSettingsSection(ctx, theme), 'remielle-dan: settings section');
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
