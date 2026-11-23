// Remielle Dan theme — 宿主半边。
//
// 只做一件事：把浏览器半边要用的两样静态资产用稳定的 HTTP 路由发出去。
//   /remielle-dan/theme.css   运行时样式（由 skin.css 的 :root 块 + patches.css 合成）
//   /remielle-dan/art.jpg     背景插画
//
// 资产路径相对本文件解析，所以仓库放在哪都能跑，不用改常量。
// 背景插画直接引用 zzz-remielle-dan/assets 下的原件，不复制第二份 —— 避免
// 同一张受限素材在仓库里出现两次、日后替换时漏掉一处。
import { readFile, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// 前端自报落盘的位置。加进 .gitignore，属本地诊断产物。
// 用途：让改样式的人（包括 agent）能确认「浏览器里跑的是哪一版、纱解析成了什么颜色」，
// 不必反复请用户截图。写失败只是少一条记录，不影响外观。
const REPORT_FILE = join(here, '.client-report.log');
const REPORT_PATH = '/remielle-dan/report';

const ROUTES = [
  {
    path: '/remielle-dan/theme.css',
    file: join(here, 'styles', 'theme.css'),
    type: 'text/css; charset=utf-8',
    // 开发期不让浏览器缓存：改完样式刷新就能看到
    cache: 'no-store',
  },
  {
    path: '/remielle-dan/art.jpg',
    file: join(here, 'zzz-remielle-dan', 'assets', 'remielle-dan-art.jpg'),
    type: 'image/jpeg',
    cache: 'public, max-age=3600',
  },
];

export default {
  inject: ['webServer'],
  apply(ctx) {
    let registered = 0;
    for (const route of ROUTES) {
      let dispose;
      try {
        dispose = ctx.webServer.register({
          kind: 'exact',
          path: route.path,
          handler: async (req, res) => {
            try {
              const bytes = await readFile(route.file);
              res.writeHead(200, {
                'Content-Type': route.type,
                'Content-Length': bytes.length,
                'Cache-Control': route.cache,
              });
              res.end(bytes);
            } catch (err) {
              console.error(`[remielle-dan] 资产读取失败: ${route.path}`, err);
              res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
              res.end('remielle-dan asset not found');
            }
          },
        });
        registered += 1;
      } catch (e) {
        // 路由已被别的实例占用时跳过，不要把整个 profile 的装载搞挂
        console.warn(
          `[remielle-dan] 路由 ${route.path} 已被占用，跳过：`,
          e?.message ?? e,
        );
        continue;
      }
      ctx.effect(() => dispose);
    }
    console.log(`[remielle-dan] 宿主半边已激活（${registered}/${ROUTES.length} 条路由）`);

    // 自报路由：独立注册、独立 try/catch，注册失败也只少一个诊断出口，
    // 决不能让上面两条资产路由跟着挂掉。
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
