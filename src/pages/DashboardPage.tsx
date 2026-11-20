import { Link, useNavigate } from 'react-router-dom';
import { useLabStore } from '@/data/store';
import { isUsableTrial, readMetric, readParam } from '@/data/integrity';
import { TEMPLATES } from '@/data/templates';
import { STAGES, currentStage, stageProgress, STAGE_MAP } from '@/pedagogy';
import { CategoryBadge, Panel, StatCard, StageSegments } from '@/components/ui';
import { TelemetryChart } from '@/components/TelemetryChart';

export default function DashboardPage() {
  const experiments = useLabStore((s) => s.experiments);
  const reports = useLabStore((s) => s.reports);
  const createFromTemplate = useLabStore((s) => s.createFromTemplate);
  const navigate = useNavigate();

  const totalTrials = experiments.reduce((n, e) => n + e.trials.filter(isUsableTrial).length, 0);
  const avgProgress = experiments.length
    ? Math.round((experiments.reduce((n, e) => n + stageProgress(e), 0) / experiments.length) * 100)
    : 0;

  const brakingExp = experiments.find((e) => e.category === 'braking' && e.trials.length > 0);
  const chartPoints =
    brakingExp?.trials
      .filter(isUsableTrial)
      .flatMap((t) => {
        const x = readParam(t, 'mu');
        const y = readMetric(t, 'brakeDistance');
        return x !== undefined && y !== undefined ? [{ x, y }] : [];
      })
      .sort((a, b) => a.x - b.x) ?? [];

  const startChallenge = () => {
    const tpl = TEMPLATES.find((t) => t.runnable && t.category === 'cornering');
    const id = tpl ? createFromTemplate(tpl.id) : null;
    navigate(id ? `/experiments/${id}` : '/experiments');
  };

  return (
    <div className="space-y-6">
      {/* Hero：首屏 10 秒理解是什么 / 学什么 / 点哪里 */}
      <section className="fade-up panel telemetry-grid relative overflow-hidden">
        <div className="race-stripes absolute inset-y-0 right-0 w-24 opacity-15" />
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-race-500/12 blur-3xl" />
        <div className="absolute -right-16 -bottom-24 h-64 w-64 rounded-full bg-tele-500/10 blur-3xl" />
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <p className="num text-[11px] tracking-[0.35em] text-tele-400">RESEARCH TELEMETRY SYSTEM · ONLINE</p>
          <h1 className="font-display mt-3 text-2xl font-bold leading-tight tracking-wide text-mist-100 sm:text-5xl">
            不只是做实验，
            <br />
            更要学会<span className="text-race-400">如何正确做实验</span>。
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-500 sm:text-base">
            通过一次赛车过弯对照实验，发现混杂变量、纠正实验设计，并利用真实计算数据形成可追溯的研究结论。
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={startChallenge}
              className="group relative inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded bg-race-500 px-6 py-3 text-base font-bold text-white shadow-[0_0_28px_rgba(225,6,0,0.45)] transition-transform hover:scale-[1.03] active:scale-95 sm:w-auto"
            >
              <span className="absolute inset-0 rounded bg-race-400/40 blur-md led" aria-hidden="true" />
              <svg viewBox="0 0 24 24" className="relative h-4 w-4" fill="currentColor"><path d="M6 3v18h2v-7h11l-2.5-4L19 6H8V3H6z" /></svg>
              <span className="relative">开始第一次科研挑战</span>
            </button>
            <Link
              to="/experiments"
              className="inline-flex w-full items-center justify-center gap-2 rounded border border-line-bright bg-carbon-800/70 px-5 py-3 text-sm font-bold text-mist-300 transition-colors hover:border-tele-500/50 hover:text-tele-300 sm:w-auto"
            >
              进入实验库
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            <Link to="/learn" className="text-center text-xs font-semibold text-mist-500 underline-offset-4 hover:text-tele-300 hover:underline sm:text-left">
              先了解科研七阶段 →
            </Link>
          </div>
          <p className="num mt-3 text-[10px] tracking-wider text-mist-600">
            无需注册 · 数据保存在本机 · 约 3 分钟完成一次可追溯的科研闭环
          </p>
        </div>
      </section>

      {/* 10 秒理解条 */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { n: '01', c: 'text-race-400', b: 'border-race-500/40', t: 'ApexLab 是什么', d: '赛车遥测风格的科研流程训练台：把科学方法拆成七个可校验的阶段，不跳步、不臆断。' },
          { n: '02', c: 'text-tele-300', b: 'border-tele-500/40', t: '你能学到什么', d: '控制变量、识别混杂与重复试跑、用试跑 ID 证据链支撑结论，并导出可复现报告。' },
          { n: '03', c: 'text-signal-amber', b: 'border-signal-amber/40', t: '从哪里开始', d: '点击红色主按钮：自动创建过弯对照实验并进入假设阶段，跟着阶段追踪器走完全程。' },
        ].map((x, i) => (
          <div key={x.n} className={`fade-up panel border-l-2 ${x.b} p-4`} style={{ animationDelay: `${0.08 + i * 0.07}s` }}>
            <p className={`num text-[10px] font-bold tracking-[0.3em] ${x.c}`}>{x.n}</p>
            <p className="mt-1 text-sm font-bold text-mist-100">{x.t}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-mist-500">{x.d}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* 进行中实验 */}
        <Panel title="进行中实验 · Active Runs" className="fade-up lg:col-span-3" >
          <div className="space-y-3">
            {experiments.length === 0 && (
              <p className="py-6 text-center text-sm text-mist-500">车库空空如也——点击上方红色主按钮，开始第一次科研挑战。</p>
            )}
            {experiments.map((exp) => {
              const stage = currentStage(exp);
              const pct = Math.round(stageProgress(exp) * 100);
              return (
                <Link
                  key={exp.id}
                  to={`/experiments/${exp.id}`}
                  className="block rounded-lg border border-line bg-carbon-800/50 p-4 transition-all hover:border-line-bright hover:bg-carbon-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-mist-100">{exp.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-mist-500">{exp.question}</p>
                    </div>
                    <CategoryBadge category={exp.category} />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <StageSegments stages={exp.stages} className="flex-1" />
                    <span className="num text-xs font-bold text-tele-300">{pct}%</span>
                  </div>
                  <p className="mt-2 text-[11px] text-mist-500">
                    当前阶段：<span className="font-semibold text-signal-amber">{STAGE_MAP[stage].name}</span>
                    <span className="num ml-3 text-mist-600">{exp.trials.length} TRIALS</span>
                  </p>
                </Link>
              );
            })}
          </div>
        </Panel>

        {/* 遥测曲线 */}
        <Panel
          title="遥测回放 · d–μ 曲线"
          className="fade-up lg:col-span-2"
          right={brakingExp && <Link to={`/experiments/${brakingExp.id}`} className="text-[11px] font-semibold text-tele-400 hover:text-tele-300">查看实验 →</Link>}
        >
          {chartPoints.length >= 2 ? (
            <>
              <TelemetryChart points={chartPoints} color="#00d2be" xLabel="μ 摩擦系数" yLabel="制动距离 / m" />
              <p className="mt-2 text-[11px] leading-relaxed text-mist-500">
                来自「{brakingExp?.title}」的 {chartPoints.length} 次有效试跑：μ 越大，制动距离越短，形态接近反比曲线。
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-xs text-mist-500">完成带试跑数据的实验后，这里将回放遥测曲线。</p>
          )}
        </Panel>
      </div>

      {/* 统计（首屏之下，减少首屏噪音） */}
      <div className="fade-up grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="在册实验" value={experiments.length} accent="bg-race-500" sub="Garage 中的研究项目" />
        <StatCard label="有效试跑" value={totalTrials} unit="次" accent="bg-tele-400" sub="已完成采集的 Trial" />
        <StatCard label="平均流程进度" value={avgProgress} unit="%" accent="bg-signal-amber" sub="七阶段完成度均值" />
        <StatCard label="实验报告" value={reports.length} unit="份" accent="bg-signal-violet" sub="可复现的 Markdown 报告" />
      </div>

      {/* 流程管线 */}
      <Panel title="科研流程管线 · Research Pipeline" className="fade-up">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {STAGES.map((s, i) => {
            const here = experiments.filter((e) => currentStage(e) === s.id && e.stages[s.id] !== 'done').length;
            const done = experiments.filter((e) => e.stages[s.id] === 'done').length;
            const colors = ['#e10600', '#ffb800', '#a3e635', '#00d2be', '#4cc3ff', '#a78bfa', '#f471b5'];
            return (
              <div key={s.id} className="relative rounded-md border border-line bg-carbon-900/70 p-3">
                <div className="absolute inset-x-0 top-0 h-0.5 rounded-t" style={{ background: colors[i] }} />
                <p className="num text-[10px] text-mist-600">STAGE {String(s.order).padStart(2, '0')}</p>
                <p className="mt-1 text-xs font-bold text-mist-300">{s.name}</p>
                <p className="num mt-2 text-lg font-bold" style={{ color: colors[i] }}>
                  {here}
                  <span className="ml-1 text-[10px] font-medium text-mist-600">在此</span>
                </p>
                <p className="num text-[10px] text-mist-600">{done} 已通过</p>
              </div>
            );
          })}
        </div>
      </Panel>

    </div>
  );
}