// 浏览器半边冒烟：假 DOM + 假 React，验「换图 → 关主题 → 开回来」这条链。
// 重点不是渲染好不好看，是背景层的图源在 attach/detach 之间有没有丢。
//
// 用法：node scripts/smoke-client-wallpaper.mjs
// 退出码 0 = 全过。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..');

let pass = 0;
let fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass += 1; console.log(`  ok   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name}${extra === undefined ? '' : ` :: ${extra}`}`); }
};

// ── 假 DOM ─────────────────────────────────────────────────────────────────
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.id = '';
    this.attrs = {};
    this._children = [];
    this.parent = null;
    this.isConnected = true;
    const props = {};
    this.style = {
      props,
      setProperty(k, v) { props[k] = String(v); },
      removeProperty(k) { delete props[k]; },
      getPropertyValue(k) { return props[k] === undefined ? '' : props[k]; },
    };
    this.listeners = {};
  }
  get children() { return this._children; }
  set children(v) { this._children = v; }
  get firstElementChild() { return this._children[0] || null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }
  appendChild(c) { c.parent = this; this._children.push(c); return c; }
  remove() {
    if (this.parent !== null) {
      this.parent.children = this.parent.children.filter((x) => x !== this);
      this.parent = null;
    }
    this.isConnected = false;
  }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((x) => x !== fn);
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { width: 0, height: 0 }; }
}

const head = new El('head');
const body = new El('body');
const html = new El('html');
const documentStub = {
  documentElement: html,
  head,
  body,
  createElement: (t) => new El(t),
  querySelector: () => null,
  querySelectorAll: () => [],
};

const store = new Map();
const windowStub = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1200,
  innerHeight: 800,
};

globalThis.window = windowStub;
globalThis.document = documentStub;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });

// ── 假 React：只为把组件跑出来，不追求重渲染 ────────────────────────────────
const render = { slots: [], i: 0, seen: new Set() };
const cleanups = [];
const React = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children: children.flat(Infinity) };
  },
  useState(initial) {
    const idx = render.i++;
    if (!(idx in render.slots)) render.slots[idx] = typeof initial === 'function' ? initial() : initial;
    const setter = (v) => {
      render.slots[idx] = typeof v === 'function' ? v(render.slots[idx]) : v;
    };
    return [render.slots[idx], setter];
  },
  useEffect(fn) {
    const idx = render.i++;
    if (!render.seen.has(idx)) {
      render.seen.add(idx);
      const c = fn();
      if (typeof c === 'function') cleanups.push(c);
    }
  },
};

// ── 假 fetch ───────────────────────────────────────────────────────────────
const wallpaperMeta = {
  custom: true,
  src: '/remielle-dan/art.jpg?v=1700000000000',
  name: '我的壁纸.jpg',
  bytes: 780000,
  width: 2560,
  height: 1440,
  updatedAt: 1700000000000,
  dir: 'D:\\DSH\\home\\remielle-dan',
};
const fetchCalls = [];
globalThis.fetch = async (url, opts) => {
  fetchCalls.push({ url: String(url), method: (opts && opts.method) || 'GET' });
  return { ok: true, status: 200, json: async () => wallpaperMeta };
};

// ── 装载 client.js ─────────────────────────────────────────────────────────
let captured = null;
windowStub.__ModuleLoader__ = {
  load({ factory }) {
    captured = factory((name) => {
      if (name === 'react') return React;
      throw new Error(`unexpected require(${name})`);
    });
  },
};
// 带时间戳的查询串，避免同一进程里二次装载命中模块缓存
await import(`${pathToFileURL(join(REPO, 'client.js')).href}?t=${Date.now()}`);
check('client.js 装载出模块', captured !== null && typeof captured.apply === 'function');

// ── 假 ctx ─────────────────────────────────────────────────────────────────
const disposers = [];
let registeredSlot = null;
const ctx = {
  slots: {
    inject: (key, fn) => fn(),
    register: (spec, comp) => {
      registeredSlot = { spec, comp };
      return () => {};
    },
  },
  effect: (fn) => {
    const d = fn();
    if (typeof d === 'function') disposers.push(d);
  },
};

