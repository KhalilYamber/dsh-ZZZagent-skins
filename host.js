// Remielle Dan theme — 宿主半边。
//
// 只做一件事：把浏览器半边要用的两样静态资产用稳定的 HTTP 路由发出去。
//   /remielle-dan/theme.css   运行时样式（由 skin.css 的 :root 块 + patches.css 合成）
//   /remielle-dan/art.jpg     背景插画
//
// 资产路径相对本文件解析，所以仓库放在哪都能跑，不用改常量。
// 背景插画直接引用 zzz-remielle-dan/assets 下的原件，不复制第二份 —— 避免
// 同一张受限素材在仓库里出现两次、日后替换时漏掉一处。
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

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
  },
};
