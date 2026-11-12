/* ============================================================
 * 合鉴 · 合并脚本
 *   把 ../dijian（中国）与 ../wangjian（欧洲）的 TSV 源合并成
 *   本站自己的 data/*.tsv。两个源项目只读，不写入、不改动。
 *
 *   node tools-merge.mjs
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_CN = path.join(DIR, '..', 'dijian', 'data');
const SRC_EU = path.join(DIR, '..', 'wangjian', 'data');
const OUT = path.join(DIR, 'data');

const read = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
const rows = (p) => read(p).filter((l) => l.trim() && !l.startsWith('#'));

/* ---------- 卷 ---------- */
const cnVols = rows(path.join(SRC_CN, 'volumes.tsv')).map((l) => l.split('\t'));
const euVols = rows(path.join(SRC_EU, 'volumes.tsv')).map((l) => l.split('\t'));
if (cnVols.length !== 8 || euVols.length !== 8) throw new Error('源卷数不是 8+8');

const euVolCode = (code) => 'e' + code.slice(1); // v3 → e3

const volumes = [];
cnVols.forEach((c, i) => volumes.push([c[0], c[1], c[2], c[3], String(i + 1)]));
euVols.forEach((c, i) => volumes.push([euVolCode(c[0]), c[1], c[2], c[3], String(i + 9)]));

/* ---------- 政权 ---------- */
const cnReg = rows(path.join(SRC_CN, 'regimes.tsv')).map((l) => l.split('\t'));
const euReg = rows(path.join(SRC_EU, 'regimes.tsv')).map((l) => l.split('\t'));

const seen = new Map();
const regimes = [];
for (const r of cnReg) {
  if (r.length !== 6) throw new Error('中国政权列数不对：' + r[0]);
  if (seen.has(r[0])) throw new Error('政权码重复：' + r[0]);
  seen.set(r[0], 'cn');
  regimes.push([r[0], r[1], r[2], r[3], r[4], r[5]]);
}
for (const r of euReg) {
  if (r.length !== 6) throw new Error('欧洲政权列数不对：' + r[0]);
  if (seen.has(r[0])) throw new Error('政权码重复：' + r[0]);
  seen.set(r[0], 'eu');
  regimes.push([r[0], r[1], euVolCode(r[2]), r[3], r[4], r[5]]);
}

/* ---------- 人物 ---------- */
const KINDS_EU = { wang: 'king' }; // 欧洲的「王」直接给「国王」，与中国的「王（诸侯）」分开

const all = [];
const files = [];
for (const side of ['cn', 'eu']) {
  const dir = side === 'cn' ? SRC_CN : SRC_EU;
  const sub = path.join(dir, 'rulers');
  for (const f of fs.readdirSync(sub).filter((x) => x.endsWith('.tsv')).sort()) {
    const lines = rows(path.join(sub, f));
    const data = [];
    for (const l of lines) {
      const c = l.split('\t');
      if (c.length !== 13) throw new Error(`${side}/${f} 列数 ${c.length}：${c[1]}`);
      if (!seen.has(c[0])) throw new Error(`${side}/${f} 政权码未知：${c[0]}`);
      if (side === 'eu' && KINDS_EU[c[5]]) c[5] = KINDS_EU[c[5]];
      data.push(c);
    }
    const outName = (side === 'cn' ? 'cn-' : 'eu-') + f.replace(/^\d+-/, '');
    files.push({ side, from: f, to: outName, data });
    all.push(...data);
  }
}

/* ---------- 重名 / id 检查 ---------- */
const ids = new Map();
for (const c of all) {
  const key = c[0] + '|' + c[1] + '|' + c[2];
  if (ids.has(key)) throw new Error('同政权同名：' + key);
  ids.set(key, 1);
}
const perReg = {};
for (const c of all) perReg[c[0]] = (perReg[c[0]] || 0) + 1;
for (const r of regimes) if (!perReg[r[0]]) throw new Error('政权没有人物：' + r[0]);

/* ---------- 写出 ---------- */
fs.mkdirSync(path.join(OUT, 'rulers'), { recursive: true });
for (const f of fs.readdirSync(path.join(OUT, 'rulers'))) {
  fs.rmSync(path.join(OUT, 'rulers', f));
}

const tsv = (head, list) => [head, ...list.map((r) => r.join('\t'))].join('\n') + '\n';

fs.writeFileSync(path.join(OUT, 'volumes.tsv'),
  tsv('# 卷：code\tname\tspan\tnote\torder', volumes));
fs.writeFileSync(path.join(OUT, 'regimes.tsv'),
  tsv('# 政权：code\tname\tvol\tstart\tend\tnote', regimes));

for (const f of files) {
  fs.writeFileSync(path.join(OUT, 'rulers', f.to.replace('.tsv', '.tsv')),
    '# 源：' + f.side + '/rulers/' + f.from + '\n' +
    '# regime\ttitle\tname\tstart\tend\tkind\t"8个逗号分"\ttags\tnote\tlong\tquote\tsrc\tconf\n' +
    f.data.map((c) => c.join('\t')).join('\n') + '\n');
}

/* ---------- 报告 ---------- */
const cnCount = all.filter((c) => seen.get(c[0]) === 'cn').length;
const euCount = all.length - cnCount;
console.log(`卷 ${volumes.length} · 政权 ${regimes.length} · 人物 ${all.length}（中国 ${cnCount} / 欧洲 ${euCount}）`);
console.log('文件：' + files.map((f) => f.to).join(' '));
