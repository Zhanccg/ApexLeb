import type { Experiment } from '@/data/schema';
import type { ComparisonReport } from '@/pedagogy';
import { readParam } from '@/data/integrity';
import { fmtNum } from '@/data/integrity';

const TONE_STYLE = {
  danger: 'border-race-500/50 bg-race-500/10 text-race-400',
  warn: 'border-signal-amber/40 bg-signal-amber/10 text-signal-amber',
  ok: 'border-tele-500/40 bg-tele-500/10 text-tele-300',
} as const;

const CODE_LABEL = { A: '缺少自变量', B: '角色不合法', C: '混杂变量', D: '重复取值', E: '对照达标', F: '基准缺失' } as const;

export default function MethodCoach({ exp, report }: { exp: Experiment; report: ComparisonReport }) {
  const { counts, baseline, independent, controlled } = report;
  const chips = [
    { label: '已保存试跑', value: counts.total, color: 'text-mist-100' },
    { label: '数据有效', value: counts.valid, color: 'text-signal-ice' },
    { label: '合格对照', value: counts.eligible, color: 'text-tele-300' },
    { label: '不同自变量取值', value: counts.distinct, color: 'text-signal-amber' },
  ];
  const flagged = report.evaluations.filter((e) => !e.eligible || e.replicate);

  return (
    <div className="space-y-4">
      {/* 四类计数 */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {chips.map((c) => (
          <div key={c.label} className="rounded-lg border border-line bg-carbon-900/70 px-3 py-2.5">
            <p className="panel-title">{c.label}</p>
            <p className={`num mt-1 text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* 当前方案与基准 */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-carbon-900/70 px-3 py-2.5 text-xs">
        <span className="text-mist-500">当前方案：</span>
        {independent ? (
          <span className="rounded border border-race-500/40 bg-race-500/10 px-2 py-0.5 font-bold text-race-400">
            自变量 {independent.name} {independent.symbol}
          </span>
        ) : (
          <span className="rounded border border-race-500/50 bg-race-500/15 px-2 py-0.5 font-bold text-race-400">未设自变量</span>
        )}
        {controlled.map((v) => (
          <span key={v.id} className="rounded border border-signal-amber/40 bg-signal-amber/10 px-2 py-0.5 font-semibold text-signal-amber">
            控制 {v.symbol}
          </span>
        ))}
        {baseline && (
          <span className="num ml-auto text-[10px] text-mist-500" title={baseline.id}>
            基准试跑 #{String(baseline.index).padStart(2, '0')}（{baseline.id}）：v={fmtNum(readParam(baseline, 'speedKmh'), 0)} km/h · R={fmtNum(readParam(baseline, 'radiusM'), 0)} m · μ={fmtNum(readParam(baseline, 'mu'))}
          </span>
        )}
      </div>

      {/* 兼容性 / 重算 / 历史复核提示 */}
      {exp.legacyMigrationNote && (
        <p className="rounded border border-signal-ice/40 bg-signal-ice/10 px-3 py-2 text-[11px] leading-relaxed text-signal-ice">
          ⓘ {exp.legacyMigrationNote}
        </p>
      )}
      {exp.methodNote && (
        <p className="rounded border border-signal-violet/40 bg-signal-violet/10 px-3 py-2 text-[11px] leading-relaxed text-signal-violet">
          ↻ {exp.methodNote}
        </p>
      )}
      {report.historicalCollectRecheck && (
        <p role="alert" className="rounded border border-signal-amber/50 bg-signal-amber/10 px-3 py-2 text-[11px] leading-relaxed text-signal-amber">
          ⚠ 「数据采集」阶段曾标记完成，但按当前对照方案复核合格对照不足。历史阶段标记与结论已保留、不会丢失；
          建议按下方提示补齐合格对照后再进入分析，以免结论建立在混杂数据上。
        </p>
      )}

      {/* 教学反馈 A–E */}
      {report.feedback.length > 0 ? (
        <ul className="space-y-2">
          {report.feedback.map((f, i) => (
            <li key={`${f.code}-${i}`} className={`flex gap-2.5 rounded border px-3 py-2.5 ${TONE_STYLE[f.tone]}`}>
              <span className="num shrink-0 rounded bg-carbon-950/60 px-1.5 py-0.5 text-[10px] font-bold">
                {f.code} · {CODE_LABEL[f.code]}
              </span>
              <span className="text-xs leading-relaxed">{f.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded border border-dashed border-line-bright px-3 py-3 text-center text-xs text-mist-500">
          运行试跑后，这里会给出控制变量、混杂与重复取值的具体纠错提示。
        </p>
      )}

      {/* 逐条资格明细 */}
      {flagged.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-carbon-800/70 text-[10px] tracking-wider text-mist-600">
                <th className="px-3 py-2 font-semibold">试跑</th>
                <th className="px-3 py-2 font-semibold">判定</th>
                <th className="px-3 py-2 font-semibold">原因与修正建议</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((e) => (
                <tr key={e.trial.id} className="border-b border-line/50 last:border-0">
                  <td className="num px-3 py-2 text-mist-500">#{String(e.trial.index).padStart(2, '0')}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                      !e.usable
                        ? 'border-race-500/50 bg-race-500/15 text-race-400'
                        : e.confounded.length > 0
                          ? 'border-signal-amber/40 bg-signal-amber/10 text-signal-amber'
                          : 'border-signal-ice/40 bg-signal-ice/10 text-signal-ice'
                    }`}>
                      {!e.usable ? '数据无效' : e.confounded.length > 0 ? '混杂' : '重复'}
                    </span>
                  </td>
                  <td className="px-3 py-2 leading-relaxed text-mist-500">{e.reasons.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}