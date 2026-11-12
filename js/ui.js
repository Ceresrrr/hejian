/* ============================================================
 * 合鉴 · 界面
 * 无框架、无依赖：字符串拼 HTML，事件委托收口
 * ============================================================ */
(function () {
  'use strict';

  var D = window.HIST;
  var C = window.HistCore;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  /* 卷色：按卷序用黄金角取色相，饱和度与明度压在同一档，卷再多也不会撞色 */
  var VOL_INDEX = {};
  D.volumes.forEach(function (v, i) { VOL_INDEX[v.code] = i; });

  function hsl2hex(h, s, l) {
    function f(n) {
      var k = (n + h / 30) % 12;
      var a = s * Math.min(l, 1 - l);
      var c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255).toString(16).padStart(2, '0');
    }
    return '#' + f(0) + f(8) + f(4);
  }

  function volColor(code) {
    var i = VOL_INDEX[code] == null ? 0 : VOL_INDEX[code];
    return hsl2hex((i * 137.508) % 360, 0.26, i % 2 ? 0.66 : 0.61);
  }

  var state = {
    tab: 'browse',
    vol: null,
    regime: null,
    kind: null,
    q: '',
    rankDim: 'all',
    rankBottom: false,
    a: null,
    b: null,
    showMean: true,
    openId: null
  };

  /* ---------- 小工具 ---------- */
  function mix(a, b, t) {
    var pa = [1, 3, 5].map(function (i) { return parseInt(a.slice(i, i + 2), 16); });
    var pb = [1, 3, 5].map(function (i) { return parseInt(b.slice(i, i + 2), 16); });
    var o = pa.map(function (v, i) { return Math.round(v + (pb[i] - v) * t); });
    return '#' + o.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  function colorFor(v) {
    if (v <= 50) return mix('#8f3520', '#4b463c', Math.max(0, v) / 50);
    return mix('#4b463c', '#d9b667', Math.min(1, (v - 50) / 50));
  }

  function byId(id) {
    for (var i = 0; i < D.rulers.length; i++) if (D.rulers[i].id === id) return D.rulers[i];
    return null;
  }

  function regimeOf(r) {
    for (var i = 0; i < D.regimes.length; i++) if (D.regimes[i].code === r.regime) return D.regimes[i];
    return { name: r.regime, code: r.regime };
  }


  /* ---------- 雷达 ---------- */
  function radar(o) {
    var w = o.w || 560, h = o.h || 520;
    var cx = o.cx != null ? o.cx : w / 2;
    var cy = o.cy != null ? o.cy : h / 2 + 4;
    var r = o.r || Math.min(w, h) / 2 - 48;
    var out = [];
    var ringLv = [0.25, 0.5, 0.75, 1];

    out.push('<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="display:block;overflow:visible">');

    // 网格
    ringLv.forEach(function (lv) {
      out.push('<polygon points="' + C.polygon([10, 10, 10, 10, 10, 10, 10, 10], r * lv, cx, cy) +
        '" fill="none" stroke="rgba(233,225,206,' + (lv === 1 ? 0.16 : 0.07) + ')" stroke-width="1"/>');
    });
    C.axisEnds(r, cx, cy).forEach(function (p) {
      out.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) +
        '" stroke="rgba(233,225,206,.08)" stroke-width="1"/>');
    });

    // 标签
    if (o.labels !== false) {
      C.DIMS.forEach(function (d, i) {
        var p = C.pointAt(i, r + 25, cx, cy);
        var cos = Math.cos(C.axisAngle(i));
        var anchor = Math.abs(cos) < 0.25 ? 'middle' : (cos > 0 ? 'start' : 'end');
        out.push('<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" text-anchor="' + anchor +
          '" dominant-baseline="middle" font-size="' + (o.labelSize || 13) +
          '" fill="' + (d.dir < 0 ? '#b08a80' : '#a29882') + '" font-family="Noto Serif SC,Songti SC,serif" letter-spacing="1">' +
          d.label + '</text>');
      });
    }

    // 均值
    if (o.mean) {
      out.push('<polygon points="' + C.polygon(o.mean, r, cx, cy) +
        '" fill="none" stroke="' + (o.meanColor || 'rgba(233,225,206,.42)') +
        '" stroke-width="' + (o.meanWidth || 1.3) + '" stroke-dasharray="' + (o.meanDash || '4 4') + '" stroke-linejoin="round"/>');
    }

    // 主体
    out.push('<polygon points="' + C.polygon(o.scores, r, cx, cy) +
      '" fill="' + o.color + '" fill-opacity="' + (o.fill == null ? 0.17 : o.fill) +
      '" stroke="' + o.color + '" stroke-width="' + (o.strokeWidth || 2) + '" stroke-linejoin="round"/>');

    // 顶点
    for (var i = 0; i < 8; i++) {
      var p2 = C.pointAt(i, r * C.clamp(o.scores[i], 0, 10) / 10, cx, cy);
      out.push('<circle cx="' + p2.x.toFixed(1) + '" cy="' + p2.y.toFixed(1) + '" r="' +
        (o.dot || 2.8) + '" fill="' + o.color + '"/>');
    }

    out.push('</svg>');
    return out.join('');
  }

  function miniRadar(s, size, color) {
    size = size || 74;
    var cx = size / 2, cy = size / 2, r = size / 2 - 7;
    return '<svg class="mini" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<polygon points="' + C.polygon([10, 10, 10, 10, 10, 10, 10, 10], r, cx, cy) +
      '" fill="none" stroke="rgba(233,225,206,.1)"/>' +
      '<polygon points="' + C.polygon(s, r, cx, cy) + '" fill="' + color + '" fill-opacity=".18" stroke="' + color +
      '" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  }

  /* ---------- 分卷 ---------- */
  function renderVols() {
    var out = [];
    D.volumes.forEach(function (v, i) {
      var n = D.rulers.filter(function (r) { return r.vol === v.code; }).length;
      var prev = i ? D.volumes[i - 1].civil : null;
      if ((i === 0 || v.civil !== prev) && v.name !== v.civil) {
        out.push('<div class="vol-grp">' + esc(v.civil || '其他') + '</div>');
      }
      out.push('<button class="vol' + (state.vol === v.code && !state.q ? ' on' : '') + '" data-vol="' + v.code + '">' +
        '<b>' + esc(v.name) + '</b><small>' + n + '</small></button>');
    });
    $('#vols').innerHTML = out.join('');
  }

  function renderRegimes() {
    var list = D.regimes.filter(function (g) { return g.vol === state.vol; });
    var html = '<button class="rg' + (!state.regime ? ' on' : '') + '" data-rg="">全部</button>' +
      list.map(function (g) {
        var n = D.rulers.filter(function (r) { return r.regime === g.code; }).length;
        return '<button class="rg' + (state.regime === g.code ? ' on' : '') + '" data-rg="' + g.code + '">' +
          esc(g.name) + '<i>' + n + '</i></button>';
      }).join('');
    $('#regimes').innerHTML = html;
    $('#regimes').style.display = state.q ? 'none' : '';
  }

  function cardHTML(r) {
    var comp = C.composite(r.s);
    var col = colorFor(comp);
    return '<div class="card" data-id="' + r.id + '">' +
      miniRadar(r.s, 74, col) +
      '<div class="meta">' +
        '<div class="nm"><span class="t" title="' + esc(r.title + ' · ' + (r.name || '')) + '">' + esc(r.title) + '</span></div>' +
        '<div class="yr"><span class="dyn">' + esc(r.regimeName) + '</span>' +
          '<span class="yy">' + esc(C.reign(r)) + '</span></div>' +
        '<div class="tg">' + (r.tags || []).slice(0, 2).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
      '</div>' +
      '<div class="sc" style="color:' + colorFor(comp) + '">' + comp.toFixed(0) + '</div>' +
    '</div>';
  }

  function renderCards() {
    var list;
    if (state.q) {
      list = C.filter(D.rulers, { q: state.q });
    } else {
      list = C.filter(D.rulers, {
        vol: state.vol, regime: state.regime,
        kinds: state.kind ? [state.kind] : null
      });
    }
    $('#cards').innerHTML = list.map(cardHTML).join('') ||
      '<p style="color:#6f6757">没有匹配的统治者，换个关键词试试。</p>';
    var rg = state.regime ? D.regimes.filter(function (g) { return g.code === state.regime; })[0] : null;
    var kd = state.kind ? (C.KINDS[state.kind] || {}).label : '';
    $('#hintline').textContent = list.length + ' 位' +
      (state.q ? ' · 全库搜索「' + state.q + '」' : (rg ? ' · ' + rg.name : '') + (kd ? ' · ' + kd : ''));
  }

  function renderKinds() {
    if (state.q) { $('#kinds').style.display = 'none'; return; }
    $('#kinds').style.display = '';
    var pool = D.rulers.filter(function (r) {
      return (!state.vol || r.vol === state.vol) && (!state.regime || r.regime === state.regime);
    });
    var n = {};
    pool.forEach(function (r) { n[r.kind] = (n[r.kind] || 0) + 1; });
    if (state.kind && !n[state.kind]) state.kind = null;
    var html = '<span class="k-lab">类型</span>' +
      '<button class="rg' + (!state.kind ? ' on' : '') + '" data-kind="">全部</button>' +
      Object.keys(C.KINDS).filter(function (k) { return n[k]; }).map(function (k) {
        return '<button class="rg' + (state.kind === k ? ' on' : '') + '" data-kind="' + k + '">' +
          esc(C.KINDS[k].label) + '<i>' + n[k] + '</i></button>';
      }).join('');
    $('#kinds').innerHTML = html;
  }

  /* ---------- 人物档案 ---------- */
  function openDetail(id) {
    var r = byId(id);
    if (!r) return;
    state.openId = id;
    var g = regimeOf(r);
    var mean = C.avgScores(D.rulers.filter(function (x) { return x.regime === r.regime; }));
    var comp = C.composite(r.s);
    var kd = C.KINDS[r.kind] || { label: r.kind, cls: '' };

    var bars = C.DIMS.map(function (d, i) {
      var v = r.s[i];
      return '<div class="sc-row"><span class="lb">' + d.label + '</span>' +
        '<div class="bar"><i style="width:' + (v * 10) + '%"></i></div>' +
        '<span class="v">' + v + '</span></div>';
    }).join('');

    var confTxt = r.conf === 1 ? '史料稀薄' : r.conf === 2 ? '记载简略' : '';

    var html =
      '<div class="m-head">' +
        '<div>' +
          '<h2>' + esc(r.title) + '<span class="kd ' + kd.cls + '">' + kd.label + '</span></h2>' +
          '<div class="sub">' + esc(g.name) + ' · ' + esc(C.reign(r)) +
            (r.name ? ' · ' + esc(r.name) : '') +
            ' · 综合 <b style="color:' + colorFor(comp) + '">' + comp.toFixed(1) + '</b>' +
            (confTxt ? ' · <span style="color:#8a7f6b">' + confTxt + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<button class="m-close" data-close>×</button>' +
      '</div>' +
      '<div class="m-body">' +
        '<div class="m-radar">' +
          radar({ scores: r.s, w: 380, h: 360, r: 140, cx: 190, cy: 184, color: '#c9a24a', mean: mean,
        meanColor: 'rgba(201,162,74,.62)', labelSize: 12.5 }) +
          '<div class="legend"><span><i class="sw" style="background:#c9a24a"></i>本人</span>' +
            '<span style="color:#b99a5c"><i style="display:inline-block;width:18px;height:0;border-top:1.4px dashed #c9a24a;vertical-align:middle;margin:0 6px 2px 0"></i>' +
            '同『' + esc(g.name) + '』均值</span></div>' +
        '</div>' +
        '<div class="m-scores">' + bars + '</div>' +
      '</div>' +
      '<div class="m-text">' +
        '<p class="m-note">' + esc(r.note) + '</p>' +
        (r.long ? '<p class="m-long">' + esc(r.long) + '</p>' : '') +
        (r.quote ? '<blockquote class="m-quote">' + esc(r.quote.t) +
          '<small>' + esc(r.quote.src || '') + '</small></blockquote>' : '') +
        '<div class="m-tags">' + (r.tags || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="m-actions">' +
          '<button class="ghost" data-set="a" data-id="' + r.id + '">设为对比 · 甲</button>' +
          '<button class="ghost" data-set="b" data-id="' + r.id + '">设为对比 · 乙</button>' +
          '<button class="ghost" data-close>关闭</button>' +
        '</div>' +
      '</div>';

    $('#modalPanel').innerHTML = html;
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('#modal').hidden = true;
    document.body.style.overflow = '';
    state.openId = null;
  }

  /* ---------- 对比 ---------- */
  function fillSelects() {
    var byReg = {};
    D.rulers.forEach(function (r) { (byReg[r.regime] = byReg[r.regime] || []).push(r); });
    var html = '';
    D.regimes.forEach(function (g) {
      var list = byReg[g.code];
      if (!list || !list.length) return;
      html += '<optgroup label="' + esc(g.name) + '">';
      list.forEach(function (r) {
        html += '<option value="' + r.id + '">' + esc(r.title) + '　' + esc(C.reign(r)) + '</option>';
      });
      html += '</optgroup>';
    });
    $('#selA').innerHTML = html;
    $('#selB').innerHTML = html;
  }

  function renderCompare() {
    PICKERS.forEach(function (p) { p.refresh(); });
    var a = byId(state.a), b = byId(state.b);
    if (!a || !b) return;
    var ma = C.avgScores(D.rulers.filter(function (x) { return x.regime === a.regime; }));
    var mb = C.avgScores(D.rulers.filter(function (x) { return x.regime === b.regime; }));
    var showMean = state.showMean;

    var chart = radar({
      scores: a.s, w: 620, h: 580, r: 210, cx: 310, cy: 292,
      color: '#d8b45a', fill: 0.16, mean: showMean ? ma : null,
      meanColor: 'rgba(216,180,90,.85)', meanWidth: 1.5, meanDash: '6 4',
      dot: 3.2, strokeWidth: 2.2
    }).replace('</svg>',
      radar({
        scores: b.s, w: 620, h: 580, r: 210, cx: 310, cy: 292,
        color: '#d2543c', fill: 0.14, mean: showMean && b.regime !== a.regime ? mb : null,
        meanColor: 'rgba(210,84,60,.85)', meanWidth: 1.5, meanDash: '2 3',
        dot: 3.2, strokeWidth: 2.2, labels: false
      }).replace('<svg', '<svg style="position:absolute;inset:0"')
    );

    var legend = '<div class="legend">' +
      '<span><i class="sw" style="background:#d8b45a"></i><b>' + esc(a.title) + '</b> ' + esc(regimeOf(a).name) + '</span>' +
      '<span><i class="sw" style="background:#d2543c"></i><b>' + esc(b.title) + '</b> ' + esc(regimeOf(b).name) + '</span>' +
      (showMean
        ? (a.regime === b.regime
            ? '<span style="color:#c9a24a"><i style="display:inline-block;width:20px;height:0;border-top:1.5px dashed #d8b45a;vertical-align:middle;margin-right:6px"></i>同『' + esc(regimeOf(a).name) + '』均值（甲乙同朝）</span>'
            : '<span style="color:#c9a24a"><i style="display:inline-block;width:20px;height:0;border-top:1.5px dashed #d8b45a;vertical-align:middle;margin-right:6px"></i>甲『' + esc(regimeOf(a).name) + '』均值</span>' +
              '<span style="color:#d2543c"><i style="display:inline-block;width:20px;height:0;border-top:1.5px dashed #d2543c;vertical-align:middle;margin-right:6px"></i>乙『' + esc(regimeOf(b).name) + '』均值</span>')
        : '') +
      '</div>';

    $('#cmpChart').innerHTML = '<div style="position:relative;max-width:700px;margin:0 auto">' + chart + '</div>' + legend;

    var rows = C.diff(a, b).map(function (d) {
      var w = Math.abs(d.d) / 10 * 50;
      var left = d.d >= 0 ? 50 : 50 - w;
      var col = d.d > 0 ? '#d8b45a' : d.d < 0 ? '#d2543c' : 'transparent';
      return '<tr>' +
        '<td>' + d.dim.label + '</td>' +
        '<td style="text-align:right">' + d.a + '</td>' +
        '<td style="text-align:right">' + d.b + '</td>' +
        '<td class="d ' + (d.d > 0 ? 'dpos' : d.d < 0 ? 'dneg' : '') + '">' + (d.d > 0 ? '+' : '') + d.d + '</td>' +
        '</tr>' +
        '<tr><td colspan="4" style="padding:0 6px 8px;border:0">' +
          '<div class="dbar"><i style="left:' + left + '%;width:' + w + '%;background:' + col + '"></i>' +
          '<span class="mid"></span></div>' +
        '</td></tr>';
    }).join('');

    var ca = C.composite(a.s), cb = C.composite(b.s);
    $('#cmpTable').innerHTML =
      '<table class="difftab"><thead><tr><th>维度</th><th style="text-align:right">' + esc(a.title) +
      '</th><th style="text-align:right">' + esc(b.title) + '</th><th style="text-align:right">甲 − 乙</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div style="display:flex;gap:18px;font-size:13px;color:#a29882;padding:10px 6px 0">' +
        '<span>甲 <b style="color:' + colorFor(ca) + '">' + ca.toFixed(1) + '</b></span>' +
        '<span>乙 <b style="color:' + colorFor(cb) + '">' + cb.toFixed(1) + '</b></span>' +
        '<span style="margin-left:auto">差 ' + (ca - cb > 0 ? '+' : '') + (ca - cb).toFixed(1) + '</span>' +
      '</div>' +
      noteBlock(a, '#d8b45a') + noteBlock(b, '#d2543c') +
      '<p style="font-size:11.5px;color:#6f6757;padding:6px 6px 0;line-height:1.7">' +
        '八轴同向，差值一律「甲 − 乙」：正数即甲强，负数即乙强。</p>';
  }

  function noteBlock(r, col) {
    if (!r.note) return '';
    return '<div class="cmp-note"><i class="sw" style="background:' + col + '"></i>' +
      '<b>' + esc(r.title) + '</b>' + esc(r.note) +
      (r.long ? '<span class="more">档案中有长评</span>' : '') + '</div>';
  }

  /* ---------- 对比：甲乙分级选择器 ---------- */
  var PICKERS = [];
  function mountPicker(sel) {
    if (!sel || sel.__pk) return;
    var wrap = document.createElement('div');
    wrap.className = 'pk';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pk-btn';
    var panel = document.createElement('div');
    panel.className = 'pk-panel';
    panel.hidden = true;
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(btn);
    wrap.appendChild(panel);
    wrap.appendChild(sel);
    sel.style.display = 'none';

    var st = { vol: null, regime: null };
    var pk = { sel: sel, panel: panel, st: st };
    pk.refresh = function () {
      var r = byId(sel.value);
      if (!r) { btn.textContent = '—'; return; }
      btn.innerHTML = '<span class="pk-t">' + esc(r.title) + '</span><span class="pk-s">' +
        esc(r.regimeName) + ' · ' + esc(C.reign(r)) + '</span>';
    };
    PICKERS.push(pk);
    sel.__pk = pk;
    pk.refresh();

    function item(r) {
      return '<div class="pk-item' + (sel.value === r.id ? ' on' : '') + '" data-id="' + r.id + '">' +
        '<span>' + esc(r.title) + '</span><small>' + esc(C.reign(r)) + '</small></div>';
    }

    function render() {
      var q = panel.querySelector('.pk-q').value.trim();
      var cols = panel.querySelector('.pk-cols');
      var res = panel.querySelector('.pk-res');
      if (q) {
        cols.hidden = true;
        res.hidden = false;
        var hit = C.filter(D.rulers, { q: q }).slice(0, 90);
        res.innerHTML = hit.length ? hit.map(item).join('') : '<div class="pk-empty">没有匹配的名字</div>';
        return;
      }
      cols.hidden = false;
      res.hidden = true;
      cols.querySelector('[data-col="vol"]').innerHTML = D.volumes.map(function (v) {
        var n = D.rulers.filter(function (r) { return r.vol === v.code; }).length;
        return '<div class="pk-item' + (st.vol === v.code ? ' on' : '') + '" data-vol="' + v.code + '">' +
          '<span>' + esc(v.name) + '</span><small>' + n + '</small></div>';
      }).join('');
      var rs = st.vol ? D.regimes.filter(function (g) { return g.vol === st.vol; }) : [];
      cols.querySelector('[data-col="reg"]').innerHTML = st.vol
        ? rs.map(function (g) {
            var n = D.rulers.filter(function (r) { return r.regime === g.code; }).length;
            return '<div class="pk-item' + (st.regime === g.code ? ' on' : '') + '" data-rg="' + g.code + '">' +
              '<span>' + esc(g.name) + '</span><small>' + n + '</small></div>';
          }).join('')
        : '<div class="pk-hint">先选一卷</div>';
      var lst = st.regime ? D.rulers.filter(function (r) { return r.regime === st.regime; }) : [];
      lst.sort(function (a, b) { return a.start - b.start; });
      cols.querySelector('[data-col="who"]').innerHTML = st.regime
        ? (lst.length ? lst.map(item).join('') : '<div class="pk-empty">此朝暂无收录</div>')
        : '<div class="pk-hint">再选一朝</div>';
    }

    function open() {
      PICKERS.forEach(function (p) { if (p !== pk) p.panel.hidden = true; });
      panel.hidden = false;
      var r = byId(sel.value);
      st.vol = r ? r.vol : null;
      st.regime = r ? r.regime : null;
      panel.querySelector('.pk-q').value = '';
      render();
    }

    function pick(id) {
      sel.value = id;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      panel.hidden = true;
      pk.refresh();
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.hidden) open(); else panel.hidden = true;
    });

    var host = wrap.parentNode;
    if (host && host.classList && host.classList.contains('pick')) {
      host.addEventListener('click', function (e) {
        if (e.target.closest('.pk')) return;
        open();
      });
    }

    panel.innerHTML =
      '<div class="pk-head"><input class="pk-q" type="search" placeholder="搜名号、原文名、王朝…" spellcheck="false">' +
      '<span class="pk-tip">卷 › 王朝 › 君主</span></div>' +
      '<div class="pk-cols">' +
        '<div class="pk-col" data-col="vol"></div>' +
        '<div class="pk-col" data-col="reg"></div>' +
        '<div class="pk-col" data-col="who"></div>' +
      '</div>' +
      '<div class="pk-res" hidden></div>';

    panel.addEventListener('pointerdown', function (e) {
      var it = e.target.closest('.pk-item');
      if (it) e.preventDefault();
      if (!it) return;
      if (it.dataset.id) { pick(it.dataset.id); return; }
      if (it.dataset.vol) { st.vol = it.dataset.vol; st.regime = null; render(); return; }
      if (it.dataset.rg) { st.regime = it.dataset.rg; render(); return; }
    });

    panel.querySelector('.pk-q').addEventListener('input', render);

    document.addEventListener('click', function (e) {
      var hostEl = wrap.parentNode;
      var path = e.composedPath ? e.composedPath() : [e.target];
      if (path.indexOf(wrap) >= 0 || (hostEl && path.indexOf(hostEl) >= 0)) return;
      panel.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') panel.hidden = true;
    });
  }

  /* ---------- 榜单 ---------- */
  function renderRank() {
    var dims = C.DIMS.map(function (d) {
      return '<button class="chip' + (state.rankDim === d.k ? ' on' : '') +
        '" data-dim="' + d.k + '">' + d.label + '</button>';
    }).join('') +
      '<button class="chip' + (state.rankDim === 'all' ? ' on' : '') + '" data-dim="all">综合</button>' +
      '<button class="chip' + (state.rankDim === 'long' ? ' on' : '') + '" data-dim="long">在位最长</button>';

    $('#rankDims').innerHTML = dims;

    var list, title, unit;
    if (state.rankDim === 'all') {
      list = C.sortBy(D.rulers, 'comp', true);
      title = '综合评鉴 · 八轴均值';
      unit = '分';
    } else if (state.rankDim === 'long') {
      list = D.rulers.slice().sort(function (a, b) { return C.span(b) - C.span(a); });
      title = '在位年数 · 从长到短';
      unit = '年';
    } else {
      var d = C.DIMS.filter(function (x) { return x.k === state.rankDim; })[0];
      list = C.sortBy(D.rulers, 'd:' + state.rankDim, true);
      title = '「' + d.label + '」全榜 · ' + d.hint;
      unit = '分';
    }
    title += '（' + list.length + ' 位）';

    $('#rankHead').innerHTML = '<span>' + title + '</span><span>' + unit + '</span>';

    var rowHTML = function (r, i) {
      var val, pct, cls = '';
      if (state.rankDim === 'long') { val = C.span(r) + ''; pct = Math.min(100, C.span(r) / 60 * 100); }
      else if (state.rankDim === 'all') { val = C.composite(r.s).toFixed(1); pct = C.composite(r.s); }
      else {
        var idx = C.DIMS.map(function (x) { return x.k; }).indexOf(state.rankDim);
        val = r.s[idx] + ''; pct = r.s[idx] * 10;
      }
      return '<div class="rank-row' + (i === 0 ? ' top1' : '') + '" data-id="' + r.id + '">' +
        '<span class="no">' + (i + 1) + '</span>' +
        '<span><span class="nm">' + esc(r.title) + '</span> <span class="rg">' + esc(r.regimeName) + '</span></span>' +
        '<span style="font-size:11.5px;color:#6f6757">' + esc(C.reign(r)) + '</span>' +
        '<span class="barcell"><span class="bar' + cls + '"><i style="width:' + pct + '%"></i></span></span>' +
        '<span class="v">' + val + '</span>' +
      '</div>';
    };

    $('#rankList').innerHTML = list.map(rowHTML).join('');
  }

  /* ---------- 纪年 ---------- */
  function renderTimeline() {
    var minY = -3500, maxY = 1930;
    D.regimes.forEach(function (g) { if (g.start < minY) minY = g.start; });
    D.rulers.forEach(function (r) { if (r.end != null && r.end > maxY) maxY = r.end; });
    minY = Math.floor(minY / 500) * 500;
    maxY = Math.ceil(maxY / 100) * 100;
    var span = maxY - minY;
    var step = span > 4000 ? 500 : span > 2000 ? 250 : 200;

    var rowH = 32, gap = 12, top = 64, left = 150, right = 24;
    var W = 1520;
    var plotW = W - left - right;
    var x = function (y) { return left + (y - minY) / (maxY - minY) * plotW; };

    var rows = [];
    D.volumes.forEach(function (v) {
      var regs = D.regimes.filter(function (g) { return g.vol === v.code; })
        .sort(function (a, b) { return a.start - b.start; });
      rows.push({ v: v, regs: regs, y: 0 });
    });
    var y = top;
    rows.forEach(function (row, i) {
      if (i && rows[i - 1].v.civil !== row.v.civil) y += gap;
      row.y = y;
      y += rowH;
    });
    var H = y + 30;

    var svg = ['<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="min-width:1020px;display:block">'];

    for (var t = Math.ceil(minY / step) * step; t <= maxY; t += step) {
      var px = x(t);
      svg.push('<line x1="' + px.toFixed(1) + '" y1="' + (top - 8) + '" x2="' + px.toFixed(1) + '" y2="' + (H - 20) +
        '" stroke="rgba(233,225,206,.06)"/>');
      svg.push('<text x="' + px.toFixed(1) + '" y="' + (top - 14) + '" text-anchor="middle" font-size="10.5" fill="#6f6757">' +
        C.fmtYear(t) + '</text>');
    }
    svg.push('<line x1="' + x(1918).toFixed(1) + '" y1="' + (top - 8) + '" x2="' + x(1918).toFixed(1) + '" y2="' + (H - 20) +
      '" stroke="rgba(201,162,74,.22)" stroke-dasharray="3 4"/>');

    rows.forEach(function (row, i) {
      if (i && rows[i - 1].v.civil !== row.v.civil) {
        svg.push('<line x1="' + left + '" y1="' + (row.y - 9) + '" x2="' + (W - right) + '" y2="' + (row.y - 9) +
          '" stroke="rgba(233,225,206,.05)"/>');
        if (row.v.name !== row.v.civil) {
          svg.push('<text x="' + (left - 12) + '" y="' + (row.y - 3).toFixed(1) +
            '" text-anchor="end" font-size="11" letter-spacing="3" fill="#8a8172">' +
            esc(row.v.civil) + '</text>');
        }
      }
      if (i === 0 && row.v.name !== row.v.civil) {
        svg.push('<text x="' + (left - 12) + '" y="' + (row.y - 3).toFixed(1) +
          '" text-anchor="end" font-size="11" letter-spacing="3" fill="#8a8172">' +
          esc(row.v.civil) + '</text>');
      }
      svg.push('<text x="' + (left - 12) + '" y="' + (row.y + rowH - 7).toFixed(1) +
        '" text-anchor="end" font-size="12" fill="' + volColor(row.v.code) + '" font-family="Noto Serif SC,Songti SC,serif">' +
        esc(row.v.name) + '</text>');
      svg.push('<line x1="' + left + '" y1="' + (row.y + rowH - 5) + '" x2="' + (W - right) + '" y2="' + (row.y + rowH - 5) +
        '" stroke="rgba(233,225,206,.045)"/>');

      row.regs.forEach(function (g) {
        var rs = D.rulers.filter(function (r) { return r.regime === g.code; });
        if (!rs.length) return;
        var comp = C.composite(C.avgScores(rs));
        var x1 = x(g.start), x2 = Math.max(x1 + 2, Math.min(W - right, x(g.end + 1)));
        svg.push('<rect x="' + x1.toFixed(1) + '" y="' + (row.y + 3) + '" width="' + (x2 - x1).toFixed(1) +
          '" height="' + (rowH - 7) + '" rx="1.6" fill="' + colorFor(comp) + '" fill-opacity=".95" data-id="' + rs[0].id +
          '" style="cursor:pointer"><title>' + esc(g.name) + ' ' + esc(C.fmtYear(g.start)) + '—' + esc(C.fmtYear(g.end)) +
          ' · ' + rs.length + ' 位 · 综合均值 ' + comp.toFixed(0) + '</title></rect>');
      });
    });

    svg.push('</svg>');

    $('#tlNote').innerHTML = '竖看是卷，横看是年代；每卷一行，段是该卷的王朝 · 色由朱转金表示综合评鉴由低到高 · 点任一段看该朝第一位 · 金线 1918 为收录终点';
    $('#tl').innerHTML = svg.join('');
  }

  /* ---------- 标准页 ---------- */
  function renderRubric() {
    var dimRows = C.DIMS.map(function (d) {
      return '<tr><td>' + d.label + '</td>' +
        '<td>' + d.hint + '</td><td>越高越好</td></tr>';
    }).join('');

    $('#rubric').innerHTML =
      '<h2>这套分数是怎么来的</h2>' +
      '<p>八个维度，每维 0–10 分，整数。分数不是史料里的数字，是<em>读史之后的一个判断</em>——' +
      '所以它必然可争论，本页就是把这些争论的标尺摊开。</p>' +
      '<div class="note-box">本站把十二个文明放进同一套坐标：<b>中国 432 位、欧洲 516 位</b>，' +
      '加上日本、朝鲜、伊斯兰、波斯、印度、内亚、东南亚、埃及、美洲、非洲十个文明。' +
      '八根轴在所有文明上<em>同名同向</em>，只在释义上各按本文明改写——' +
      '所以「纳谏」在中国是对谏官、台谏与士论的容受，在欧洲是对议会、等级会议与请愿的容受，' +
      '在伊斯兰是对舒拉、迪万与乌里玛的容受。尺子同名，量的是同一种能力：' +
      '<b>坐在最高位置上，把事情办成，并且允许别人说话。</b>' +
      '有的文明这一轴扎实（中国、欧洲、伊斯兰、朝鲜），有的只能靠旁证（埃及、美洲、非洲）——' +
      '后者一律标「存疑」，分数趋中，不用它去拉高或拉低任何人的排名。</div>' +
      '<h2>收录范围</h2>' +
      '<p>共 <b>' + D.rulers.length + '</b> 位，分 ' + D.volumes.length + ' 卷、' + D.regimes.length + ' 个政权。' +
      '中国部分上起传说与考古之间的夏，下讫 1912 年清帝退位；欧洲上起 395 年东西分治，下讫 1918 年诸帝国崩溃；' +
      '日本自 660 年神武东征（存疑）与 592 年推古朝起，朝鲜自三国，伊斯兰自 632 年正统哈里发，波斯自阿契美尼德，' +
      '印度自孔雀，内亚自匈奴与突厥，东南亚、埃及、美洲、非洲各据其史料起点，一律下讫 1918–1924 年间的旧秩序终结。' +
      '凡在此前即位、实际在位者尽录，在位不足一年者亦录，未及亲政者标注。</p>' +
      '<p><b>一人只收一次。</b>中国部分：追尊者归其所追之朝，如曹操归曹魏、司马懿归西晋，不另立一行；' +
      '同时并立的政权（如三国、南北朝、宋辽金）各归其卷。欧洲部分：查理五世归神圣罗马一朝，腓力二世以下归西班牙；' +
      '詹姆斯六世兼英格兰，归英伦；丹麦王兼挪威、瑞典者归丹麦；同君者各归其主政之卷，余卷以注说明。' +
      '日本的天皇与武家两系并立，同一人若跨阶段（如源赖朝、德川家康）按阶段分记，名号相同而年份不重叠；' +
      '伊斯兰的奥斯曼苏丹、印度的莫卧儿诸帝、美洲与非洲的君主，均只在本文明出现一次。' +
      '1912、1918 年仍在位者按史实记完整在位年，纪年条到收录终点截断。</p>' +
      '<p>每位标注三档可信度：<b>高</b>——编年、文书、账簿充足；<b>中</b>——材料零散，或历代评价两歧；' +
      '<b>存疑</b>——多出传说与后世追述。' +
      '当前分布：高 ' + D.rulers.filter(function (r) { return r.conf === 3; }).length +
      ' · 中 ' + D.rulers.filter(function (r) { return r.conf === 2; }).length +
      ' · 存疑 ' + D.rulers.filter(function (r) { return r.conf === 1; }).length + '。</p>' +
      '<h2>八根轴</h2>' +
      '<table><thead><tr><th>维度</th><th>看什么</th><th>方向</th></tr></thead><tbody>' + dimRows + '</tbody></table>' +
      '<p>八根轴<em>同向</em>：一律越高越好，雷达面积就是「人望」。中间仍有一道分界——' +
      '<em>功业、治绩、民生、文教、武功</em>说的是「事办得怎么样」，' +
      '<em>用贤、纳谏、德行</em>说的是「这个人坐在最高位置上是什么样子」。' +
      '两类会打架，而且常常打架：汉武帝武功 10 而民生 3，路易十四功业 10 而民生 3，' +
      '唐太宗纳谏 9 而德行 6——这些参差正是雷达图存在的理由。</p>' +
      '<h2>锚点</h2>' +
      '<p>打分时对照下列极端，中间值按比例估。括号内是两侧的例证，只用来说明刻度，不代表全站评分。</p>' +
      '<table><thead><tr><th>维度</th><th>0–2</th><th>5</th><th>8–10</th></tr></thead><tbody>' +
      '<tr><td>功业</td><td>无尺寸之功，身死国乱（秦二世、路易十六）</td><td>守成，无所增益亦无所失（汉景帝、路易十八）</td><td>开疆定鼎、创制立法，国势为之改观（秦始皇、汉武帝、查理曼、拿破仑）</td></tr>' +
      '<tr><td>治绩</td><td>政令不出宫门，债主临门（隋炀帝末年、卡洛斯二世）</td><td>常调，能维持（宋仁宗、乔治三世）</td><td>仓廪实、法令行、吏称其职（汉宣帝、腓特烈·威廉一世、约瑟夫二世）</td></tr>' +
      '<tr><td>用贤</td><td>亲小人远贤臣、卖官鬻爵、诛戮功臣（汉灵帝、伊凡雷帝）</td><td>循资任用，偶有失察（唐玄宗晚年、路易十五）</td><td>名臣辈出而各得其任（唐太宗、伊丽莎白一世、腓特烈二世）</td></tr>' +
      '<tr><td>纳谏</td><td>拒谏饰非、言者获罪（秦始皇、隋炀帝、查理一世）</td><td>常规纳谏，异论而心不喜（汉武帝、乔治三世）</td><td>主动求言、容忍讥切、改过不吝（唐太宗、宋仁宗、阿尔弗雷德、约瑟夫二世）</td></tr>' +
      '<tr><td>德行</td><td>屠戮骨肉、背信弃义、荒淫无度（隋炀帝、伊凡雷帝）</td><td>中人，间有过失（汉景帝、乔治四世）</td><td>恭俭自持、守信、刑不滥及（汉文帝、宋仁宗、圣路易、阿尔弗雷德）</td></tr>' +
      '<tr><td>民生</td><td>赋役竭泽、大饥人相食、户口减半（隋炀帝末年、路易十四末年）</td><td>粗能自给，凶年有赈而不至流亡（明宣宗、维多利亚）</td><td>轻徭薄赋、仓廪充实、户口滋息（汉文帝、宋仁宗、约瑟夫二世）</td></tr>' +
      '<tr><td>文教</td><td>鄙野无文、禁锢学术（秦二世、早期墨洛温）</td><td>通文墨，循故事（汉景帝、乔治三世）</td><td>兴学校、修典籍、赞助艺术学术（汉武帝、唐太宗、腓特烈二世、路易十四、美第奇）</td></tr>' +
      '<tr><td>武功</td><td>屡战屡败，丧师失地，都城不保（宋徽宗、路易十六）</td><td>能守边，无大胜亦无大败（宋真宗、乔治二世）</td><td>扫平群雄、开疆数千里（秦始皇、汉武帝、唐太宗、查理曼、拿破仑、古斯塔夫二世）</td></tr>' +
      '</tbody></table>' +
      '<h2>综合分</h2>' +
      '<p>综合 = 50 + 10 ×（八维均值 − 5）。八轴均值 5 分即「平庸之主」得 50 分，' +
      '90 分以上是少数几个治世之君，20 分以下是幼帝、傀儡与亡国之君。' +
      '它只用于排序与上色，不能替代八个分维——把一个人压成一个数，本身就是一种失真。</p>' +
      '<h2>几条自觉的边界</h2>' +
      '<ul>' +
      '<li><b>史料不均，而且是两侧不均衡。</b>中国先秦的人物靠《史记》与金文追述，夏商一段几乎只有后世谱系；' +
      '欧洲上古靠普罗科匹厄斯、格雷戈里与萨迦，北欧的萨迦又掺着传说。材料少的，分数一律趋中，' +
      '并在档案里标注「史料稀薄」，不做过度解读。</li>' +
      '<li><b>幼帝与傀儡。</b>汉殇帝、爱德华五世、伊凡六世、拿破仑二世在位数月或终身未亲政，' +
      '其「功业」「治绩」不是零，而是<em>无从谈起</em>。本作仍给低分，但在总评里写清「未及亲政」，请读者自行打折。</li>' +
      '<li><b>共治与摄政。</b>威廉与玛丽、伊凡五世与彼得一世共治，各占一行，按实际主政年份记；' +
      '吕后、武则天、慈禧、奥尔加、伊琳娜这类以摄政或临朝身份实际统治者，标「摄政」，与正式在位的帝王分开。</li>' +
      '<li><b>正统与僭伪。</b>王莽的新、更始、南明、太平天国，与伪德米特里、简·格雷、詹姆斯党、卡洛斯派一并收录，' +
      '只标类型，不作道德判决。「僭伪」二字是史书的话，不是本作的话。</li>' +
      '<li><b>政治形式各不相同。</b>中国的皇帝是官僚制帝国的顶点；欧洲的君主是封建契约与等级会议里的一个节点；' +
      '哈里发是沙里亚的守护者而非立法者；日本天皇长期是象征，实际权力在摄关、院政与幕府；奥斯曼苏丹集军事、司法与宗教于一身；' +
      '阿兹特克与印加靠贡赋与神权，法老靠尼罗河的账簿与祭司。' +
      '神圣罗马皇帝由选帝侯选出，教皇国与威尼斯是选举君主制，都不入此表，只在相关条目里作注。' +
      '把十二个文明的制度放在同一张图上，天然对某些文明不利（如「纳谏」在无成文议会的文明里缺少制度载体），' +
      '评分时按各文明制度的上限去量，而不是按另一文明的制度去量。</li>' +
      '<li><b>时代标准。</b>以近代早期国家的治理能力为尺，不以现代民主、人权或民族国家倒推。' +
      '「纳谏」是对谏官、议会与请愿的容受，不是对反对党的容忍；「民生」看的是赋役与灾赈，不是福利国家。' +
      '若换一把尺，整张图都会变形。</li>' +
      '</ul>' +
      '<h2>一处私见</h2>' +
      '<p>把十二个文明的地图并排看了很久，最深的一个印象是：<em>中国的明君多半是自己挣来的，欧洲的明君多半是被制度逼出来的</em>；' +
      '而奥斯曼、莫卧儿、萨法维的明君多半是「一开始就很能打」，几代之后就被后宫、禁卫军与地方总督架空。' +
      '中国的好皇帝要在没有议会的条件下自我约束——纳谏靠的是个人修养与台谏制度那点可怜的独立性；' +
      '欧洲的国王被等级会议、选帝侯、城市特许状捆住手脚，不得不听人说话、不得不算账。' +
      '所以同是八分，含义并不完全一样：一边是「他能做到」，一边是「他不得不做到」。' +
      '这张图给了个人很大的权重，但它测的是「在这个位置上做得怎么样」，不是「这个人有多伟大」。</p>';
  }

  /* ---------- 标签切换 ---------- */
  function switchTab(name) {
    state.tab = name;
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === name);
    });
    document.querySelectorAll('.tab').forEach(function (s) {
      s.classList.toggle('on', s.id === 't-' + name);
    });
    if (name === 'compare') renderCompare();
    if (name === 'rank') renderRank();
    if (name === 'timeline') renderTimeline();
  }

  /* ---------- 事件 ---------- */
  function bind() {
    $('#tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (b) switchTab(b.dataset.tab);
    });

    $('#q').addEventListener('input', function (e) {
      state.q = e.target.value;
      state.regime = null;
      renderVols(); renderRegimes(); renderKinds(); renderCards();
      if (state.q) switchTab('browse');
    });

    $('#vols').addEventListener('click', function (e) {
      var b = e.target.closest('[data-vol]');
      if (!b) return;
      state.vol = b.dataset.vol; state.regime = null; state.q = ''; $('#q').value = '';
      renderVols(); renderRegimes(); renderKinds(); renderCards();
    });

    $('#regimes').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rg]');
      if (!b) return;
      state.regime = b.dataset.rg || null;
      renderRegimes(); renderKinds(); renderCards();
    });

    $('#kinds').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b) return;
      state.kind = b.dataset.kind || null;
      renderKinds(); renderCards();
    });

    $('#cards').addEventListener('click', function (e) {
      var c = e.target.closest('[data-id]');
      if (c) openDetail(c.dataset.id);
    });

    $('#modal').addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close')) { closeModal(); return; }
      var set = e.target.closest('[data-set]');
      if (set) {
        state[set.dataset.set] = set.dataset.id;
        $('#sel' + set.dataset.set.toUpperCase()).value = set.dataset.id;
        closeModal();
        switchTab('compare');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
    });

    $('#selA').addEventListener('change', function (e) { state.a = e.target.value; renderCompare(); });
    $('#selB').addEventListener('change', function (e) { state.b = e.target.value; renderCompare(); });
    $('#ckMean').addEventListener('change', function (e) { state.showMean = e.target.checked; renderCompare(); });
    $('#btnRandom').addEventListener('click', function () {
      var n = D.rulers.length;
      var i = Math.floor(Math.random() * n), j = Math.floor(Math.random() * n);
      if (j === i) j = (j + 1) % n;
      state.a = D.rulers[i].id; state.b = D.rulers[j].id;
      $('#selA').value = state.a; $('#selB').value = state.b;
      renderCompare();
    });

    $('#rankDims').addEventListener('click', function (e) {
      var b = e.target.closest('[data-dim]');
      if (!b) return;
      state.rankDim = b.dataset.dim;
      renderRank();
    });
    $('#rankList').addEventListener('click', function (e) {
      var row = e.target.closest('[data-id]');
      if (row) openDetail(row.dataset.id);
    });
    $('#tl').addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]');
      if (b) openDetail(b.dataset.id);
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    state.vol = D.volumes[0].code;
    fillSelects();

    var prefer = function (t, rg) {
      for (var i = 0; i < D.rulers.length; i++) {
        if (D.rulers[i].title === t && (!rg || D.rulers[i].regime === rg)) return D.rulers[i].id;
      }
      for (var j = 0; j < D.rulers.length; j++) if (D.rulers[j].title === t) return D.rulers[j].id;
      return null;
    };
    state.a = prefer('唐太宗', 'tang') || D.rulers[0].id;
    state.b = prefer('腓特烈二世（普）', 'deu-prussia') || prefer('腓特烈二世', 'deu-prussia') || D.rulers[1].id;
    $('#selA').value = state.a;
    $('#selB').value = state.b;

    mountPicker($('#selA')); mountPicker($('#selB'));
    renderVols(); renderRegimes(); renderKinds(); renderCards(); renderRank(); renderRubric();
    bind();
  }

  init();
})();
