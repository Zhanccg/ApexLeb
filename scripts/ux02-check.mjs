/**
 * UX-02 真实浏览器回归（headless Chrome + CDP）：
 * 54 / 54重复 / 72混杂 / 72纠正 / 90 五步序列 + 半径自变量切换 + 缺参历史 + 刷新持久化 + 双视口截图。
 * 运行：node scripts/ux02-check.mjs
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9223;
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--window-size=1440,900',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '/apexlab-ux02-profile',
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
const ws = new WebSocket(await getWsUrl());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push('exception: ' + JSON.stringify(m.params.exceptionDetails?.exception?.description || m.params));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push('console.error: ' + m.params.args.map((a) => a.value || a.description).join(' '));
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
  throw new Error('timeout: ' + expression);
};
const clickText = async (text, exact = false) => {
  const ok = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => ${exact ? `x.textContent.trim() === ${JSON.stringify(text)}` : `x.textContent.includes(${JSON.stringify(text)})`}); if (!b || b.disabled) return false; b.click(); return true; })()`);
  if (!ok) throw new Error('click failed: ' + text);
  await sleep(350);
};
const setInput = async (label, value) => {
  await evaluate(`(() => { const el = document.querySelector('input[aria-label="${label}"]'); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
};
const run = async (v, r, mu) => {
  await setInput('车辆速度（km/h）', v);
  await setInput('弯道半径（m）', r);
  await setInput('路面附着系数（—）', mu);
  await clickText('运行试验');
};
const feedback = () => evaluate(`(() => { const el = document.querySelector('[role="status"]'); return el ? el.innerText.replace(/\\n+/g, ' | ') : null; })()`);
const counts = () => evaluate(`(() => { const t = document.body.innerText; const m = t.match(/合格对照 (\\d+) 条 · 不同水平 (\\d+)\\/3/); const s = t.match(/已保存 (\\d+) 条/); return m ? { eligible: +m[1], distinct: +m[2], saved: s ? +s[1] : null } : null; })()`);
const shotFeedback = async (name) => {
  await evaluate(`document.querySelector('[role="status"]').scrollIntoView({ block: 'center' })`);
  await sleep(300);
  const rect = await evaluate(`(() => { const r = document.querySelector('[role="status"]').getBoundingClientRect(); return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }; })()`);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: Math.max(0, rect.x - 10), y: Math.max(0, rect.y - 10), width: rect.width + 20, height: rect.height + 20, scale: 1 } });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
};
const shotFull = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const report = { steps: [] };
const step = (name, data) => report.steps.push({ name, ...data });

// create via home CTA
await send('Page.navigate', { url: 'http://localhost:5173/' });
await waitFor(`!![...document.querySelectorAll('button')].find(b => b.textContent.includes('开始第一次科研挑战'))`);
await clickText('开始第一次科研挑战');
await waitFor(`location.pathname.startsWith('/experiments/')`);
const expUrl = await evaluate('location.pathname');
await clickText('标记本阶段完成', true); // hypothesis
await clickText('标记本阶段完成', true); // design
await waitFor(`document.body.innerText.includes('过弯工况设置')`);

// 1: 54/50/1 eligible 1/3
await run('54', '50', '1');
step('run1-54', { feedback: await feedback(), counts: await counts() });
await shotFeedback('ux02-feedback-eligible');
// 2: 54 repeat
await run('54', '50', '1');
step('run2-54-repeat', { feedback: await feedback(), counts: await counts() });
await shotFeedback('ux02-feedback-replicate');
// 3: 72/60 confounded
await run('72', '60', '1');
step('run3-72-R60-confounded', { feedback: await feedback(), counts: await counts() });
await shotFeedback('ux02-feedback-confounded');
// fix button restores radius
await clickText('一键恢复控制变量到基准值');
step('fix-restore', { radiusInput: await evaluate(`document.querySelector('input[aria-label="弯道半径（m）"]').value`) });
// 4: 72/50 eligible 2/3, cannot advance
await run('72', '50', '1');
step('run4-72-R50', { feedback: await feedback(), counts: await counts(), collectDisabled: await evaluate(`[...document.querySelectorAll('button')].find(x => x.textContent.trim() === '标记本阶段完成').disabled`) });
// 5: 90/50 ready
await run('90', '50', '1');
step('run5-90', { feedback: await feedback(), counts: await counts(), nextStep: await evaluate(`(() => { const t = document.body.innerText; const i = t.indexOf('下一步'); return t.slice(i, i + 80).replace(/\\n+/g, ' '); })()`) });
await clickText('标记采集完成');
step('collect-complete', { analyzeActive: await evaluate(`document.body.innerText.includes('分析工作台')`) });

// switch independent to radius, run 72/50 -> confounded speed
await clickText('编辑假设 / 变量');
await evaluate(`(() => { const sel = document.querySelector('select[aria-label="弯道半径的角色"]'); const s = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; s.call(sel, 'independent'); sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(250);
await clickText('保存方法设置', true);
await run('72', '50', '1');
step('radius-mode-72', { feedback: await feedback(), counts: await counts() });
await shotFeedback('ux02-feedback-confounded-speed');
// switch back to speed
await clickText('编辑假设 / 变量');
await evaluate(`(() => { const sel = document.querySelector('select[aria-label="车速的角色"]'); const s = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; s.call(sel, 'independent'); sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(250);
await clickText('保存方法设置', true);

// inject missing-mu history, reload -> invalid feedback persisted
await evaluate(`(() => { const key = 'apexlab-store-v1'; const st = JSON.parse(localStorage.getItem(key)); const e = st.state.experiments.find(x => location.pathname.includes(x.id)); e.trials.push({ id: 'ux02-missing-mu', index: 90, params: { speedKmh: 60, radiusM: 50 }, metrics: { lateralAccelMs2: 5, gripUtilization: 0.5, limitSpeedKmh: 80, limitSpeedMs: 22 }, samples: [], status: 'completed', note: '', createdAt: '2026-11-20T05:00:00.000Z' }); localStorage.setItem(key, JSON.stringify(st)); })()`);
await send('Page.reload');
await sleep(700);
await waitFor(`document.readyState === 'complete' && document.body.innerText.includes('过弯工况设置') && !!document.querySelector('[role="status"]')`);
step('missing-mu-after-refresh', { feedback: await feedback(), counts: await counts() });
await shotFeedback('ux02-feedback-invalid');
// refresh again -> still correct
await send('Page.reload');
await sleep(700);
await waitFor(`document.readyState === 'complete' && document.body.innerText.includes('过弯工况设置') && !!document.querySelector('[role="status"]')`);
step('missing-mu-second-refresh', { feedback: await feedback(), counts: await counts() });
// cleanup injected
await evaluate(`(() => { const key = 'apexlab-store-v1'; const st = JSON.parse(localStorage.getItem(key)); const e = st.state.experiments.find(x => location.pathname.includes(x.id)); e.trials = e.trials.filter(t => t.id !== 'ux02-missing-mu'); localStorage.setItem(key, JSON.stringify(st)); })()`);
await send('Page.reload');
await sleep(700);
await waitFor(`document.readyState === 'complete' && document.body.innerText.includes('过弯工况设置') && !!document.querySelector('[role="status"]')`);
step('after-cleanup', { feedback: await feedback(), counts: await counts() });

// home badges desktop（注入一条历史气动实验以验证「运行器未接入」标签）
await send('Page.navigate', { url: 'http://localhost:5173/' });
await waitFor(`document.body.innerText.includes('进行中实验')`);
await evaluate(`(() => { const key = 'apexlab-store-v1'; const st = JSON.parse(localStorage.getItem(key)); st.state.experiments.push({ id: 'ux02-legacy-aero', title: '速度对气动下压力的影响（历史）', category: 'aero', question: '车速如何影响下压力？', hypothesis: null, variables: [], trials: [], analysis: null, conclusion: null, stages: { question: 'done', hypothesis: 'active', design: 'locked', collect: 'locked', analyze: 'locked', conclude: 'locked', report: 'locked' }, tags: [], createdAt: '2026-11-18T00:00:00.000Z', updatedAt: '2026-11-18T00:00:00.000Z' }); localStorage.setItem(key, JSON.stringify(st)); })()`);
await send('Page.reload');
await sleep(700);
await waitFor(`document.readyState === 'complete' && document.body.innerText.includes('进行中实验')`);
step('home-badges', { badges: await evaluate(`(() => { const t = document.body.innerText; return { preset: t.includes('预置示例'), full: t.includes('完整流程'), noRunner: t.includes('运行器未接入') }; })()`) });
await shotFull('ux02-home-badges');

// mobile 390
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://localhost:5173' + expUrl });
await waitFor(`document.body.innerText.includes('过弯工况设置')`);
await sleep(400);
step('mobile', { overflow: await evaluate('document.documentElement.scrollWidth - innerWidth'), feedbackVisible: await evaluate(`(() => { const r = document.querySelector('[role="status"]').getBoundingClientRect(); return r.width > 0; })()`) });
await evaluate(`document.querySelector('[role="status"]').scrollIntoView({ block: 'center' })`);
await sleep(300);
await shotFull('ux02-mobile-runner');

report.consoleErrors = consoleErrors;
writeFileSync('docs/ux02-check-result.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
chrome.kill();
process.exit(0);