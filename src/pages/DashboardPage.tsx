import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLabStore } from '@/data/store';
import { isUsableTrial } from '@/data/integrity';
import { experimentFlowStatus } from '@/data/templates';
import { createCorneringChallenge } from '@/onboarding/challenge';
import { currentStage, stageProgress, STAGE_MAP } from '@/pedagogy';
import type { Experiment } from '@/data/schema';
import { Button, CategoryBadge, FLOW_TONE, Panel, StatCard, StageSegments } from '@/components/ui';

/** 进行中实验默认只露两条，其余连同关键数据一起收进监控面板 */
const PREVIEW_RUNS = 2;

function RunRow({ exp }: { exp: Experiment }) {
  const stage = currentStage(exp);
  const pct = Math.round(stageProgress(exp) * 100);
  const flow = experimentFlowStatus(exp);
  return (
    <Link
      to={`/experiments/${exp.id}`}
      className="block rounded-lg border border-line bg-carbon-800/50 p-4 transition-all hover:border-line-bright hover:bg-carbon-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-mist-100">{exp.title}</p>
          <p className="mt-1 line-clamp-1 text-xs text-mist-500">{exp.question}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <CategoryBadge category={exp.category} />
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${FLOW_TONE[flow.key]}`}>{flow.label}</span>
        </div>
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
}

export default function DashboardPage() {
  const experiments = useLabStore((s) => s.experiments);
  const reports = useLabStore((s) => s.reports);
  const navigate = useNavigate();
  const [monitorOpen, setMonitorOpen] = useState(false);

  const totalTrials = experiments.reduce((n, e) => n + e.trials.filter(isUsableTrial).length, 0);
  const allTrials = experiments.reduce((n, e) => n + e.trials.length, 0);
  const avgProgress = experiments.length
    ? Math.round((experiments.reduce((n, e) => n + stageProgress(e), 0) / experiments.length) * 100)
    : 0;

  const stats = [
    { label: '在册实验', value: experiments.length, accent: 'bg-race-500', sub: 'Garage 中的研究项目' },
    { label: '有效试跑', value: totalTrials, unit: '次', accent: 'bg-tele-400', sub: '已完成采集的 Trial' },
    { label: '平均流程进度', value: avgProgress, unit: '%', accent: 'bg-signal-amber', sub: '七阶段完成度均值' },
    { label: '实验报告', value: reports.length, unit: '份', accent: 'bg-signal-violet', sub: '可复现的 Markdown 报告' },
  ];

  const hiddenRuns = Math.max(0, experiments.length - PREVIEW_RUNS);
  const startChallenge = () => {
    const id = createCorneringChallenge();
    navigate(id ? `/experiments/${id}` : '/experiments');
  };

  useEffect(() => {
    if (!monitorOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMonitorOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [monitorOpen]);

  return (
    <>
      {/* 实验台整页背景：遥测网格 + 两侧斜纹 + 上下辉光，内容全部叠在上面 */}
      <div className="pointer-events-none fixed inset-0 z-0 transition-[left] duration-300 ease-out lg:left-[var(--shell-nav)]" aria-hidden="true">
        <div className="telemetry-grid absolute inset-0" />
        <div className="race-stripes absolute inset-y-0 left-0 w-20 opacity-10" />
        <div className="race-stripes absolute inset-y-0 right-0 w-20 opacity-10" />
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-race-500/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-tele-500/10 blur-3xl" />
      </div>

      {/* 整组往下放，在视口里上下居中 */}
      <div className="fade-up relative z-10 flex min-h-[calc(100vh-11rem)] flex-col justify-center gap-6 py-8">
        <section className="mx-auto max-w-3xl text-center">
          <p className="num text-[11px] tracking-[0.35em] text-tele-400">RESEARCH TELEMETRY SYSTEM · ONLINE</p>
          <h1 className="font-display mt-3 text-2xl font-bold leading-tight tracking-wide text-mist-100 sm:text-5xl">
            不只是做实验，
            <br />
            更要学会<span className="text-race-400">如何正确做实验</span>。
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-mist-500 sm:text-base">
            通过一次赛车过弯对照实验，发现混杂变量、纠正实验设计，并利用真实计算数据形成可追溯的研究结论。
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              data-tour="challenge"
              onClick={startChallenge}
              className="group relative inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded bg-race-500 px-6 py-3 text-base font-bold text-white glow-race-strong transition-transform hover:scale-[1.03] active:scale-95 sm:w-auto"
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
            <Link to="/learn" className="text-xs font-semibold text-mist-500 underline-offset-4 hover:text-tele-300 hover:underline">
              先了解科研七阶段 →
            </Link>
          </div>
          <p className="num mt-3 text-[10px] tracking-wider text-mist-600">
            无需注册 · 数据保存在本机 · 约 3 分钟完成一次可追溯的科研闭环
          </p>
        </section>

        <Panel dataTour="runs" title="进行中实验 · Active Runs" className="mx-auto w-full max-w-3xl">
          <div className="space-y-3">
            {experiments.length === 0 && (
              <p className="py-6 text-center text-sm text-mist-500">车库空空如也——点击上方蓝色主按钮，开始第一次科研挑战。</p>
            )}
            {experiments.slice(0, PREVIEW_RUNS).map((exp) => (
              <RunRow key={exp.id} exp={exp} />
            ))}
          </div>
        </Panel>

        {experiments.length > 0 && (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => setMonitorOpen(true)}>
              显示更多
              {hiddenRuns > 0 && <span className="num text-[11px] opacity-70">+{hiddenRuns}</span>}
            </Button>
          </div>
        )}
      </div>

      {monitorOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="数据监控面板">
          <div className="absolute inset-0 bg-carbon-950/80 backdrop-blur-sm" onClick={() => setMonitorOpen(false)} aria-hidden="true" />
          <div className="fade-up panel relative w-full max-w-3xl overflow-hidden shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <p className="panel-title flex items-center gap-2">
                <span className="led inline-block h-1.5 w-1.5 rounded-full bg-tele-400 text-tele-400" />
                监控面板 · TELEMETRY MONITOR
              </p>
              <button
                onClick={() => setMonitorOpen(false)}
                className="num cursor-pointer text-[11px] text-mist-600 transition-colors hover:text-mist-300"
              >
                关闭 ✕
              </button>
            </header>

            <div className="max-h-[72vh] space-y-5 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((s) => (
                  <StatCard key={s.label} {...s} />
                ))}
              </div>

              <div>
                <p className="panel-title">七阶段完成度 · Stage Pass</p>
                <div className="mt-2.5 space-y-3">
                  {experiments.map((exp) => (
                    <RunRow key={exp.id} exp={exp} />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <p className="num text-[11px] text-mist-600">
                  TRIALS · 有效 {totalTrials} / 共 {allTrials}，无效记录保留原值但不进图表与报告
                </p>
                <Link
                  to="/experiments"
                  className="rounded border border-tele-500/40 bg-tele-500/10 px-2.5 py-1 text-[11px] font-bold text-tele-300 transition-colors hover:bg-tele-500/25"
                >
                  去实验库看档案 →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
