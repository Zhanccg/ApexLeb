import { Link, useNavigate } from 'react-router-dom';
import { useLabStore } from '@/data/store';
import { isUsableTrial } from '@/data/integrity';
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
      .filter((t) => t.status === 'completed')
      .map((t) => ({ x: t.params.mu, y: t.metrics.brakeDistance }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x) ?? [];

  const quickStart = (tplId: string) => {
    const id = createFromTemplate(tplId);
    if (id) navigate(`/experiments/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="fade-up panel telemetry-grid relative overflow-hidden">
        <div className="race-stripes absolute inset-y-0 right-0 w-24 opacity-15" />
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-race-500/12 blur-3xl" />
        <div className="absolute -right-16 -bottom-24 h-64 w-64 rounded-full bg-tele-500/10 blur-3xl" />
        <div className="relative px-6 py-8 sm:px-8">
          <p className="num text-[11px] tracking-[0.35em] text-tele-400">RESEARCH TELEMETRY SYSTEM · ONLINE</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-wide text-mist-100 sm:text-5xl">
            像调校赛车一样<span className="text-race-400">做科研</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-500">
            ApexLab 把科学研究流程拆成七个可执行的阶段：提出问题、建立假设、实验设计、数据采集、分析、结论与报告。
            每个阶段都有赛车工程类比与退出条件——不跳步、不臆断，用遥测数据说话。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/experiments"
              className="inline-flex items-center gap-2 rounded bg-race-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(225,6,0,0.4)] transition-transform hover:scale-[1.03] active:scale-95"
            >
              进入实验库
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            <Link
              to="/learn"
              className="inline-flex items-center gap-2 rounded border border-tele-500/40 bg-tele-500/10 px-5 py-2.5 text-sm font-bold text-tele-300 transition-colors hover:bg-tele-500/20"
            >
              学习科研七阶段
            </Link>
          </div>
        </div>
      </section>

      {/* 统计 */}
      <div className="fade-up grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ animationDelay: '0.08s' }}>
        <StatCard label="在册实验" value={experiments.length} accent="bg-race-500" sub="Garage 中的研究项目" />
        <StatCard label="有效试跑" value={totalTrials} unit="次" accent="bg-tele-400" sub="已完成采集的 Trial" />
        <StatCard label="平均流程进度" value={avgProgress} unit="%" accent="bg-signal-amber" sub="七阶段完成度均值" />
        <StatCard label="实验报告" value={reports.length} unit="份" accent="bg-signal-violet" sub="可复现的 Markdown 报告" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* 进行中实验 */}
        <Panel title="进行中实验 · Active Runs" className="fade-up lg:col-span-3" >
          <div className="space-y-3">
            {experiments.length === 0 && (
              <p className="py-6 text-center text-sm text-mist-500">车库空空如也——从下方模板创建第一个实验。</p>
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

      {/* 快速开始 */}
      <Panel title="快速发车 · Quick Launch" className="fade-up">
        <div className="grid gap-3 md:grid-cols-3">
          {TEMPLATES.map((tpl) => (
            <div key={tpl.id} className="flex flex-col rounded-lg border border-line bg-carbon-800/50 p-4 transition-colors hover:border-line-bright">
              <CategoryBadge category={tpl.category} />
              <p className="mt-2.5 text-sm font-bold text-mist-100">{tpl.title}</p>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-mist-500">{tpl.brief}</p>
              <button
                onClick={() => quickStart(tpl.id)}
                className="mt-3 cursor-pointer rounded border border-race-500/40 bg-race-500/10 px-3 py-2 text-xs font-bold text-race-400 transition-colors hover:bg-race-500/25 active:scale-95"
              >
                以此模板创建实验 →
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}