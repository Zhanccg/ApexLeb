import { useState } from 'react';
import type { Experiment } from '@/data/schema';
import type { ComparisonReport } from '@/pedagogy';
import { useLabStore } from '@/data/store';
import { isUsableTrial, readParam } from '@/data/integrity';
import { planControlRestore, MIN_DISTINCT_LEVELS, MIN_ELIGIBLE_TRIALS } from '@/pedagogy';
import {
  CORNERING_MODEL_VERSION,
  computeCorneringRun,
  validateCorneringInputs,
  type CorneringParams,
} from '@/engine';
import { G } from '@/engine/constants';
import { Button } from '@/components/ui';

const FIELDS: Array<{ key: keyof CorneringParams; label: string; symbol: string; unit: string; step: string; hint: string }> = [
  { key: 'speedKmh', label: '车辆速度', symbol: 'v', unit: 'km/h', step: 'any', hint: '内部换算为 m/s 参与计算；支持小数输入' },
  { key: 'radiusM', label: '弯道半径', symbol: 'R', unit: 'm', step: 'any', hint: '必须大于 0；支持小数输入' },
  { key: 'mu', label: '路面附着系数', symbol: 'μ', unit: '—', step: 'any', hint: '必须大于 0；支持小数输入' },
];

export default function CorneringRunner({
  exp,
  report,
  onOpenMethod,
}: {
  exp: Experiment;
  report: ComparisonReport;
  onOpenMethod?: () => void;
}) {
  const addTrial = useLabStore((s) => s.addTrial);
  const completeStage = useLabStore((s) => s.completeStage);
  const [raw, setRaw] = useState<Record<keyof CorneringParams, string>>({
    speedKmh: '54',
    radiusM: '50',
    mu: '1.0',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CorneringParams, string>>>({});
  const [computeError, setComputeError] = useState<string | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [fixedForTrialId, setFixedForTrialId] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);

  const completed = exp.trials.filter(isUsableTrial);
  const invalidCount = exp.trials.length - completed.length;
  const latest = completed[completed.length - 1] ?? null;
  const latestComp = latest
    ? computeCorneringRun({
        speedKmh: readParam(latest, 'speedKmh') ?? 0,
        radiusM: readParam(latest, 'radiusM') ?? 0,
        mu: readParam(latest, 'mu') ?? 0,
      })
    : null;
  const latestResult = latestComp && latestComp.ok ? latestComp.result : null;

  const onRun = () => {
    const check = validateCorneringInputs(raw);
    if (!check.ok) {
      setErrors({ [check.field]: check.error });
      setComputeError(null);
      return;
    }
    setErrors({});
    const comp = computeCorneringRun(check.value);
    if (!comp.ok) {
      setComputeError(comp.error);
      return;
    }
    setComputeError(null);
    const res = comp.result;
    const vMs = check.value.speedKmh / 3.6;
    // FIX-03：存储保留完整计算精度，显示/导出统一由格式化出口负责舍入
    const samples = Array.from({ length: 25 }, (_, i) => {
      const t = i / 6;
      return {
        t: Number(t.toFixed(3)),
        channels: {
          speed: check.value.speedKmh,
          lateralAccelMs2: res.lateralAccelMs2,
          gripUtilization: res.gripUtilization,
          distance: vMs * t,
        },
      };
    });
    const trial = addTrial(exp.id, {
      params: { ...check.value },
      metrics: {
        lateralAccelMs2: res.lateralAccelMs2,
        gripUtilization: res.gripUtilization,
        limitSpeedKmh: res.limitSpeedKmh,
        limitSpeedMs: res.limitSpeedMs,
      },
      samples,
      modelVersion: CORNERING_MODEL_VERSION,
    });
    if (!trial) {
      setComputeError('试跑未保存：实验不存在或记录含非有限数值');
      return;
    }
    setLastRunId(trial.id);
    setFixError(null);
    setStageError(null);
    setFixedForTrialId(null);
  };

  const exceeded = latestResult?.status === 'grip-exceeded';

  // UX-02：资格反馈唯一来源 = evaluateComparison 的 evaluations（持久化数据重算，刷新后依然正确）
  const latestEval = report.evaluations[report.evaluations.length - 1] ?? null;
  const focusEval = report.evaluations.find((e) => e.trial.id === lastRunId) ?? latestEval;
  const feedbackKind: 'eligible' | 'replicate' | 'confounded' | 'invalid' | 'scheme' | null = !focusEval
    ? null
    : !focusEval.usable
      ? 'invalid'
      : focusEval.confounded.length > 0
        ? 'confounded'
        : focusEval.replicate
          ? 'replicate'
          : focusEval.eligible
            ? 'eligible'
            : 'scheme';

  const unitOf = (key: string) => report.controlled.find((v) => v.id === key)?.unit ?? '';
  // FIX-B：以资格卡对应试跑的已保存原始参数为基础，仅替换混杂控制变量；保留自变量取值
  const fixControls = () => {
    if (!focusEval) return;
    const plan = planControlRestore(focusEval.trial, report.baseline, focusEval.confounded);
    if (!plan.ok) {
      setFixError(plan.problems.join('；'));
      return;
    }
    setRaw({
      speedKmh: String(plan.params.speedKmh),
      radiusM: String(plan.params.radiusM),
      mu: String(plan.params.mu),
    });
    setErrors({});
    setFixError(null);
    setFixedForTrialId(focusEval.trial.id);
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const missingLevels = Math.max(0, MIN_DISTINCT_LEVELS - report.counts.distinct);
  const nextStep: { text: string; action?: { label: string; fn: () => void } } = (() => {
    if (exp.stages.hypothesis !== 'done') {
      return { text: '完成研究假设与变量角色设置', action: onOpenMethod ? { label: '打开方法编辑器', fn: onOpenMethod } : undefined };
    }
    if (exp.stages.design !== 'done') {
      return { text: '确认自变量 / 因变量 / 控制变量', action: onOpenMethod ? { label: '确认变量角色', fn: onOpenMethod } : undefined };
    }
    if (exp.stages.collect === 'locked') {
      return { text: '按顺序完成前序阶段以解锁采集', action: { label: '查看阶段追踪器', fn: () => scrollTo('stage-tracker') } };
    }
    if (exp.stages.collect === 'active') {
      if (feedbackKind === 'confounded' && focusEval) {
        if (fixedForTrialId === focusEval.trial.id) {
          return { text: '已按该试跑原始参数恢复控制变量（自变量取值保留），请点击「运行试验」生成新记录', action: { label: '运行试验', fn: onRun } };
        }
        return {
          text: `恢复 ${focusEval.confounded.map((d) => d.name).join('、')} 至基准值后重新运行`,
          action: { label: '一键恢复控制变量', fn: fixControls },
        };
      }
      if (!report.collectReady) {
        return { text: `还差 ${missingLevels} 个不同自变量水平：改变${report.independent?.name ?? '自变量'}取值后运行新试跑` };
      }
      return {
        text: '对照要求已满足：标记「数据采集」完成，进入数据分析',
        action: {
          label: '标记采集完成',
          fn: () => {
            const r = completeStage(exp.id, 'collect');
            setStageError(r.ok ? null : r.reason);
          },
        },
      };
    }
    // FIX-C：历史采集完成但当前方案对照不足 → 优先补齐建议，查看分析明确标注为历史结果
    if (!report.collectReady) {
      return {
        text: `历史采集完成标记保留；当前方案水平仅 ${report.counts.distinct}/${MIN_DISTINCT_LEVELS}，合格对照不足：请先补齐合格对照`,
        action: { label: '查看历史分析结果', fn: () => scrollTo('analysis-workbench') },
      };
    }
    if (exp.stages.analyze === 'active') {
      return { text: '进入分析工作台：勾选证据试跑并保存研究发现', action: { label: '前往分析工作台', fn: () => scrollTo('analysis-workbench') } };
    }
    if (exp.stages.conclude === 'active') {
      return { text: '填写研究结论与模型局限性', action: { label: '前往结论', fn: () => scrollTo('conclusion-panel') } };
    }
    // FIX-C：结论完成但报告未生成 → 引导生成报告，而非宣称闭环完成
    if (exp.stages.report !== 'done') {
      return { text: '结论已完成：生成研究报告以完成闭环', action: { label: '生成报告', fn: () => scrollTo('report-panel') } };
    }
    return { text: '科研闭环已完成：报告已生成，可在报告中心查看与下载', action: { label: '查看报告', fn: () => scrollTo('report-panel') } };
  })();

  const FEEDBACK_STYLE = {
    eligible: { border: 'border-tele-500/50 bg-tele-500/8', text: 'text-tele-300', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.4-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z' },
    replicate: { border: 'border-signal-ice/50 bg-signal-ice/8', text: 'text-signal-ice', icon: 'M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z' },
    confounded: { border: 'border-signal-amber/60 bg-signal-amber/10', text: 'text-signal-amber', icon: 'M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z' },
    invalid: { border: 'border-danger-500/60 bg-danger-500/10', text: 'text-danger-400', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.3 12.9-1.4 1.4-2.9-2.9-2.9 2.9-1.4-1.4 2.9-2.9-2.9-2.9 1.4-1.4 2.9 2.9 2.9-2.9 1.4 1.4-2.9 2.9 2.9 2.9z' },
    scheme: { border: 'border-signal-amber/60 bg-signal-amber/10', text: 'text-signal-amber', icon: 'M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z' },
  } as const;
  const FEEDBACK_TITLE = {
    eligible: '试跑已保存，符合当前对照条件',
    replicate: '试跑已保存，属于重复实验',
    confounded: '试跑已保存，但不计入有效对照',
    invalid: '试跑记录无效，不计入有效对照',
    scheme: '试跑已保存，但当前方法方案无法判定资格',
  } as const;

  return (
    <div className="space-y-4">
      {/* 参数设置 */}
      <div className="rounded-lg border border-line bg-carbon-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="panel-title flex items-center gap-2">
            <span className="inline-block h-3 w-1 bg-signal-amber" />
            过弯工况设置 · Run Setup
          </p>
          <span className="num rounded border border-line px-1.5 py-0.5 text-[9px] tracking-wider text-mist-600">
            MODEL {CORNERING_MODEL_VERSION}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {report.independent ? (
            <span className="rounded border border-race-500/40 bg-race-500/10 px-2 py-0.5 font-bold text-race-400">
              自变量 {report.independent.name} {report.independent.symbol}
            </span>
          ) : (
            <span className="rounded border border-danger-500/50 bg-danger-500/15 px-2 py-0.5 font-bold text-danger-400">未设自变量</span>
          )}
          {report.controlled.map((v) => (
            <span key={v.id} className="rounded border border-signal-amber/40 bg-signal-amber/10 px-2 py-0.5 font-semibold text-signal-amber">
              控制 {v.symbol} 保持基准值
            </span>
          ))}
          {report.baseline && (
            <span className="num text-[10px] text-mist-500">
              基准：v={readParam(report.baseline, 'speedKmh') ?? '—'} · R={readParam(report.baseline, 'radiusM') ?? '—'} · μ={readParam(report.baseline, 'mu') ?? '—'}
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="flex items-baseline justify-between text-xs font-semibold text-mist-300">
                {f.label} <span className="num text-tele-300">{f.symbol}</span>
              </span>
              <span
                className={`mt-1.5 flex items-center rounded border bg-carbon-950 transition-colors focus-within:border-tele-500/60 focus-within:ring-1 focus-within:ring-tele-500/40 ${
                  errors[f.key] ? 'border-danger-500/70' : 'border-line'
                }`}
              >
                <input
                  type="number"
                  inputMode="decimal"
                  step={f.step}
                  value={raw[f.key]}
                  aria-label={`${f.label}（${f.unit}）`}
                  aria-invalid={Boolean(errors[f.key])}
                  onChange={(e) => {
                    setRaw({ ...raw, [f.key]: e.target.value });
                    if (errors[f.key]) setErrors({ ...errors, [f.key]: undefined });
                    if (computeError) setComputeError(null);
                    if (fixError) setFixError(null);
                  }}
                  className="num w-full bg-transparent px-3 py-2 text-sm font-bold text-mist-100 focus:outline-none"
                />
                <span className="num shrink-0 border-l border-line px-2 text-[10px] text-mist-500">{f.unit}</span>
              </span>
              <span className={`mt-1 block text-[10px] leading-snug ${errors[f.key] ? 'font-semibold text-danger-400' : 'text-mist-600'}`}>
                {errors[f.key] ?? f.hint}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={onRun}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M7 4.5v15l13-7.5-13-7.5z" /></svg>
            运行试验
          </Button>
          <p className="num text-[10px] tracking-wider text-mist-600">
            ay = v²/R · ay_max = μg · λ = ay/ay_max · v_limit = √(μgR)
          </p>
        </div>
        {computeError && (
          <p role="alert" className="fade-up mt-3 rounded border border-danger-500/50 bg-danger-500/10 px-3 py-2 text-xs font-semibold leading-relaxed text-danger-400">
            ✕ {computeError}
          </p>
        )}
        {invalidCount > 0 && (
          <p className="mt-3 rounded border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-[11px] leading-relaxed text-signal-amber">
            {invalidCount} 条历史记录被标记为无效：不计入有效试跑、不进入图表，原始数值保留在下方列表供排查。
          </p>
        )}
      </div>

      {/* 结果展示 */}
      {latest && latestResult ? (
        <div key={latest.id} className="fade-up grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="panel relative overflow-hidden p-3">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-signal-ice" />
            <p className="panel-title">侧向加速度 ay</p>
            <p className="num mt-1.5 text-2xl font-bold text-signal-ice">
              {latestResult.lateralAccelMs2.toFixed(2)}
              <span className="ml-1 text-xs font-medium text-mist-500">m/s²</span>
            </p>
            <p className="num mt-0.5 text-[10px] text-mist-600">= {(latestResult.lateralAccelMs2 / G).toFixed(3)} g</p>
          </div>
          <div className="panel relative overflow-hidden p-3">
            <div className={`absolute inset-x-0 top-0 h-0.5 ${exceeded ? 'bg-danger-500' : 'bg-tele-400'}`} />
            <p className="panel-title">附着利用率 λ</p>
            <p className={`num mt-1.5 text-2xl font-bold ${exceeded ? 'text-danger-400' : 'text-tele-300'}`}>
              {(latestResult.gripUtilization * 100).toFixed(1)}
              <span className="ml-1 text-xs font-medium text-mist-500">%</span>
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded bg-carbon-700">
              <div
                className={`h-full rounded transition-all duration-500 ${exceeded ? 'bg-danger-500' : 'bg-tele-400'}`}
                style={{ width: `${Math.min(100, latestResult.gripUtilization * 100)}%` }}
              />
            </div>
          </div>
          <div className="panel relative overflow-hidden p-3">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-signal-violet" />
            <p className="panel-title">临界速度 v_limit</p>
            <p className="num mt-1.5 text-2xl font-bold text-signal-violet">
              {latestResult.limitSpeedKmh.toFixed(2)}
              <span className="ml-1 text-xs font-medium text-mist-500">km/h</span>
            </p>
            <p className="num mt-0.5 text-[10px] text-mist-600">= {latestResult.limitSpeedMs.toFixed(2)} m/s</p>
          </div>
          <div className="panel relative overflow-hidden p-3">
            <div className={`absolute inset-x-0 top-0 h-0.5 ${exceeded ? 'bg-signal-amber' : 'bg-signal-lime'}`} />
            <p className="panel-title">当前附着状态</p>
            <p className={`mt-1.5 text-sm font-bold leading-snug ${exceeded ? 'text-signal-amber' : 'text-signal-lime'}`}>
              {exceeded ? 'λ > 1 · 超出附着极限' : 'λ ≤ 1 · 附着范围内'}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-mist-600">
              {exceeded
                ? '简化模型内无法维持该半径的匀速圆周运动'
                : `余量 ${((1 - latestResult.gripUtilization) * 100).toFixed(1)}% · ay_max = ${latestResult.ayMaxMs2.toFixed(2)} m/s²`}
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded border border-dashed border-line-bright px-4 py-3 text-center text-xs text-mist-500">
          设置工况后点击「运行试验」，结果与试跑记录将显示在这里并自动保存。
        </p>
      )}

      {/* UX-02：本次试跑资格反馈（紧邻结果，图标+文字+计数，刷新后由持久化数据重算） */}
      {focusEval && feedbackKind && (
        <div
          role="status"
          aria-live="polite"
          key={`${focusEval.trial.id}-${feedbackKind}`}
          className={`fade-up rounded-lg border p-4 ${FEEDBACK_STYLE[feedbackKind].border}`}
        >
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 24 24" className={`mt-0.5 h-5 w-5 shrink-0 ${FEEDBACK_STYLE[feedbackKind].text}`} fill="currentColor" aria-hidden="true">
              <path d={FEEDBACK_STYLE[feedbackKind].icon} />
            </svg>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${FEEDBACK_STYLE[feedbackKind].text}`}>{FEEDBACK_TITLE[feedbackKind]}</p>
              {feedbackKind === 'eligible' && (
                <p className="mt-1 text-xs leading-relaxed text-mist-500">
                  已计入合格对照。当前合格试跑 <span className="num font-bold text-tele-300">{report.counts.eligible}</span> 条 ·
                  不同自变量水平 <span className="num font-bold text-tele-300">{report.counts.distinct}/3</span>。
                </p>
              )}
              {feedbackKind === 'replicate' && (
                <p className="mt-1 text-xs leading-relaxed text-mist-500">
                  重复实验仍可作为合格样本（合格数 +1），但不会增加不同自变量水平：当前有效水平仍为
                  <span className="num font-bold text-signal-ice"> {report.counts.distinct}/3</span>。
                  改变{report.independent?.name ?? '自变量'}取值再运行，才能新增水平。
                </p>
              )}
              {feedbackKind === 'confounded' && (
                <div className="mt-1 space-y-1">
                  {focusEval.confounded.map((d) => (
                    <p key={d.key} className="text-xs leading-relaxed text-mist-300">
                      <span className="font-bold text-signal-amber">{d.name} {d.symbol}</span> 从
                      <span className="num font-bold"> {d.from}{unitOf(d.key)}</span> 变为
                      <span className="num font-bold"> {d.to}{unitOf(d.key)}</span> —— 控制变量被同时改变，无法归因。
                    </p>
                  ))}
                  <p className="text-xs font-semibold leading-relaxed text-signal-amber">
                    请将{focusEval.confounded.map((d) => `${d.name}恢复到 ${d.from}${unitOf(d.key)}`).join('、')}后重新运行。原始试跑已保留，不会删除。
                  </p>
                  <Button variant="ghost" onClick={fixControls} className="mt-2">一键恢复控制变量到基准值</Button>
                  {fixedForTrialId === focusEval.trial.id && (
                    <p className="mt-2 rounded border border-tele-500/40 bg-tele-500/10 px-2 py-1.5 text-[11px] font-semibold leading-relaxed text-tele-300">
                      ✓ 已按试跑 #{String(focusEval.trial.index).padStart(2, '0')} 的原始参数恢复：自变量取值保留，仅混杂控制变量替换为基准值。请确认后点击「运行试验」。
                    </p>
                  )}
                </div>
              )}
              {(feedbackKind === 'invalid' || feedbackKind === 'scheme') && (
                <div className="mt-1 space-y-1">
                  {focusEval.reasons.map((r, i) => (
                    <p key={i} className="text-xs leading-relaxed text-mist-300">{r}</p>
                  ))}
                  {feedbackKind === 'scheme' && onOpenMethod && (
                    <Button variant="ghost" onClick={onOpenMethod} className="mt-2">打开方法编辑器</Button>
                  )}
                </div>
              )}
              <p className="num mt-2 text-[10px] text-mist-600">
                试跑 #{String(focusEval.trial.index).padStart(2, '0')} · {focusEval.trial.id} · 「已保存」≠「合格对照」
              </p>
            </div>
          </div>
          {fixError && (
            <p role="alert" className="mt-2 rounded border border-danger-500/50 bg-danger-500/10 px-2 py-1.5 text-[11px] font-semibold leading-relaxed text-danger-400">
              ✕ 无法自动恢复：{fixError}
            </p>
          )}
        </div>
      )}

      {/* 进度与下一步：合格数 / 水平数分开显示，依据 evaluateComparison */}
      <div className="rounded-lg border border-line bg-carbon-900/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1.5 w-8 rounded-sm ${i < report.counts.distinct ? 'bg-tele-400' : 'bg-carbon-700'}`} />
            ))}
          </div>
          <p className="num text-xs font-bold text-mist-300">
            合格对照 {report.counts.eligible} 条 · 不同水平 {report.counts.distinct}/3
          </p>
          <p className="num text-[10px] text-mist-600">已保存 {report.counts.total} 条（含重复 / 混杂 / 无效）</p>
        </div>
        <p className={`mt-2 text-[11px] leading-relaxed ${report.collectReady ? 'font-semibold text-tele-300' : exp.stages.collect === 'done' ? 'font-semibold text-signal-amber' : 'text-mist-500'}`}>
          {report.collectReady
            ? '对照要求已满足：可标记「数据采集」完成并进入数据分析。'
            : exp.stages.collect === 'done'
              ? `历史采集完成标记保留；当前方案水平仅 ${report.counts.distinct}/${MIN_DISTINCT_LEVELS}，合格对照不足：补齐前不建议基于当前方案下新结论。`
              : `距离解锁数据分析还差 ${missingLevels} 个不同有效自变量水平${report.counts.eligible < MIN_ELIGIBLE_TRIALS ? `，合格对照还差 ${MIN_ELIGIBLE_TRIALS - report.counts.eligible} 条` : ''}。`}
        </p>
        {stageError && (
          <p role="alert" className="mt-2 rounded border border-danger-500/50 bg-danger-500/10 px-2 py-1.5 text-[11px] font-semibold text-danger-400">
            ✕ {stageError}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <span className="panel-title shrink-0">下一步</span>
          <p className="min-w-0 flex-1 text-xs font-semibold text-mist-300">{nextStep.text}</p>
          {nextStep.action && (
            <Button variant="tele" onClick={nextStep.action.fn} className="shrink-0">{nextStep.action.label}</Button>
          )}
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-mist-600">
        模型假设：水平道路、匀速圆周运动、忽略空气动力与纵向轮胎力。λ &gt; 1 仅表示在该简化模型中无法维持指定半径的匀速圆周运动，
        不构成对真实车辆失控的精确预测。
      </p>
    </div>
  );
}