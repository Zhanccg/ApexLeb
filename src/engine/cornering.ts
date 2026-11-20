/**
 * 过弯实验简化模型（T03）。
 * 物理假设：水平道路、匀速圆周运动、忽略空气动力与纵向轮胎力。
 * λ > 1 仅表示在该简化模型中无法维持指定半径的匀速圆周运动，
 * 不是对真实车辆失控的精确预测。
 */
import { G } from './constants';
import { corneringLimitSpeed, kmhToMs, lateralAccel, msToKmh } from './vehicle';

export const CORNERING_MODEL_VERSION = 'cornering-flat-noaero-v1';

/** 统一试跑字段键：单位显式写入键名，供 T04 控制变量检查与 T05 分析复用 */
export interface CorneringParams {
  speedKmh: number;
  radiusM: number;
  mu: number;
}

export interface CorneringMetrics {
  lateralAccelMs2: number;
  gripUtilization: number;
  limitSpeedKmh: number;
  limitSpeedMs: number;
}

export type CorneringInputCheck =
  | { ok: true; value: CorneringParams }
  | { ok: false; field: keyof CorneringParams; error: string };

const parse = (raw: string): number => Number(raw.trim());

export const OVERFLOW_INPUT_MESSAGE =
  '当前参数可能导致数值计算溢出，请调整速度、半径或附着系数。';

/**
 * 安全计算包络：包络内任意组合的 v²/R、μg、ay/(μg)、√(μgR) 均远离
 * Number.MAX_VALUE / MIN_VALUE，不会溢出；包络外即使有限也拒绝计算。
 */
export const SAFE_LIMITS = {
  speedKmhMax: 1e4,
  radiusMMin: 1e-3,
  radiusMMax: 1e6,
  muMin: 1e-3,
  muMax: 1e2,
} as const;

/** 校验原始输入：拒绝无效数字、负速度、非正半径/附着系数与溢出风险包络外取值 */
export function validateCorneringInputs(raw: {
  speedKmh: string;
  radiusM: string;
  mu: string;
}): CorneringInputCheck {
  const speed = parse(raw.speedKmh);
  const radius = parse(raw.radiusM);
  const mu = parse(raw.mu);

  if (raw.speedKmh.trim() === '' || !Number.isFinite(speed)) {
    return { ok: false, field: 'speedKmh', error: '车速必须是有效数字' };
  }
  if (speed < 0) {
    return { ok: false, field: 'speedKmh', error: '车速不能为负值' };
  }
  if (speed > SAFE_LIMITS.speedKmhMax) {
    return { ok: false, field: 'speedKmh', error: OVERFLOW_INPUT_MESSAGE };
  }
  if (raw.radiusM.trim() === '' || !Number.isFinite(radius)) {
    return { ok: false, field: 'radiusM', error: '弯道半径必须是有效数字' };
  }
  if (radius <= 0) {
    return { ok: false, field: 'radiusM', error: '弯道半径必须大于 0' };
  }
  if (radius < SAFE_LIMITS.radiusMMin || radius > SAFE_LIMITS.radiusMMax) {
    return { ok: false, field: 'radiusM', error: OVERFLOW_INPUT_MESSAGE };
  }
  if (raw.mu.trim() === '' || !Number.isFinite(mu)) {
    return { ok: false, field: 'mu', error: '附着系数必须是有效数字' };
  }
  if (mu <= 0) {
    return { ok: false, field: 'mu', error: '附着系数必须大于 0' };
  }
  if (mu < SAFE_LIMITS.muMin || mu > SAFE_LIMITS.muMax) {
    return { ok: false, field: 'mu', error: OVERFLOW_INPUT_MESSAGE };
  }
  return { ok: true, value: { speedKmh: speed, radiusM: radius, mu } };
}

export interface CorneringResult extends CorneringMetrics {
  /** grip-ok: λ ≤ 1；grip-exceeded: λ > 1（模型内无法维持该半径圆周运动） */
  status: 'grip-ok' | 'grip-exceeded';
  ayMaxMs2: number;
}

export type CorneringComputation =
  | { ok: true; result: CorneringResult }
  | { ok: false; error: string };

export const NON_FINITE_RESULT_MESSAGE =
  '计算结果出现非有限数值（溢出或非法参数），本次试跑不会保存。';

/**
 * 复用引擎纯函数计算一次过弯工况。
 * 对全部中间量与最终输出做有限性检查；任何非有限结果都返回失败，
 * 调用方不得保存、不得截断后当作正常结果。
 */
export function computeCorneringRun(input: CorneringParams): CorneringComputation {
  const { speedKmh, radiusM, mu } = input;
  if (
    !Number.isFinite(speedKmh) ||
    !Number.isFinite(radiusM) ||
    !Number.isFinite(mu) ||
    speedKmh < 0 ||
    radiusM <= 0 ||
    mu <= 0
  ) {
    return { ok: false, error: NON_FINITE_RESULT_MESSAGE };
  }
  const vMs = kmhToMs(speedKmh);
  const ay = lateralAccel(vMs, radiusM);
  const ayMax = mu * G;
  const limitMs = corneringLimitSpeed(radiusM, mu);
  const limitKmh = msToKmh(limitMs);
  const lambda = ayMax > 0 ? ay / ayMax : Number.NaN;
  const intermediates = [vMs, ay, ayMax, limitMs, limitKmh, lambda];
  if (!intermediates.every((n) => Number.isFinite(n))) {
    return { ok: false, error: NON_FINITE_RESULT_MESSAGE };
  }
  return {
    ok: true,
    result: {
      lateralAccelMs2: ay,
      gripUtilization: lambda,
      limitSpeedKmh: limitKmh,
      limitSpeedMs: limitMs,
      ayMaxMs2: ayMax,
      status: lambda > 1 ? 'grip-exceeded' : 'grip-ok',
    },
  };
}