/**
 * 历史数据容错（T03 最终修复）。
 * 纯函数：记录完整性判定、无效标记、持久化内容解析与清洗。
 * 原则：无效记录保留原值并标记 invalid，不删除、不参与有效计数与图表。
 */
import type { Experiment, ReportDoc, StageId, StageStatus, Trial } from './schema';

export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const allFiniteValues = (rec: unknown): boolean =>
  Boolean(rec) && typeof rec === 'object' && Object.values(rec as Record<string, unknown>).every(isFiniteNumber);

/** 返回记录无效的原因；null 表示结构完整且数值有限 */
export function trialInvalidReason(t: unknown): string | null {
  if (!t || typeof t !== 'object') return '记录结构缺失';
  const tr = t as Partial<Trial>;
  if (typeof tr.id !== 'string' || tr.id === '') return '缺少试跑 ID';
  if (!isFiniteNumber(tr.index)) return '试跑序号非有限数字';
  if (typeof tr.createdAt !== 'string' || tr.createdAt === '') return '缺少试跑时间戳';
  if (!allFiniteValues(tr.params)) return '参数含非有限数值（NaN / Infinity / 缺失）';
  if (!allFiniteValues(tr.metrics)) return '指标含非有限数值（NaN / Infinity / 缺失）';
  if (tr.samples !== undefined) {
    if (!Array.isArray(tr.samples)) return '遥测样本结构损坏';
    const bad = tr.samples.some(
      (s) => !s || typeof s !== 'object' || !isFiniteNumber(s.t) || !allFiniteValues(s.channels),
    );
    if (bad) return '遥测样本含非有限数值';
  }
  return null;
}

/** 可用于有效计数 / 图表 / 报告的试跑 */
export function isUsableTrial(t: Trial): boolean {
  return t.status === 'completed' && trialInvalidReason(t) === null;
}

/** 保留原始记录并标记无效；无法识别结构的记录返回 null（仅丢弃该条，不动其余数据） */
export function sanitizeTrial(t: unknown): Trial | null {
  const reason = trialInvalidReason(t);
  if (reason === null) return t as Trial;
  if (!t || typeof t !== 'object' || typeof (t as Partial<Trial>).id !== 'string') return null;
  const orig = t as Trial;
  return {
    ...orig,
    status: 'invalid',
    invalidReason: reason,
    note: `[数据异常：${reason}]${orig.note ? ` ${orig.note}` : ''}`,
  };
}

const STAGE_IDS: StageId[] = ['question', 'hypothesis', 'design', 'collect', 'analyze', 'conclude', 'report'];
const STAGE_STATUSES: StageStatus[] = ['locked', 'active', 'done'];

function sanitizeStages(raw: unknown): Record<StageId, StageStatus> {
  const out = {} as Record<StageId, StageStatus>;
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  for (const id of STAGE_IDS) {
    const v = src[id];
    out[id] = STAGE_STATUSES.includes(v as StageStatus) ? (v as StageStatus) : 'locked';
  }
  if (!STAGE_IDS.some((id) => out[id] !== 'locked')) out.question = 'active';
  return out;
}

/** 实验级清洗：保留可识别实验，试跑逐条容错；结构彻底损坏的实验才丢弃 */
export function sanitizeExperiment(e: unknown): Experiment | null {
  if (!e || typeof e !== 'object') return null;
  const exp = e as Partial<Experiment>;
  if (typeof exp.id !== 'string' || exp.id === '' || typeof exp.title !== 'string') return null;
  if (!Array.isArray(exp.trials)) return null;
  const trials = exp.trials.map(sanitizeTrial).filter((t): t is Trial => t !== null);
  return {
    ...(exp as Experiment),
    trials,
    variables: Array.isArray(exp.variables) ? exp.variables : [],
    tags: Array.isArray(exp.tags) ? exp.tags : [],
    stages: sanitizeStages(exp.stages),
    question: typeof exp.question === 'string' ? exp.question : '',
    createdAt: typeof exp.createdAt === 'string' ? exp.createdAt : new Date().toISOString(),
    updatedAt: typeof exp.updatedAt === 'string' ? exp.updatedAt : new Date().toISOString(),
  };
}

export interface PersistedShape {
  experiments: unknown[];
  reports: unknown[];
}

/** 解析 localStorage 原始字符串；JSON 损坏或顶层结构不符均视为损坏（不抛异常） */
export function parsePersistedRaw(raw: string | null): { ok: true; state: PersistedShape } | { ok: false } {
  if (raw === null || raw === '') return { ok: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false };
  const state = (parsed as { state?: unknown }).state;
  if (!state || typeof state !== 'object') return { ok: false };
  const s = state as { experiments?: unknown; reports?: unknown };
  if (!Array.isArray(s.experiments)) return { ok: false };
  return { ok: true, state: { experiments: s.experiments, reports: Array.isArray(s.reports) ? s.reports : [] } };
}

/** 清洗已解析的持久化状态：实验与报告逐条容错，绝不整体清空可用数据 */
export function sanitizePersistedState(state: PersistedShape): { experiments: Experiment[]; reports: ReportDoc[] } {
  const exps = Array.isArray(state?.experiments) ? state.experiments : [];
  const reps = Array.isArray(state?.reports) ? state.reports : [];
  const experiments = exps.map(sanitizeExperiment).filter((e): e is Experiment => e !== null);
  const reports = reps.filter(
    (r): r is ReportDoc =>
      Boolean(r) &&
      typeof r === 'object' &&
      typeof (r as ReportDoc).id === 'string' &&
      typeof (r as ReportDoc).experimentId === 'string' &&
      typeof (r as ReportDoc).markdown === 'string',
  );
  return { experiments, reports };
}

/** 展示用安全格式化：非有限数值显示为「非有限」，绝不抛异常 */
export function fmtNum(v: unknown, digits = 2): string {
  return isFiniteNumber(v) ? v.toFixed(digits) : '非有限';
}