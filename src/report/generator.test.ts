import { describe, expect, it } from 'vitest';
import { generateReport, renderReportMarkdown, reportEvidenceBlockers } from './generator';
import { evaluateComparison } from '@/pedagogy';
import { corneringVariables } from '@/data/variables';
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
    modelVersion: 'cornering-flat-noaero-v1',
  };
};

const analysis: Analysis = {
  id: 'ana-1',
  method: '对照曲线比较',
  findings: [
    {
      id: 'f-1',
      observation: '半径保持 50 m 时，车速 54→72→90 km/h 对应 ay 4.5→8→12.5 m/s²，符合平方关系。',
      evidenceTrialIds: ['trial-1', 'trial-2', 'trial-3'],
      supportsHypothesis: true,
    },
  ],
  createdAt: '2026-11-19T11:00:00.000Z',
  limitations: '仅覆盖 54–90 km/h 与 R=50 m。',
};

const mkExp = (trials: Trial[], over: Partial<Experiment> = {}): Experiment =>
  ({
    id: 'exp-rpt',
    title: '车速与侧向加速度',
    category: 'cornering',
    question: '在相同弯道半径与路面附着条件下，车速 v 如何影响赛车过弯时的侧向加速度 ay？',
    hypothesis: { id: 'h1', statement: 'ay 随 v 增大而增大，与 v² 成正比。', expectedDirection: 'nonlinear', rationale: 'ay = v²/R', createdAt: 'x' },
    variables: corneringVariables('speedKmh'),
    variablesVersion: 2,
    trials,
    analysis,
    conclusion: {
      statement: '在 R=50 m、μ=1 条件下，侧向加速度与车速平方成正比，假设被数据支持。',
      hypothesisVerdict: 'supported',
      limitations: '简化质点模型，未含轮胎特性与气动载荷。',
      createdAt: 'x',
    },
    stages: { question: 'done', hypothesis: 'done', design: 'done', collect: 'done', analyze: 'done', conclude: 'done', report: 'active' },
    tags: [],
    createdAt: '2026-11-19T09:00:00.000Z',
    updatedAt: 'x',
    ...over,
  }) as Experiment;

const standard = [mkTrial(1, 54, 50), mkTrial(2, 72, 50), mkTrial(3, 90, 50)];

