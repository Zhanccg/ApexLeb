/**
 * T04 统一对照资格判定与科研方法教学反馈（规则驱动，无 LLM）。
 * 所有计数、图表筛选、阶段推进共用本模块，避免各组件判断口径不一致。
 */
import type { Experiment, Trial, VariableDef } from '@/data/schema';
import { isUsableTrial, readParam, trialInvalidReason } from '@/data/integrity';
import { CORNERING_DEPENDENT_KEY, CORNERING_PARAM_KEYS } from '@/data/variables';

const EPS = 1e-9;
const sameValue = (a: number, b: number) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));

export const MIN_DISTINCT_LEVELS = 3;
export const MIN_ELIGIBLE_TRIALS = 3;

export interface ConfoundDiff {
  key: string;
  name: string;
  symbol: string;
  from: number;
  to: number;
}

export interface TrialEvaluation {
  trial: Trial;
  usable: boolean;
  eligible: boolean;
  replicate: boolean;
  confounded: ConfoundDiff[];
  reasons: string[];
}

export interface MethodFeedback {
  code: 'A' | 'B' | 'C' | 'D' | 'E';
  tone: 'danger' | 'warn' | 'ok';
  text: string;
}

export interface ComparisonReport {
  independent: VariableDef | null;
  dependent: VariableDef | null;
  controlled: VariableDef[];
  roleIssues: string[];
  baseline: Trial | null;
  evaluations: TrialEvaluation[];
  eligible: Trial[];
  distinctValues: number[];
  counts: { total: number; valid: number; eligible: number; distinct: number };
  feedback: MethodFeedback[];
  collectReady: boolean;
  collectMissing: string[];
  /** 历史已完成采集、但按当前方案复核不足：保留历史标记并提示 */
  historicalCollectRecheck: boolean;
}

/** 变量角色合法性（教学反馈 B） */
export function validateVariableRoles(exp: Experiment): string[] {
  const issues: string[] = [];
  const vars = exp.variables ?? [];
  const independents = vars.filter((v) => v.role === 'independent');
  const dependent = vars.find((v) => v.role === 'dependent');
  const controlledIds = vars.filter((v) => v.role === 'controlled').map((v) => v.id);

  if (independents.length === 0) {
    issues.push('缺少自变量：请在方法编辑器中把车速 v 或弯道半径 R 设为自变量。');
  } else if (independents.length > 1) {
    issues.push(`同时存在 ${independents.length} 个自变量（${independents.map((v) => v.symbol).join('、')}）：一次实验只能改变一个因素，请只保留一个自变量。`);
  } else if (independents[0].id !== 'speedKmh' && independents[0].id !== 'radiusM') {
    issues.push(`自变量「${independents[0].name}」不在本过弯实验的可操纵参数中：自变量只能是车速 v 或弯道半径 R。`);
  }
  if (!dependent || dependent.id !== CORNERING_DEPENDENT_KEY) {
    issues.push('因变量必须为侧向加速度 ay（本版本固定，不支持自由公式）。');
  }
  const independentId = independents.length === 1 ? independents[0].id : null;
  const requiredControlled = CORNERING_PARAM_KEYS.filter((k) => k !== independentId);
  const missingControlled = requiredControlled.filter((k) => !controlledIds.includes(k));
  if (missingControlled.length > 0) {
    const names = missingControlled.map((k) => (k === 'speedKmh' ? '车速 v' : k === 'radiusM' ? '弯道半径 R' : '附着系数 μ'));
    issues.push(`控制变量缺少 ${names.join('、')}：除自变量外的参数都必须保持不变，否则无法归因。`);
  }
  return issues;
}

