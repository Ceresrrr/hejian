/* ============================================================
 * 合鉴 · 自检
 *   node test.mjs
 * 校验数据完整性、评分合法性、几何与筛选函数，以及页面挂载点。
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
await import('./js/core.js');
await import('./js/data.js');

const C = globalThis.HistCore;
const H = globalThis.HIST;

let pass = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fails.push(name + (detail ? '  → ' + detail : ''));
}
function eq(name, a, b) { ok(name, a === b, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

/* ---------- 1. 结构 ---------- */
ok('data 非空', H && Array.isArray(H.rulers) && H.rulers.length > 0);
ok('volumes 非空', H.volumes.length > 0);
ok('regimes 非空', H.regimes.length > 0);
eq('volumes 唯一 code', new Set(H.volumes.map(v => v.code)).size, H.volumes.length);
eq('regimes 唯一 code', new Set(H.regimes.map(r => r.code)).size, H.regimes.length);

const volCodes = new Set(H.volumes.map(v => v.code));
const regimeByCode = Object.fromEntries(H.regimes.map(r => [r.code, r]));
for (const g of H.regimes) {
  ok(`政权 ${g.code} 属于存在的卷`, volCodes.has(g.vol), g.vol);
  ok(`政权 ${g.code} 有起止年`, Number.isFinite(g.start) && Number.isFinite(g.end), `${g.start}~${g.end}`);
  ok(`政权 ${g.code} 起 ≤ 止`, g.start <= g.end, `${g.start}~${g.end}`);
}

/* ---------- 2. 每位统治者 ---------- */
const ids = new Set();
const seen = new Set();
const perRegime = {};
const perVol = {};
for (const r of H.rulers) {
  const tag = `${r.id} ${r.title}`;
  ok(`${tag} id 唯一`, !ids.has(r.id));
  ids.add(r.id);
  ok(`${tag} 政权存在`, !!regimeByCode[r.regime], r.regime);
  ok(`${tag} 卷已派生`, volCodes.has(r.vol), r.vol);
  ok(`${tag} 名号非空`, !!r.title && !!r.name);
  ok(`${tag} 类型合法`, !!C.KINDS[r.kind], r.kind);

  const s = r.s;
  ok(`${tag} 八维齐全`, Array.isArray(s) && s.length === 8, JSON.stringify(s));
  s.forEach((v, i) => ok(`${tag} ${C.DIMS[i].label}=${v} 是 0-10 整数`, Number.isInteger(v) && v >= 0 && v <= 10));

  ok(`${tag} 总评非空`, !!r.note && r.note.trim().length > 0);
  ok(`${tag} 总评 ≤46 字`, [...r.note].length <= 46, `${[...r.note].length} 字`);
  ok(`${tag} 可信度 1-3`, [1, 2, 3].includes(r.conf), r.conf);
  if (r.long) ok(`${tag} 长评成篇`, [...r.long].length >= 20, `${[...r.long].length} 字`);
  if (r.quote) ok(`${tag} 摘句须有出处`, !!r.quote.src, '有摘句无出处');
  ok(`${tag} 起 ≤ 止`, r.start <= r.end, `${r.start}~${r.end}`);
  ok(`${tag} 年份在区间内`, r.start >= -3200 && r.start <= 1925 && r.end <= 1990, `${r.start}~${r.end}`);
  ok(`${tag} 年份格式`, C.fmtYear(r.start) !== '' && !/NaN/.test(C.reign(r)));

  const dup = `${r.regime}|${r.title}|${r.name}`;
  ok(`${tag} 同政权同名不重复`, !seen.has(dup), dup);
  seen.add(dup);

  perRegime[r.regime] = (perRegime[r.regime] || 0) + 1;
  perVol[r.vol] = (perVol[r.vol] || 0) + 1;
  ok(`${tag} 综合分可用`, C.composite(s) >= 0 && C.composite(s) <= 100);
}

for (const v of H.volumes) ok(`卷 ${v.code} 有人物`, (perVol[v.code] || 0) > 0, String(perVol[v.code] || 0));
for (const g of H.regimes) ok(`政权 ${g.code} 有人物`, (perRegime[g.code] || 0) > 0, '0 位');
ok('规模 ≥ 1200 位', H.rulers.length >= 1200, String(H.rulers.length));

/* ---------- 3. 核心函数 ---------- */
eq('fmtYear(-221)', C.fmtYear(-221), '前221');
eq('fmtYear(1912)', C.fmtYear(1912), '1912');
eq('fmtYear(-1)', C.fmtYear(-1), '前1');
eq('clamp 越界', C.clamp(11, 0, 10), 10);
eq('平庸五分 = 50', C.composite([5, 5, 5, 5, 5, 5, 5, 5]), 50);
eq('满分 = 100', C.composite([10, 10, 10, 10, 10, 10, 10, 10]), 100);
eq('全零 = 0', C.composite([0, 0, 0, 0, 0, 0, 0, 0]), 0);
ok('德行越高分越高', C.composite([5, 5, 5, 5, 8, 5, 5, 5]) > C.composite([5, 5, 5, 5, 2, 5, 5, 5]));
ok('民生越高分越高', C.composite([5, 5, 5, 5, 5, 8, 5, 5]) > C.composite([5, 5, 5, 5, 5, 2, 5, 5]));
ok('八轴无负向', C.DIMS.every(x => x.dir === undefined));

