import { useMemo, useState } from 'react';
import type { Experiment } from '@/data/schema';
import { DIRECTION_LABEL } from '@/data/schema';
import { checkFindingEvidence, type ComparisonReport } from '@/pedagogy';
import { useLabStore } from '@/data/store';
import { fmtNum, fmtParam, readMetric, readParam } from '@/data/integrity';
import { downloadExperimentCsv } from '@/report/csv';
import { G } from '@/engine/constants';
import { Button } from '@/components/ui';
import { TelemetryChart } from '@/components/TelemetryChart';

interface Draft {
  observation: string;
  ids: string[];
  supports: boolean;
}

const emptyDraft = (): Draft => ({ observation: '', ids: [], supports: true });

export default function AnalysisWorkbench({
  exp,
  report,
  notify,
}: {
  exp: Experiment;
  report: ComparisonReport;
  notify: (message: string, tone: 'ok' | 'err') => void;
}) {
  const addFinding = useLabStore((s) => s.addFinding);
  const updateFinding = useLabStore((s) => s.updateFinding);
  const deleteFinding = useLabStore((s) => s.deleteFinding);
  const setAnalysisMeta = useLabStore((s) => s.setAnalysisMeta);

  const [view, setView] = useState<'level' | 'record'>('level');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [method, setMethod] = useState(exp.analysis?.method ?? '绘制 ay–自变量对照曲线并比较水平间差异');
  const [limitations, setLimitations] = useState(exp.analysis?.limitations ?? '');

  const indKey = report.independent?.id ?? 'speedKmh';
  const indUnit = report.independent?.unit ?? '';
  const indSymbol = report.independent?.symbol ?? 'v';

  const chart = useMemo(() => {
    const rows = report.eligible
      .map((t) => ({ t, x: readParam(t, indKey), y: readMetric(t, 'lateralAccelMs2') }))
      .filter((r): r is { t: (typeof report.eligible)[number]; x: number; y: number } => r.x !== undefined && r.y !== undefined)
      .sort((a, b) => a.x - b.x || a.t.index - b.t.index);
    if (view === 'record') {
      const seen = new Map<number, number>();
      return {
        points: rows.map((r) => ({ x: r.x, y: r.y })),
        annotations: rows.map((r) => {
          const n = seen.get(r.x) ?? 0;
          seen.set(r.x, n + 1);
          return { label: `#${String(r.t.index).padStart(2, '0')}`, rings: n };
        }),
      };
    }
    const groups = new Map<number, { x: number; y: number; n: number }>();
    for (const r of rows) {
      const g = groups.get(r.x);
      if (g) g.n += 1;
      else groups.set(r.x, { x: r.x, y: r.y, n: 1 });
    }
    const levels = [...groups.values()].sort((a, b) => a.x - b.x);
    return {
      points: levels.map((l) => ({ x: l.x, y: l.y })),
      annotations: levels.map((l) => ({ label: `n=${l.n}`, rings: 0 })),
    };
  }, [report, view, indKey]);

  const eligibleRows = report.evaluations.filter((e) => e.eligible);
  const findings = exp.analysis?.findings ?? [];
  const findingChecks = findings.map((f) => checkFindingEvidence(report, f));
  const analyzeReady = findings.length > 0 && findingChecks.every((c) => c.ok);
  const draftProblems = draft ? checkFindingEvidence(report, { id: 'draft', observation: draft.observation, evidenceTrialIds: draft.ids, supportsHypothesis: draft.supports }).problems : [];

  const toggleEvidence = (id: string) => {
    setDraft((d) => {
      const base = d ?? emptyDraft();
      return { ...base, ids: base.ids.includes(id) ? base.ids.filter((x) => x !== id) : [...base.ids, id] };
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    const payload = { observation: draft.observation.trim(), evidenceTrialIds: draft.ids, supportsHypothesis: draft.supports };
    const res = editingId ? updateFinding(exp.id, editingId, payload) : addFinding(exp.id, payload);
    if (!res.ok) {
      notify(res.reason ?? '保存失败', 'err');
      return;
    }
    notify(editingId ? '研究发现已更新' : '研究发现已保存并关联试跑证据', 'ok');
    setDraft(null);
    setEditingId(null);
  };

  const muBase = readParam(report.baseline, 'mu') ?? 1;

  return (
    <div className="space-y-4">
      {/* 研究上下文 */}
      <div className="rounded-lg border border-line bg-carbon-900/70 p-4">
        <p className="panel-title">研究上下文</p>
        <p className="mt-1.5 text-sm font-semibold leading-relaxed text-mist-100">{exp.question}</p>
        {exp.hypothesis && (
          <p className="mt-1 text-xs leading-relaxed text-mist-500">
            假设：{exp.hypothesis.statement}
            <span className="ml-2 rounded bg-carbon-700/70 px-1.5 py-0.5 text-[10px] text-signal-amber">{DIRECTION_LABEL[exp.hypothesis.expectedDirection]}</span>
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded border border-race-500/40 bg-race-500/10 px-2 py-0.5 font-bold text-race-400">
            自变量 {report.independent?.name ?? '—'} {indSymbol}（{indUnit}）
          </span>
          <span className="rounded border border-tele-500/40 bg-tele-500/10 px-2 py-0.5 font-bold text-tele-300">因变量 侧向加速度 ay（m/s²）</span>
          {report.controlled.map((v) => (
            <span key={v.id} className="rounded border border-signal-amber/40 bg-signal-amber/10 px-2 py-0.5 font-semibold text-signal-amber">
              控制 {v.symbol}
            </span>
          ))}
          <span className="num ml-auto text-[10px] text-mist-500">
            合格对照 {report.counts.eligible} 条 · 不同取值 {report.counts.distinct} 个
          </span>
        </div>
      </div>

      {/* 对照曲线 */}
      <div className="rounded-lg border border-line bg-carbon-900/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="panel-title">对照曲线 · ay–{report.independent?.name ?? '自变量'}</p>
          <div className="flex gap-1 rounded border border-line bg-carbon-950 p-0.5">
            {(['level', 'record'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  view === v ? 'bg-tele-500/20 text-tele-300' : 'text-mist-500 hover:text-mist-300'
                }`}
              >
                {v === 'level' ? '水平汇总（样本数）' : '逐条记录（重复环）'}
              </button>
            ))}
          </div>
        </div>
        {chart.points.length >= 2 ? (
          <TelemetryChart
            points={chart.points}
            annotations={chart.annotations}
            color="#4cc3ff"
            xLabel={`${indSymbol} / ${indUnit}`}
            yLabel="ay / m/s²"
            animate={false}
            reference={{ y: muBase * G, label: `ay_max = μg = ${(muBase * G).toFixed(2)} m/s²` }}
          />
        ) : (
          <p className="py-8 text-center text-xs text-mist-500">合格对照不足两个水平，暂无法绘制对照曲线。</p>
        )}
        <p className="mt-1 text-[10px] leading-relaxed text-mist-600">
          {view === 'level'
            ? '汇总视图：每个自变量水平一个点，n 为该水平的合格试跑样本数（重复试跑计入 n，不伪装成新水平）。'
            : '逐条视图：每条合格试跑一个点，同水平重复记录以同心环与试跑号标出；确定性模型下同参数结果完全相同，未添加人为噪声。'}
          数据为简化物理模型计算值，非真实车辆测试数据。点击下表「引用」可追溯试跑 ID。
        </p>
      </div>

      {/* 合格试跑结果表 */}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-carbon-800/70 text-[10px] tracking-wider text-mist-600">
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">试跑 ID</th>
              <th className="px-3 py-2 font-semibold">{indSymbol}（{indUnit}）</th>
              <th className="px-3 py-2 font-semibold">ay（m/s²）</th>
              <th className="px-3 py-2 font-semibold">λ（%）</th>
              <th className="px-3 py-2 font-semibold">v_limit（km/h）</th>
              <th className="px-3 py-2 font-semibold">重复</th>
              <th className="px-3 py-2 font-semibold">引用为证据</th>
            </tr>
          </thead>
          <tbody>
            {eligibleRows.map((e) => {
              const t = e.trial;
              const lambda = readMetric(t, 'gripUtilization');
              const selected = draft?.ids.includes(t.id) ?? false;
              return (
                <tr key={t.id} className={`border-b border-line/50 last:border-0 ${selected ? 'bg-race-500/8' : ''}`}>
                  <td className="num px-3 py-2 text-mist-500">{String(t.index).padStart(2, '0')}</td>
                  <td className="num px-3 py-2 text-[10px] text-mist-500" title={t.id}>{t.id}</td>
                  <td className="num px-3 py-2 font-bold text-signal-amber">{fmtParam(readParam(t, indKey))}</td>
                  <td className="num px-3 py-2 text-signal-ice">{fmtNum(readMetric(t, 'lateralAccelMs2'))}</td>
                  <td className="num px-3 py-2 text-tele-300">{lambda === undefined ? '非有限' : `${(lambda * 100).toFixed(1)}%`}</td>
                  <td className="num px-3 py-2 text-signal-violet">{fmtNum(readMetric(t, 'limitSpeedKmh'))}</td>
                  <td className="px-3 py-2">
                    {e.replicate ? (
                      <span className="rounded border border-signal-ice/40 bg-signal-ice/10 px-1.5 py-0.5 text-[10px] font-bold text-signal-ice">重复</span>
                    ) : (
                      <span className="text-[10px] text-mist-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleEvidence(t.id)}
                      aria-label={`引用试跑 ${t.id} 作为证据`}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#e10600]"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-line px-3 py-2 text-[10px] text-mist-600">
          仅列合格对照（含重复标记）；混杂 / 无效记录见 Method Coach，不进入本表、曲线与合格 CSV。
        </p>
      </div>

      {/* 已有研究发现 */}
      <div className="space-y-2">
        <p className="panel-title">研究发现（{findings.length}）</p>
        {findings.length === 0 && (
          <p className="rounded border border-dashed border-line-bright px-3 py-3 text-center text-xs text-mist-500">
            尚无研究发现。勾选上表试跑作为证据，填写观察描述后保存。
          </p>
        )}
        {findings.map((f, i) => {
          const check = findingChecks[i];
          return (
            <div key={f.id} className={`rounded-lg border p-3 ${check.ok ? 'border-line bg-carbon-900/70' : 'border-signal-amber/50 bg-signal-amber/8'}`}>
              <p className="text-sm leading-relaxed text-mist-300">{f.observation}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {f.evidenceTrialIds.map((id) => (
                  <span key={id} className="num rounded bg-carbon-700/70 px-1.5 py-0.5 text-[10px] text-tele-300" title="证据试跑 ID">{id}</span>
                ))}
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${f.supportsHypothesis ? 'bg-tele-500/15 text-tele-300' : 'bg-race-500/15 text-race-400'}`}>
                  {f.supportsHypothesis ? '支持假设' : '不支持假设'}
                </span>
                <span className="ml-auto flex gap-2">
                  <button
                    onClick={() => {
                      setDraft({ observation: f.observation, ids: [...f.evidenceTrialIds], supports: f.supportsHypothesis });
                      setEditingId(f.id);
                    }}
                    className="cursor-pointer text-[11px] font-semibold text-tele-400 hover:text-tele-300"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => {
                      deleteFinding(exp.id, f.id);
                      notify('研究发现已删除', 'ok');
                    }}
                    className="cursor-pointer text-[11px] font-semibold text-mist-600 hover:text-race-400"
                  >
                    删除
                  </button>
                </span>
              </div>
              {!check.ok && (
                <ul role="alert" className="mt-2 space-y-1">
                  {check.problems.map((p, n) => (
                    <li key={n} className="text-[11px] font-semibold leading-relaxed text-signal-amber">⚠ {p}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* 发现编辑区 */}
      {draft && (
        <div className="fade-up space-y-3 rounded-lg border border-tele-500/40 bg-tele-500/5 p-4">
          <p className="panel-title">{editingId ? '编辑研究发现' : '新建研究发现'}</p>
          <textarea
            value={draft.observation}
            onChange={(e) => setDraft({ ...draft, observation: e.target.value })}
            rows={3}
            placeholder="例如：在弯道半径保持 50 m 时，车速从 54 km/h 提高到 72 km/h，所需侧向加速度从 4.5 m/s² 提高到 8 m/s²。"
            className="w-full rounded border border-line bg-carbon-950 p-3 text-sm leading-relaxed text-mist-100 placeholder:text-mist-600 focus:border-tele-500/60 focus:outline-none"
          />
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-mist-500">证据试跑（仅合格对照可选，已选 {draft.ids.length} 条）</p>
            <div className="flex flex-wrap gap-1.5">
              {eligibleRows.map((e) => (
                <button
                  key={e.trial.id}
                  onClick={() => toggleEvidence(e.trial.id)}
                  className={`num cursor-pointer rounded border px-2 py-1 text-[10px] font-bold transition-colors ${
                    draft.ids.includes(e.trial.id)
                      ? 'border-race-500/60 bg-race-500/20 text-race-400'
                      : 'border-line bg-carbon-900 text-mist-500 hover:text-mist-300'
                  }`}
                >
                  #{String(e.trial.index).padStart(2, '0')} {e.replicate ? '·重复' : ''}
                </button>
              ))}
            </div>
          </div>
          <label className="block max-w-xs">
            <span className="text-[11px] font-semibold text-mist-500">对研究假设的判断</span>
            <select
              value={draft.supports ? 'yes' : 'no'}
              onChange={(e) => setDraft({ ...draft, supports: e.target.value === 'yes' })}
              className="mt-1 w-full cursor-pointer rounded border border-line bg-carbon-950 px-3 py-2 text-sm text-mist-300 focus:border-tele-500/60 focus:outline-none"
            >
              <option value="yes">该发现支持假设</option>
              <option value="no">该发现不支持假设</option>
            </select>
          </label>
          {draftProblems.length > 0 && (
            <ul role="alert" className="space-y-1">
              {draftProblems.map((p, n) => (
                <li key={n} className="text-[11px] font-semibold text-race-400">✕ {p}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button onClick={saveDraft} disabled={draftProblems.length > 0}>保存发现</Button>
            <Button variant="ghost" onClick={() => { setDraft(null); setEditingId(null); }}>取消</Button>
          </div>
        </div>
      )}
      {!draft && (
        <Button variant="tele" onClick={() => setDraft(emptyDraft())}>+ 新建研究发现</Button>
      )}

      {/* 分析方法与局限 */}
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="block">
          <span className="panel-title">分析方法</span>
          <input
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-1.5 w-full rounded border border-line bg-carbon-950 px-3 py-2 text-sm text-mist-100 focus:border-tele-500/60 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="panel-title">可能的模型局限</span>
          <input
            value={limitations}
            onChange={(e) => setLimitations(e.target.value)}
            placeholder="例如：忽略空气动力与载荷转移；仅覆盖所测取值范围。"
            className="mt-1.5 w-full rounded border border-line bg-carbon-950 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-600 focus:border-tele-500/60 focus:outline-none"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setAnalysisMeta(exp.id, { method, limitations });
            notify('分析方法与局限已保存', 'ok');
          }}
        >
          保存方法 / 局限
        </Button>
        <span className={`text-[11px] font-semibold ${analyzeReady ? 'text-tele-300' : 'text-signal-amber'}`}>
          {analyzeReady
            ? '证据齐全：可在阶段追踪器标记「分析数据」完成，进入结论阶段。'
            : '完成至少一条证据合格的研究发现后，才能推进到结论阶段。'}
        </span>
      </div>

      {/* CSV 导出 */}
      <div className="rounded-lg border border-line bg-carbon-900/70 p-4">
        <p className="panel-title">导出实验数据 CSV（UTF-8 BOM）</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button variant="tele" onClick={() => { downloadExperimentCsv(exp, report, 'raw'); notify('已导出原始记录 CSV（含混杂/无效/重复标记）', 'ok'); }}>
            ↓ 导出原始记录 CSV
          </Button>
          <Button onClick={() => { downloadExperimentCsv(exp, report, 'eligible'); notify('已导出合格对照 CSV', 'ok'); }}>
            ↓ 导出合格对照 CSV
          </Button>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-mist-600">
          原始记录口径包含全部 {report.counts.total} 条试跑，并以「合格对照 / 重复试跑 / 不合格或无效原因」列明确标记；
          合格对照口径仅含 {report.counts.eligible} 条 eligible 记录。两者数值与页面表格、曲线完全一致，均含试跑 ID 与时间戳。
        </p>
      </div>
    </div>
  );
}