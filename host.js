// Remielle Dan theme — 宿主半边。
//
// 两件事：
//   1. 把浏览器半边要用的静态资产用稳定的 HTTP 路由发出去；
//   2. 接住设置页「换壁纸」这个动作：收图、落盘、再发出去。
//
// 路由：
//   /remielle-dan/theme.css     运行时样式（由 skin.css 的 :root 块 + patches.css 合成）
//   /remielle-dan/settings.css  设置页分区样式（常驻，不随主题开关卸载）
//   /remielle-dan/art.jpg       当前壁纸（用户图优先，没有就是默认插画）
//   /remielle-dan/wallpaper     GET 读状态 / POST 换图 / DELETE 恢复默认
//   /remielle-dan/report        前端自报，写 .client-report.log
//
// 静态资产路径相对本文件解析，所以仓库放在哪都能跑，不用改常量。
// 默认插画直接引用 zzz-remielle-dan/assets 下的原件，不复制第二份 —— 避免
// 同一张受限素材在仓库里出现两次、日后替换时漏掉一处。
//
// 用户换的壁纸**不写仓库**：它落在 DSH 数据目录（<DSH_HOME>/remielle-dan/）。
// 理由写在 ARCHITECTURE.md 第十一节：插件目录属于「程序」，升级会被整体替换，
// 用户数据必须放在用户那边。同理，`files` 白名单里没有它，打包也不会带上。
import {
  readFile,
  appendFile,
  writeFile,
  rename,
  mkdir,
  rm,
  readdir,
  stat,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// 前端自报落盘的位置。加进 .gitignore，属本地诊断产物。
// 用途：让改样式的人（包括 agent）能确认「浏览器里跑的是哪一版、纱解析成了什么颜色」，
// 不必反复请用户截图。写失败只是少一条记录，不影响外观。
const REPORT_FILE = join(here, '.client-report.log');
const REPORT_PATH = '/remielle-dan/report';

const THEME_PATH = '/remielle-dan/theme.css';
const SETTINGS_CSS_PATH = '/remielle-dan/settings.css';
const ART_PATH = '/remielle-dan/art.jpg';
const WALLPAPER_PATH = '/remielle-dan/wallpaper';

// 默认插画。路径名 art.jpg 是 0.1.0 留下的历史，现在它也可能吐 PNG / WebP，
// 真实类型一律以 Content-Type 为准，别拿扩展名推断。
const DEFAULT_ART = join(here, 'zzz-remielle-dan', 'assets', 'remielle-dan-art.jpg');

// 上限：请求体 28MB（base64 比原图大约三成），解码后的图 20MB。
const MAX_BODY_BYTES = 28 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const MIME = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// ── 数据目录 ────────────────────────────────────────────────────────────────
// 与记忆系统插件同口径（D:\GitHub_place\plugins\记忆系统\index.mjs:4080-4086）：
// 先问 loader 的基目录，取不到退环境变量，再退 ~/.dsh。本机 ~/.dsh 是指向
// D:\DSH\home 的 Junction，三层指向同一物理目录，任一层通就够。
const dshHomeOf = (ctx) => {
  try {
    const baseDir = ctx?.loader?.baseDir;
    if (typeof baseDir === 'string' && baseDir.length > 0) return baseDir;
  } catch (e) {
    /* loader 不可用，继续往下退 */
  }
  const fromEnv = process.env.DSH_HOME;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return join(homedir(), '.dsh');
};

const dataDirOf = (ctx) => join(dshHomeOf(ctx), 'remielle-dan');

const metaFileOf = (dir) => join(dir, 'wallpaper.json');

// ── 小工具 ─────────────────────────────────────────────────────────────────
const sendJson = (res, status, obj) => {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    // 状态每次都要现读，不能被缓存糊住
    'Cache-Control': 'no-store',
  });
  res.end(body);
};

// 读请求体，带上限。**超限不 destroy**：destroy 会把 res 一起废掉，前端只能
// 看到网络错误，看不到那句「图片太大」。正确姿势是标记后继续把流入读完，
// 在 end 里 reject，调用方就能正常回 413。
const readBody = (req, limit) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  req.on('data', (chunk) => {
    if (tooLarge) return; // 已超标：继续消费，但不再收
    size += chunk.length;
    if (size > limit) {
      tooLarge = true;
      chunks.length = 0;
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (tooLarge) reject(Object.assign(new Error('body too large'), { tooLarge: true }));
    else resolve(Buffer.concat(chunks));
  });
  req.on('error', reject);
});