/** 统一对照资格判定：有效记录 + 明确自变量 + 控制变量一致 + 不同取值 */
export function evaluateComparison(exp: Experiment): ComparisonReport {
  const vars = exp.variables ?? [];
  const independent = vars.find((v) => v.role === 'independent') ?? null;
  const dependent = vars.find((v) => v.role === 'dependent') ?? null;
  const controlled = vars.filter((v) => v.role === 'controlled' && (CORNERING_PARAM_KEYS as readonly string[]).includes(v.id));
  const roleIssues = validateVariableRoles(exp);
  const schemeOk = roleIssues.length === 0 && independent !== null;

  const ordered = [...exp.trials].sort((a, b) => a.index - b.index);
  const usable = ordered.filter(isUsableTrial);
  const baseline = usable[0] ?? null;

  const evaluations: TrialEvaluation[] = ordered.map((trial) => {
    const reasons: string[] = [];
    const invalid = trialInvalidReason(trial);
    const usableTrial = trial.status === 'completed' && invalid === null;
    if (!usableTrial) {
      reasons.push(`记录无效：${invalid ?? '状态为 ' + trial.status}，不计入有效对照。`);
      return { trial, usable: false, eligible: false, replicate: false, confounded: [], reasons };
    }
    if (!schemeOk) {
      reasons.push('实验方案不合法（自变量 / 控制变量设置问题），暂无法判定对照资格，请先修正方法设置。');
      return { trial, usable: true, eligible: false, replicate: false, confounded: [], reasons };
    }
    const confounded: ConfoundDiff[] = [];
    if (baseline && baseline.id !== trial.id) {
      for (const cv of controlled) {
        const from = readParam(baseline, cv.id);
        const to = readParam(trial, cv.id);
        if (from !== undefined && to !== undefined && !sameValue(from, to)) {
          confounded.push({ key: cv.id, name: cv.name, symbol: cv.symbol, from, to });
          reasons.push(
            `本次试跑改变了${cv.name} ${cv.symbol}（${from} → ${to}），不能直接用于当前控制变量实验的有效对照。`,
          );
        }
      }
    }
    const eligible = confounded.length === 0;
    let replicate = false;
    if (eligible && independent) {
      const value = readParam(trial, independent.id);
      // 仅当与更早的合格试跑取值相同才算重复（混杂试跑不作为重复基准）
      const earlierEligibleSame = usable.find((t) => {
        if (t.id === trial.id || t.index >= trial.index) return false;
        const tv = readParam(t, independent.id);
        if (tv === undefined || value === undefined || !sameValue(tv, value)) return false;
        return controlled.every((cv) => {
          const a = readParam(baseline ?? t, cv.id);
          const b = readParam(t, cv.id);
          return a === undefined || b === undefined || sameValue(a, b);
        });
      });
      if (earlierEligibleSame) {
        replicate = true;
        reasons.push(
          `重复试跑：自变量取值与试跑 #${String(earlierEligibleSame.index).padStart(2, '0')} 相同，可作为重复测量验证稳定性，但不增加对照水平。`,
        );
      }
    }
    return { trial, usable: true, eligible, replicate, confounded, reasons };
  });

  const eligible = evaluations.filter((e) => e.eligible).map((e) => e.trial);
  const distinctValues: number[] = [];
  if (independent) {
    for (const t of eligible) {
      const v = readParam(t, independent.id);
      if (v !== undefined && !distinctValues.some((d) => sameValue(d, v))) distinctValues.push(v);
    }
  }
  const counts = {
    total: exp.trials.length,
    valid: usable.length,
    eligible: eligible.length,
    distinct: distinctValues.length,
  };

  const feedback: MethodFeedback[] = [];
  if (!independent) {
    feedback.push({ code: 'A', tone: 'danger', text: '当前缺少自变量：实验还没有「要改变的那个因素」。请在方法编辑器中选择车速 v 或弯道半径 R 作为自变量。' });
  }
  for (const issue of roleIssues) {
    if (issue.startsWith('缺少自变量')) continue;
    feedback.push({ code: 'B', tone: 'danger', text: issue });
  }
  for (const e of evaluations) {
    for (const diff of e.confounded) {
      feedback.push({
        code: 'C',
        tone: 'warn',
        text: `试跑 #${String(e.trial.index).padStart(2, '0')}：本次试跑改变了${diff.name} ${diff.symbol}（${diff.from} → ${diff.to}），不能直接用于当前控制变量实验的有效对照。修正方法：把 ${diff.symbol} 恢复为基准值 ${diff.from} 后重跑。`,
      });
    }
  }
  if (schemeOk && counts.eligible > 0 && counts.distinct < MIN_DISTINCT_LEVELS) {
    feedback.push({
      code: 'D',
      tone: 'warn',
      text: `当前只有${counts.distinct}个不同的自变量取值，还需要至少${MIN_DISTINCT_LEVELS - counts.distinct}个不同取值才能完成对照实验。重复试跑可以保存（用于验证稳定性），但请改变${independent?.name ?? '自变量'}再运行新的试跑。`,
    });
  }
  const collectReady = schemeOk && counts.distinct >= MIN_DISTINCT_LEVELS && counts.eligible >= MIN_ELIGIBLE_TRIALS;
  if (collectReady) {
    feedback.push({
      code: 'E',
      tone: 'ok',
      text: `已满足合格对照数量：${counts.distinct} 个不同自变量取值、${counts.eligible} 条控制变量一致的合格对照。可以在阶段追踪器中标记「数据采集」完成，进入分析阶段。`,
    });
  }

  const collectMissing: string[] = [];
  if (!schemeOk) collectMissing.push(...roleIssues);
  if (counts.distinct < MIN_DISTINCT_LEVELS) {
    collectMissing.push(`不同自变量取值仅 ${counts.distinct} 个（需 ≥ ${MIN_DISTINCT_LEVELS}）：请改变${independent?.name ?? '自变量'}取值后运行新试跑`);
  }
  if (counts.eligible < MIN_ELIGIBLE_TRIALS) {
    collectMissing.push(`合格对照仅 ${counts.eligible} 条（需 ≥ ${MIN_ELIGIBLE_TRIALS}）：混杂与无效记录不计入，请保持控制变量与基准一致后重跑`);
  }

  return {
    independent,
    dependent,
    controlled,
    roleIssues,
    baseline,
    evaluations,
    eligible,
    distinctValues,
    counts,
    feedback,
    collectReady,
    collectMissing,
    historicalCollectRecheck: exp.stages.collect === 'done' && !collectReady,
  };
}