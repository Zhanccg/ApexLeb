import { describe, expect, it } from 'vitest';
import { checkFindingEvidence, evaluateComparison } from './comparison';
import { checkStageCompletion } from './rules';
import { corneringVariables } from '@/data/variables';
import { sanitizeExperiment } from '@/data/integrity';
import { computeCorneringRun } from '@/engine';
import type { Analysis, Experiment, Trial } from '@/data/schema';

const mkTrial = (index: number, speedKmh: number, radiusM: number): Trial => {
  const comp = computeCorneringRun({ speedKmh, radiusM, mu: 1 });
  if (!comp.ok) throw new Error('fixture compute failed');
  return {
    id: `trial-${index}`,
    index,
    params: { speedKmh, radiusM, mu: 1 },
    metrics: {
      lateralAccelMs2: comp.result.lateralAccelMs2,
      gripUtilization: comp.result.gripUtilization,
      limitSpeedKmh: comp.result.limitSpeedKmh,
      limitSpeedMs: comp.result.limitSpeedMs,
    },
    samples: [],
    status: 'completed',
    note: '',
    createdAt: '2026-11-19T10:00:00.000Z',
  };
};

const analysis = (evidence: string[]): Analysis => ({
  id: 'ana-1',
  method: '对照曲线比较',
  findings: [
    {
      id: 'f-1',
      observation: '在弯道半径保持 50 m 时，车速从 54 km/h 提高到 72 km/h，侧向加速度从 4.5 m/s² 提高到 8 m/s²。',
      evidenceTrialIds: evidence,
      supportsHypothesis: true,
    },
  ],
  createdAt: '2026-11-19T11:00:00.000Z',
  limitations: '忽略空气动力与载荷转移。',
});

const mkExp = (trials: Trial[], ana: Analysis | null, independent: 'speedKmh' | 'radiusM' = 'speedKmh'): Experiment =>
  ({
    id: 'e1',
    title: 't',
    category: 'cornering',
    question: 'q',
    hypothesis: null,
    variables: corneringVariables(independent),
    variablesVersion: 2,
    trials,
    analysis: ana,
    conclusion: null,
    stages: { question: 'done', hypothesis: 'done', design: 'done', collect: 'done', analyze: 'active', conclude: 'locked', report: 'locked' },
    tags: [],
    createdAt: 'x',
    updatedAt: 'x',
  }) as Experiment;

const standard = [mkTrial(1, 54, 50), mkTrial(2, 72, 50), mkTrial(3, 90, 50)];

describe('研究发现证据校验与分析阶段推进（T05）', () => {
  it('合格证据 → 校验通过且允许推进结论', () => {
    const exp = mkExp(standard, analysis(['trial-1', 'trial-2']));
    const report = evaluateComparison(exp);
    expect(checkFindingEvidence(report, exp.analysis!.findings[0]).ok).toBe(true);
    const r = checkStageCompletion(exp, 'analyze');
    expect(r.ok).toBe(true);
  });
  it('引用混杂试跑 → 提示重新确认且禁止推进', () => {
    const trials = [mkTrial(1, 54, 50), mkTrial(2, 72, 60), mkTrial(3, 90, 50)];
    const exp = mkExp(trials, analysis(['trial-1', 'trial-2']));
    const report = evaluateComparison(exp);
    const check = checkFindingEvidence(report, exp.analysis!.findings[0]);
    expect(check.ok).toBe(false);
    expect(check.problems.join()).toContain('trial-2');
    expect(check.problems.join()).toContain('重新确认研究发现');
    expect(checkStageCompletion(exp, 'analyze').ok).toBe(false);
  });
  it('引用不存在的试跑 → 明确报错', () => {
    const exp = mkExp(standard, analysis(['trial-99']));
    const check = checkFindingEvidence(evaluateComparison(exp), exp.analysis!.findings[0]);
    expect(check.problems.join()).toContain('不存在于当前实验');
  });
  it('无证据引用 → 不允许保存/推进', () => {
    const exp = mkExp(standard, analysis([]));
    expect(checkFindingEvidence(evaluateComparison(exp), exp.analysis!.findings[0]).ok).toBe(false);
    expect(checkStageCompletion(exp, 'analyze').ok).toBe(false);
  });
  it('方案切换使引用失效，切回后恢复合格（重新计算而非静默保留）', () => {
    const exp = mkExp(standard, analysis(['trial-1', 'trial-2']));
    const switched = { ...exp, variables: corneringVariables('radiusM') };
    expect(checkFindingEvidence(evaluateComparison(switched), exp.analysis!.findings[0]).ok).toBe(false);
    const back = { ...exp, variables: corneringVariables('speedKmh') };
    expect(checkFindingEvidence(evaluateComparison(back), exp.analysis!.findings[0]).ok).toBe(true);
  });
  it('无分析发现 → 分析阶段不可推进', () => {
    expect(checkStageCompletion(mkExp(standard, null), 'analyze').ok).toBe(false);
  });
  it('制动实验沿用旧分析校验（历史兼容）', () => {
    const braking = {
      ...mkExp(standard, analysis(['trial-1'])),
      category: 'braking' as const,
    };
    expect(checkStageCompletion(braking, 'analyze').ok).toBe(true);
  });
  it('读取清洗保留 analysis 与 limitations（刷新恢复）', () => {
    const exp = mkExp(standard, analysis(['trial-1']));
    const out = sanitizeExperiment(exp);
    expect(out?.analysis?.findings).toHaveLength(1);
    expect(out?.analysis?.limitations).toBe('忽略空气动力与载荷转移。');
    expect(out?.analysis?.findings[0].evidenceTrialIds).toEqual(['trial-1']);
  });
});

