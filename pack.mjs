/* pack.mjs — 把「要部署的那几个文件」拷进 dist/，其余（数据源 TSV、脚本、截图）都不上传。
   用法：node pack.mjs
   产物：dist/  ← 整个文件夹拖到任意静态托管即可                                          */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'dist');

const FILES = ['index.html', '404.html', 'favicon.svg', 'robots.txt', 'sitemap.xml', '_headers'];
const DIRS = ['css', 'js'];

try {
  fs.rmSync(OUT, { recursive: true, force: true });
} catch (e) {
  console.error('\n✗ 删不掉旧的 dist/：' + (e.code || e.message));
  console.error('  多半是有程序正开在里面（本地服务器 / 资源管理器窗口 / 编辑器）。');
  console.error('  关掉它再跑一次：node pack.mjs\n');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

let total = 0;
const copy = (rel) => {
  const src = path.join(ROOT, rel);
  const dst = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  total += fs.statSync(dst).size;
};

FILES.forEach((f) => {
  if (fs.existsSync(path.join(ROOT, f))) copy(f);
  else console.warn('  跳过（不存在）：' + f);
});

DIRS.forEach((d) => {
  for (const name of fs.readdirSync(path.join(ROOT, d))) {
    if (name.endsWith('.js') || name.endsWith('.css')) copy(path.join(d, name));
  }
});

// GitHub Pages 默认会跑 Jekyll，空 .nojekyll 让它别碰我的文件
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const kb = (total / 1024).toFixed(1);
console.log(`✓ dist/ 已生成：${kb} KB`);
console.log(`  访问入口：dist/index.html（线上就是 /）`);
console.log(`  用之前先 node test.mjs 过一遍。`);
