import { describe, expect, it } from 'vitest';
import { checkStageCompletion } from './rules';
import { checkFindingEvidence, evaluateComparison, validateVariableRoles } from './comparison';
import { corneringVariables } from '@/data/variables';
import { computeCorneringRun } from '@/engine';
import { fmtNum, readParam, sanitizeExperiment, trialInvalidReason } from '@/data/integrity';
import type { Experiment, Trial } from '@/data/schema';

const mkTrial = (index: number, speedKmh: number, radiusM: number, mu = 1): Trial => {
  const comp = computeCorneringRun({ speedKmh, radiusM, mu });
  if (!comp.ok) throw new Error('fixture compute failed');
  return {
    id: `t${index}`,
    index,
    params: { speedKmh, radiusM, mu },
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
    modelVersion: 'cornering-flat-noaero-v1',
  };
};

const mkExp = (trials: Trial[], independent: 'speedKmh' | 'radiusM' = 'speedKmh', collectDone = false): Experiment =>
  ({
    id: 'e1',
    title: '车速与侧向加速度',
    category: 'cornering',
    question: '车速如何影响侧向加速度？',
    hypothesis: { id: 'h1', statement: 'ay 随 v 增大而增大，与 v² 成正比。', expectedDirection: 'nonlinear', rationale: 'ay = v²/R', createdAt: 'x' },
    variables: corneringVariables(independent),
    variablesVersion: 2,
    trials,
    analysis: null,
    conclusion: null,
    stages: {
      question: 'done',
      hypothesis: 'done',
      design: 'done',
      collect: collectDone ? 'done' : 'active',
      analyze: collectDone ? 'active' : 'locked',
      conclude: 'locked',
      report: 'locked',
    },
    tags: [],
    createdAt: 'x',
    updatedAt: 'x',
  }) as Experiment;

describe('案例一：标准实验 54/72/90，R=50，μ=1', () => {
  const exp = mkExp([mkTrial(1, 54, 50), mkTrial(2, 72, 50), mkTrial(3, 90, 50)]);
  const report = evaluateComparison(exp);
  it('三个不同自变量取值、三条合格对照', () => {
    expect(report.counts).toEqual({ total: 3, valid: 3, eligible: 3, distinct: 3 });
    expect(report.distinctValues).toEqual([54, 72, 90]);
    expect(report.collectReady).toBe(true);
  });
  it('允许推进采集阶段', () => {
    const r = checkStageCompletion(exp, 'collect');
    expect(r.ok).toBe(true);
  });
  it('教学反馈 E 达标', () => {
    expect(report.feedback.some((f) => f.code === 'E')).toBe(true);
  });
});

describe('案例二：重复试跑 54/54/54', () => {
  const exp = mkExp([mkTrial(1, 54, 50), mkTrial(2, 54, 50), mkTrial(3, 54, 50)]);
  const report = evaluateComparison(exp);
  it('三条有效但只有一个不同取值', () => {
    expect(report.counts.valid).toBe(3);
    expect(report.counts.eligible).toBe(3);
    expect(report.counts.distinct).toBe(1);
    expect(report.collectReady).toBe(false);
  });
  it('反馈 D 给出明确缺口文案', () => {
    const d = report.feedback.find((f) => f.code === 'D');
    expect(d?.text).toContain('当前只有1个不同的自变量取值，还需要至少2个不同取值才能完成对照实验');
  });
  it('重复试跑被标记且保留', () => {
    expect(report.evaluations.filter((e) => e.replicate)).toHaveLength(2);
    expect(exp.trials).toHaveLength(3);
  });
  it('不允许推进采集阶段', () => {
    expect(checkStageCompletion(exp, 'collect').ok).toBe(false);
  });
});

describe('案例三：混杂变量 54/R50、72/R60、90/R50', () => {
  const exp = mkExp([mkTrial(1, 54, 50), mkTrial(2, 72, 60), mkTrial(3, 90, 50)]);
  const report = evaluateComparison(exp);
  it('第二条被判定混杂并点名半径变化', () => {
    const e2 = report.evaluations[1];
    expect(e2.eligible).toBe(false);
    expect(e2.confounded.map((c) => c.key)).toEqual(['radiusM']);
    expect(e2.reasons[0]).toContain('本次试跑改变了弯道半径 R（50 → 60），不能直接用于当前控制变量实验的有效对照');
  });
  it('合格对照仅两条、两个取值，不能推进', () => {
    expect(report.counts.eligible).toBe(2);
    expect(report.counts.distinct).toBe(2);
    expect(report.collectReady).toBe(false);
    expect(checkStageCompletion(exp, 'collect').ok).toBe(false);
  });
  it('反馈 C 含修正建议', () => {
    const c = report.feedback.find((f) => f.code === 'C');
    expect(c?.text).toContain('把 R 恢复为基准值 50 后重跑');
  });
});

