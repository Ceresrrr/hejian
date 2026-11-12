/* ============================================================
 * 合鉴 · 构建：data/*.tsv  →  js/data.js
 * 源文件以制表符分栏，人工可读可改；产物是浏览器与 Node 共用的一份。
 *   node build-data.mjs
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'js', 'data.js');

function rows(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const out = [];
  raw.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    out.push({ c: line.split('\t'), n: i + 1, f: path.basename(file) });
  });
  return out;
}

function fail(r, msg) {
  throw new Error(`${r.f}:${r.n}  ${msg}\n  ${r.c.join(' | ')}`);
}

function val(s) {
  s = (s || '').trim();
  return s === '-' || s === '' ? null : s;
}

function num(r, i) {
  const s = val(r.c[i]);
  if (s === null) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) fail(r, `第 ${i + 1} 列「${s}」不是数字`);
  return n;
}

/* ---------- 卷 ---------- */
const volumes = rows(path.join(DATA, 'volumes.tsv')).map(r => ({
  code: r.c[0].trim(),
  name: r.c[1].trim(),
  span: (r.c[2] || '').trim(),
  note: (r.c[3] || '').trim(),
  order: Number(r.c[4]),
  civil: (r.c[5] || '').trim()
}));

/* ---------- 政权 ---------- */
const regimes = rows(path.join(DATA, 'regimes.tsv')).map(r => ({
  code: r.c[0].trim(),
  name: r.c[1].trim(),
  vol: r.c[2].trim(),
  start: Number(r.c[3]),
  end: Number(r.c[4]),
  note: (r.c[5] || '').trim()
}));

const regBy = Object.fromEntries(regimes.map(g => [g.code, g]));
const volBy = Object.fromEntries(volumes.map(v => [v.code, v]));

/* ---------- 统治者 ---------- */
const dir = path.join(DATA, 'rulers');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsv')).sort();
const rulers = [];

for (const f of files) {
  for (const r of rows(path.join(dir, f))) {
    const c = r.c;
    if (c.length < 9) fail(r, `列数不足（要 9 列以上，实得 ${c.length}）`);
    const regime = c[0].trim();
    if (!regBy[regime]) fail(r, `未知政权代码「${regime}」`);
    const s = c[6].split(',').map(x => Number(x.trim()));
    if (s.length !== 8) fail(r, `分数应为 8 个，实得 ${s.length}`);
    const kind = c[5].trim();
    rulers.push({
      regime,
      title: c[1].trim(),
      name: val(c[2]),
      start: num(r, 3),
      end: num(r, 4),
      kind,
      s,
      tags: (c[7] || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      note: c[8].trim(),
      long: val(c[9]),
      quote: val(c[10]) ? { t: c[10].trim(), src: (c[11] || '').trim() } : null,
      conf: val(c[12]) ? Number(c[12]) : 3
    });
  }
}

/* ---------- 排序与派生字段 ---------- */
const regOrder = new Map();
regimes.slice().sort((a, b) => {
  const va = volBy[a.vol] ? volBy[a.vol].order : 99;
  const vb = volBy[b.vol] ? volBy[b.vol].order : 99;
  return va - vb || a.start - b.start;
}).forEach((g, i) => regOrder.set(g.code, i));

rulers.sort((a, b) => {
  const ra = regOrder.get(a.regime) ?? 99, rb = regOrder.get(b.regime) ?? 99;
  if (ra !== rb) return ra - rb;
  const sa = a.start == null ? 1e9 : a.start, sb = b.start == null ? 1e9 : b.start;
  return sa - sb;
});

const counter = {};
rulers.forEach(r => {
  const g = regBy[r.regime];
  counter[r.regime] = (counter[r.regime] || 0) + 1;
  r.id = `${r.regime}-${String(counter[r.regime]).padStart(2, '0')}`;
  r.vol = g.vol;
  r.regimeName = g.name;
  r.volName = volBy[g.vol] ? volBy[g.vol].name : g.vol;
});

/* ---------- 输出 ---------- */
const payload = {
  generated: new Date().toISOString().slice(0, 10),
  volumes,
  regimes,
  rulers
};

const js = `/* 自动生成，请勿手改 —— 源文件在 data/，改完跑 node build-data.mjs */
(function (g) {
  var D = ${JSON.stringify(payload, null, 0)};
  g.HIST = D;
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, js, 'utf8');

const byVol = {};
rulers.forEach(r => { byVol[r.volName] = (byVol[r.volName] || 0) + 1; });
console.log(`政权 ${regimes.length} 个 · 统治者 ${rulers.length} 位 · ${(js.length / 1024).toFixed(1)} KB`);
console.log(Object.entries(byVol).map(([k, v]) => `${k} ${v}`).join(' · '));