describe('结论阶段证据与局限校验（T06）', () => {
  const conclusion = { statement: '在 R=50 m、μ=1 条件下 ay 与 v² 成正比，假设被支持。', hypothesisVerdict: 'supported' as const, limitations: '简化质点模型，未含轮胎特性与气动。', createdAt: 'x' };

  it('结论 + 局限 + 合格证据齐全 → 允许完成结论', () => {
    const exp = { ...mkExp(standard, analysis(['trial-1', 'trial-2'])), conclusion };
    expect(checkStageCompletion(exp, 'conclude').ok).toBe(true);
  });
  it('缺少模型局限 → 禁止并给出修正建议', () => {
    const exp = { ...mkExp(standard, analysis(['trial-1'])), conclusion: { ...conclusion, limitations: '  ' } };
    const r = checkStageCompletion(exp, 'conclude');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('模型局限性');
  });
  it('缺少结论陈述 → 禁止', () => {
    const exp = { ...mkExp(standard, analysis(['trial-1'])), conclusion: { ...conclusion, statement: '短' } };
    expect(checkStageCompletion(exp, 'conclude').ok).toBe(false);
  });
  it('证据因方案变更失效 → 禁止完成结论并提示重新确认', () => {
    const exp = { ...mkExp(standard, analysis(['trial-1', 'trial-2'])), conclusion, variables: corneringVariables('radiusM') };
    const r = checkStageCompletion(exp, 'conclude');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('重新确认研究发现');
  });
  it('无研究发现 → 禁止完成结论', () => {
    const exp = { ...mkExp(standard, null), conclusion };
    expect(checkStageCompletion(exp, 'conclude').ok).toBe(false);
  });
  it('制动历史实验：结论 + 局限即可（不套用过期对照证据）', () => {
    const braking = { ...mkExp(standard, null), category: 'braking' as const, conclusion };
    expect(checkStageCompletion(braking, 'conclude').ok).toBe(true);
  });
});

describe('FIX-02：空局限性历史结论的恢复与补填', () => {
  const legacyConclusion = { statement: '在 R=50 m、μ=1 条件下 ay 与 v² 成正比，假设被支持。', hypothesisVerdict: 'supported' as const, limitations: '', createdAt: 'x' };

  it('E：历史空局限性结论读取后保留内容与阶段，且复核不通过', () => {
    const exp = { ...mkExp(standard, analysis(['trial-1'])), conclusion: legacyConclusion, stages: { ...mkExp(standard, null).stages, conclude: 'done' as const, analyze: 'done' as const } };
    const out = sanitizeExperiment(exp);
    expect(out?.conclusion?.statement).toBe(legacyConclusion.statement);
    expect(out?.conclusion?.hypothesisVerdict).toBe('supported');
    expect(out?.stages.conclude).toBe('done');
    expect(checkStageCompletion(out!, 'conclude').ok).toBe(false);
  });
  it('C：纯空格局限性视为未填写', () => {
    const exp = { ...mkExp(standard, analysis(['trial-1'])), conclusion: { ...legacyConclusion, limitations: ' \t ' } };
    expect(checkStageCompletion(exp, 'conclude').ok).toBe(false);
  });
  it('F：补填局限后复核通过可推进', () => {
    const exp = { ...mkExp(standard, analysis(['trial-1'])), conclusion: { ...legacyConclusion, limitations: '简化质点模型，未含轮胎非线性与气动。' } };
    expect(checkStageCompletion(exp, 'conclude').ok).toBe(true);
  });
  it('D：null / undefined 局限性同样视为缺口', () => {
    for (const lim of [null, undefined]) {
      const exp = { ...mkExp(standard, analysis(['trial-1'])), conclusion: { ...legacyConclusion, limitations: lim as unknown as string } };
      expect(checkStageCompletion(exp, 'conclude').ok).toBe(false);
    }
  });
});