// 宿主半边冒烟：假 webServer + 真 HTTP，把 /remielle-dan/wallpaper 与 art.jpg 走一遍。
// 落盘指向临时 DSH_HOME，不碰用户真实数据目录。
//
// 用法：node scripts/smoke-host-wallpaper.mjs
// 退出码 0 = 全过。任何一条失败都会打印 FAIL 并以 1 退出。
import { createServer } from 'node:http';
import { mkdtemp, rm, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..');
const home = await mkdtemp(join(tmpdir(), 'remielle-smoke-'));
process.env.DSH_HOME = home;

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let pass = 0;
let fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass += 1; console.log(`  ok   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name}${extra === undefined ? '' : ` :: ${extra}`}`); }
};

const routes = new Map();
const ctx = {
  webServer: {
    register(spec) {
      if (routes.has(spec.path)) throw new Error(`duplicate route ${spec.path}`);
      routes.set(spec.path, spec.handler);
      return () => routes.delete(spec.path);
    },
  },
  effect(fn) {
    fn();
  },
  loader: null,
};

const mod = await import(pathToFileURL(join(REPO, 'host.js')).href);
mod.default.apply(ctx);

console.log(`routes = ${[...routes.keys()].join(', ')}`);
check('五条路由都注册上了', routes.size === 5, routes.size);

const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  const handler = routes.get(pathname);
  if (handler === undefined) {
    res.writeHead(404).end('no route');
    return;
  }
  Promise.resolve(handler(req, res)).catch((e) => {
    res.writeHead(500).end(String(e));
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/remielle-dan`;
const dataDir = join(home, 'remielle-dan');

try {
  // 1) 默认态
  let r = await fetch(`${base}/wallpaper`);
  let m = await r.json();
  check('GET wallpaper 200', r.status === 200, r.status);
  check('默认态 custom=false', m.custom === false, JSON.stringify(m));
  check('默认态 src 不带版本戳', m.src === '/remielle-dan/art.jpg', m.src);
  check('默认态带 dir', typeof m.dir === 'string' && m.dir.length > 0, m.dir);

  // 2) 默认插画
  r = await fetch(`${base}/art.jpg`);
  let buf = Buffer.from(await r.arrayBuffer());
  check('默认 art.jpg 200', r.status === 200, r.status);
  check('默认 art.jpg 是 jpeg', r.headers.get('content-type') === 'image/jpeg', r.headers.get('content-type'));
  check('默认 art.jpg 字节数 797052', buf.length === 797052, buf.length);
  check('默认 art.jpg 有 1 小时缓存', (r.headers.get('cache-control') || '') === 'public, max-age=3600', r.headers.get('cache-control'));

  // 3) 上传一张 PNG
  r = await fetch(`${base}/wallpaper`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dataUrl: PNG_1X1, name: '测试/换行\n名字.png', width: 1, height: 1 }),
  });
  m = await r.json();
  check('POST 200', r.status === 200, `${r.status} ${JSON.stringify(m)}`);
  check('POST 后 custom=true', m.custom === true, JSON.stringify(m));
  check('POST 后 src 带版本戳', /^\/remielle-dan\/art\.jpg\?v=\d+$/.test(m.src), m.src);
  check('名字里的换行被剥掉', !m.name.includes('\n'), JSON.stringify(m.name));
  check('bytes 取解码后的长度', m.bytes > 0, m.bytes);

  // 4) 落盘
  let names = await readdir(dataDir);
  check('目录里有 wallpaper.png', names.includes('wallpaper.png'), names.join(','));
  check('目录里有 wallpaper.json', names.includes('wallpaper.json'), names.join(','));

  // 5) 自定义图走 art.jpg
  r = await fetch(`${base}/art.jpg`);
  buf = Buffer.from(await r.arrayBuffer());
  check('自定义 art.jpg 200', r.status === 200, r.status);
  check('自定义 art.jpg 按真实类型给 png', r.headers.get('content-type') === 'image/png', r.headers.get('content-type'));
  check('自定义 art.jpg 用 no-cache', (r.headers.get('cache-control') || '') === 'no-cache', r.headers.get('cache-control'));
  const etag = r.headers.get('etag');
  check('自定义 art.jpg 带 ETag', typeof etag === 'string' && etag.length > 2, etag);

  // 6) If-None-Match 走 304
  r = await fetch(`${base}/art.jpg`, { headers: { 'if-none-match': etag } });
  check('ETag 命中回 304', r.status === 304, r.status);

  // 7) 换一张 JPEG，旧 png 要被清掉
  const jpgDataUrl = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64')}`;
  r = await fetch(`${base}/wallpaper`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dataUrl: jpgDataUrl, name: 'x.jpg', width: 2, height: 2 }),
  });
  check('换格式 POST 200', r.status === 200, r.status);
  names = await readdir(dataDir);
  check('换格式后只剩 jpg', names.includes('wallpaper.jpg') && !names.includes('wallpaper.png'), names.join(','));

  // 8) 坏数据
  r = await fetch(`${base}/wallpaper`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dataUrl: 'data:image/png;base64,bm90IGFuIGltYWdl' }),
  });
  check('文件头不对 -> 400', r.status === 400, r.status);
  r = await fetch(`${base}/wallpaper`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'not json',
  });
  check('body 不是 JSON -> 400（不硬校验 Content-Type）', r.status === 400, r.status);

  // 9) DELETE 恢复默认
  r = await fetch(`${base}/wallpaper`, { method: 'DELETE' });
  m = await r.json();
  check('DELETE 200', r.status === 200, r.status);
  check('DELETE 后 custom=false', m.custom === false, JSON.stringify(m));
  names = await readdir(dataDir);
  check('DELETE 后目录干净', names.length === 0, names.join(','));

  // 10) 手工丢图（没有 json）也要认
  await copyFile(join(REPO, 'zzz-remielle-dan', 'assets', 'remielle-dan-art.jpg'), join(dataDir, 'wallpaper.jpg'));
  r = await fetch(`${base}/wallpaper`);
  m = await r.json();
  check('手工图 custom=true', m.custom === true, JSON.stringify(m));
  check('手工图 updatedAt 来自 mtime', m.updatedAt > 0, m.updatedAt);
  r = await fetch(`${base}/art.jpg`);
  check('手工图能发出来', r.status === 200 && r.headers.get('content-type') === 'image/jpeg', r.status);

  // 11) 405
  r = await fetch(`${base}/wallpaper`, { method: 'PATCH' });
  check('未支持方法 -> 405', r.status === 405, r.status);
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(home, { recursive: true, force: true });
}

console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
