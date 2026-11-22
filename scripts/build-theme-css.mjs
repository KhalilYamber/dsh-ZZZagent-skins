// 由 zzz-remielle-dan/skin.css 的 :root 块 + patches.css 合成 styles/theme.css。
//
// 为什么要有这个脚本：theme.css 是运行时唯一被加载的样式，但它的内容来源是
// 上游皮肤的两个文件。若直接手改 theme.css，改了什么、来自哪里就追不回来了；
// 若只改源文件不重新生成，跑起来的是旧样式，看现象会误判。
//
// 用法：node scripts/build-theme-css.mjs
//
// 生成规则（三件事，都别"优化"掉）：
//   1. token 块写两遍：html[data-remielle-dan] 与 html[data-remielle-dan] body。
//      宿主在 body[data-ds-dark-theme] 上也定义 --dsw-*，自定义属性按最近祖先
//      生效；只写 :root 会被 body 上的声明盖掉，颜色根本不生效。
//   2. :root 之外的行首 body 选择器一律挂 html[data-remielle-dan] 前缀。
//   3. 其余 :root（例如 @supports 回退块里那个）也挂作用域，避免全局泄漏。
//   patches.css 全文原样追加在最末——它按设计就是全局的（注入即生效、移除即复原）。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const skinPath = join(root, 'zzz-remielle-dan', 'skin.css');
const patchPath = join(root, 'zzz-remielle-dan', 'patches.css');
const outPath = join(root, 'styles', 'theme.css');

const ATTR = 'html[data-remielle-dan]';

const src = readFileSync(skinPath, 'utf8');
const patch = readFileSync(patchPath, 'utf8');

// 取第一个 :root { ... } 的内容（括号配平，不依赖行号）
const m = /:root\s*\{/.exec(src);
if (!m) throw new Error('skin.css 里找不到 :root 块');
let depth = 1;
let i = m.index + m[0].length;
while (depth > 0 && i < src.length) {
  if (src[i] === '{') depth += 1;
  else if (src[i] === '}') depth -= 1;
  i += 1;
}
const block = src.slice(m.index + m[0].length, i - 1).replace(/^\n+|\n+$/g, '');
const rest = src
  .slice(i)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .trim()
  .replace(/^body/gm, `${ATTR} body`)
  .replace(/^:root/gm, ATTR);

const header = `/* ============================================================
   Remielle Dan — 运行时样式（生成产物，勿手改）
   源：zzz-remielle-dan/skin.css 的 :root 块 + patches.css
   重新生成：node scripts/build-theme-css.mjs
   token 块重复两遍（html / html body）的原因见生成脚本注释。
   ============================================================ */

`;

const out =
  header +
  `${ATTR} {\n${block}\n}\n\n` +
  `${ATTR} body {\n${block}\n}\n\n` +
  `/* ---- 原 skin.css 的 body 级与回退规则（已挂作用域） ---- */\n${rest}\n\n` +
  `/* ---- patches.css：DOM 质感层（按原设计保持全局） ---- */\n${patch}\n`;

mkdirSync(join(root, 'styles'), { recursive: true });
writeFileSync(outPath, out, 'utf8');

const tokens = (out.match(/^\s*--(?:dsw|aion)-[a-z0-9-]+\s*:/gm) ?? []).length;
console.log(`已生成 ${outPath}`);
console.log(`  token 定义 ${tokens} 条（含两遍） / 总长 ${out.length} 字符`);
