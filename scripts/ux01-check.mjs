/**
 * UX-01 真实浏览器验收（headless Chrome + CDP，无新增依赖）：
 * 桌面 1440×900 与手机 390×844 双视口；真实指针点击主按钮；截图留证。
 * 运行：node scripts/ux01-check.mjs
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9222;
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--window-size=1440,900',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '/apexlab-ux01-profile',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome devtools not reachable');
}

const wsUrl = await getWsUrl();
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails?.exception?.description || msg.params));
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') consoleErrors.push('console.error: ' + msg.params.args.map((a) => a.value || a.description).join(' '));
};
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const waitFor = async (expression, timeout = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await evaluate(expression)) return true;
    await sleep(200);
  }
  throw new Error('timeout waiting: ' + expression);
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
};
const clickAt = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

await send('Page.enable');
await send('Runtime.enable');

const report = {};

// ---- desktop 1440x900 ----
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:5173/' });
await waitFor(`!![...document.querySelectorAll('button')].find(b => b.textContent.includes('开始第一次科研挑战'))`);
await sleep(600);
report.desktopHome = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('开始第一次科研挑战'));
  const r = b.getBoundingClientRect();
  const t = document.body.innerText;
  return { viewport: [innerWidth, innerHeight], cta: { top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width) },
    title: t.includes('不只是做实验') && t.includes('如何正确做实验'),
    subtitle: t.includes('发现混杂变量、纠正实验设计'),
    strip: t.includes('ApexLab 是什么') && t.includes('你能学到什么') && t.includes('从哪里开始'),
    overflow: document.documentElement.scrollWidth - innerWidth };
})()`);
await shot('ux01-home-desktop');

// real pointer click on primary CTA
const center = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('开始第一次科研挑战')); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
await clickAt(center[0], center[1]);
await waitFor(`location.pathname.startsWith('/experiments/')`);
await sleep(500);
report.created = await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('apexlab-store-v1')); const e = s.state.experiments[0]; return { id: e.id, category: e.category, stages: e.stages, hypothesis: Boolean(e.hypothesis), url: location.pathname }; })()`);
await shot('ux01-created-desktop');

// garage statuses
await send('Page.navigate', { url: 'http://localhost:5173/experiments' });
await waitFor(`document.body.innerText.includes('状态图例')`);
await sleep(400);
report.garage = await evaluate(`(() => {
  const cards = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === '创建实验' || b.textContent.trim() === '暂不可创建');
  const t = document.body.innerText;
  return { buttons: cards.map(b => ({ label: b.textContent.trim(), disabled: b.disabled })),
    legend: t.includes('完整科研流程') && t.includes('预置示例') && t.includes('运行器未接入'),
    presetBadge: t.includes('预置示例'), overflow: document.documentElement.scrollWidth - innerWidth };
})()`);
await shot('ux01-garage-desktop');

// ---- mobile 390x844 ----
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://localhost:5173/' });
await waitFor(`!![...document.querySelectorAll('button')].find(b => b.textContent.includes('开始第一次科研挑战'))`);
await sleep(600);
report.mobileHome = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('开始第一次科研挑战'));
  const r = b.getBoundingClientRect();
  return { viewport: [innerWidth, innerHeight], cta: { top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width) },
    visibleInFirstScreen: r.top >= 0 && r.bottom <= innerHeight,
    overflow: document.documentElement.scrollWidth - innerWidth };
})()`);
await shot('ux01-home-mobile');
const mcenter = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('开始第一次科研挑战')); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
await clickAt(mcenter[0], mcenter[1]);
await waitFor(`location.pathname.startsWith('/experiments/')`);
await sleep(400);
// refresh persistence
await send('Page.reload');
await waitFor(`document.body.innerText.includes('科研阶段追踪')`);
report.mobilePersist = await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('apexlab-store-v1')); return { experiments: s.state.experiments.length, firstStages: s.state.experiments[0].stages.question, url: location.pathname }; })()`);
await shot('ux01-mobile-after-refresh');

report.consoleErrors = consoleErrors;
writeFileSync('docs/ux01-check-result.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
chrome.kill();
process.exit(0);