// 文件头判定，不信 dataUrl 里声明的 MIME：声明的可以伪造，字节不会。
const sniffImage = (buf) => {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'png';
  if (
    buf.length >= 12 &&
    buf.toString('latin1', 0, 4) === 'RIFF' &&
    buf.toString('latin1', 8, 12) === 'WEBP'
  ) return 'webp';
  return null;
};

// 用户给的文件名只当显示名用，不参与拼路径。剥掉控制字符（换行会把提示行撑破），
// 截到 200 字符。
const sanitizeName = (v) => {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
};

const intIn = (v, max) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i <= 0 || i > max) return null;
  return i;
};

// ── 壁纸落盘 ────────────────────────────────────────────────────────────────
const readMeta = async (dir) => {
  try {
    const raw = await readFile(metaFileOf(dir), 'utf8');
    const m = JSON.parse(raw);
    if (m === null || typeof m !== 'object') return null;
    const ext = String(m.ext || '').toLowerCase();
    if (MIME[ext] === undefined) return null;
    return {
      name: typeof m.name === 'string' ? sanitizeName(m.name) : '',
      bytes: Number.isFinite(m.bytes) ? m.bytes : 0,
      width: Number.isInteger(m.width) ? m.width : null,
      height: Number.isInteger(m.height) ? m.height : null,
      ext,
      updatedAt: Number.isFinite(m.updatedAt) ? m.updatedAt : 0,
    };
  } catch (e) {
    return null;
  }
};

// 先清掉旧的（含别的扩展名、临时文件、以及 json），再改名。
// Windows 上 rename 覆盖已存在文件会报 EEXIST；先删后改名也让「换格式」时
// 不会两张图并存。
//
// keep 是要保住的那个文件名：POST 刚写好的 .tmp 必须排除在外。上一版忘了
// 这一步，清理把刚写的临时文件一起删了，rename 直接 ENOENT——冒烟测试抓到。
const removeWallpaperFiles = async (dir, keep) => {
  const keepOne = typeof keep === 'string' && keep.length > 0 ? keep : null;
  try {
    const names = await readdir(dir);
    for (const n of names) {
      if (keepOne !== null && n === keepOne) continue;
      if (/^wallpaper\.(jpg|png|webp|json)$/.test(n) || /^wallpaper\.(jpg|png|webp)\.tmp$/.test(n)) {
        await rm(join(dir, n), { force: true });
      }
    }
  } catch (e) {
    /* 目录不在：没有可删的 */
  }
};

// 返回 { file, ext, meta } 或 null。
// meta 为 null 表示这张图是用户手工拷进来的（没有 json）。
const findWallpaper = async (dir) => {
  const meta = await readMeta(dir);
  if (meta !== null) {
    const file = join(dir, `wallpaper.${meta.ext}`);
    try {
      const st = await stat(file);
      if (st.isFile() && st.size > 0) return { file, ext: meta.ext, meta };
    } catch (e) {
      /* json 指的文件不在：继续走手工兜底 */
    }
  }
  // 手工兜底：用户直接把图拷进目录、或者 json 丢了。
  try {
    const names = await readdir(dir);
    for (const ext of Object.keys(MIME)) {
      const fileName = `wallpaper.${ext}`;
      if (!names.includes(fileName)) continue;
      const file = join(dir, fileName);
      const st = await stat(file);
      if (!st.isFile() || st.size === 0) continue;
      return {
        file,
        ext,
        meta: {
          name: fileName,
          bytes: st.size,
          width: null,
          height: null,
          ext,
          updatedAt: Math.round(st.mtimeMs) || 0,
        },
      };
    }
  } catch (e) {
    /* 目录不存在：没有壁纸 */
  }
  return null;
};

const describeWallpaper = (dir, found) => {
  if (found === null) {
    return {
      custom: false,
      src: ART_PATH,
      name: '默认插画',
      bytes: 0,
      width: null,
      height: null,
      updatedAt: 0,
      dir,
    };
  }
  const m = found.meta;
  return {
    custom: true,
    // 版本戳：换图后 URL 变化，绕开浏览器对同一 URL 的复用。
    src: `${ART_PATH}?v=${m.updatedAt || 0}`,
    name: m.name,
    bytes: m.bytes,
    width: m.width,
    height: m.height,
    updatedAt: m.updatedAt,
    dir,
  };
};