const gPoly = C.polygon([10, 10, 10, 10, 10, 10, 10, 10], 100, 150, 150);
eq('polygon 顶点数', gPoly.split(' ').length, 8);
const verts = gPoly.split(' ').map(p => p.split(',').map(Number));
ok('polygon 顶点在半径内', verts.every(([x, y]) => Math.hypot(x - 150, y - 150) <= 100.5));
const zeroPoly = C.polygon([0, 0, 0, 0, 0, 0, 0, 0], 100, 150, 150);
ok('零分多边形退化为点', zeroPoly.split(' ').every(p => Number(p.split(',')[0]) === 150 && Number(p.split(',')[1]) === 150));

const angg = C.axisAngle(0);
ok('首轴朝上', Math.abs(Math.cos(angg)) < 1e-9 && Math.sin(angg) < 0);
eq('八轴等分', Math.round((C.axisAngle(1) - C.axisAngle(0)) * 180 / Math.PI), 45);

/* 具体人物的排序与筛选 */
const byId = Object.fromEntries(H.rulers.map(r => [r.id, r]));
const eliz = H.rulers.find(r => r.title === '伊丽莎白一世' && r.regime === 'eng-tudor');
const phil = H.rulers.find(r => r.title === '腓力二世' && r.regime === 'spa-habs');
ok('伊丽莎白一世存在', !!eliz);
ok('腓力二世存在', !!phil);
ok('伊丽莎白一世纳谏 ≥ 5', eliz.s[3] >= 5, String(eliz.s[3]));
ok('伊丽莎白一世治绩 ≥ 7', eliz.s[1] >= 7, String(eliz.s[1]));
ok('腓力二世纳谏 ≤ 4', phil.s[3] <= 4, String(phil.s[3]));
ok('伊丽莎白一世综合 60–85', C.composite(eliz.s) >= 60 && C.composite(eliz.s) <= 85, String(C.composite(eliz.s)));

const ivan = H.rulers.find(r => r.title === '伊凡四世' || r.name === '伊凡四世');
ok('伊凡雷帝存在', !!ivan);
if (ivan) {
  ok('伊凡雷帝纳谏 ≤ 3', ivan.s[3] <= 3, String(ivan.s[3]));
  ok('伊凡雷帝德行 ≤ 3', ivan.s[4] <= 3, String(ivan.s[4]));
  ok('伊凡雷帝武功 ≥ 5', ivan.s[7] >= 5, String(ivan.s[7]));
}

/* 中国一侧的锚点，防止两套源在合并时串档 */
const taizong = H.rulers.find(r => r.title === '唐太宗' && r.regime === 'tang');
const hanwu = H.rulers.find(r => r.title === '汉武帝' && r.regime === 'xihan');
const qinshi = H.rulers.find(r => r.title === '秦始皇' && r.regime === 'qin');
ok('唐太宗存在（中国卷）', !!taizong);
ok('汉武帝存在（中国卷）', !!hanwu);
ok('秦始皇存在（中国卷）', !!qinshi);
if (taizong) {
  ok('唐太宗纳谏 ≥ 9', taizong.s[3] >= 9, String(taizong.s[3]));
  ok('唐太宗综合 80–95', C.composite(taizong.s) >= 80 && C.composite(taizong.s) <= 95, String(C.composite(taizong.s)));
  ok('唐太宗在中国卷', taizong.vol === 'cn', taizong.vol);
}
if (hanwu) {
  ok('汉武帝武功 = 10', hanwu.s[7] === 10, String(hanwu.s[7]));
  ok('汉武帝民生 ≤ 3', hanwu.s[5] <= 3, String(hanwu.s[5]));
  ok('汉武帝纪年为公元前', C.fmtYear(hanwu.start) === '前141', C.fmtYear(hanwu.start));
}
if (qinshi) {
  ok('秦始皇纳谏 ≤ 2', qinshi.s[3] <= 2, String(qinshi.s[3]));
  ok('秦始皇德行 ≤ 3', qinshi.s[4] <= 3, String(qinshi.s[4]));
}