const findBg = () => body.children.find((c) => c.id === 'remielle-dan-bg') || null;
const bgVar = () => {
  const bg = findBg();
  return bg === null ? undefined : bg.style.props['--remielle-bg-image'];
};
const findNode = (node, pred) => {
  if (node === null || typeof node !== 'object') return null;
  if (node.props && pred(node)) return node;
  for (const c of node.children || []) {
    const hit = findNode(c, pred);
    if (hit !== null) return hit;
  }
  return null;
};

try {
  captured.apply(ctx);

  // A. 启动（存储缺省 = 开）
  check('html 打上 data-remielle-dan', html.attrs['data-remielle-dan'] === 'on', JSON.stringify(html.attrs));
  check('背景层建出来了', findBg() !== null);
  check('样式表 link 已插入', head.children.some((c) => c.tagName === 'LINK'));
  check('BASE_CSS 的 style 已插入', head.children.some((c) => c.tagName === 'STYLE'));
  check('设置分区注册了', registeredSlot !== null && registeredSlot.spec.id === 'remielle-dan');

  // B. 组件渲染 → useEffect 拉 meta → 背景层拿到用户图
  check('渲染前背景层还没有图源变量', bgVar() === undefined, bgVar());
  const tree = registeredSlot.comp();
  await new Promise((r) => setTimeout(r, 30));
  check(
    '渲染后背景层用上用户图（带版本戳）',
    bgVar() === 'url("/remielle-dan/art.jpg?v=1700000000000")',
    bgVar(),
  );
  check('确实问过宿主 wallpaper', fetchCalls.some((c) => c.url === '/remielle-dan/wallpaper'));

  // C. 关掉主题 → 背景层消失
  const toggle = findNode(tree, (n) => typeof n.props.onClick === 'function' && 'aria-pressed' in n.props);
  check('找得到主题开关按钮', toggle !== null);
  toggle.props.onClick();
  check('关闭后背景层被移除', findBg() === null);
  check('关闭后 html 属性也撤了', html.attrs['data-remielle-dan'] === undefined, JSON.stringify(html.attrs));
  check('关闭后主题样式表被摘', !head.children.some((c) => c.tagName === 'LINK' && String(c.href || '').includes('theme.css')));
  // 0.3.1：分区样式常驻，关掉主题不该把它一起摘走——否则这一栏又变回裸文字
  check('关闭后分区样式表仍在', head.children.some((c) => c.tagName === 'LINK' && String(c.href || '').includes('settings.css')));

  // D. 再开回来 → 图源必须还在（本功能最容易漏的一处）
  toggle.props.onClick();
  check('重开后背景层重建', findBg() !== null);
  check(
    '重开后用户图仍在',
    bgVar() === 'url("/remielle-dan/art.jpg?v=1700000000000")',
    bgVar(),
  );

  // E. 设置页里有壁纸控件（关闭态之外的分支）
  check('壁纸行渲染出来了', findNode(tree, (n) => n.children && n.children.includes('壁纸')) !== null);
  check('分区样式表已挂上', head.children.some((c) => c.tagName === 'LINK' && String(c.href || '').includes('settings.css')));

  // E2. 渲染树里用到的每个 .remielle-set* 类，settings.css 里都要有对应的规则。
  //     抓的是「类名拼错 / 改了 JSX 忘了改样式」这类静默失效——它们不会报错，
  //     只会让某一小块没样式，肉眼很难定位。
  const settingsCss = readFileSync(join(REPO, 'zzz-remielle-dan', 'settings.css'), 'utf8');
  const used = new Set();
  (function walk(node) {
    if (node === null || typeof node !== 'object') return;
    if (node.props && typeof node.props.className === 'string') {
      for (const token of node.props.className.split(/\s+/)) {
        if (token.startsWith('remielle-set')) used.add(token);
      }
    }
    for (const child of node.children || []) walk(child);
  })(tree);
  const missing = [...used].filter((token) => !settingsCss.includes(`.${token}`));
  check(
    `渲染用到的 ${used.size} 个分区类在 settings.css 里都有规则`,
    missing.length === 0,
    missing.join(', '),
  );

  // F. dispose 收干净
  for (const d of disposers) d();
  check('dispose 后背景层没了', findBg() === null);
  check('dispose 后 html 属性没了', html.attrs['data-remielle-dan'] === undefined, JSON.stringify(html.attrs));
} finally {
  console.log(`\n通过 ${pass}，失败 ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}
