import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLabStore } from '@/data/store';
import { DIRECTION_LABEL, ROLE_LABEL, type Conclusion, type StageId } from '@/data/schema';
import { STAGE_MAP, checkStageCompletion, checkFindingEvidence, currentStage, evaluateComparison, stageProgress } from '@/pedagogy';
import { generateReport, reportEvidenceBlockers } from '@/report/generator';
import { G } from '@/engine/constants';
import { fmtNum, fmtParam, isUsableTrial, readChannel, readMetric, readParam, samplesOf, trialInvalidReason } from '@/data/integrity';
import { Button, CategoryBadge, EmptyState, Panel, StageSegments, Toast } from '@/components/ui';
import StageTracker from '@/components/StageTracker';
import CorneringRunner from '@/components/CorneringRunner';
import MethodEditor from '@/components/MethodEditor';
import MethodCoach from '@/components/MethodCoach';
import AnalysisWorkbench from '@/components/AnalysisWorkbench';
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
  const [editingMethod, setEditingMethod] = useState(false);
  const [questionDraft, setQuestionDraft] = useState('');
  const [selectedTrial, setSelectedTrial] = useState<string | null>(null);
  const [conclusionDraft, setConclusionDraft] = useState<Omit<Conclusion, 'createdAt'>>({
    statement: '',
    hypothesisVerdict: 'supported',
    limitations: '',
  });
  const [editingConclusion, setEditingConclusion] = useState(false);
  const [conclusionErrors, setConclusionErrors] = useState<{ statement?: string; limitations?: string }>({});

  const openConclusionEdit = () => {
    setConclusionDraft({
      statement: exp?.conclusion?.statement ?? '',
      hypothesisVerdict: exp?.conclusion?.hypothesisVerdict ?? 'supported',
      limitations: exp?.conclusion?.limitations ?? '',
    });
    setConclusionErrors({});
    setEditingConclusion(true);
  };

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

  const comparison = useMemo(() => (exp ? evaluateComparison(exp) : null), [exp]);

  const corneringPoints = useMemo(() => {
    if (!comparison) return [];
    const key = comparison.independent?.id ?? 'speedKmh';
    return comparison.eligible
      .flatMap((t) => {
        const x = readParam(t, key);
        const y = readMetric(t, 'lateralAccelMs2');
        return x !== undefined && y !== undefined ? [{ x, y }] : [];
      })
      .sort((a, b) => a.x - b.x);
  }, [comparison]);

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
    const blockers = reportEvidenceBlockers(exp);
    if (blockers.length > 0) {
      notify(`证据复核未通过：${blockers[0]}`, 'err');
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

      {editingMethod && exp.category === 'cornering' && (
        <Panel title="方法编辑器 · 假设与变量角色" className="fade-up">
          <MethodEditor
            exp={exp}
            onClose={(saved, notice) => {
              setEditingMethod(false);
              if (saved) notify(notice ?? '方法设置已保存', 'ok');
            }}
          />
        </Panel>
      )}

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
        <Panel
          title="② 假设"
          className="fade-up"
          right={
            exp.category === 'cornering' && (
              <button onClick={() => setEditingMethod(true)} className="cursor-pointer text-[11px] font-semibold text-tele-400 hover:text-tele-300">
                编辑假设 / 变量
              </button>
            )
          }
        >
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
      <Panel
        title="③ 实验设计 · 变量表"
        className="fade-up"
        right={
          exp.category === 'cornering' && (
            <button onClick={() => setEditingMethod(true)} className="cursor-pointer text-[11px] font-semibold text-tele-400 hover:text-tele-300">
              编辑变量角色
            </button>
          )
        }
      >
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

      {exp.category === 'cornering' && comparison && (
        <Panel title="实验方法纠错 · Method Coach" className="fade-up">
          <MethodCoach exp={exp} report={comparison} />
        </Panel>
      )}

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
              <CorneringRunner exp={exp} report={comparison!} notify={notify} />
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
                          const lambda = readMetric(t, 'gripUtilization');
                          const over = !bad && lambda !== undefined && lambda > 1;
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
                              <td className="num py-2 pr-2 font-bold text-signal-amber">{fmtParam(readParam(t, 'speedKmh'))}</td>
                              <td className="num py-2 pr-2 text-mist-300">{fmtParam(readParam(t, 'radiusM'))}</td>
                              <td className="num py-2 pr-2 text-mist-300">{fmtParam(readParam(t, 'mu'))}</td>
                              <td className="num py-2 pr-2 text-signal-ice">{fmtNum(readMetric(t, 'lateralAccelMs2'))}</td>
                              <td className={`num py-2 pr-2 font-bold ${over ? 'text-race-400' : 'text-tele-300'}`}>
                                {lambda === undefined ? '非有限' : `${(lambda * 100).toFixed(1)}%`}
                              </td>
                              <td className="num py-2 pr-2 text-signal-violet">{fmtNum(readMetric(t, 'limitSpeedKmh'))}</td>
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
                    <p className="panel-title mb-1">
                      侧向加速度–{comparison?.independent?.name ?? '车速'}曲线 · 虚线为 ay_max = μg
                    </p>
                    {corneringPoints.length >= 2 ? (
                      <TelemetryChart
                        points={corneringPoints}
                        color="#4cc3ff"
                        xLabel={`${comparison?.independent?.symbol ?? 'v'} / ${comparison?.independent?.unit ?? 'km/h'}`}
                        yLabel="ay / m/s²"
                        animate={false}
                        reference={{
                          y: (readParam(refTrial, 'mu') ?? 1) * G,
                          label: `ay_max = ${((readParam(refTrial, 'mu') ?? 1) * G).toFixed(2)} m/s²`,
                        }}
                      />
                    ) : (
                      <p className="py-8 text-center text-xs text-mist-500">再以不同自变量取值运行一次合格试跑，即可生成对照曲线。</p>
                    )}
                    <p className="mt-1 text-[10px] text-mist-600">
                      仅绘制合格对照（混杂 / 无效 / 重复判定见 Method Coach）· 横轴与实验方案自变量一致
                    </p>
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
                      <td className="num py-2 pr-2 font-bold text-signal-amber">{fmtParam(readParam(t, 'mu'))}</td>
                      <td className="num py-2 pr-2 text-mist-100">{fmtNum(readMetric(t, 'brakeDistance'))} m</td>
                      <td className="num py-2 pr-2 text-mist-500">{fmtNum(readMetric(t, 'stopTime'))} s</td>
                      <td className="py-2"><Sparkline values={samplesOf(t).map((s) => readChannel(s, 'speed')).filter((v): v is number => v !== undefined)} color={trial?.id === t.id ? '#00d2be' : '#647182'} /></td>
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
                  points={samplesOf(trial).flatMap((s) => {
                    const x = typeof s.t === 'number' && Number.isFinite(s.t) ? s.t : undefined;
                    const y = readChannel(s, 'speed');
                    return x !== undefined && y !== undefined ? [{ x, y }] : [];
                  })}
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

      {exp.category === 'cornering' && comparison && exp.stages.analyze !== 'locked' && (
        <Panel title="⑤ 数据分析 · 分析工作台" className="fade-up">
          <AnalysisWorkbench exp={exp} report={comparison} notify={notify} />
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 分析 */}
        <Panel title={exp.category === 'cornering' && exp.stages.analyze !== 'locked' ? '⑤ 分析状态' : '⑤ 分析发现'} className="fade-up">
          {exp.category === 'cornering' && comparison && exp.stages.analyze !== 'locked' ? (
            <div className="space-y-2 text-xs leading-relaxed">
              <p className="text-mist-500"><span className="font-bold text-mist-300">方法：</span>{exp.analysis?.method || '—'}</p>
              <p className="text-mist-500"><span className="font-bold text-mist-300">模型局限：</span>{exp.analysis?.limitations || '—'}</p>
              <p className="num font-bold text-mist-300">
                {exp.analysis?.findings.length ?? 0} 条研究发现 · 合格对照 {comparison.counts.eligible} 条
              </p>
              {(exp.analysis?.findings ?? []).flatMap((f, i) =>
                checkFindingEvidence(comparison, f).problems.map((p, n) => (
                  <p key={`${i}-${n}`} role="alert" className="font-semibold text-signal-amber">⚠ 发现 #{i + 1}：{p}</p>
                )),
              )}
              <p className="text-mist-600">在上方工作台编辑发现、勾选证据试跑并导出 CSV。</p>
            </div>
          ) : exp.analysis ? (
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
          {exp.category === 'cornering' && comparison && exp.stages.conclude !== 'locked' && (
            <div className="mb-3 space-y-1.5 rounded-lg border border-line bg-carbon-900/70 p-3 text-xs leading-relaxed">
              <p className="panel-title">结论证据上下文</p>
              <p className="text-mist-300">{exp.question}</p>
              {exp.hypothesis && <p className="text-mist-500">原始假设：{exp.hypothesis.statement}</p>}
              <p className="num text-mist-500">
                合格对照 {comparison.counts.eligible} 条 · 不同取值 {comparison.counts.distinct} 个
                {comparison.baseline && ` · 基准 #${String(comparison.baseline.index).padStart(2, '0')}`}
              </p>
              {(exp.analysis?.findings ?? []).map((f) => (
                <p key={f.id} className="text-mist-500">
                  发现：{f.observation}
                  <span className="num ml-1 text-tele-300">证据 {f.evidenceTrialIds.join('、')}</span>
                  <span className={`ml-1 font-bold ${f.supportsHypothesis ? 'text-tele-300' : 'text-race-400'}`}>
                    {f.supportsHypothesis ? '支持假设' : '不支持假设'}
                  </span>
                </p>
              ))}
              {exp.analysis?.limitations && <p className="text-mist-600">模型局限（分析阶段）：{exp.analysis.limitations}</p>}
            </div>
          )}
          {exp.stages.conclude === 'locked' ? (
            <EmptyState icon="🔒" title="结论阶段未解锁" hint="完成数据采集与分析后，才能进入结论阶段——科研流程不允许跳步。" />
          ) : (
            <div className="space-y-3">
              {exp.conclusion && !editingConclusion && (
                <div className="space-y-2.5 text-sm">
                  <p className="leading-relaxed text-mist-300">{exp.conclusion.statement}</p>
                  <p className="text-xs font-bold">
                    {{ supported: <span className="text-tele-300">✅ 假设被数据支持</span>, rejected: <span className="text-race-400">❌ 假设被数据拒绝</span>, inconclusive: <span className="text-signal-amber">⚠️ 证据不足</span> }[exp.conclusion.hypothesisVerdict]}
                  </p>
                  {exp.conclusion.limitations?.trim() ? (
                    <p className="rounded border border-line bg-carbon-900/70 p-2.5 text-xs leading-relaxed text-mist-500">
                      <span className="font-bold text-mist-300">局限：</span>{exp.conclusion.limitations}
                    </p>
                  ) : (
                    <p role="alert" className="rounded border border-signal-amber/50 bg-signal-amber/10 p-2.5 text-xs leading-relaxed text-signal-amber">
                      ⚠ 结论存在必填缺口：模型局限性未填写。请编辑结论补充（例如未考虑空气动力学或轮胎非线性特性）；
                      不完整结论无法通过报告复核，历史阶段标记保留不变。
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" onClick={openConclusionEdit}>编辑结论</Button>
                    <span className="text-[11px] text-mist-600">已保存的结论可随时重新编辑，不会因保存过而锁定。</span>
                  </div>
                </div>
              )}
              {(editingConclusion || !exp.conclusion) && (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const errs: { statement?: string; limitations?: string } = {};
                    if (conclusionDraft.statement.trim().length < 8) {
                      errs.statement = '结论陈述至少 8 个字，需回答最初的研究问题。';
                    }
                    if (!conclusionDraft.limitations.trim()) {
                      errs.limitations = '请补充本次实验所用简化物理模型的局限性，例如未考虑空气动力学或轮胎非线性特性。';
                    }
                    if (errs.statement || errs.limitations) {
                      setConclusionErrors(errs);
                      notify(errs.limitations ?? errs.statement ?? '请补全结论必填字段', 'err');
                      return;
                    }
                    setConclusionErrors({});
                    setConclusion(exp.id, {
                      statement: conclusionDraft.statement.trim(),
                      hypothesisVerdict: conclusionDraft.hypothesisVerdict,
                      limitations: conclusionDraft.limitations.trim(),
                    });
                    setEditingConclusion(false);
                    notify('结论已保存：可在阶段追踪器标记「得出结论」完成', 'ok');
                  }}
                >
                  <div>
                    <textarea
                      value={conclusionDraft.statement}
                      onChange={(e) => {
                        setConclusionDraft({ ...conclusionDraft, statement: e.target.value });
                        if (conclusionErrors.statement) setConclusionErrors({ ...conclusionErrors, statement: undefined });
                      }}
                      rows={3}
                      aria-label="研究结论"
                      aria-invalid={Boolean(conclusionErrors.statement)}
                      placeholder="回答最初的研究问题，例如：在 R=50 m、μ=1 条件下，侧向加速度与车速平方成正比…"
                      className={`w-full rounded border bg-carbon-900 p-3 text-sm text-mist-100 placeholder:text-mist-600 focus:border-tele-500/60 focus:outline-none ${conclusionErrors.statement ? 'border-race-500/70' : 'border-line'}`}
                    />
                    {conclusionErrors.statement && (
                      <p role="alert" className="mt-1 text-[11px] font-semibold text-race-400">✕ {conclusionErrors.statement}</p>
                    )}
                  </div>
                  <select
                    value={conclusionDraft.hypothesisVerdict}
                    onChange={(e) => setConclusionDraft({ ...conclusionDraft, hypothesisVerdict: e.target.value as Conclusion['hypothesisVerdict'] })}
                    aria-label="假设判断"
                    className="w-full cursor-pointer rounded border border-line bg-carbon-900 px-3 py-2 text-sm text-mist-300 focus:border-tele-500/60 focus:outline-none"
                  >
                    <option value="supported">假设被数据支持</option>
                    <option value="rejected">假设被数据拒绝</option>
                    <option value="inconclusive">证据不足，无法判定</option>
                  </select>
                  <div>
                    <textarea
                      value={conclusionDraft.limitations}
                      onChange={(e) => {
                        setConclusionDraft({ ...conclusionDraft, limitations: e.target.value });
                        if (conclusionErrors.limitations) setConclusionErrors({ ...conclusionErrors, limitations: undefined });
                      }}
                      rows={2}
                      aria-label="模型局限性"
                      aria-invalid={Boolean(conclusionErrors.limitations)}
                      placeholder="模型局限与适用范围（必填）：例如简化质点模型未含轮胎特性、空气动力与载荷转移…"
                      className={`w-full rounded border bg-carbon-900 p-3 text-sm text-mist-100 placeholder:text-mist-600 focus:border-tele-500/60 focus:outline-none ${conclusionErrors.limitations ? 'border-race-500/70' : 'border-line'}`}
                    />
                    {conclusionErrors.limitations && (
                      <p role="alert" className="mt-1 text-[11px] font-semibold leading-relaxed text-race-400">✕ {conclusionErrors.limitations}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" variant="tele">保存结论</Button>
                    {exp.conclusion && (
                      <Button variant="ghost" onClick={() => { setEditingConclusion(false); setConclusionErrors({}); }}>取消编辑</Button>
                    )}
                  </div>
                  <p className="text-[10px] leading-relaxed text-mist-600">
                    「保存结论」仅记录内容；「得出结论」阶段完成另需必填字段齐全与证据复核通过（见阶段追踪器退出条件）。
                    保存失败不会清空已填写的其他字段。
                  </p>
                </form>
              )}
            </div>
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

      {exp.stages.report === 'done' && (
        <div className="fade-up flex flex-wrap items-center gap-3 rounded-lg border border-tele-500/40 bg-tele-500/10 p-4">
          <p className="text-sm font-bold text-tele-300">
            🏁 科研流程闭环完成：问题 → 假设 → 设计 → 采集 → 分析 → 结论 → 报告。
          </p>
          <Link
            to="/reports"
            className="ml-auto rounded border border-tele-500/40 bg-tele-500/15 px-3 py-1.5 text-xs font-bold text-tele-300 transition-colors hover:bg-tele-500/25"
          >
            前往报告中心查看 / 下载 →
          </Link>
        </div>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}