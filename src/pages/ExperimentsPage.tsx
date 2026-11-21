import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLabStore } from '@/data/store';
import { isUsableTrial } from '@/data/integrity';
import { TEMPLATES, experimentFlowStatus } from '@/data/templates';
import { CATEGORY_LABEL, type ExperimentCategory, type StageId } from '@/data/schema';
import { STAGES, currentStage, stageProgress, STAGE_MAP } from '@/pedagogy';
import { CategoryBadge, EmptyState, FLOW_TONE, Panel, StageSegments } from '@/components/ui';
import { STAGE_SERIES } from '@/styles/palette';

type SortKey = 'updated' | 'progress' | 'title';
const CATEGORIES: Array<ExperimentCategory | 'all'> = ['all', 'braking', 'cornering', 'acceleration', 'aero'];

export default function ExperimentsPage() {
  const experiments = useLabStore((s) => s.experiments);
  const createFromTemplate = useLabStore((s) => s.createFromTemplate);
  const deleteExperiment = useLabStore((s) => s.deleteExperiment);
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExperimentCategory | 'all'>('all');
  const [stage, setStage] = useState<StageId | null>(null);
  const [sort, setSort] = useState<SortKey>('updated');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = experiments.filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (!stage || currentStage(e) === stage) &&
        (!q || e.title.toLowerCase().includes(q) || e.question.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q))),
    );
    list = [...list].sort((a, b) => {
      if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt);
      if (sort === 'progress') return stageProgress(b) - stageProgress(a);
      return a.title.localeCompare(b.title, 'zh-CN');
    });
    return list;
  }, [experiments, query, category, stage, sort]);

  const launch = (tplId: string) => {
    const id = createFromTemplate(tplId);
    if (id) navigate(`/experiments/${id}`);
  };

  return (
    <div className="space-y-6">
      <header className="fade-up">
        <p className="num text-[11px] tracking-[0.35em] text-tele-400">GARAGE · EXPERIMENT REGISTRY</p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-wide text-mist-100">实验库</h1>
        <p className="mt-1.5 text-sm text-mist-500">每个实验都是一份完整的科研档案：问题、假设、变量、试跑、分析与结论。</p>
      </header>

      {/* 实验流程：七阶段既是导航也是筛选，点一下把列表收到停在该阶段的实验 */}
      <Panel
        dataTour="flow"
        title="实验流程 · Research Pipeline"
        className="fade-up"
        right={
          stage && (
            <button
              onClick={() => setStage(null)}
              className="cursor-pointer rounded border border-line-bright bg-carbon-700/60 px-2 py-1 text-[11px] font-semibold text-mist-300 transition-colors hover:bg-carbon-600/60"
            >
              清除「{STAGE_MAP[stage].shortName}」筛选
            </button>
          )
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {STAGES.map((s, i) => {
            const here = experiments.filter((e) => currentStage(e) === s.id).length;
            const done = experiments.filter((e) => e.stages[s.id] === 'done').length;
            const accent = STAGE_SERIES[i];
            const on = stage === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStage(on ? null : s.id)}
                aria-pressed={on}
                title={`筛选停在「${s.name}」的实验`}
                className={`relative cursor-pointer rounded-md border p-3 text-left transition-all ${
                  on ? 'border-line-bright bg-carbon-700/70' : 'border-line bg-carbon-900/70 hover:border-line-bright hover:bg-carbon-800/70'
                }`}
              >
                <span className="absolute inset-x-0 top-0 h-0.5 rounded-t" style={{ background: accent }} />
                <p className="num text-[10px] text-mist-600">STAGE {String(s.order).padStart(2, '0')}</p>
                <p className="mt-1 text-xs font-bold text-mist-300">{s.name}</p>
                <p className="num mt-2 text-lg font-bold" style={{ color: accent }}>
                  {here}
                  <span className="ml-1 text-[10px] font-medium text-mist-600">在此</span>
                </p>
                <p className="num text-[10px] text-mist-600">{done} 已通过</p>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* 工具栏 */}
      <div className="fade-up panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center" style={{ animationDelay: '0.06s' }}>
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-mist-600" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题、研究问题或标签…"
            className="w-full rounded border border-line bg-carbon-900 py-2 pr-3 pl-9 text-sm text-mist-100 placeholder:text-mist-600 focus:border-tele-500/60 focus:ring-1 focus:ring-tele-500/40 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`cursor-pointer rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                category === c ? 'bg-race-500/15 text-race-400 ring-race' : 'text-mist-500 hover:bg-carbon-700/60 hover:text-mist-300'
              }`}
            >
              {c === 'all' ? '全部' : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="cursor-pointer rounded border border-line bg-carbon-900 px-2.5 py-2 text-xs font-semibold text-mist-300 focus:border-tele-500/60 focus:outline-none"
        >
          <option value="updated">按更新时间</option>
          <option value="progress">按流程进度</option>
          <option value="title">按标题</option>
        </select>
      </div>

      {/* 实验列表 */}
      {filtered.length === 0 ? (
        <EmptyState icon="🏁" title="没有匹配的实验" hint="调整搜索或筛选条件，或从下方模板创建一个新的实验。" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((exp, i) => {
            const pct = Math.round(stageProgress(exp) * 100);
            const atStage = currentStage(exp);
            const flow = experimentFlowStatus(exp);
            const completedTrials = exp.trials.filter(isUsableTrial).length;
            return (
              <article key={exp.id} className="fade-up panel group relative overflow-hidden p-4 transition-colors hover:border-line-bright" style={{ animationDelay: `${0.05 * i}s` }}>
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/experiments/${exp.id}`} className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-bold text-mist-100 transition-colors group-hover:text-tele-300">{exp.title}</h2>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-mist-500">{exp.question}</p>
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <CategoryBadge category={exp.category} />
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${FLOW_TONE[flow.key]}`}>
                      {flow.label}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {exp.tags.map((t) => (
                    <span key={t} className="rounded bg-carbon-700/70 px-1.5 py-0.5 text-[10px] text-mist-500">#{t}</span>
                  ))}
                </div>
                <div className="mt-3.5 flex items-center gap-3">
                  <StageSegments stages={exp.stages} className="flex-1" />
                  <span className="num text-xs font-bold text-tele-300">{pct}%</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <p className="num text-[10px] tracking-wider text-mist-600">
                    {completedTrials}/{exp.trials.length} TRIALS · 当前: {STAGE_MAP[atStage].shortName}
                  </p>
                  <div className="flex items-center gap-2">
                    <Link to={`/experiments/${exp.id}`} className="rounded border border-tele-500/40 bg-tele-500/10 px-2.5 py-1 text-[11px] font-bold text-tele-300 transition-colors hover:bg-tele-500/25">
                      打开 →
                    </Link>
                    <button
                      onClick={() => {
                        if (pendingDelete === exp.id) {
                          deleteExperiment(exp.id);
                          setPendingDelete(null);
                        } else {
                          setPendingDelete(exp.id);
                          setTimeout(() => setPendingDelete((p) => (p === exp.id ? null : p)), 3000);
                        }
                      }}
                      className={`cursor-pointer rounded border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        pendingDelete === exp.id ? 'border-danger-500 bg-danger-500/25 text-danger-400' : 'border-line text-mist-600 hover:border-danger-500/40 hover:text-danger-400'
                      }`}
                    >
                      {pendingDelete === exp.id ? '确认删除?' : '删除'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 模板 */}
      <Panel title="实验模板 · Launch New Experiment" className="fade-up">
        <div className="grid gap-3 md:grid-cols-3">
          {TEMPLATES.map((tpl) => (
            <div key={tpl.id} className={`flex flex-col rounded-lg border p-4 transition-all ${tpl.runnable ? 'border-tele-500/40 bg-carbon-800/50 hover:-translate-y-0.5 hover:border-tele-500/70' : 'border-line bg-carbon-900/60 opacity-80'}`}>
              <div className="flex items-center justify-between">
                <CategoryBadge category={tpl.category} />
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${tpl.runnable ? 'border-tele-500/40 bg-tele-500/10 text-tele-300' : 'border-signal-amber/40 bg-signal-amber/10 text-signal-amber'}`}>
                  {tpl.runnable ? '完整科研流程' : '运行器未接入'}
                </span>
              </div>
              <p className="mt-2.5 text-sm font-bold text-mist-100">{tpl.title}</p>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-mist-500">{tpl.brief}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-mist-600">{tpl.statusNote}</p>
              <button
                onClick={() => launch(tpl.id)}
                disabled={!tpl.runnable}
                title={tpl.runnable ? undefined : tpl.statusNote}
                className={`mt-3 rounded px-3 py-2 text-xs font-bold transition-all ${
                  tpl.runnable
                    ? 'cursor-pointer bg-race-500 text-white glow-race hover:bg-race-400 active:scale-95'
                    : 'cursor-not-allowed border border-line bg-carbon-800/60 text-mist-600'
                }`}
              >
                {tpl.runnable ? '创建实验' : '暂不可创建'}
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}