describe('T06 报告证据链与数据一致性', () => {
  it('十节结构齐全且含强制披露', () => {
    const md = renderReportMarkdown(mkExp(standard));
    for (const s of ['## 1. 研究背景', '## 2. 研究假设', '## 3. 理论模型', '## 4. 实验设计', '## 5. 实验数据（合格对照）', '## 6. 数据分析', '## 7. 科研结论', '## 8. 模型局限性', '## 9. 数据来源说明', '## 10. 科研流程存档']) {
      expect(md).toContain(s);
    }
    expect(md).toContain('ay     = v² / R');
    expect(md).toContain('v_limit = sqrt(μ × 9.81 × R)');
    expect(md).toContain('本实验数据由简化物理模型计算生成，不属于真实赛车实测数据。');
    expect(md).toContain('不包含完整轮胎特性');
    expect(md).toContain('研究者补充：简化质点模型');
    expect(md).toContain('分析阶段声明：仅覆盖 54–90 km/h');
  });

  it('数据表仅含合格对照且带试跑ID与重复标记，混杂不进入', () => {
    const trials = [...standard, mkTrial(4, 72, 60), mkTrial(5, 54, 50)];
    const md = renderReportMarkdown(mkExp(trials));
    const dataSection = md.split('## 5. 实验数据（合格对照）')[1].split('## 6.')[0];
    expect(dataSection).toContain('trial-1');
    expect(dataSection).toContain('trial-5');
    expect(dataSection).not.toContain('trial-4');
    expect(dataSection).toContain('| 是 |');
    expect(dataSection).toContain('正式对照纳入 4 条');
    expect(md).not.toMatch(/NaN|Infinity|null/);
  });

  it('证据 ID 可追溯且复核状态写入分析节', () => {
    const md = renderReportMarkdown(mkExp(standard));
    expect(md).toContain('证据试跑：trial-1、trial-2、trial-3');
    expect(md).toContain('证据复核：当前合格');
  });

  it('引用失效时 blockers 非空且报告标注失效（不伪装合格）', () => {
    const trials = [mkTrial(1, 54, 50), mkTrial(2, 72, 60), mkTrial(3, 90, 50)];
    const exp = mkExp(trials);
    const blockers = reportEvidenceBlockers(exp);
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.join()).toContain('重新确认研究发现');
    const md = renderReportMarkdown(exp);
    expect(md).toContain('证据复核：失效');
  });

  it('自变量切换后报告使用最新角色与横轴字段', () => {
    const exp = mkExp([mkTrial(1, 54, 30), mkTrial(2, 54, 40), mkTrial(3, 54, 50)], {
      variables: corneringVariables('radiusM'),
      analysis: { ...analysis, findings: [{ ...analysis.findings[0], evidenceTrialIds: ['trial-1', 'trial-2', 'trial-3'] }] },
    });
    const md = renderReportMarkdown(exp);
    expect(md).toContain('| 弯道半径 | R | m | 自变量 |');
    expect(md).toContain('自变量（弯道半径）');
    expect(reportEvidenceBlockers(exp)).toEqual([]);
  });

  it('结论判定保留用户确认措辞，不擅自改为已证实', () => {
    const md = renderReportMarkdown(mkExp(standard, {
      conclusion: { statement: '数据与平方关系一致，但样本范围有限。', hypothesisVerdict: 'inconclusive', limitations: '范围有限。', createdAt: 'x' },
    }));
    expect(md).toContain('⚠️ 证据不足，无法判定（用户确认）');
    expect(md).not.toContain('✅ 假设被数据支持');
  });

  it('制动历史实验兼容：有效记录口径 + 扰动披露', () => {
    const braking = mkExp(standard, {
      category: 'braking',
      dataSourceNote: '预置教学示例：含人为扰动。',
      variables: [
        { id: 'mu', name: '路面摩擦系数', symbol: 'μ', unit: '—', role: 'independent', min: 0.3, max: 1.4, step: 0.05, defaultValue: 1, hint: '' },
        { id: 'brakeDistance', name: '制动距离', symbol: 'd', unit: 'm', role: 'dependent', min: 0, max: 300, step: 0.1, defaultValue: 0, hint: '' },
        { id: 'v0', name: '制动初速度', symbol: 'v₀', unit: 'km/h', role: 'controlled', min: 60, max: 200, step: 5, defaultValue: 100, hint: '' },
      ],
    });
    const md = renderReportMarkdown(braking);
    expect(md).toContain('理想制动模型');
    expect(md).toContain('预置教学示例：含人为扰动。');
    expect(md).toContain('trial-1');
    expect(reportEvidenceBlockers(braking)).toEqual([]);
  });

  it('FIX-02：历史空局限性结论 → 报告复核拦截并提示补填', () => {
    const exp = mkExp(standard, {
      conclusion: { statement: '在 R=50 m、μ=1 条件下 ay 与 v² 成正比。', hypothesisVerdict: 'supported', limitations: '   ', createdAt: 'x' },
      stages: { question: 'done', hypothesis: 'done', design: 'done', collect: 'done', analyze: 'done', conclude: 'done', report: 'active' },
    });
    const blockers = reportEvidenceBlockers(exp);
    expect(blockers.join()).toContain('结论必填缺口');
    expect(blockers.join()).toContain('模型局限性');
  });

  it('generateReport 标记 report 阶段完成且标题规范', () => {
    const doc = generateReport(mkExp(standard));
    expect(doc.title).toBe('研究报告：车速与侧向加速度');
    expect(doc.markdown).toContain('| 7. 撰写报告 | 已完成 |');
    expect(evaluateComparison(mkExp(standard)).counts.eligible).toBe(3);
  });
});