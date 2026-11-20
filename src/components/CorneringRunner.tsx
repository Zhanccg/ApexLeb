import { useState } from 'react';
import type { Experiment } from '@/data/schema';
import { useLabStore } from '@/data/store';
import { isUsableTrial, readParam } from '@/data/integrity';
import {
  CORNERING_MODEL_VERSION,
  computeCorneringRun,
  validateCorneringInputs,
  type CorneringParams,
} from '@/engine';
import { G } from '@/engine/constants';
import { Button } from '@/components/ui';

const r4 = (n: number) => Number(n.toFixed(4));

const FIELDS: Array<{ key: keyof CorneringParams; label: string; symbol: string; unit: string; step: string; hint: string }> = [
  { key: 'speedKmh', label: '车辆速度', symbol: 'v', unit: 'km/h', step: '1', hint: '内部换算为 m/s 参与计算' },
  { key: 'radiusM', label: '弯道半径', symbol: 'R', unit: 'm', step: '1', hint: '必须大于 0' },
  { key: 'mu', label: '路面附着系数', symbol: 'μ', unit: '—', step: '0.05', hint: '必须大于 0' },
];

export default function CorneringRunner({
  exp,
  notify,
}: {
  exp: Experiment;
  notify: (message: string, tone: 'ok' | 'err') => void;
}) {
  const addTrial = useLabStore((s) => s.addTrial);
  const [raw, setRaw] = useState<Record<keyof CorneringParams, string>>({
    speedKmh: '54',
    radiusM: '50',
    mu: '1.0',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CorneringParams, string>>>({});
  const [computeError, setComputeError] = useState<string | null>(null);

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
      notify(check.error, 'err');
      return;
    }
    setErrors({});
    const comp = computeCorneringRun(check.value);
    if (!comp.ok) {
      setComputeError(comp.error);
      notify(comp.error, 'err');
      return;
    }
    setComputeError(null);
    const res = comp.result;
    const vMs = check.value.speedKmh / 3.6;
    const samples = Array.from({ length: 25 }, (_, i) => {
      const t = i / 6;
      return {
        t: Number(t.toFixed(3)),
        channels: {
          speed: check.value.speedKmh,
          lateralAccelMs2: r4(res.lateralAccelMs2),
          gripUtilization: r4(res.gripUtilization),
          distance: r4(vMs * t),
        },
      };
    });
    const trial = addTrial(exp.id, {
      params: { ...check.value },
      metrics: {
        lateralAccelMs2: r4(res.lateralAccelMs2),
        gripUtilization: r4(res.gripUtilization),
        limitSpeedKmh: r4(res.limitSpeedKmh),
        limitSpeedMs: r4(res.limitSpeedMs),
      },
      samples,
      modelVersion: CORNERING_MODEL_VERSION,
    });
    if (!trial) {
      notify('试跑未保存：实验不存在或记录含非有限数值', 'err');
      return;
    }
    notify(
      `试跑 ${String(trial.index).padStart(2, '0')} 已保存：ay = ${res.lateralAccelMs2.toFixed(2)} m/s²，λ = ${(res.gripUtilization * 100).toFixed(1)}%`,
      'ok',
    );
  };

  const exceeded = latestResult?.status === 'grip-exceeded';

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
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="flex items-baseline justify-between text-xs font-semibold text-mist-300">
                {f.label} <span className="num text-tele-300">{f.symbol}</span>
              </span>
              <span
                className={`mt-1.5 flex items-center rounded border bg-carbon-950 transition-colors focus-within:border-tele-500/60 focus-within:ring-1 focus-within:ring-tele-500/40 ${
                  errors[f.key] ? 'border-race-500/70' : 'border-line'
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
                  }}
                  className="num w-full bg-transparent px-3 py-2 text-sm font-bold text-mist-100 focus:outline-none"
                />
                <span className="num shrink-0 border-l border-line px-2 text-[10px] text-mist-500">{f.unit}</span>
              </span>
              <span className={`mt-1 block text-[10px] leading-snug ${errors[f.key] ? 'font-semibold text-race-400' : 'text-mist-600'}`}>
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
          <p role="alert" className="fade-up mt-3 rounded border border-race-500/50 bg-race-500/10 px-3 py-2 text-xs font-semibold leading-relaxed text-race-400">
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
            <div className={`absolute inset-x-0 top-0 h-0.5 ${exceeded ? 'bg-race-500' : 'bg-tele-400'}`} />
            <p className="panel-title">附着利用率 λ</p>
            <p className={`num mt-1.5 text-2xl font-bold ${exceeded ? 'text-race-400' : 'text-tele-300'}`}>
              {(latestResult.gripUtilization * 100).toFixed(1)}
              <span className="ml-1 text-xs font-medium text-mist-500">%</span>
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded bg-carbon-700">
              <div
                className={`h-full rounded transition-all duration-500 ${exceeded ? 'bg-race-500' : 'bg-tele-400'}`}
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

      {/* 进度反馈 */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-carbon-900/70 px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1.5 w-8 rounded-sm ${i < completed.length ? 'bg-tele-400' : 'bg-carbon-700'}`} />
          ))}
        </div>
        <p className="num text-xs font-bold text-mist-300">
          有效试跑 {completed.length} / 3
        </p>
        <p className={`text-[11px] ${completed.length >= 3 ? 'font-semibold text-tele-300' : 'text-mist-500'}`}>
          {completed.length >= 3
            ? '采集阶段退出条件已满足 —— 可在上方阶段追踪器标记完成'
            : '采集阶段要求至少 3 次已完成试跑（手动运行，逐条保存）'}
        </p>
      </div>

      <p className="text-[10px] leading-relaxed text-mist-600">
        模型假设：水平道路、匀速圆周运动、忽略空气动力与纵向轮胎力。λ &gt; 1 仅表示在该简化模型中无法维持指定半径的匀速圆周运动，
        不构成对真实车辆失控的精确预测。
      </p>
    </div>
  );
}