/**
 * T04 统一变量契约：变量 id 与试跑 params 键同名同单位。
 * 过弯实验规范键：speedKmh / radiusM / mu / lateralAccelMs2（复用 T03 字段）。
 */
import type { Experiment, VariableDef } from './schema';
import { SAFE_LIMITS } from '@/engine/cornering';

export const CORNERING_PARAM_KEYS = ['speedKmh', 'radiusM', 'mu'] as const;
export type CorneringParamKey = (typeof CORNERING_PARAM_KEYS)[number];
export const CORNERING_DEPENDENT_KEY = 'lateralAccelMs2';
export const VARIABLES_VERSION = 2;

const BASE: Record<CorneringParamKey, Omit<VariableDef, 'role'>> = {
  speedKmh: {
    id: 'speedKmh',
    name: '车速',
    symbol: 'v',
    unit: 'km/h',
    min: 0,
    max: SAFE_LIMITS.speedKmhMax,
    step: 1,
    defaultValue: 54,
    hint: '界面单位 km/h，内部换算 m/s 计算；作为自变量时逐次改变取值。',
  },
  radiusM: {
    id: 'radiusM',
    name: '弯道半径',
    symbol: 'R',
    unit: 'm',
    min: SAFE_LIMITS.radiusMMin,
    max: SAFE_LIMITS.radiusMMax,
    step: 1,
    defaultValue: 50,
    hint: '发夹弯约 15–30 m，高速弯可超过 150 m；作为控制变量时须与基准试跑一致。',
  },
  mu: {
    id: 'mu',
    name: '路面附着系数',
    symbol: 'μ',
    unit: '—',
    min: SAFE_LIMITS.muMin,
    max: SAFE_LIMITS.muMax,
    step: 0.05,
    defaultValue: 1,
    hint: '干沥青约 1.2–1.4，湿路面约 0.6–0.8；本实验中作为控制变量保持恒定。',
  },
};

const DEPENDENT: VariableDef = {
  id: CORNERING_DEPENDENT_KEY,
  name: '侧向加速度',
  symbol: 'ay',
  unit: 'm/s²',
  role: 'dependent',
  min: 0,
  max: 1e5,
  step: 0.01,
  defaultValue: 0,
  hint: '由 ay = v²/R 计算得出；本版本固定为因变量，不支持自由公式。',
};

/** 生成过弯实验规范变量表：independentKey 决定自变量，其余自动为控制变量 */
export function corneringVariables(independentKey: CorneringParamKey): VariableDef[] {
  const roles: Record<CorneringParamKey, VariableDef['role']> = {
    speedKmh: independentKey === 'speedKmh' ? 'independent' : 'controlled',
    radiusM: independentKey === 'radiusM' ? 'independent' : 'controlled',
    mu: 'controlled',
  };
  return [
    { ...BASE.speedKmh, role: roles.speedKmh },
    { ...BASE.radiusM, role: roles.radiusM },
    { ...BASE.mu, role: roles.mu },
    { ...DEPENDENT },
  ];
}

/** 旧模板 / 旧实验字段 → 规范键 */
export const LEGACY_VARIABLE_ID_MAP: Record<string, string> = {
  radius: 'radiusM',
  r: 'radiusM',
  speed: 'speedKmh',
  v: 'speedKmh',
  v0: 'speedKmh',
  vLimit: CORNERING_DEPENDENT_KEY,
  frictionCoefficient: 'mu',
};

export interface VariableNormalization {
  variables: VariableDef[];
  variablesVersion: number;
  legacyMigrationNote?: string;
}

/**
 * 读取兼容：旧 id（radius / vLimit 等）迁移到规范键，保留用户原先的自变量选择；
 * 已是规范定义的实验仅 stamped 版本，不重建、不改动角色。
 */
export function normalizeCorneringVariables(exp: Experiment): VariableNormalization {
  const vars = Array.isArray(exp.variables) ? exp.variables : [];
  const canonicalIds = new Set<string>([...CORNERING_PARAM_KEYS, CORNERING_DEPENDENT_KEY]);
  const legacy = vars.filter((v) => !canonicalIds.has(v.id));
  if (exp.variablesVersion === VARIABLES_VERSION && legacy.length === 0) {
    return { variables: vars, variablesVersion: VARIABLES_VERSION };
  }
  if (legacy.length === 0 && vars.length > 0) {
    return { variables: vars, variablesVersion: VARIABLES_VERSION };
  }
  const legacyIndependent = vars.find((v) => v.role === 'independent');
  const mapped = legacyIndependent ? LEGACY_VARIABLE_ID_MAP[legacyIndependent.id] : undefined;
  const independentKey: CorneringParamKey =
    mapped === 'radiusM' ? 'radiusM' : 'speedKmh';
  return {
    variables: corneringVariables(independentKey),
    variablesVersion: VARIABLES_VERSION,
    legacyMigrationNote:
      legacy.length > 0
        ? `检测到旧版变量字段（${legacy.map((v) => v.id).join('、')}），已统一为 speedKmh / radiusM / mu / lateralAccelMs2；自变量沿用原选择（${independentKey === 'radiusM' ? '弯道半径 R' : '车速 v'}），全部试跑的对照资格已按新定义重新计算。`
        : undefined,
  };
}