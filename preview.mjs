/* ============================================================
 * 合鉴 · 终端预览（不依赖浏览器）
 *   node preview.mjs              概览
 *   node preview.mjs 唐太宗       单人档案
 *   node preview.mjs 唐太宗 "腓特烈二世@普鲁士"  双人对比（重名用 @ 指定政权）
 * ============================================================ */
import './js/core.js';
import './js/data.js';

const C = globalThis.HistCore;
const H = globalThis.HIST;
const args = process.argv.slice(2);

const BAR = '█';
const DIMC = ['\x1b[38;5;180m', '\x1b[38;5;173m', '\x1b[38;5;109m', '\x1b[38;5;145m',
  '\x1b[38;5;131m', '\x1b[38;5;95m', '\x1b[38;5;186m', '\x1b[38;5;108m'];
const OFF = '\x1b[0m', DIM = '\x1b[38;5;242m', BOLD = '\x1b[1m', GOLD = '\x1b[38;5;179m';

function bar(v, width = 20) {
  const n = Math.round(v / 10 * width);
  return BAR.repeat(n) + DIM + '·'.repeat(width - n) + OFF;
}
function pad(s, n) {
  const w = [...s].reduce((a, ch) => a + (/[\u4e00-\u9fa5\uff00-\uffef]/.test(ch) ? 2 : 1), 0);
  return s + ' '.repeat(Math.max(0, n - w));
}
function find(q) {
  // 「腓力二世@哈布斯堡（西）」：重名时用 @ 指定政权
  const at = q.indexOf('@');
  const t = at > 0 ? q.slice(0, at) : q;
  const rg = at > 0 ? q.slice(at + 1) : null;
  const hit = H.rulers.filter(r =>
    (r.title.includes(t) || (r.name || '').includes(t) || r.id === t) &&
    (!rg || r.regimeName === rg || r.regime === rg));
  if (!hit.length) {
    console.log(`没有找到「${q}」。可试：${H.rulers.slice(0, 6).map(r => r.title).join('、')}…`);
    process.exit(1);
  }
  return hit;
}

function sheet(r, meanOf) {
  console.log('');
  console.log(`  ${BOLD}${GOLD}${r.title}${OFF} ${DIM}${r.name} · ${r.regimeName} · ${C.reign(r)}${OFF}`);
  console.log(`  ${DIM}${r.tags.join(' / ')}${OFF}`);
  console.log('');
  const avg = meanOf ? C.avgScores(meanOf) : null;
  C.DIMS.forEach((d, i) => {
    const v = r.s[i];
    const col = DIMC[i];
    const line = `  ${pad(d.label, 5)}${col}${bar(v)}${OFF} ${BOLD}${String(v).padStart(2)}${OFF}`;
    const cmp = avg ? `${DIM}  同政权均值 ${avg[i]}${OFF}` : '';
    console.log(line + cmp);
  });
  console.log('');
  console.log(`  ${DIM}综合${OFF} ${BOLD}${C.composite(r.s)}${OFF}   ${r.note}`);
  if (r.long) console.log(`\n  ${r.long}`);
  if (r.quote) console.log(`\n  ${GOLD}「${r.quote.t}」${OFF}${DIM} —— ${r.quote.src}${OFF}`);
  console.log('');
}

if (!args.length) {
  const n = H.rulers.length, g = H.regimes.length, v = H.volumes.length;
  console.log(`\n${BOLD}${GOLD}合鉴${OFF} ${DIM}中外历代统治者 · 八维评鉴${OFF}\n`);
  console.log(`  ${n} 位统治者 · ${g} 个政权 · ${v} 卷 · 生成于 ${H.generated}`);
  console.log(`  ${DIM}` + H.volumes.map(x => `${x.name} ${H.rulers.filter(r => r.vol === x.code).length}`).join(' · ') + OFF);
  console.log(`  数据可信度：高 ${H.rulers.filter(r => r.conf === 3).length} · 中 ${H.rulers.filter(r => r.conf === 2).length} · 存疑 ${H.rulers.filter(r => r.conf === 1).length}`);

  const ranked = C.sortBy(H.rulers, 'composite', true);
  console.log(`\n  ${GOLD}综合分前十${OFF}`);
  ranked.slice(0, 10).forEach((r, i) => {
    console.log(`  ${DIM}${String(i + 1).padStart(2)}${OFF} ${pad(r.title, 12)}${DIM}${pad(r.regimeName, 10)}${OFF} ${bar(C.composite(r.s) / 10, 24)} ${BOLD}${C.composite(r.s)}${OFF}`);
  });
  console.log(`\n  ${GOLD}综合分末五${OFF}`);
  ranked.slice(-5).reverse().forEach((r, i) => {
    console.log(`  ${DIM}${String(i + 1).padStart(2)}${OFF} ${pad(r.title, 12)}${DIM}${pad(r.regimeName, 10)}${OFF} ${bar(C.composite(r.s) / 10, 24)} ${BOLD}${C.composite(r.s)}${OFF}`);
  });
  console.log(`\n  ${DIM}单人：node preview.mjs 唐太宗   对比：node preview.mjs 唐太宗 "腓特烈二世@普鲁士"${OFF}\n`);
} else if (args.length === 1) {
  const [r] = find(args[0]);
  sheet(r, H.rulers.filter(x => x.regime === r.regime));
} else {
  const [a] = find(args[0]);
  const [b] = find(args[1]);
  console.log(`\n  ${BOLD}${GOLD}${a.title}${OFF} ${DIM}vs${OFF} ${BOLD}\x1b[38;5;167m${b.title}${OFF}`);
  console.log(`  ${DIM}${a.regimeName} ${C.reign(a)}  /  ${b.regimeName} ${C.reign(b)}${OFF}\n`);
  C.diff(a, b).forEach(d => {
    const left = Math.round(d.a / 10 * 14), right = Math.round(d.b / 10 * 14);
    const diff = (d.d > 0 ? '+' : '') + d.d;
    console.log(
      `  ${DIMC[C.DIMS.indexOf(d.dim)]}${pad(d.dim.label, 5)}${OFF}` +
      ' '.repeat(14 - left) + `${GOLD}${BAR.repeat(left)}${OFF} ` +
      `${pad(String(d.a), 2)} ${DIM}│${OFF} ` +
      `${'\x1b[38;5;167m'}${BAR.repeat(right)}${OFF}` +
      ' '.repeat(14 - right) + ` ${pad(String(d.b), 2)}  ${d.d === 0 ? DIM + '=' + OFF : (d.d > 0 ? GOLD : '\x1b[38;5;167m') + pad(diff, 3) + OFF}`
    );
  });
  console.log(`\n  ${DIM}合计${OFF} ${GOLD}${C.composite(a.s)}${OFF}  ${DIM}vs${OFF}  \x1b[38;5;167m${C.composite(b.s)}${OFF}   ${DIM}甲 ${a.title} / 乙 ${b.title}${OFF}`);
  console.log(`  ${DIM}网格为中轴：左为甲，右为乙；八轴同向，差值即「甲 − 乙」。${OFF}\n`);
}