describe('案例四：半径作为自变量，v=54、μ=1，R=30/40/50', () => {
  const exp = mkExp([mkTrial(1, 54, 30), mkTrial(2, 54, 40), mkTrial(3, 54, 50)], 'radiusM');
  const report = evaluateComparison(exp);
  it('自变量为 radiusM，控制变量为车速与 μ', () => {
    expect(report.independent?.id).toBe('radiusM');
    expect(report.controlled.map((v) => v.id)).toEqual(['speedKmh', 'mu']);
  });
  it('三个不同半径取值、允许推进', () => {
    expect(report.counts.distinct).toBe(3);
    expect(report.collectReady).toBe(true);
    expect(checkStageCompletion(exp, 'collect').ok).toBe(true);
  });
  it('改变车速会被判定混杂（控制变量互换后口径一致）', () => {
    const mixed = mkExp([mkTrial(1, 54, 30), mkTrial(2, 72, 40)], 'radiusM');
    const r2 = evaluateComparison(mixed);
    expect(r2.evaluations[1].confounded.map((c) => c.key)).toEqual(['speedKmh']);
    expect(r2.evaluations[1].reasons[0]).toContain('改变了车速 v');
  });
});

describe('FIX-01：关键参数完整性与基准选择', () => {
  const drop = (t: Trial, key: string): Trial => {
    const params = { ...t.params } as Record<string, number>;
    delete params[key];
    return { ...t, params };
  };

  it.each(['speedKmh', 'radiusM', 'mu'])('A/B/C：基准候选缺 %s → 不得作基准，改选后续合法记录', (key) => {
    const exp = mkExp([drop(mkTrial(1, 54, 50), key), mkTrial(2, 72, 50), mkTrial(3, 90, 50)]);
    const report = evaluateComparison(exp);
    expect(report.evaluations[0].usable).toBe(false);
    expect(report.evaluations[0].reasons.join()).toContain(key);
    expect(report.baseline?.id).toBe('t2');
    expect(report.counts.eligible).toBe(2);
    expect(report.counts.distinct).toBe(2);
    expect(report.collectReady).toBe(false);
    expect(checkStageCompletion(exp, 'collect').ok).toBe(false);
  });

  it.each(['speedKmh', 'radiusM', 'mu'])('D：候选缺 %s → 保留记录、标记不合格、点名缺失字段', (key) => {
    const exp = mkExp([mkTrial(1, 54, 50), drop(mkTrial(2, 72, 50), key), mkTrial(3, 90, 50)]);
    const report = evaluateComparison(exp);
    expect(exp.trials).toHaveLength(3);
    const e2 = report.evaluations[1];
    expect(e2.eligible).toBe(false);
    expect(e2.reasons.join()).toContain(`缺少关键参数`);
    expect(e2.reasons.join()).toContain(key);
    expect(report.eligible.map((t) => t.id)).toEqual(['t1', 't3']);
    expect(report.distinctValues).toEqual([54, 90]);
    expect(report.collectReady).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Infinity],
    ['字符串', '54'],
  ])('E：mu 为 %s → 记录无效', (_label, value) => {
    const bad = { ...mkTrial(2, 72, 50), params: { speedKmh: 72, radiusM: 50, mu: value as number } };
    expect(trialInvalidReason(bad)).not.toBeNull();
    const exp = mkExp([mkTrial(1, 54, 50), bad]);
    expect(evaluateComparison(exp).eligible.map((t) => t.id)).toEqual(['t1']);
  });

  it.each([
    ['speedKmh', -5, '车速不得为负数'],
    ['radiusM', 0, '弯道半径必须大于 0'],
    ['mu', 0, '附着系数必须大于 0'],
  ])('E：域非法 %s=%s → 拒绝', (key, value, message) => {
    const bad = { ...mkTrial(2, 72, 50), params: { speedKmh: 72, radiusM: 50, mu: 1, [key]: value } };
    expect(trialInvalidReason(bad)).toBe(message);
  });

  it('F：无完整合法基准 → 无法构建对照且禁止推进', () => {
    const exp = mkExp([drop(mkTrial(1, 54, 50), 'mu'), drop(mkTrial(2, 72, 50), 'mu'), drop(mkTrial(3, 90, 50), 'mu')]);
    const report = evaluateComparison(exp);
    expect(report.baseline).toBeNull();
    expect(report.counts.eligible).toBe(0);
    expect(report.feedback.some((f) => f.code === 'F')).toBe(true);
    expect(report.collectMissing.join()).toContain('无法构建有效对照');
    expect(checkStageCompletion(exp, 'collect').ok).toBe(false);
  });

  it('I：缺参记录不能作为研究发现的有效证据', () => {
    const exp = mkExp([mkTrial(1, 54, 50), drop(mkTrial(2, 72, 50), 'radiusM'), mkTrial(3, 90, 50)]);
    const report = evaluateComparison(exp);
    const check = checkFindingEvidence(report, {
      id: 'f-x',
      observation: '车速提高时侧向加速度按平方增长。',
      evidenceTrialIds: ['t1', 't2'],
      supportsHypothesis: true,
    });
    expect(check.ok).toBe(false);
    expect(check.problems.join()).toContain('t2');
  });

  it('J：读取清洗保留缺参记录并标记 invalid，展示安全', () => {
    const bad = drop(mkTrial(2, 72, 50), 'mu');
    const out = sanitizeExperiment(mkExp([mkTrial(1, 54, 50), bad]));
    expect(out?.trials).toHaveLength(2);
    expect(out?.trials[1].status).toBe('invalid');
    expect(out?.trials[1].invalidReason).toContain('mu');
    expect(out?.trials[1].params).toEqual(bad.params);
    expect(fmtNum(readParam(out?.trials[1], 'mu'))).toBe('非有限');
    expect(out?.stages.collect).toBe('active');
  });

  it('G 回归：标准三组仍合格且基准为第一条', () => {
    const report = evaluateComparison(mkExp([mkTrial(1, 54, 50), mkTrial(2, 72, 50), mkTrial(3, 90, 50)]));
    expect(report.baseline?.id).toBe('t1');
    expect(report.collectReady).toBe(true);
  });

  it('FIX-03 G：小数参数不影响对照资格与取值计数', () => {
    const report = evaluateComparison(mkExp([mkTrial(1, 54.5, 50.5), mkTrial(2, 72.5, 50.5), mkTrial(3, 90.5, 50.5)]));
    expect(report.counts.eligible).toBe(3);
    expect(report.distinctValues).toEqual([54.5, 72.5, 90.5]);
    expect(report.collectReady).toBe(true);
    expect(report.baseline?.params.speedKmh).toBe(54.5);
    expect(report.baseline?.params.radiusM).toBe(50.5);
  });
});

