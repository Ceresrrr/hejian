/**
 * 合鉴 · 真实渲染截图（需要本机装有 Chrome 或 Edge）
 *
 *   node shots.mjs
 *
 * 用 CDP 打开 index.html，跑到指定状态再截图，存进 preview/。
 * 没装浏览器也不影响 index.html 本身。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, 'preview');
const PORT = 9341;
const W = 1500, H = 1120;

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];
const BROWSER = CANDIDATES.find((p) => fs.existsSync(p));
if (!BROWSER) {
  console.error('没找到 Chrome / Edge，跳过截图。');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const openCard = (title) => `
  [...document.querySelectorAll('.card')].find(c => c.querySelector('.nm .t').textContent.trim() === '${title}').click();
`;

const SHOTS = [
  {
    file: 'browse.png',
    note: '分卷：中国（全卷）',
    before: `document.querySelector('[data-vol="cn"]').click();`
  },
  {
    file: 'browse-eu.png',
    note: '分卷：欧洲 · 法兰克与神圣罗马',
    before: `document.querySelector('[data-vol="eu"]').click();`
  },
  {
    file: 'filter.png',
    note: '分卷：欧洲 · 都铎王朝',
    before: `document.querySelector('[data-vol="eu"]').click();document.querySelector('[data-rg="eng-tudor"]').click();`
  },
  {
    file: 'detail.png',
    note: '人物档案：唐太宗',
    before: `document.querySelector('[data-vol="cn"]').click();${openCard('唐太宗')}`
  },
  {
    file: 'detail-eu.png',
    note: '人物档案：腓特烈二世（普鲁士）',
    before: `document.querySelector('[data-vol="eu"]').click();${openCard('腓特烈二世（普）')}`
  },
  {
    file: 'compare.png',
    note: '跨文明对比：唐太宗 vs 腓特烈二世',
    before: `document.querySelector('[data-tab="compare"]').click();`
  },
  {
    file: 'browse-jp.png',
    note: '分卷：日本 · 战国',
    before: `document.querySelector('[data-vol="jp"]').click();document.querySelector('[data-rg="jap-sengoku"]').click();`
  },
  {
    file: 'detail-jp.png',
    note: '人物档案：织田信长',
    before: `document.querySelector('[data-vol="jp"]').click();${openCard('织田信长')}`
  },
  {
    file: 'detail-eg.png',
    note: '人物档案：拉美西斯二世',
    before: `document.querySelector('[data-vol="eg"]').click();${openCard('拉美西斯二世')}`
  },
  {
    file: 'compare-civ.png',
    note: '跨文明对比：唐太宗 vs 阿克巴',
    before: `(() => {
      document.querySelector('[data-tab="compare"]').click();
      const sel = document.querySelector('#selB');
      const opt = [...sel.options].find(o => o.textContent.startsWith('阿克巴'));
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change'));
    })();`
  },
  {
    file: 'compare-pick.png',
    note: '对比：卷 › 王朝 › 君主 三级选择器',
    before: `(() => {
      document.querySelector('[data-tab="compare"]').click();
      document.querySelectorAll('.pk-btn')[0].click();
      document.querySelectorAll('[data-col="vol"] .pk-item')[2].click();
      document.querySelectorAll('[data-col="reg"] .pk-item')[1].click();
    })();`
  },
  {
    file: 'rank.png',
    note: '榜单：武功最高二十人',
    before: `
      document.querySelector('[data-tab="rank"]').click();
      [...document.querySelectorAll('#rankDims .chip')].find(c => c.textContent === '武功').click();
    `
  },
  {
    file: 'timeline.png',
    note: '纪年：前 3500—1930 卷与王朝条带',
    before: `document.querySelector('[data-tab="timeline"]').click();`,
    tall: true
  },
  {
    file: 'rubric.png',
    note: '标准页：维度表与锚点',
    before: `document.querySelector('[data-tab="rubric"]').click();`
  },
  {
    file: 'rubric2.png',
    note: '标准页下段：锚点表与边界',
    before: `document.querySelector('[data-tab="rubric"]').click();
      setTimeout(() => window.scrollTo(0, 1010), 200);`
  },
  {
    file: 'search.png',
    note: '搜索：关键词「哈布斯堡」',
    before: `(() => {
      const q = document.querySelector('#q');
      q.value = '哈布斯堡';
      q.dispatchEvent(new Event('input', { bubbles: true }));
    })();`
  },
  {
    file: 'narrow.png',
    note: '窄屏（820px）',
    before: `document.querySelector('[data-vol="cn"]').click();`,
    metrics: { width: 820, height: 1500, deviceScaleFactor: 1, mobile: false }
  }
];

async function shoot(s) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dj-shot-'));
  const url = 'file:///' + path.join(DIR, 'index.html').replace(/\\/g, '/');
  const chrome = spawn(BROWSER, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`, `--window-size=${W},${H}`,
    '--force-device-scale-factor=1', url
  ], { stdio: 'ignore' });

  try {
    let page = null;
    for (let i = 0; i < 80 && !page; i++) {
      await sleep(250);
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
        page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      } catch { /* 还没起来 */ }
    }
    if (!page) throw new Error('连不上浏览器调试端口');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    });
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    const send = (method, params) => new Promise((res) => {
      const mid = ++id;
      pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

    const evalJS = async (code) => send('Runtime.evaluate', { expression: code, awaitPromise: true });

    await sleep(800);
    if (s.metrics) {
      await send('Emulation.setDeviceMetricsOverride', s.metrics);
      await sleep(500);
    }
    if (s.before) { await evalJS(s.before); }
    await sleep(600);

    const r = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: !!s.tall, fromSurface: true
    });
    const out = path.join(OUT, s.file);
    fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
    console.log('  ✓', s.file, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
    ws.close();
  } finally {
    chrome.kill();
    await sleep(300);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[2];
for (const s of SHOTS) {
  if (ONLY && s.file !== ONLY) continue;
  console.log('·', s.note);
  await shoot(s);
}
console.log('\n完成，图片在 preview/');
