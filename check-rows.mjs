/* 校验待并入的 TSV 行：node check-rows.mjs <file>
 * 列：regime title name start end kind scores tags note long quote src conf
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || 'data/rulers/10-add.tsv';
const file = path.isAbsolute(target) ? target : path.join(ROOT, target);
const KINDS = ['di', 'basileus', 'tsar', 'caliph', 'sultan', 'shah', 'pharaoh', 'tenno', 'king', 'wang', 'maharaja', 'raja', 'negus', 'lord', 'grand', 'duke', 'shogun', 'ajaw', 'khan', 'chanyu', 'mansa', 'tlatoani', 'inca', 'zanpu', 'regent', 'zhuang', 'pretender'];

const regimes = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'data/regimes.tsv'), 'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.startsWith('#')) continue;
  const c = line.split('\t');
  regimes.set(c[0], { name: c[1], volume: c[2], from: +c[3], to: +c[4] });
}

const seen = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'data/rulers'))) {
  if (!f.endsWith('.tsv')) continue;
  const self = path.resolve(ROOT, 'data/rulers', f) === path.resolve(file);
  for (const line of fs.readFileSync(path.join(ROOT, 'data/rulers/' + f), 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const c = line.split('\t');
    if (self) continue;
    seen.set(c[0] + '|' + c[1] + '|' + c[2], f);
  }
}

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
let bad = 0;
const byRegime = {};
lines.forEach((line, i) => {
  const c = line.split('\t');
  const tag = `L${i + 1} ${c[1] || '?'}`;
  const err = m => { bad++; console.log(`  ✗ ${tag}: ${m}`); };
  if (c.length !== 13) { err(`列数 ${c.length}（应为 13）`); return; }
  const g = regimes.get(c[0]);
  if (!g) err(`政权代码 ${c[0]} 不存在`);
  if (!c[1] || !c[2]) err('名号或原文名为空');
  if (c[1] && seen.has(c[0] + '|' + c[1] + '|' + c[2])) err(`同政权同名：${seen.get(c[0] + '|' + c[1] + '|' + c[2])} 已有`);
  seen.set(c[0] + '|' + c[1] + '|' + c[2], path.basename(file));

  if (!KINDS.includes(c[5])) err(`类型 ${c[5]} 不在 ${KINDS.join('/')}`);
  const s = c[6].split(',');
  if (s.length !== 8) err(`分数不是 8 个：${c[6]}`);
  else if (!s.every(x => /^\d+$/.test(x) && +x >= 0 && +x <= 10)) err(`分数越界：${c[6]}`);
  const noteLen = [...(c[8] || '')].length;
  if (!c[8]) err('总评为空');
  else if (noteLen > 46) err(`总评 ${noteLen} 字，超 46`);
  if (c[12] && ![1, 2, 3].includes(+c[12])) err(`可信度 ${c[12]}`);
  const a = +c[3], b = +c[4];
  if (!/^-?\d+$/.test(c[3]) || !/^-?\d+$/.test(c[4])) err(`年份不是整数：${c[3]}~${c[4]}`);
  else if (!(a <= b)) err(`起止年倒置：${c[3]}~${c[4]}`);
  else if (g && (a < g.from - 120 || b > g.to + 120)) err(`年份 ${a}~${b} 超出政权 ${c[0]} 范围 ${g.from}~${g.to}`);
  byRegime[c[0]] = (byRegime[c[0]] || 0) + 1;
});

console.log(`\n${path.basename(file)}：共 ${lines.length} 行，问题 ${bad} 条`);
console.log('分布：' + Object.entries(byRegime).map(([k, v]) => `${k} ${v}`).join(' · '));
if (bad) process.exit(1);
