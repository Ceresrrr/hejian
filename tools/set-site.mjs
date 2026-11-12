#!/usr/bin/env node
/* set-site.mjs — 把仓库里的 YOURNAME 占位符换成真实的 GitHub 账号与仓库名。
   用法：
     node tools/set-site.mjs <owner>            # 仓库名默认 hejian
     node tools/set-site.mjs <owner> <repo>
   例：node tools/set-site.mjs zhangsan
       把 https://YOURNAME.github.io/hejian/ → https://zhangsan.github.io/hejian/
       把 https://github.com/YOURNAME/hejian  → https://github.com/zhangsan/hejian
                                                                     */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const owner = (process.argv[2] || '').trim();
const repo = (process.argv[3] || 'hejian').trim();

if (!/^[A-Za-z0-9-]+$/.test(owner)) {
  console.error('✗ 需要一个合法的 GitHub 用户名/组织名，例如：node tools/set-site.mjs zhangsan');
  process.exit(1);
}

const site = `https://${owner}.github.io/${repo}/`;
const repoUrl = `https://github.com/${owner}/${repo}`;

const FILES = ['README.md', 'deploy.md', 'index.html', '404.html', 'sitemap.xml', 'robots.txt', 'package.json'];

let touched = 0;
for (const rel of FILES) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) continue;
  const before = fs.readFileSync(f, 'utf8');
  let s = before
    .replace(/https:\/\/YOURNAME\.github\.io\/hejian\/?/g, site)
    .replace(/https:\/\/github\.com\/YOURNAME\/hejian/g, repoUrl)
    .replace(/YOURNAME/g, owner);
  if (s !== before) {
    fs.writeFileSync(f, s);
    touched++;
    console.log('  ✓ ' + rel);
  }
}

console.log(`\n站点地址：${site}`);
console.log(`仓库地址：${repoUrl}`);
console.log(`改了 ${touched} 个文件。接下来：\n`);
console.log('  git remote add origin ' + repoUrl + '.git');
console.log('  git branch -M main && git push -u origin main');
console.log('\n然后在 GitHub 仓库 Settings → Pages 里把 Source 设为「GitHub Actions」，');
console.log('push 之后 Actions 会自动构建并发布。\n');
