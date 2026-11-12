/* ============================================================
 * 合鉴 · core —— 纯计算，不碰 DOM，Node 可直接 require
 * 八维：功业 治绩 用贤 纳谏 德行 民生 文教 武功（与《帝鉴》同一把尺）
 * 八根轴同向——数值越高越好，雷达面积即人望
 * ============================================================ */
(function (global) {
  'use strict';

  var DIMS = [
    { k: 'gongye',   label: '功业', hint: '一朝事功与遗产：疆域、国势的净变化、留下的制度' },
    { k: 'zhiji',    label: '治绩', hint: '行政效率、财政、司法、政令能否推行' },
    { k: 'yongxian', label: '用贤', hint: '识人用人：贤者在位、人尽其才，抑或任唯亲、诛功臣' },
    { k: 'najian',   label: '纳谏', hint: '容受逆耳之言、议会与请愿，抑或拒谏饰非、一意孤行' },
    { k: 'dexing',   label: '德行', hint: '诚信、节欲、家庭与杀戮：私德与暴行的分量' },
    { k: 'minsheng', label: '民生', hint: '赋税轻重、饥荒与瘟疫、人口与城镇的兴衰' },
    { k: 'wenjiao',  label: '文教', hint: '兴学、修史、赞助艺术与学术，及本人文采' },
    { k: 'wugong',   label: '武功', hint: '军事才能、战争胜负、疆场开拓与守成' }
  ];

  var KINDS = {
    di:        { label: '皇帝',      cls: 'k-di' },
    basileus:  { label: '巴西琉斯',  cls: 'k-di' },
    tsar:      { label: '沙皇',      cls: 'k-di' },
    caliph:    { label: '哈里发',    cls: 'k-di' },
    sultan:    { label: '苏丹',      cls: 'k-di' },
    shah:      { label: '沙阿',      cls: 'k-di' },
    pharaoh:   { label: '法老',      cls: 'k-di' },
    tenno:     { label: '天皇',      cls: 'k-di' },
    king:      { label: '国王',      cls: 'k-wang' },
    wang:      { label: '王',        cls: 'k-wang' },
    maharaja:  { label: '大君',      cls: 'k-wang' },
    raja:      { label: '罗阇',      cls: 'k-wang' },
    negus:     { label: '内古斯',    cls: 'k-wang' },
    lord:      { label: '诸侯',      cls: 'k-lord' },
    grand:     { label: '大公',      cls: 'k-lord' },
    duke:      { label: '公爵',      cls: 'k-lord' },
    shogun:    { label: '将军',      cls: 'k-lord' },
    ajaw:      { label: '阿豪',      cls: 'k-lord' },
    khan:      { label: '可汗',      cls: 'k-khan' },
    chanyu:    { label: '单于',      cls: 'k-khan' },
    mansa:     { label: '曼萨',      cls: 'k-khan' },
    tlatoani:  { label: '特拉托阿尼', cls: 'k-khan' },
    inca:      { label: '印加王',    cls: 'k-khan' },
    zanpu:     { label: '赞普',      cls: 'k-khan' },
    regent:    { label: '摄政',      cls: 'k-regent' },
    zhuang:    { label: '追尊',      cls: 'k-zhuang' },
    pretender: { label: '僭伪',      cls: 'k-pretender' }
  };

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function sum(a) { var s = 0, i; for (i = 0; i < a.length; i++) s += a[i]; return s; }

  /* 综合分：八轴均值线性映射到 0–100（均值 5 → 50，10 → 100，0 → 0） */
  function composite(s) {
    return Math.round(clamp(50 + 10 * (sum(s) / 8 - 5), 0, 100) * 10) / 10;
  }

  /* 八边形顶点：-90° 起，顺时针每 45° */
  function axisAngle(i) { return -Math.PI / 2 + i * Math.PI / 4; }

  function pointAt(i, r, cx, cy) {
    var a = axisAngle(i);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  /* 返回 SVG polygon 的 points 字符串；scores 可超过 8 个则只取 8 */
  function polygon(scores, r, cx, cy, max) {
    max = max || 10;
    var pts = [], i, p;
    for (i = 0; i < 8; i++) {
      p = pointAt(i, r * clamp(scores[i], 0, max) / max, cx, cy);
      pts.push(p.x.toFixed(2) + ',' + p.y.toFixed(2));
    }
    return pts.join(' ');
  }

  function axisEnds(r, cx, cy) {
    var out = [], i, p;
    for (i = 0; i < 8; i++) out.push(pointAt(i, r, cx, cy));
    return out;
  }

  function rings(levels, r, cx, cy) {
    var out = [], li, i, p, pts;
    for (li = 0; li < levels.length; li++) {
      pts = [];
      for (i = 0; i < 8; i++) {
        p = pointAt(i, r * levels[li], cx, cy);
        pts.push(p.x.toFixed(2) + ',' + p.y.toFixed(2));
      }
      out.push({ level: levels[li], points: pts.join(' ') });
    }
    return out;
  }

  function fmtYear(y) {
    if (y === null || y === undefined || y === '') return '—';
    var n = Number(y);
    if (!isFinite(n)) return '—';
    return n < 0 ? '前' + Math.abs(n) : '' + n;
  }

  function reign(r) {
    if (r.start == null && r.end == null) return '年代不详';
    return fmtYear(r.start) + '—' + fmtYear(r.end);
  }

  function span(r) {
    if (r.start == null || r.end == null) return 0;
    return Math.max(1, r.end - r.start + 1);
  }

  /* 过滤：卷 / 政权 / 关键词 / 类型 / 分数区间 */
  function filter(list, o) {
    o = o || {};
    var q = (o.q || '').trim().toLowerCase();
    return list.filter(function (r) {
      if (o.vol && r.vol !== o.vol) return false;
      if (o.regime && r.regime !== o.regime) return false;
      if (o.kinds && o.kinds.length && o.kinds.indexOf(r.kind) < 0) return false;
      if (o.dim && o.min != null && r.s[DIMS.findIndex(function (d) { return d.k === o.dim; })] < o.min) return false;
      if (o.dim && o.max != null && r.s[DIMS.findIndex(function (d) { return d.k === o.dim; })] > o.max) return false;
      if (q) {
        var hay = [r.title, r.name, r.regimeName, r.volName, (r.tags || []).join(''), r.note].join(' ');
        if (hay.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function sortBy(list, key, desc) {
    var arr = list.slice();
    var idx = -1;
    if (key && key.charAt(0) === 'd') idx = DIMS.findIndex(function (d) { return d.k === key.slice(2); });
    arr.sort(function (a, b) {
      var va, vb;
      if (idx >= 0) { va = a.s[idx]; vb = b.s[idx]; }
      else if (key === 'reign') { va = a.start == null ? 1e9 : a.start; vb = b.start == null ? 1e9 : b.start; }
      else { va = composite(a.s); vb = composite(b.s); }
      if (va === vb) return (a.title > b.title ? 1 : -1);
      return desc ? vb - va : va - vb;
    });
    return arr;
  }

  function topBy(list, k, n) {
    var idx = DIMS.findIndex(function (d) { return d.k === k; });
    return list.slice().sort(function (a, b) {
      var d = b.s[idx] - a.s[idx];
      return d !== 0 ? d : composite(b.s) - composite(a.s);
    }).slice(0, n || 20);
  }

  function avgScores(list) {
    var out = [], i, n = list.length || 1, j;
    for (i = 0; i < 8; i++) {
      var s = 0;
      for (j = 0; j < list.length; j++) s += list[j].s[i];
      out.push(Math.round(s / n * 10) / 10);
    }
    return out;
  }

  function diff(a, b) {
    var out = [], i;
    for (i = 0; i < 8; i++) out.push({ dim: DIMS[i], a: a.s[i], b: b.s[i], d: a.s[i] - b.s[i] });
    return out;
  }

  /* 数据完整性校验，给 test.mjs 用 */
  function validate(rulers, regimes, vols) {
    var errs = [];
    var ids = {}, seen = {};
    var regMap = {}, volMap = {};
    (regimes || []).forEach(function (g) { regMap[g.code] = g; });
    (vols || []).forEach(function (v) { volMap[v.code] = v; });

    rulers.forEach(function (r, i) {
      var tag = '#' + i + ' ' + (r.title || '?');
      if (!r.id) errs.push(tag + ' 缺 id');
      else if (ids[r.id]) errs.push(tag + ' id 重复：' + r.id);
      ids[r.id] = 1;
      if (!r.title) errs.push(tag + ' 缺 title');
      if (!regMap[r.regime]) errs.push(tag + ' 未知政权：' + r.regime);
      if (!volMap[r.vol]) errs.push(tag + ' 未知卷：' + r.vol);
      if (!Array.isArray(r.s) || r.s.length !== 8) errs.push(tag + ' 分数必须 8 个');
      else r.s.forEach(function (v, k) {
        if (!Number.isInteger(v) || v < 0 || v > 10) errs.push(tag + ' 第' + (k + 1) + '维分数非法：' + v);
      });
      if (!KINDS[r.kind]) errs.push(tag + ' 未知类型：' + r.kind);
      if (!r.note) errs.push(tag + ' 缺总评');
      if (r.start != null && r.end != null && r.start > r.end) errs.push(tag + ' 在位年份倒置');
      if (r.note && r.note.length > 46) errs.push(tag + ' 总评过长（' + r.note.length + '）');
      if (r.conf != null && [1, 2, 3].indexOf(r.conf) < 0) errs.push(tag + ' conf 非法');
      // 同名只允许出现在不同政权（欧洲重名普遍，如 查理、路易、腓特烈）
      // 中国部分有「吐蕃赞普」这类共用名号、以名区分的情况，故按「名号+名」判重
      var key = (r.regime || '') + '|' + (r.title || '') + '|' + (r.name || '');
      if (r.title && seen[key]) errs.push(tag + ' 同政权内重名：' + r.title);
      seen[key] = 1;
    });

    // 每个政权都得有人
    (regimes || []).forEach(function (g) {
      var n = rulers.filter(function (r) { return r.regime === g.code; }).length;
      if (n === 0) errs.push('政权「' + g.name + '」下没有统治者');
    });
    return errs;
  }

  var API = {
    DIMS: DIMS,
    KINDS: KINDS,
    composite: composite,
    polygon: polygon,
    axisEnds: axisEnds,
    rings: rings,
    pointAt: pointAt,
    axisAngle: axisAngle,
    fmtYear: fmtYear,
    reign: reign,
    span: span,
    filter: filter,
    sortBy: sortBy,
    topBy: topBy,
    avgScores: avgScores,
    diff: diff,
    validate: validate,
    clamp: clamp
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.HistCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
