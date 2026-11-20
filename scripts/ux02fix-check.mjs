/**
 * UX-02-FIX 端到端回归（headless Chrome + CDP）：
 * FIX-A 摘要计数 / FIX-B 刷新后一键纠错 / FIX-C 阶段冲突文案 / FIX-D 浮层遮挡。
 * 运行：node scripts/ux02fix-check.mjs
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9224;
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--window-size=1440,900',
  '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '/apexlab-ux02fix-profile', 'about:blank',
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
const inputs = () => evaluate(`['车辆速度（km/h）','弯道半径（m）','路面附着系数（—）'].map(l => document.querySelector('input[aria-label="' + l + '"]').value)`);
const run = async (v, r, mu) => { await setInput('车辆速度（km/h）', v); await setInput('弯道半径（m）', r); await setInput('路面附着系数（—）', mu); await clickText('运行试验'); };
const header = () => evaluate(`(() => { const s = [...document.querySelectorAll('section')].find(x => x.textContent.includes('④ 数据采集')); return s.querySelector('header span.num').textContent; })()`);
const feedback = () => evaluate(`(() => { const el = document.querySelector('[role="status"]'); return el ? el.innerText.replace(/\\n+/g, ' | ') : null; })()`);
const nextStep = () => evaluate(`(() => { const t = document.body.innerText; const i = t.indexOf('下一步'); return t.slice(i, i + 120).replace(/\\n+/g, ' '); })()`);
const toastPresent = () => evaluate(`!!document.querySelector('.fixed.bottom-6')`);
const unobstructed = (sel) => evaluate(`(() => { const el = ${sel}; if (!el) return false; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && (hit === el || el.contains(hit) || hit.contains(el)); })()`);
const reload = async () => { await send('Page.reload'); await sleep(700); await waitFor(`document.readyState === 'complete' && document.body.innerText.includes('过弯工况设置')`); };
const clipShot = async (name, selA, selB) => {
  await evaluate(`document.querySelector(${JSON.stringify(selA)}).scrollIntoView({ block: 'start' })`);
  await sleep(300);
  const rect = await evaluate(`(() => { const a = document.querySelector(${JSON.stringify(selA)}).getBoundingClientRect(); const b = document.querySelector(${JSON.stringify(selB || selA)}).getBoundingClientRect(); const top = Math.min(a.top, b.top) + scrollY; const bottom = Math.max(a.bottom, b.bottom) + scrollY; const left = Math.min(a.left, b.left); const right = Math.max(a.right, b.right); return { x: left, y: top, width: right - left, height: bottom - top }; })()`);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: Math.max(0, rect.x - 8), y: Math.max(0, rect.y - 8), width: rect.width + 16, height: rect.height + 16, scale: 1 } });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
};
const fullShot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const report = { steps: [] };
const step = (name, data) => report.steps.push({ name, ...data });

await send('Page.navigate', { url: 'http://localhost:5173/' });
await waitFor(`!![...document.querySelectorAll('button')].find(b => b.textContent.includes('开始第一次科研挑战'))`);
await clickText('开始第一次科研挑战');
await waitFor(`location.pathname.startsWith('/experiments/')`);
const expUrl = await evaluate('location.pathname');
await clickText('标记本阶段完成', true);
await clickText('标记本阶段完成', true);
await waitFor(`document.body.innerText.includes('过弯工况设置')`);

await run('54', '50', '1');
await run('54', '50', '1');
await run('72', '60', '1');
step('after-3-runs', { header: await header(), feedback: await feedback(), toast: await toastPresent() });
await clipShot('ux02fix-counts-desktop', 'input[aria-label="车辆速度（km/h）"]', '[role="status"]');

// FIX-B: refresh then restore must keep 72
await reload();
const thirdId = await evaluate(`JSON.parse(localStorage.getItem('apexlab-store-v1')).state.experiments.find(e => location.pathname.includes(e.id)).trials[2].id`);
step('after-refresh-target', { thirdId, feedbackHasThirdId: (await feedback()).includes(thirdId) });
await clickText('一键恢复控制变量到基准值');
step('restore-after-refresh', { inputs: await inputs(), toast: await toastPresent(), fixButtonUnobstructed: await unobstructed(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('一键恢复'))`) });
await clipShot('ux02fix-restore-desktop', 'input[aria-label="车辆速度（km/h）"]', '[role="status"]');
// run #4 from restored form
await clickText('运行试验');
step('after-4-runs', { header: await header(), oldConfoundedPreserved: await evaluate(`(() => { const t = JSON.parse(localStorage.getItem('apexlab-store-v1')).state.experiments.find(e => location.pathname.includes(e.id)).trials[2]; return t.params.speedKmh === 72 && t.params.radiusM === 60; })()`) });
await run('90', '50', '1');
step('after-5-runs', { header: await header(), next: await nextStep() });
await clickText('标记采集完成');
step('collect-done', { analyze: await evaluate(`document.body.innerText.includes('分析工作台')`) });

// FIX-C1: historical collect done + insufficient scheme
await clickText('编辑假设 / 变量');
await evaluate(`(() => { const sel = document.querySelector('select[aria-label="弯道半径的角色"]'); const s = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; s.call(sel, 'independent'); sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(250);
await clickText('保存方法设置', true);
step('historical-insufficient', { next: await nextStep(), workbenchChip: await evaluate(`document.body.innerText.includes('历史结果查看')`), noFalseAnalysisClaim: !(await nextStep()).includes('前往分析工作台') });
await clipShot('ux02fix-historical-desktop', '[role="status"]', 'section#analysis-workbench header');
// switch back
await clickText('编辑假设 / 变量');
await evaluate(`(() => { const sel = document.querySelector('select[aria-label="车速的角色"]'); const s = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; s.call(sel, 'independent'); sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(250);
await clickText('保存方法设置', true);

// analyze -> conclude -> report gating (FIX-C2)
await clickText('新建研究发现');
await evaluate(`(() => { const ta = document.querySelector('textarea[placeholder^="例如：在弯道半径保持"]'); const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(ta, '半径保持 50 m 时，车速 54→72→90 km/h 对应 ay 4.50→8.00→12.50 m/s²，符合平方关系。'); ta.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(200);
for (const label of ['#01', '#04', '#05']) await clickText(label);
await clickText('保存发现', true);
await clickText('标记本阶段完成', true); // analyze
await evaluate(`(() => { const tas = [...document.querySelectorAll('textarea')]; const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; const stmt = tas.find(t => t.placeholder.startsWith('回答最初的研究问题')); const lim = tas.find(t => t.placeholder.startsWith('模型局限与适用范围')); set.call(stmt, '在 R=50 m、μ=1 条件下 ay 与 v² 成正比，假设被数据支持。'); stmt.dispatchEvent(new Event('input', { bubbles: true })); set.call(lim, '简化质点模型，未含轮胎特性、气动与载荷转移；仅适用所测范围。'); lim.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(200);
await clickText('保存结论', true);
await clickText('标记本阶段完成', true); // conclude
step('conclude-done-report-pending', { next: await nextStep(), notClosedLoop: !(await nextStep()).includes('科研闭环已完成') });
await clipShot('ux02fix-conclude-desktop', '[role="status"]', 'section#report-panel');
await clickText('生成实验报告');
await waitFor(`location.pathname === '/reports'`);
await send('Page.navigate', { url: 'http://localhost:5173' + expUrl });
await waitFor(`document.body.innerText.includes('过弯工况设置')`);
step('report-done', { next: await nextStep() });
await reload();
step('report-done-after-refresh', { next: await nextStep() });

// exports unaffected
await evaluate(`window.__caps = []; const orig = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { const u = orig(b); window.__caps.push(b); return u; };`);
await clickText('导出原始记录 CSV');
await clickText('导出合格对照 CSV');
const csvs = await evaluate(`Promise.all(window.__caps.map(b => b.text()))`);
step('csv', { rawRows: csvs[0].trim().split('\r\n').length - 1, eligibleRows: csvs[1].trim().split('\r\n').length - 1, rawHas72R60: csvs[0].includes('72,60,1') });

// FIX-D mobile: confounded run + restore, no toast, unobstructed controls
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://localhost:5173' + expUrl });
await waitFor(`document.body.innerText.includes('过弯工况设置')`);
await run('72', '60', '1');
step('mobile-confounded', { toast: await toastPresent(), feedback: (await feedback()).slice(0, 60) });
await clickText('一键恢复控制变量到基准值');
step('mobile-restore', {
  inputs: await inputs(),
  toast: await toastPresent(),
  fixUnobstructed: await unobstructed(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('一键恢复'))`),
  runUnobstructed: await unobstructed(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '运行试验')`),
  inputUnobstructed: await unobstructed(`document.querySelector('input[aria-label="车辆速度（km/h）"]')`),
  overflow: await evaluate('document.documentElement.scrollWidth - innerWidth'),
});
await evaluate(`document.querySelector('[role="status"]').scrollIntoView({ block: 'center' })`);
await sleep(300);
await fullShot('ux02fix-mobile.png');
// cleanup mobile extra trial
await evaluate(`(() => { const key = 'apexlab-store-v1'; const st = JSON.parse(localStorage.getItem(key)); const e = st.state.experiments.find(x => location.pathname.includes(x.id)); e.trials = e.trials.slice(0, 5); localStorage.setItem(key, JSON.stringify(st)); })()`);
await reload();
step('final-counts', { header: await header() });

report.consoleErrors = consoleErrors;
writeFileSync('docs/ux02fix-check-result.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
chrome.kill();
process.exit(0);