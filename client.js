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
    // 0.3.1：设置页分区的样式，**常驻**——不随主题开关卸载，挂载见 apply()。
    const SETTINGS_CSS_URL = '/remielle-dan/settings.css';
    const ART_URL = '/remielle-dan/art.jpg';
    const REPORT_URL = '/remielle-dan/report';
    // 0.3.0：壁纸状态与换图。GET 读、POST 换、DELETE 恢复默认（见 host.js）。
    const WALLPAPER_URL = '/remielle-dan/wallpaper';
    // 运行时开关的存盘点。值只有 '1' / '0'，缺省按「开」。
    // 为什么用 localStorage：要求是「点完立刻生效」，而禁用插件要重启、
    // configForms 的配置也在宿主侧，都满足不了即时；本插件 0.1.6 之前的浮窗
    // 就用过 localStorage，属既有做法，不引入新依赖。
    const STORE_KEY = 'remielle-dan:enabled';
    // 壁纸的跨窗口信标：存最近一次的 updatedAt。别的窗口改了壁纸，这个窗口
    // 靠它收到 storage 事件，再去问一次宿主「现在是谁」。值本身不作判断依据。
    const WALLPAPER_KEY = 'remielle-dan:wallpaper';
    // 改动这个标记，就能在 .client-report.log 里认出「页面跑的是哪一版」。
    const BUILD_TAG = '0.3.2';

    // 背景层：遮罩在上、图在下（CSS 多重背景，写在前的在上层）。
    //
    // 「纱」= 盖在壁纸上的那层深色渐变。它的三个颜色由 theme.css 的三个变量给出，
    // 变量不存在时用下面的兜底值（= 原始外观），所以缺变量不会坏成白屏/黑屏。
    // 特意不把数字写进 calc()：万一浏览器不接受 rgba() 里套算式，整条
    // background-image 会被丢弃 —— 那是"壁纸消失"，比"纱没去掉"严重得多。
    //
    // 0.3.0：第二层图源改成 CSS 变量 --remielle-bg-image。换壁纸时只改这个变量
    // （写在背景层的 inline style 上，优先级高于本规则），渐变仍留在 CSS 里。
    // 变量的 fallback 就是默认插画，所以没换过壁纸时行为与 0.2.1 完全一致。
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
    var(--remielle-bg-image, url("${ART_URL}"));
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
      // 0.3.0：当前图源，形如 url("/remielle-dan/art.jpg?v=123")。空串 = 用
      // BASE_CSS 里的默认插画。必须记在闭包里：关掉主题时 bg 被移除，它身上
      // 的 inline style 跟着没了，重新打开时要靠这个变量把用户那张图复原。
      let bgImage = '';
      const listeners = new Set();

      // 把 bgImage 落到背景层上。bg 不存在（主题关着）时只记住值、等 attach
      // 补上——所以关闭态下收到跨窗口的换图消息也不会丢。
      const applyBgImage = () => {
        if (bg === null) return;
        if (bgImage === '') bg.style.removeProperty('--remielle-bg-image');
        else bg.style.setProperty('--remielle-bg-image', bgImage);
      };

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
        // 新建的 div 不带 inline style，必须在这里补一次。0.2.1 之前没有这句
        // 没关系；有了可换壁纸之后漏掉它，就会「关掉主题再开，壁纸回到默认
        // 插画」——这是本功能最容易漏的一处。
        applyBgImage();
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
        bgImage: () => bgImage,
        // 0.3.0：换壁纸。只改外观层，**不 emit**——设置页那行 UI 状态由组件
        // 自己维护；runtime 再存一份 meta 的话，两个来源必然打架。
        setBgImage(next) {
          bgImage = typeof next === 'string' ? next : '';
          applyBgImage();
        },
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
    // ── 壁纸：选图、缩图、拖放（0.3.0）────────────────────────────────────
    // 全是浏览器里的活，不碰宿主。判据三条，见 prepareWallpaper：
    //   ① 像素不超标、文件也不大 → 原样上传，字节与格式都不动
    //   ② 像素超标               → 等比缩到最长边 2560，JPEG 0.86
    //   ③ 像素不超标但文件很大   → 保持原尺寸重编码为 JPEG 0.86
    // 2560 与 0.86 取自 jeweis/dsh-skin-lab 的 src/shrink.js（BACKGROUND_MAX_EDGE）。
    // 它那套 8 级降级阶梯不抄：那是为 localStorage 的 5MB 预算设计的，落盘没有这个预算。
    const MAX_EDGE = 2560;
    const MAX_ORIGINAL_BYTES = 8 * 1024 * 1024;
    const JPEG_QUALITY = 0.86;
    // 透明图垫底色。JPEG 没有 alpha 通道，canvas 留空会编成黑块；
    // 垫成主题遮罩的基色，是最不意外的合成结果。
    const MATTE = '#071321';

    // 拼 CSS 图源。src 由我们自己生成（固定前缀 + 版本戳），仍把引号与反斜杠
    // 去掉兜一层：一个引号就能把整条 background-image 打成非法值。
    const urlOf = (src) => `url("${String(src).replace(/["\\\u0000-\u001f]/g, '')}")`;

    const formatBytes = (n) => {
      const v = Number(n) || 0;
      if (v <= 0) return '0 B';
      if (v < 1024) return `${v} B`;
      if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
      return `${(v / (1024 * 1024)).toFixed(1)} MB`;
    };

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('读不到这个文件'));
      reader.readAsDataURL(file);
    });

    // 先探测再应用：解不开就当它不是图片，原壁纸保持不变（不黑屏）。
    const loadImage = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('这不是一张能打开的图片'));
      img.src = src;
    });

    const encodeWithCanvas = (img, width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx2d = canvas.getContext('2d');
      if (ctx2d === null) throw new Error('这个界面不支持画布，换不了壁纸');
      ctx2d.fillStyle = MATTE;
      ctx2d.fillRect(0, 0, width, height);
      ctx2d.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    };

    // data URL 实际携带的字节数（base64 每 3 字节写成 4 个字符）。
    const dataUrlBytes = (dataUrl) => {
      const comma = dataUrl.indexOf(',');
      if (comma < 0) return 0;
      const payload = dataUrl.length - comma - 1;
      return dataUrl.slice(0, comma).includes(';base64')
        ? Math.floor((payload * 3) / 4)
        : payload;
    };

    const prepareWallpaper = async (file) => {
      const type = String(file.type || '').toLowerCase();
      if (type !== 'image/jpeg' && type !== 'image/png' && type !== 'image/webp') {
        throw new Error('只支持 JPEG / PNG / WebP');
      }
      const source = await readFileAsDataUrl(file);
      const img = await loadImage(source);

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) throw new Error('读不出这张图的尺寸');

      const longest = Math.max(w, h);
      const oversize = longest > MAX_EDGE;
      const heavy = file.size > MAX_ORIGINAL_BYTES;

      // ① 像素不超、文件不重：原样上传，不白丢一次画质。
      if (!oversize && !heavy) {
        return {
          dataUrl: source,
          name: file.name || 'wallpaper',
          width: w,
          height: h,
          bytes: file.size,
          shrunk: false,
          originalBytes: file.size,
          originalWidth: w,
          originalHeight: h,
        };
      }

      // ② 超像素：等比缩到最长边 MAX_EDGE。
      // ③ 像素够但文件重：保持原尺寸，只换一种更省字节的编码。
      const scale = oversize ? Math.min(1, MAX_EDGE / longest) : 1;
      const outW = Math.max(1, Math.round(w * scale));
      const outH = Math.max(1, Math.round(h * scale));
      const dataUrl = encodeWithCanvas(img, outW, outH);
      const bytes = dataUrlBytes(dataUrl);
      if (!dataUrl || bytes === 0) throw new Error('重新编码失败');
      return {
        dataUrl,
        name: file.name || 'wallpaper',
        width: outW,
        height: outH,
        bytes,
        shrunk: true,
        originalBytes: file.size,
        originalWidth: w,
        originalHeight: h,
      };
    };

    const SETTINGS_SLOT = 'settings.section';
    const SETTINGS_ID = 'remielle-dan';
    let settingsState = 'pending';

    const installSettingsSection = (ctx, theme, wallpaperState) => {
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

      // 三个排版零件，对齐官方设置页的「卡片 + 行」（规范在 settings.css）：
      //   card      = 一张设置卡
      //   line      = 带控件的行：左列行名 + 说明，右侧控件
      //   valueLine = 只读行：左行名、右值
      const card = (key, children) => h('section', { key, className: 'remielle-set-card' }, children);
      const line = (key, name, note, control) => h('div', { key, className: 'remielle-set-row' },
        h('div', { className: 'remielle-set-text' },
          h('span', { className: 'remielle-set-k' }, name),
          note ? h('span', { className: 'remielle-set-v' }, note) : null),
        control === null ? null : control);
      const valueLine = (key, name, value) => h('div', { key, className: 'remielle-set-row' },
        h('div', { className: 'remielle-set-text' },
          h('span', { className: 'remielle-set-k' }, name)),
        h('span', { className: 'remielle-set-value' }, value));

      /** 设置页分区组件。0.3.0 起：主题开关 → 壁纸 → 只读当前值。 */
      function RemielleSection() {
        const [enabled, setEnabled] = useState(() => theme.isEnabled());
        // 壁纸的 UI 状态全部住在这里。runtime 只管背景层，不存 meta。
        const [wallpaper, setWallpaper] = useState(null);
        const [busy, setBusy] = useState(false);
        const [dragging, setDragging] = useState(false);
        const [wallError, setWallError] = useState('');
        const [wallNote, setWallNote] = useState('');

        // 订阅运行时的状态：按钮自己点、另一个窗口改、将来别处改，标签都跟着走。
        useEffect(() => theme.subscribe(() => setEnabled(theme.isEnabled())), []);

        const remember = (meta) => {
          wallpaperState.custom = !!(meta && meta.custom);
          wallpaperState.bytes = (meta && meta.bytes) || 0;
          wallpaperState.name = (meta && meta.name) || '';
          setWallpaper(meta || null);
        };

        // 问宿主「现在是谁」。0.3.0 起背景层的图源也由它决定。
        const refreshWallpaper = async () => {
          try {
            const res = await fetch(WALLPAPER_URL, { cache: 'no-store' });
            if (!res.ok) return null;
            const meta = await res.json();
            remember(meta);
            theme.setBgImage(meta && meta.custom ? urlOf(meta.src) : '');
            return meta;
          } catch (e) {
            return null;
          }
        };

        // 挂载时拉一次；另一个窗口换了壁纸，这里跟着换。
        // 监听放在组件里而不是 apply()：换图要同时更新「外观」与「这行 UI」，
        // 后者是组件的 state，apply() 够不着。
        useEffect(() => {
          refreshWallpaper();
          const onStorage = (ev) => {
            if (ev.key !== WALLPAPER_KEY) return;
            refreshWallpaper();
          };
          window.addEventListener('storage', onStorage);
          return () => window.removeEventListener('storage', onStorage);
        }, []);

        const applyFile = async (file) => {
          if (!file || busy) return;
          setWallError('');
          setWallNote('');
          setBusy(true);
          try {
            const prep = await prepareWallpaper(file);
            const res = await fetch(WALLPAPER_URL, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                dataUrl: prep.dataUrl,
                name: prep.name,
                width: prep.width,
                height: prep.height,
              }),
            });
            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }
            if (!res.ok) {
              setWallError((body && body.error) || `服务端返回 ${res.status}`);
              return;
            }
            remember(body);
            theme.setBgImage(urlOf(body.src));
            try {
              window.localStorage.setItem(WALLPAPER_KEY, String(body.updatedAt || 0));
            } catch (e) {
              /* 存不住只影响别的窗口能不能立刻跟上，本次照常 */
            }
            setWallNote(prep.shrunk
              ? `${prep.originalWidth}×${prep.originalHeight} ${formatBytes(prep.originalBytes)} → ${prep.width}×${prep.height} ${formatBytes(prep.bytes)}`
              : `${prep.width}×${prep.height} · ${formatBytes(prep.bytes)}`);
          } catch (e) {
            setWallError(e && e.message ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        };

        const resetWallpaper = async () => {
          if (busy) return;
          setWallError('');
          setWallNote('');
          setBusy(true);
          try {
            const res = await fetch(WALLPAPER_URL, { method: 'DELETE' });
            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }
            if (!res.ok) {
              setWallError((body && body.error) || `服务端返回 ${res.status}`);
              return;
            }
            remember(body);
            theme.setBgImage('');
            try {
              window.localStorage.setItem(WALLPAPER_KEY, '0');
            } catch (e) {
              /* 同上 */
            }
          } catch (e) {
            setWallError(e && e.message ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        };

        // 关闭态不显示这三行（见下面的 valuesCard）：它们是现读计算样式拿的，
        // 主题一关就全退到兜底值，显示出来就是错数字（比如气泡透明度仍写 62%，
        // 而气泡根本不存在）。

        const currentText = wallpaper === null
          ? '读取中…'
          : wallpaper.custom
            ? `${wallpaper.name || '自定义壁纸'}${
              wallpaper.width && wallpaper.height ? ` · ${wallpaper.width}×${wallpaper.height}` : ''
            }${wallpaper.bytes ? ` · ${formatBytes(wallpaper.bytes)}` : ''}`
            : '默认插画';

        // ── 三张卡片：主题外观 / 壁纸 / 当前值（排版规范在 settings.css）──
        const themeCard = card('theme', [
          line(
            'theme-row',
            '主题外观',
            enabled ? '已开启（Remielle Dan）' : '已关闭（DSH 原生）',
            h('div', { key: 'theme-actions', className: 'remielle-set-actions' },
              h('button', {
                key: 'toggle',
                className: 'remielle-set-btn is-primary',
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
          ),
          h('p', { key: 'theme-hint', className: 'remielle-set-hint' },
            '这个选择记在当前界面的浏览器存储里（桌面端与浏览器端各存一份）；关掉只摘外观，不卸载插件。'),
        ]);

        // 关闭态下壁纸层根本不存在，所以右侧控件整列不渲染，只留一句状态说明：
        // 点了没反应，比没有按钮更像坏了。
        const wallpaperCard = card('wall', [
          line(
            'wall-row',
            '壁纸',
            enabled ? currentText : '先开启主题外观才能更换壁纸。',
            enabled
              ? h('div', { key: 'wall-actions', className: 'remielle-set-actions' },
                h('label', {
                  key: 'wall-pick',
                  className: 'remielle-set-file',
                  'data-busy': busy ? 'true' : 'false',
                },
                  busy ? '正在应用…' : '选择壁纸…',
                  // 不用 useRef：宿主 React 是否暴露它未经验证；label 的隐式
                  // 激活就够，input 用 display:none 藏起来（样式在 settings.css）。
                  h('input', {
                    type: 'file',
                    accept: 'image/*',
                    onChange: (ev) => {
                      const picked = ev.target.files && ev.target.files[0];
                      // 清空，否则同一个文件选第二次不触发 change
                      ev.target.value = '';
                      applyFile(picked);
                    },
                  })),
                h('button', {
                  key: 'wall-reset',
                  className: 'remielle-set-btn',
                  type: 'button',
                  disabled: busy || wallpaper === null || !wallpaper.custom,
                  onClick: resetWallpaper,
                }, '恢复默认壁纸'))
              : null,
          ),
          enabled
            ? h('p', { key: 'wall-hint', className: 'remielle-set-hint' },
              `换上的图存在 ${wallpaper && wallpaper.dir ? wallpaper.dir : 'DSH 数据目录'}。超过 2560 像素的图会自动缩小。也可以把图拖进这一块。`)
            : null,
          wallError
            ? h('p', { key: 'wall-err', className: 'remielle-set-error' }, `失败：${wallError}`)
            : null,
          wallNote
            ? h('p', { key: 'wall-note', className: 'remielle-set-hint' }, wallNote)
            : null,
        ]);

        const valuesCard = enabled
          ? card('values', [
            valueLine('v-bubble', '用户气泡透明度', liveBubblePct()),
            valueLine('v-board', '消息板底', liveChatBg()),
            valueLine('v-input', '输入文字颜色', liveInputColor()),
          ])
          : null;

        // 拖放通道：桌面端 file dialog 是否可用未经验证，这里留一条旁路。
        // 三个处理器都要 preventDefault（dragOver 不拦就收不到 drop），顺带
        // 挡住 Electron「文件拖进窗口就导航过去」的默认行为。
        const onDragOver = (ev) => {
          if (!enabled) return;
          ev.preventDefault();
          if (!dragging) setDragging(true);
        };
        const onDragLeave = (ev) => {
          // 在子元素之间移动也会触发 dragleave，用 relatedTarget 判是不是真走了
          if (ev.currentTarget && ev.relatedTarget && ev.currentTarget.contains(ev.relatedTarget)) return;
          setDragging(false);
        };
        const onDrop = (ev) => {
          setDragging(false);
          if (!enabled) return;
          ev.preventDefault();
          const dropped = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
          if (dropped) applyFile(dropped);
        };

        return h('div', {
          className: dragging ? 'remielle-set is-drop' : 'remielle-set',
          onDragOver,
          onDragLeave,
          onDrop,
        },
          h('h2', { className: 'remielle-set-title' }, 'Remielle Dan'),
          h('p', { className: 'remielle-set-intro' },
            '主题外观的运行时开关：关掉后界面立刻回到 DSH 原生外观，插件仍然装着，随时可以再打开。'),
          themeCard,
          wallpaperCard,
          valuesCard,
          h('p', { className: 'remielle-set-foot' }, `Remielle Dan 主题插件 · ${BUILD_TAG}`));
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

      // 0.3.1：设置页分区的样式表，**不受主题开关管辖**。
      // 关闭态下 theme.css 被整个摘掉，这一栏若没有自己的样式就只剩裸文字。
      // 这份样式只选择 .remielle-set*，不碰宿主任何全局选择器，所以
      // 「关掉主题 = 整页原生外观」这条边界没被破坏，只是分区自己还站着。
      try {
        const settingsCss = document.createElement('link');
        settingsCss.rel = 'stylesheet';
        settingsCss.href = SETTINGS_CSS_URL;
        settingsCss.setAttribute('data-remielle-dan-asset', 'settings');
        settingsCss.addEventListener('error', () => {
          console.error(`[remielle-dan] 分区样式加载失败：${SETTINGS_CSS_URL}`);
        });
        document.head.appendChild(settingsCss);
        ctx.effect(() => () => settingsCss.remove());
      } catch (e) {
        console.warn('[remielle-dan] 分区样式未挂上（不影响主题）：', e);
      }

      // 0.3.0：壁纸摘要，只给自报用。设置页组件写它（那边拿得到 meta），
      // 自报只读。meta 本身刻意不进 runtime——两个来源必然打架。
      const wallpaperState = { custom: false, bytes: 0, name: '' };

      // 启动时问一次宿主「当前壁纸是谁」，好让背景层一上来就是用户那张。
      // 失败就保持 BASE_CSS 里的默认图：壁纸取不到不该连累主题，整段吞异常。
      const loadWallpaper = async () => {
        try {
          const res = await fetch(WALLPAPER_URL, { cache: 'no-store' });
          if (!res.ok) return;
          const meta = await res.json();
          wallpaperState.custom = !!(meta && meta.custom);
          wallpaperState.bytes = (meta && meta.bytes) || 0;
          wallpaperState.name = (meta && meta.name) || '';
          theme.setBgImage(meta && meta.custom ? urlOf(meta.src) : '');
        } catch (e) {
          /* 拿不到就沿用默认壁纸 */
        }
      };
      loadWallpaper();

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
            // 0.3.0：壁纸此刻是不是自定义的、多大、叫什么。不含 dir（数据目录
            // 的绝对路径没必要写进落盘的日志里）。
            wallpaper: { ...wallpaperState },
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
        ctx.effect(() => installSettingsSection(ctx, theme, wallpaperState), 'remielle-dan: settings section');
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
