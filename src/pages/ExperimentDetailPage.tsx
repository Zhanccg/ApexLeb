import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLabStore } from '@/data/store';
import { DIRECTION_LABEL, ROLE_LABEL, type Conclusion, type StageId } from '@/data/schema';
import { STAGE_MAP, checkStageCompletion, currentStage, stageProgress } from '@/pedagogy';
import { generateReport } from '@/report/generator';
import { G } from '@/engine/constants';
import { fmtNum, isUsableTrial, trialInvalidReason } from '@/data/integrity';
import { Button, CategoryBadge, EmptyState, Panel, StageSegments, Toast } from '@/components/ui';
import StageTracker from '@/components/StageTracker';
import CorneringRunner from '@/components/CorneringRunner';
import { Sparkline, TelemetryChart } from '@/components/TelemetryChart';

const ROLE_STYLE = {
  independent: 'text-race-400 border-race-500/40 bg-race-500/10',
  dependent: 'text-tele-300 border-tele-500/40 bg-tele-500/10',
  controlled: 'text-signal-amber border-signal-amber/40 bg-signal-amber/10',
} as const;

export default function ExperimentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const exp = useLabStore((s) => s.experiments.find((e) => e.id === id));
  const completeStage = useLabStore((s) => s.completeStage);
  const updateQuestion = useLabStore((s) => s.updateQuestion);
  const setConclusion = useLabStore((s) => s.setConclusion);
  const addReport = useLabStore((s) => s.addReport);

  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'err' } | null>(null);
  const [focusStage, setFocusStage] = useState<StageId | null>(null);
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [questionDraft, setQuestionDraft] = useState('');
  const [selectedTrial, setSelectedTrial] = useState<string | null>(null);
  const [conclusionDraft, setConclusionDraft] = useState<Omit<Conclusion, 'createdAt'>>({
    statement: '',
    hypothesisVerdict: 'supported',
    limitations: '',
  });

  const notify = (message: string, tone: 'ok' | 'err') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2600);
  };

  const active = exp ? currentStage(exp) : 'question';
  const shownStage = focusStage ?? active;
  const stageDef = STAGE_MAP[shownStage];

  const trial = useMemo(() => {
    if (!exp) return null;
    return (
      exp.trials.find((t) => t.id === selectedTrial) ??
      exp.trials.find(isUsableTrial) ??
      exp.trials[0] ??
      null
    );
  }, [exp, selectedTrial]);

  const corneringPoints = useMemo(() => {
    if (!exp || exp.category !== 'cornering') return [];
    return exp.trials
      .filter(isUsableTrial)
      .map((t) => ({ x: t.params.speedKmh, y: t.metrics.lateralAccelMs2 }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);
  }, [exp]);

  if (!exp) {
    return (
      <div className="space-y-4">
        <EmptyState icon="🔍" title="未找到该实验" hint="它可能已被删除，或链接已失效。" />
        <Link to="/experiments" className="text-sm font-semibold text-tele-400 hover:text-tele-300">← 返回实验库</Link>
      </div>
    );
  }

  const pct = Math.round(stageProgress(exp) * 100);
  const check = checkStageCompletion(exp, shownStage);
  const stageDone = exp.stages[shownStage] === 'done';
  const completedTrials = exp.trials.filter(isUsableTrial);
  const invalidTrials = exp.trials.filter((t) => t.status === 'invalid' || trialInvalidReason(t) !== null);
  const refTrial = [...exp.trials].reverse().find(isUsableTrial) ?? null;

  const onCompleteStage = () => {
    const r = completeStage(exp.id, shownStage);
    notify(r.ok ? `阶段「${stageDef.name}」已完成` : r.reason, r.ok ? 'ok' : 'err');
    if (r.ok) setFocusStage(null);
  };

  const onGenerateReport = () => {
    const prevDone = ['question', 'hypothesis', 'design', 'collect', 'analyze', 'conclude'].every(
      (s) => exp.stages[s as StageId] === 'done',
    );
    if (!prevDone) {
      notify('请先完成前六个阶段，再生成正式报告', 'err');
      return;
    }
    addReport(generateReport(exp));
    notify('报告已生成，正在前往报告中心', 'ok');
    setTimeout(() => navigate('/reports'), 700);
  };

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <header className="fade-up">
        <Link to="/experiments" className="num text-[11px] tracking-widest text-mist-500 hover:text-tele-400">← GARAGE / 实验库</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-wide text-mist-100 sm:text-3xl">{exp.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CategoryBadge category={exp.category} />
              {exp.tags.map((t) => (
                <span key={t} className="rounded bg-carbon-700/70 px-1.5 py-0.5 text-[10px] text-mist-500">#{t}</span>
              ))}
              <span className="num text-[10px] text-mist-600">ID {exp.id}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="num text-3xl font-bold text-tele-300">{pct}<span className="text-sm text-mist-500">%</span></p>
            <p className="panel-title mt-0.5">流程进度</p>
          </div>
        </div>
        <StageSegments stages={exp.stages} className="mt-4" />
      </header>

      {/* 阶段追踪器 */}
      <Panel title="科研阶段追踪 · Stage Tracker" className="fade-up" right={<span className="num text-[10px] text-mist-600">点击阶段查看要求</span>}>
        <StageTracker exp={exp} onSelect={(s) => setFocusStage(s)} />
        <div className="mt-4 rounded-lg border border-line bg-carbon-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-mist-100">
              <span className="num mr-2 text-tele-400">S{stageDef.order}</span>
              {stageDef.name}
              <span className="ml-2 text-xs font-normal text-mist-500 italic">—— {stageDef.racingAnalogy}</span>
            </p>
            {stageDone ? (
              <span className="rounded border border-tele-500/40 bg-tele-500/10 px-2 py-1 text-[11px] font-bold text-tele-300">✓ 已完成</span>
            ) : (
              <Button onClick={onCompleteStage} disabled={!check.ok} variant="tele">
                标记本阶段完成
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mist-500">{stageDef.goal}</p>
          <p className={`mt-2 text-xs font-semibold ${stageDone || check.ok ? 'text-tele-300' : 'text-signal-amber'}`}>
            退出条件：{stageDef.exitCriteria} {stageDone ? '' : check.ok ? '（已满足 ✓）' : `（未满足：${check.reason}）`}
          </p>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 研究问题 */}
        <Panel
          title="① 研究问题"
          className="fade-up"
          right={
            !editingQuestion && (
              <button onClick={() => { setQuestionDraft(exp.question); setEditingQuestion(true); }} className="cursor-pointer text-[11px] font-semibold text-tele-400 hover:text-tele-300">
                编辑
              </button>
            )
          }
        >
          {editingQuestion ? (
            <div className="space-y-2">
              <textarea
                value={questionDraft}
                onChange={(e) => setQuestionDraft(e.target.value)}
                rows={3}
                className="w-full rounded border border-line bg-carbon-900 p-3 text-sm leading-relaxed text-mist-100 focus:border-tele-500/60 focus:outline-none"
              />
              <div className="flex gap-2">
                <Button variant="tele" onClick={() => { updateQuestion(exp.id, questionDraft.trim()); setEditingQuestion(false); notify('研究问题已更新', 'ok'); }}>保存</Button>
                <Button variant="ghost" onClick={() => setEditingQuestion(false)}>取消</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-mist-300">{exp.question}</p>
          )}
          <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-mist-600">
            要点：{STAGE_MAP.question.guidance[0]}
          </p>
        </Panel>

        {/* 假设 */}
        <Panel title="② 假设" className="fade-up">
          {exp.hypothesis ? (
            <div className="space-y-2.5 text-sm">
              <p className="leading-relaxed text-mist-300">{exp.hypothesis.statement}</p>
              <p className="text-xs text-mist-500">
                预期方向：<span className="font-semibold text-signal-amber">{DIRECTION_LABEL[exp.hypothesis.expectedDirection]}</span>
              </p>
              <p className="rounded border border-line bg-carbon-900/70 p-2.5 text-xs leading-relaxed text-mist-500">
                <span className="font-bold text-mist-300">物理依据：</span>{exp.hypothesis.rationale}
              </p>
            </div>
          ) : (
            <EmptyState icon="💭" title="尚未建立假设" hint="基于物理知识给出一个可被证伪的预测，并写明依据。" />
          )}
        </Panel>
      </div>

      {/* 变量表 */}
      <Panel title="③ 实验设计 · 变量表" className="fade-up">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] tracking-wider text-mist-600">
                <th className="pb-2 pr-3 font-semibold">变量</th>
                <th className="pb-2 pr-3 font-semibold">符号</th>
                <th className="pb-2 pr-3 font-semibold">角色</th>
                <th className="pb-2 pr-3 font-semibold">默认值</th>
                <th className="pb-2 pr-3 font-semibold">范围</th>
                <th className="pb-2 font-semibold">教学提示</th>
              </tr>
            </thead>
            <tbody>
              {exp.variables.map((v) => (
                <tr key={v.id} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-mist-100">{v.name}</td>
                  <td className="num py-2.5 pr-3 text-tele-300">{v.symbol}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${ROLE_STYLE[v.role]}`}>{ROLE_LABEL[v.role]}</span>
                  </td>
                  <td className="num py-2.5 pr-3 text-mist-300">{v.defaultValue} <span className="text-[10px] text-mist-600">{v.unit}</span></td>
                  <td className="num py-2.5 pr-3 text-xs text-mist-500">{v.min} – {v.max}</td>
                  <td className="py-2.5 text-xs leading-relaxed text-mist-500">{v.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* 试跑数据 */}
      <Panel
        title="④ 数据采集 · 试跑记录"
        className="fade-up"
        right={<span className="num text-[10px] text-mist-600">{completedTrials.length}/{exp.trials.length} COMPLETED</span>}
      >
        {invalidTrials.length > 0 && (
          <p role="alert" className="mb-4 rounded border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-[11px] leading-relaxed text-signal-amber">
            检测到 {invalidTrials.length} 条无效历史试跑：已标记 invalid，不计入有效试跑数量、不进入分析图表与报告；
            原始数值保留在列表中供查看与导出排查，不会自动删除。
          </p>
        )}
        {exp.category === 'cornering' ? (
          exp.stages.collect === 'locked' ? (
            <EmptyState icon="🔒" title="采集阶段未解锁" hint="请先完成实验设计阶段，再运行试跑——科研流程不允许跳步。" />
          ) : (
            <div className="space-y-4">
              <CorneringRunner exp={exp} notify={notify} />
              {exp.trials.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-line text-[11px] tracking-wider text-mist-600">
                          <th className="pb-2 pr-2 font-semibold">#</th>
                          <th className="pb-2 pr-2 font-semibold">v km/h</th>
                          <th className="pb-2 pr-2 font-semibold">R m</th>
                          <th className="pb-2 pr-2 font-semibold">μ</th>
                          <th className="pb-2 pr-2 font-semibold">ay m/s²</th>
                          <th className="pb-2 pr-2 font-semibold">λ</th>
                          <th className="pb-2 pr-2 font-semibold">v_limit km/h</th>
                          <th className="pb-2 font-semibold">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exp.trials.map((t) => {
                          const bad = t.status === 'invalid' || trialInvalidReason(t) !== null;
                          const over = !bad && t.metrics.gripUtilization > 1;
                          return (
                            <tr
                              key={t.id}
                              onClick={() => setSelectedTrial(t.id)}
                              title={bad ? (t.invalidReason ?? trialInvalidReason(t) ?? undefined) : undefined}
                              className={`cursor-pointer border-b border-line/60 transition-colors last:border-0 ${
                                bad ? 'opacity-60' : ''
                              } ${trial?.id === t.id ? 'bg-tele-500/8' : 'hover:bg-carbon-800/60'}`}
                            >
                              <td className="num py-2 pr-2 text-mist-500">
                                {Number.isFinite(t.index) ? String(t.index).padStart(2, '0') : '—'}
                              </td>
                              <td className="num py-2 pr-2 font-bold text-signal-amber">{fmtNum(t.params.speedKmh, 0)}</td>
                              <td className="num py-2 pr-2 text-mist-300">{fmtNum(t.params.radiusM, 0)}</td>
                              <td className="num py-2 pr-2 text-mist-300">{fmtNum(t.params.mu)}</td>
                              <td className="num py-2 pr-2 text-signal-ice">{fmtNum(t.metrics.lateralAccelMs2)}</td>
                              <td className={`num py-2 pr-2 font-bold ${over ? 'text-race-400' : 'text-tele-300'}`}>
                                {bad ? '非有限' : `${(t.metrics.gripUtilization * 100).toFixed(1)}%`}
                              </td>
                              <td className="num py-2 pr-2 text-signal-violet">{fmtNum(t.metrics.limitSpeedKmh)}</td>
                              <td className="py-2">
                                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                                  bad
                                    ? 'border-race-500/50 bg-race-500/15 text-race-400'
                                    : over
                                      ? 'border-signal-amber/40 bg-signal-amber/10 text-signal-amber'
                                      : 'border-signal-lime/40 bg-signal-lime/10 text-signal-lime'
                                }`}>
                                  {bad ? '无效' : over ? '超出附着' : '附着内'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="num mt-2 text-[10px] text-mist-600">
                      点击行切换右侧参考线 · 模型 {trial?.modelVersion ?? '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-line bg-carbon-900/60 p-3">
                    <p className="panel-title mb-1">侧向加速度–车速曲线 · 虚线为 ay_max = μg</p>
                    {corneringPoints.length >= 2 ? (
                      <TelemetryChart
                        points={corneringPoints}
                        color="#4cc3ff"
                        xLabel="v / km/h"
                        yLabel="ay / m/s²"
                        animate={false}
                        reference={{
                          y: (refTrial?.params.mu ?? 1) * G,
                          label: `ay_max = ${((refTrial?.params.mu ?? 1) * G).toFixed(2)} m/s²`,
                        }}
                      />
                    ) : (
                      <p className="py-8 text-center text-xs text-mist-500">再以不同车速运行一次试跑，即可生成 ay–v 对比曲线。</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        ) : exp.trials.length === 0 ? (
          <div className="space-y-3">
            <EmptyState icon="🏎️" title="暂无试跑数据" hint="数值仿真器将在第二阶段接入。届时每次试跑会按变量表取值执行，并逐帧记录遥测通道（速度 / 距离 / 加速度）。" />
            <p className="num text-center text-[10px] tracking-[0.3em] text-mist-600">SIMULATOR · COMING IN PHASE 2</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] tracking-wider text-mist-600">
                    <th className="pb-2 pr-2 font-semibold">#</th>
                    <th className="pb-2 pr-2 font-semibold">μ</th>
                    <th className="pb-2 pr-2 font-semibold">制动距离</th>
                    <th className="pb-2 pr-2 font-semibold">刹停用时</th>
                    <th className="pb-2 font-semibold">速度曲线</th>
                  </tr>
                </thead>
                <tbody>
                  {exp.trials.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTrial(t.id)}
                      className={`cursor-pointer border-b border-line/60 transition-colors last:border-0 ${
                        (trial?.id === t.id) ? 'bg-tele-500/8' : 'hover:bg-carbon-800/60'
                      }`}
                    >
                      <td className="num py-2 pr-2 text-mist-500">{String(t.index).padStart(2, '0')}</td>
                      <td className="num py-2 pr-2 font-bold text-signal-amber">{fmtNum(t.params.mu)}</td>
                      <td className="num py-2 pr-2 text-mist-100">{fmtNum(t.metrics.brakeDistance)} m</td>
                      <td className="num py-2 pr-2 text-mist-500">{fmtNum(t.metrics.stopTime)} s</td>
                      <td className="py-2"><Sparkline values={t.samples.map((s) => s.channels.speed).filter(Number.isFinite)} color={trial?.id === t.id ? '#00d2be' : '#647182'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trial?.note && <p className="mt-2 text-[11px] text-mist-500 italic">试跑 {trial.index} 备注：{trial.note}</p>}
            </div>
            <div className="rounded-lg border border-line bg-carbon-900/60 p-3">
              <p className="panel-title mb-1">试跑 {String(trial?.index ?? 0).padStart(2, '0')} · 速度遥测 (km/h vs s)</p>
              {trial && (
                <TelemetryChart
                  points={trial.samples
                    .map((s) => ({ x: s.t, y: s.channels.speed }))
                    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))}
                  color="#e10600"
                  xLabel="t / s"
                  yLabel="speed / km/h"
                  animate={false}
                />
              )}
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 分析 */}
        <Panel title="⑤ 分析发现" className="fade-up">
          {exp.analysis ? (
            <div className="space-y-3">
              <p className="text-xs text-mist-500"><span className="font-bold text-mist-300">方法：</span>{exp.analysis.method}</p>
              {exp.analysis.findings.map((f) => (
                <div key={f.id} className="rounded border border-line bg-carbon-900/70 p-3">
                  <p className="text-sm leading-relaxed text-mist-300">{f.observation}</p>
                  <p className="num mt-2 flex items-center gap-2 text-[10px] text-mist-600">
                    证据 {f.evidenceTrialIds.join(' · ')}
                    <span className={`rounded px-1.5 py-0.5 font-bold ${f.supportsHypothesis ? 'bg-tele-500/15 text-tele-300' : 'bg-race-500/15 text-race-400'}`}>
                      {f.supportsHypothesis ? '支持假设' : '不支持假设'}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="📈" title="尚未分析" hint="先画图再下结论：把试跑数据绘制成散点图，寻找趋势并关联证据。分析工作台将在第二阶段提供。" />
          )}
        </Panel>

        {/* 结论 */}
        <Panel title="⑥ 结论" className="fade-up">
          {exp.conclusion ? (
            <div className="space-y-2.5 text-sm">
              <p className="leading-relaxed text-mist-300">{exp.conclusion.statement}</p>
              <p className="text-xs font-bold">
                {{ supported: <span className="text-tele-300">✅ 假设被数据支持</span>, rejected: <span className="text-race-400">❌ 假设被数据拒绝</span>, inconclusive: <span className="text-signal-amber">⚠️ 证据不足</span> }[exp.conclusion.hypothesisVerdict]}
              </p>
              {exp.conclusion.limitations && (
                <p className="rounded border border-line bg-carbon-900/70 p-2.5 text-xs leading-relaxed text-mist-500">
                  <span className="font-bold text-mist-300">局限：</span>{exp.conclusion.limitations}
                </p>
              )}
            </div>
          ) : exp.stages.conclude === 'active' ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (conclusionDraft.statement.trim().length < 8) {
                  notify('结论陈述至少 8 个字', 'err');
                  return;
                }
                setConclusion(exp.id, conclusionDraft);
                notify('结论已记录，可标记阶段完成', 'ok');
              }}
            >
              <textarea
                value={conclusionDraft.statement}
                onChange={(e) => setConclusionDraft({ ...conclusionDraft, statement: e.target.value })}
                rows={3}
                placeholder="回答最初的研究问题，例如：在 100 km/h 初速度下，制动距离与摩擦系数成反比…"
                className="w-full rounded border border-line bg-carbon-900 p-3 text-sm text-mist-100 placeholder:text-mist-600 focus:border-tele-500/60 focus:outline-none"
              />
              <select
                value={conclusionDraft.hypothesisVerdict}
                onChange={(e) => setConclusionDraft({ ...conclusionDraft, hypothesisVerdict: e.target.value as Conclusion['hypothesisVerdict'] })}
                className="w-full cursor-pointer rounded border border-line bg-carbon-900 px-3 py-2 text-sm text-mist-300 focus:border-tele-500/60 focus:outline-none"
              >
                <option value="supported">假设被数据支持</option>
                <option value="rejected">假设被数据拒绝</option>
                <option value="inconclusive">证据不足，无法判定</option>
              </select>
              <textarea
                value={conclusionDraft.limitations}
                onChange={(e) => setConclusionDraft({ ...conclusionDraft, limitations: e.target.value })}
                rows={2}
                placeholder="局限与适用范围（模型简化、取值范围等）"
                className="w-full rounded border border-line bg-carbon-900 p-3 text-sm text-mist-100 placeholder:text-mist-600 focus:border-tele-500/60 focus:outline-none"
              />
              <Button type="submit" variant="tele">保存结论</Button>
            </form>
          ) : (
            <EmptyState icon="🔒" title="结论阶段未解锁" hint="完成数据采集与分析后，才能进入结论阶段——科研流程不允许跳步。" />
          )}
        </Panel>
      </div>

      {/* 报告 */}
      <Panel title="⑦ 实验报告" className="fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-xs leading-relaxed text-mist-500">
            报告生成器会把问题、假设、变量表、试跑数据、分析、结论与流程存档组装为标准结构的 Markdown 报告。
            完成全部前序阶段后即可生成并下载。
          </p>
          <Button onClick={onGenerateReport}>生成实验报告 →</Button>
        </div>
      </Panel>

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}