/* 新增文明的锚点：只校验方向，防止并行造数时串档 */
const nobunaga = H.rulers.find(r => r.title === '织田信长');
const sejong = H.rulers.find(r => r.title === '世宗');
const suleiman = H.rulers.find(r => r.title === '苏莱曼一世');
const akbar = H.rulers.find(r => r.title === '阿克巴');
const ramses = H.rulers.find(r => r.title === '拉美西斯二世');
const musa = H.rulers.find(r => r.title === '曼萨·穆萨');
const pachacuti = H.rulers.find(r => r.title === '帕查库特克');
ok('织田信长存在（日本卷）', !!nobunaga);
ok('世宗存在（朝鲜卷）', !!sejong);
ok('苏莱曼一世存在（伊斯兰卷）', !!suleiman);
ok('阿克巴存在（印度卷）', !!akbar);
ok('拉美西斯二世存在（埃及卷）', !!ramses);
ok('曼萨·穆萨存在（非洲卷）', !!musa);
ok('帕查库特克存在（美洲卷）', !!pachacuti);
if (nobunaga) {
  ok('织田信长纳谏 ≤ 4', nobunaga.s[3] <= 4, String(nobunaga.s[3]));
  ok('织田信长武功 ≥ 8', nobunaga.s[7] >= 8, String(nobunaga.s[7]));
}
if (sejong) {
  ok('世宗文教 ≥ 9', sejong.s[6] >= 9, String(sejong.s[6]));
  ok('世宗综合 ≥ 70', C.composite(sejong.s) >= 70, String(C.composite(sejong.s)));
}
if (suleiman) {
  ok('苏莱曼武功 ≥ 8', suleiman.s[7] >= 8, String(suleiman.s[7]));
  ok('苏莱曼纳谏 ≤ 5', suleiman.s[3] <= 5, String(suleiman.s[3]));
}
if (akbar) {
  ok('阿克巴纳谏 ≥ 6', akbar.s[3] >= 6, String(akbar.s[3]));
  ok('阿克巴文教 ≥ 9', akbar.s[6] >= 9, String(akbar.s[6]));
}
if (ramses) ok('拉美西斯二世武功 ≥ 8', ramses.s[7] >= 8, String(ramses.s[7]));
if (musa) ok('曼萨·穆萨文教 ≥ 7', musa.s[6] >= 7, String(musa.s[6]));
if (pachacuti) ok('帕查库特克综合 ≥ 75', C.composite(pachacuti.s) >= 75, String(C.composite(pachacuti.s)));

const tudorList = H.rulers.filter(r => r.regime === 'eng-tudor');eq('filter 按政权', C.filter(H.rulers, { regime: 'eng-tudor' }).length, tudorList.length);
ok('filter 按卷', C.filter(H.rulers, { vol: 'eu' }).every(r => r.vol === 'eu'));
const qHit = C.filter(H.rulers, { q: '都铎' });
ok('filter 关键词命中', qHit.length > 0 && qHit.some(r => r.regime === 'eng-tudor'), String(qHit.length));
ok('filter 排除型关键词', C.filter(H.rulers, { q: '不存在的关键词xyz' }).length === 0);
ok('filter 多维叠加', C.filter(H.rulers, { vol: 'cn', dim: 'wugong', min: 7 }).every(r => r.vol === 'cn' && r.s[7] >= 7));

const sorted = C.sortBy(H.rulers, 'composite', true);
ok('sortBy 降序', C.composite(sorted[0].s) >= C.composite(sorted[sorted.length - 1].s));
const sortedWen = C.sortBy(H.rulers, 'd:gongye', true);
ok('sortBy 单维降序', sortedWen[0].s[0] >= sortedWen[sortedWen.length - 1].s[0]);
eq('topBy 长度', C.topBy(H.rulers, 'gongye', 5).length, 5);
ok('topBy 首位最高', C.topBy(H.rulers, 'wugong', 1)[0].s[7] === Math.max(...H.rulers.map(r => r.s[7])));
const avg = C.avgScores(tudorList);
eq('avgScores 维数', avg.length, 8);
ok('avgScores 在范围内', avg.every(v => v >= 0 && v <= 10));

const d = C.diff(eliz, phil);
eq('diff 维数', d.length, 8);
ok('diff 差值自洽', d.every(x => x.d === x.a - x.b));
ok('diff 方向一致', d.every(x => x.dim.dir === undefined));
eq('span 伊丽莎白在位年数', C.span(eliz), 46);

/* ---------- 4. 页面挂载点 ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const id of ['t-browse', 't-compare', 't-rank', 't-timeline', 't-rubric', 'cards', 'cmpChart', 'cmpTable', 'rankList', 'tl', 'modal']) {
  ok(`index.html 有 #${id}`, html.includes(`id="${id}"`), id);
}
for (const f of ['js/data.js', 'js/core.js', 'js/ui.js', 'css/style.css']) {
  ok(`${f} 存在`, fs.existsSync(path.join(ROOT, f)));
  if (f.endsWith('.js')) ok(`index.html 引用 ${f}`, html.includes(f), f);
}
const remoteAsset = /<script[^>]+src="https?:/i.test(html) || /<link[^>]+rel="stylesheet"[^>]+href="https?:/i.test(html) || /<img[^>]+src="https?:/i.test(html);
ok('无 CDN 外链', !remoteAsset, '页面从外部域加载脚本/样式/图片');
ok('无 ES module', !/type="module"/.test(html));

/* ---------- 汇总 ---------- */
const total = pass + fails.length;
if (fails.length) {
  console.log(`✗ ${fails.length} / ${total} 项未通过\n`);
  fails.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log(`✓ ${pass} / ${total} 项通过`);
console.log(`  统治者 ${H.rulers.length} 位 · 政权 ${H.regimes.length} 个 · 卷 ${H.volumes.length} 卷`);
console.log('  ' + H.volumes.map(v => `${v.name} ${perVol[v.code]}`).join(' · '));