describe('变量角色合法性（反馈 A / B）', () => {
  it('缺少自变量 → A', () => {
    const exp = mkExp([]);
    exp.variables = corneringVariables('speedKmh').map((v) => (v.role === 'independent' ? { ...v, role: 'controlled' as const } : v));
    const report = evaluateComparison(exp);
    expect(report.independent).toBeNull();
    expect(report.feedback.some((f) => f.code === 'A')).toBe(true);
    expect(report.collectReady).toBe(false);
  });
  it('双自变量 → B 且禁止推进', () => {
    const exp = mkExp([mkTrial(1, 54, 50)]);
    exp.variables = exp.variables.map((v) => (v.id === 'radiusM' ? { ...v, role: 'independent' as const } : v));
    const issues = validateVariableRoles(exp);
    expect(issues.some((i) => i.includes('2 个自变量'))).toBe(true);
    expect(checkStageCompletion(exp, 'design').ok).toBe(false);
    expect(checkStageCompletion(exp, 'collect').ok).toBe(false);
  });
  it('μ 设为自变量 → B', () => {
    const exp = mkExp([]);
    exp.variables = exp.variables.map((v) =>
      v.id === 'mu' ? { ...v, role: 'independent' as const } : v.id === 'speedKmh' ? { ...v, role: 'controlled' as const } : v,
    );
    expect(validateVariableRoles(exp).some((i) => i.includes('自变量只能是车速 v 或弯道半径 R'))).toBe(true);
  });
});

describe('历史兼容与阶段复核', () => {
  it('旧实验已完成采集但复核不足：保留标记并给出复核提示', () => {
    const exp = mkExp([mkTrial(1, 54, 50), mkTrial(2, 54, 50), mkTrial(3, 54, 50)], 'speedKmh', true);
    const report = evaluateComparison(exp);
    expect(report.historicalCollectRecheck).toBe(true);
    expect(exp.stages.collect).toBe('done');
    expect(exp.stages.analyze).toBe('active');
  });
  it('标准历史实验复核通过则无复核警告', () => {
    const exp = mkExp([mkTrial(1, 54, 50), mkTrial(2, 72, 50), mkTrial(3, 90, 50)], 'speedKmh', true);
    expect(evaluateComparison(exp).historicalCollectRecheck).toBe(false);
  });
  it('无效记录不计入任何合格口径', () => {
    const bad = { ...mkTrial(4, 100, 50), metrics: null as unknown as Trial['metrics'] };
    const exp = mkExp([mkTrial(1, 54, 50), mkTrial(2, 72, 50), mkTrial(3, 90, 50), bad]);
    const report = evaluateComparison(exp);
    expect(report.counts.total).toBe(4);
    expect(report.counts.valid).toBe(3);
    expect(report.counts.eligible).toBe(3);
    expect(report.collectReady).toBe(true);
  });
});