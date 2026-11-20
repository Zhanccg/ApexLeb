/**
 * 阶段推进校验规则：科研流程不允许跳步，
 * 每个阶段必须满足退出条件才能标记完成。
 */
import type { Experiment, StageId } from '@/data/schema';
import { trialInvalidReason } from '@/data/integrity';
import { evaluateComparison, checkFindingEvidence } from './comparison';
import { STAGE_ORDER } from './stages';

export interface StageCheck {
  ok: boolean;
  reason: string;
}

export function checkStageCompletion(exp: Experiment, stage: StageId): StageCheck {
  switch (stage) {
    case 'question':
      return exp.question.trim().length >= 8
        ? { ok: true, reason: '研究问题已填写' }
        : { ok: false, reason: '请先填写不少于 8 个字的研究问题' };
    case 'hypothesis':
      return exp.hypothesis && exp.hypothesis.statement.trim().length >= 8 && exp.hypothesis.rationale.trim().length > 0
        ? { ok: true, reason: '假设与依据已记录' }
        : { ok: false, reason: '需要假设陈述与物理依据' };
    case 'design': {
      if (exp.category === 'cornering') {
        const report = evaluateComparison(exp);
        return report.roleIssues.length === 0
          ? { ok: true, reason: '变量角色合法：单一自变量 + 固定因变量 ay + 完整控制变量' }
          : { ok: false, reason: report.roleIssues.join('；') };
      }
      const roles = new Set(exp.variables.map((v) => v.role));
      const ok = roles.has('independent') && roles.has('dependent') && roles.has('controlled');
      return ok
        ? { ok: true, reason: '变量表完整' }
        : { ok: false, reason: '变量表需同时包含自变量、因变量与控制变量' };
    }
    case 'collect': {
      if (exp.category === 'cornering') {
        const report = evaluateComparison(exp);
        return report.collectReady
          ? { ok: true, reason: `合格对照 ${report.counts.eligible} 条 · 不同自变量取值 ${report.counts.distinct} 个` }
          : { ok: false, reason: report.collectMissing.join('；') };
      }
      const done = exp.trials.filter((t) => t.status === 'completed' && trialInvalidReason(t) === null).length;
      return done >= 3
        ? { ok: true, reason: `已完成 ${done} 次试跑` }
        : { ok: false, reason: `至少需要 3 次完成的试跑（当前 ${done} 次）` };
    }
    case 'analyze': {
      if (exp.category === 'cornering') {
        if (!exp.analysis || exp.analysis.findings.length === 0) {
          return { ok: false, reason: '需要至少一条带证据引用的研究发现（在分析工作台填写）' };
        }
        const report = evaluateComparison(exp);
        const problems = exp.analysis.findings.flatMap((f, i) =>
          checkFindingEvidence(report, f).problems.map((p) => `发现 #${i + 1}：${p}`),
        );
        return problems.length === 0
          ? { ok: true, reason: `${exp.analysis.findings.length} 条研究发现证据均合格` }
          : { ok: false, reason: problems.join('；') };
      }
      return exp.analysis && exp.analysis.findings.length > 0
        ? { ok: true, reason: '已有分析发现' }
        : { ok: false, reason: '需要至少一条分析发现' };
    }
    case 'conclude': {
      if (!exp.conclusion || exp.conclusion.statement.trim().length < 8) {
        return { ok: false, reason: '需要不少于 8 个字的结论陈述' };
      }
      if (!exp.conclusion.limitations.trim()) {
        return { ok: false, reason: '请填写模型局限性（简化模型假设与适用范围）后才能完成结论阶段' };
      }
      if (exp.category === 'cornering') {
        if (!exp.analysis || exp.analysis.findings.length === 0) {
          return { ok: false, reason: '需要至少一条带证据的研究发现（分析工作台）' };
        }
        const report = evaluateComparison(exp);
        const problems = exp.analysis.findings.flatMap((f, i) =>
          checkFindingEvidence(report, f).problems.map((p) => `发现 #${i + 1}：${p}`),
        );
        if (problems.length > 0) return { ok: false, reason: problems.join('；') };
      }
      return { ok: true, reason: '结论、局限与证据链齐全' };
    }
    case 'report':
      return { ok: false, reason: '请在报告中心生成实验报告' };
  }
}

/** 当前应处的阶段：第一个未完成的阶段 */
export function currentStage(exp: Experiment): StageId {
  for (const id of STAGE_ORDER) {
    if (exp.stages[id] !== 'done') return id;
  }
  return 'report';
}

export function stageProgress(exp: Experiment): number {
  const done = STAGE_ORDER.filter((id) => exp.stages[id] === 'done').length;
  return done / STAGE_ORDER.length;
}

/** 只有前序阶段全部完成，才允许推进目标阶段 */
export function canAdvanceTo(exp: Experiment, stage: StageId): boolean {
  const idx = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER.slice(0, idx).every((id) => exp.stages[id] === 'done');
}