// ── 路由 ────────────────────────────────────────────────────────────────────
export default {
  inject: ['webServer'],
  apply(ctx) {
    const dataDir = dataDirOf(ctx);
    let registered = 0;
    let total = 0;

    const addRoute = (path, handler) => {
      total += 1;
      try {
        const dispose = ctx.webServer.register({ kind: 'exact', path, handler });
        registered += 1;
        ctx.effect(() => dispose);
        return true;
      } catch (e) {
        // 路由已被别的实例占用时跳过，不要把整个 profile 的装载搞挂
        console.warn(`[remielle-dan] 路由 ${path} 已被占用，跳过：`, e?.message ?? e);
        return false;
      }
    };

    // 1) 样式表：开发期不让浏览器缓存，改完样式刷新就能看到。
    addRoute(THEME_PATH, async (req, res) => {
      try {
        const bytes = await readFile(join(here, 'styles', 'theme.css'));
        res.writeHead(200, {
          'Content-Type': 'text/css; charset=utf-8',
          'Content-Length': bytes.length,
          'Cache-Control': 'no-store',
        });
        res.end(bytes);
      } catch (err) {
        console.error(`[remielle-dan] 资产读取失败: ${THEME_PATH}`, err);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('remielle-dan asset not found');
      }
    });

    // 2) 设置页分区的样式。**不随主题开关卸载**：关闭态下 theme.css 被整个摘掉，
    //    这一栏仍要有卡片与排版。它只选择 .remielle-set*，不碰宿主全局，
    //    所以关闭态整页仍是原生外观。源文件直发，不走生成脚本（它不用 skin.css 的 token）。
    addRoute(SETTINGS_CSS_PATH, async (req, res) => {
      try {
        const bytes = await readFile(join(here, 'zzz-remielle-dan', 'settings.css'));
        res.writeHead(200, {
          'Content-Type': 'text/css; charset=utf-8',
          'Content-Length': bytes.length,
          'Cache-Control': 'no-store',
        });
        res.end(bytes);
      } catch (err) {
        console.error(`[remielle-dan] 资产读取失败: ${SETTINGS_CSS_PATH}`, err);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('remielle-dan asset not found');
      }
    });

    // 3) 当前壁纸。用户图优先，没有就发默认插画。
    //    自定义图用 no-cache + ETag：刷新走 304，换图靠 URL 上的版本戳强制重取。
    //    默认插画保持原来的 public, max-age=3600，一个字不动。
    addRoute(ART_PATH, async (req, res) => {
      let found = null;
      try {
        found = await findWallpaper(dataDir);
      } catch (e) {
        /* 读不到就当没有自定义壁纸 */
      }
      const file = found === null ? DEFAULT_ART : found.file;
      const type = found === null ? 'image/jpeg' : MIME[found.ext];
      try {
        const bytes = await readFile(file);
        if (found === null) {
          res.writeHead(200, {
            'Content-Type': type,
            'Content-Length': bytes.length,
            'Cache-Control': 'public, max-age=3600',
          });
          res.end(bytes);
          return;
        }
        const etag = `"${found.meta.updatedAt || bytes.length}-${bytes.length}"`;
        const inm = req.headers['if-none-match'];
        const matched = typeof inm === 'string' &&
          inm.split(',').some((t) => t.trim() === etag);
        if (matched) {
          res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': type,
          'Content-Length': bytes.length,
          'Cache-Control': 'no-cache',
          ETag: etag,
        });
        res.end(bytes);
      } catch (err) {
        console.error(`[remielle-dan] 资产读取失败: ${ART_PATH}`, err);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('remielle-dan asset not found');
      }
    });

    // 4) 壁纸状态与换图。三条方法共用一条 exact route，按 req.method 分派。
    addRoute(WALLPAPER_PATH, async (req, res) => {
      const method = String(req.method || 'GET').toUpperCase();
      try {
        if (method === 'GET' || method === 'HEAD') {
          const found = await findWallpaper(dataDir);
          sendJson(res, 200, describeWallpaper(dataDir, found));
          return;
        }

        if (method === 'DELETE') {
          await removeWallpaperFiles(dataDir);
          const found = await findWallpaper(dataDir);
          sendJson(res, 200, describeWallpaper(dataDir, found));
          return;
        }

        if (method === 'POST') {
          let body;
          try {
            body = await readBody(req, MAX_BODY_BYTES);
          } catch (e) {
            if (e && e.tooLarge) {
              sendJson(res, 413, { error: '图片太大（请求体超过 28MB）' });
              return;
            }
            sendJson(res, 400, { error: '读取请求失败' });
            return;
          }

          // 不校验 Content-Type：桌面端走 Electron 的 IPC 桥接，该 header 是否
          // 原样保留未经验证。解析不出合法 dataUrl 就 400，堵的是同一个口。
          let payload = null;
          try {
            payload = JSON.parse(body.toString('utf8'));
          } catch (e) {
            sendJson(res, 400, { error: '请求不是合法 JSON' });
            return;
          }

          const dataUrl = payload && typeof payload.dataUrl === 'string' ? payload.dataUrl : '';
          const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
          if (m === null) {
            sendJson(res, 400, { error: '不是可识别的图片数据' });
            return;
          }

          let buf;
          try {
            buf = Buffer.from(m[2], 'base64');
          } catch (e) {
            sendJson(res, 400, { error: '图片数据解码失败' });
            return;
          }
          if (buf.length === 0) {
            sendJson(res, 400, { error: '图片是空的' });
            return;
          }
          if (buf.length > MAX_IMAGE_BYTES) {
            sendJson(res, 413, { error: '图片太大（超过 20MB）' });
            return;
          }

          const ext = sniffImage(buf);
          if (ext === null) {
            sendJson(res, 400, { error: '文件头不像 JPEG / PNG / WebP' });
            return;
          }

          const name = sanitizeName(payload.name);
          const width = intIn(payload.width, 100000);
          const height = intIn(payload.height, 100000);
          const updatedAt = Date.now();

          try {
            await mkdir(dataDir, { recursive: true });
            const tmpName = `wallpaper.${ext}.tmp`;
            const tmp = join(dataDir, tmpName);
            const target = join(dataDir, `wallpaper.${ext}`);
            await writeFile(tmp, buf);
            // 清理时把刚写的 tmp 保下来，否则 rename 会 ENOENT
            await removeWallpaperFiles(dataDir, tmpName);
            await rename(tmp, target);
            await writeFile(
              metaFileOf(dataDir),
              JSON.stringify(
                { name, bytes: buf.length, width, height, ext, updatedAt },
                null,
                2,
              ),
              'utf8',
            );
          } catch (e) {
            console.error('[remielle-dan] 壁纸落盘失败：', e);
            sendJson(res, 500, { error: `无法写入 ${dataDir}：${e?.message ?? e}` });
            return;
          }

          const found = await findWallpaper(dataDir);
          sendJson(res, 200, describeWallpaper(dataDir, found));
          return;
        }

        res.writeHead(405, {
          Allow: 'GET, HEAD, POST, DELETE',
          'Content-Type': 'text/plain; charset=utf-8',
        });
        res.end('method not allowed');
      } catch (e) {
        console.error('[remielle-dan] 壁纸路由失败：', e);
        try {
          sendJson(res, 500, { error: '壁纸处理失败' });
        } catch (e2) {
          /* 响应可能已经发出，不能再写 */
        }
      }
    });

    console.log(`[remielle-dan] 宿主半边已激活（${registered}/${total} 条路由）`);
    console.log(`[remielle-dan] 壁纸目录：${dataDir}`);

    // 自报路由：独立注册、独立 try/catch，注册失败也只少一个诊断出口，
    // 决不能让上面几条资产路由跟着挂掉。
    try {
      const disposeReport = ctx.webServer.register({
        kind: 'exact',
        path: REPORT_PATH,
        handler: (req, res) => {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 16384) req.destroy();
          });
          req.on('end', async () => {
            try {
              const line = `${new Date().toISOString()} ${body}\n`;
              await appendFile(REPORT_FILE, line, 'utf8');
            } catch (err) {
              console.warn('[remielle-dan] 自报写入失败：', err?.message ?? err);
            }
            res.writeHead(204).end();
          });
        },
      });
      ctx.effect(() => disposeReport);
      console.log(`[remielle-dan] 自报路由已开启（${REPORT_PATH}）`);
    } catch (e) {
      console.warn('[remielle-dan] 自报路由未注册（不影响外观）：', e?.message ?? e);
    }
  },
};
