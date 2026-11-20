import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLabStore } from '@/data/store';
import { isUsableTrial } from '@/data/integrity';
import { TEMPLATES } from '@/data/templates';
import { CATEGORY_LABEL, type ExperimentCategory } from '@/data/schema';
import { currentStage, stageProgress, STAGE_MAP } from '@/pedagogy';
import { CategoryBadge, EmptyState, Panel, StageSegments } from '@/components/ui';

type SortKey = 'updated' | 'progress' | 'title';
const CATEGORIES: Array<ExperimentCategory | 'all'> = ['all', 'braking', 'cornering', 'acceleration', 'aero'];

export default function ExperimentsPage() {
  const experiments = useLabStore((s) => s.experiments);
  const createFromTemplate = useLabStore((s) => s.createFromTemplate);
  const deleteExperiment = useLabStore((s) => s.deleteExperiment);
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExperimentCategory | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = experiments.filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (!q || e.title.toLowerCase().includes(q) || e.question.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q))),
    );
    list = [...list].sort((a, b) => {
      if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt);
      if (sort === 'progress') return stageProgress(b) - stageProgress(a);
      return a.title.localeCompare(b.title, 'zh-CN');
    });
    return list;
  }, [experiments, query, category, sort]);

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
                category === c ? 'bg-race-500/15 text-race-400 shadow-[inset_0_0_0_1px_rgba(225,6,0,0.4)]' : 'text-mist-500 hover:bg-carbon-700/60 hover:text-mist-300'
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
            const stage = currentStage(exp);
            const completedTrials = exp.trials.filter(isUsableTrial).length;
            return (
              <article key={exp.id} className="fade-up panel group relative overflow-hidden p-4 transition-colors hover:border-line-bright" style={{ animationDelay: `${0.05 * i}s` }}>
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/experiments/${exp.id}`} className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-bold text-mist-100 transition-colors group-hover:text-tele-300">{exp.title}</h2>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-mist-500">{exp.question}</p>
                  </Link>
                  <CategoryBadge category={exp.category} />
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
                    {completedTrials}/{exp.trials.length} TRIALS · 当前: {STAGE_MAP[stage].shortName}
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
                        pendingDelete === exp.id ? 'border-race-500 bg-race-500/25 text-race-400' : 'border-line text-mist-600 hover:border-race-500/40 hover:text-race-400'
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
            <div key={tpl.id} className="flex flex-col rounded-lg border border-line bg-carbon-800/50 p-4 transition-all hover:-translate-y-0.5 hover:border-line-bright">
              <div className="flex items-center justify-between">
                <CategoryBadge category={tpl.category} />
                <span className="num text-[10px] text-mist-600">{tpl.variables.length} VARS</span>
              </div>
              <p className="mt-2.5 text-sm font-bold text-mist-100">{tpl.title}</p>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-mist-500">{tpl.brief}</p>
              <p className="mt-2 line-clamp-2 text-[11px] text-mist-600 italic">“{tpl.question}”</p>
              <button
                onClick={() => launch(tpl.id)}
                className="mt-3 cursor-pointer rounded bg-race-500 px-3 py-2 text-xs font-bold text-white shadow-[0_0_16px_rgba(225,6,0,0.3)] transition-all hover:bg-race-400 active:scale-95"
              >
                创建实验
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}