import { describe, expect, it } from 'vitest';
import { buildExperimentCsv } from './csv';
import { evaluateComparison } from '@/pedagogy';
import { corneringVariables } from '@/data/variables';
import { computeCorneringRun } from '@/engine';
import { readMetric, readParam } from '@/data/integrity';
import type { Experiment, Trial } from '@/data/schema';

const mkTrial = (index: number, speedKmh: number, radiusM: number, mu = 1, over: Partial<Trial> = {}): Trial => {
  const comp = computeCorneringRun({ speedKmh, radiusM, mu });
  if (!comp.ok) throw new Error('fixture compute failed');
  return {
    id: `trial-${index}`,
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
    ...over,
  };
};

const mkExp = (trials: Trial[], independent: 'speedKmh' | 'radiusM' = 'speedKmh'): Experiment =>
  ({
    id: 'exp-csv',
    title: '车速与侧向加速度',
    category: 'cornering',
    question: 'q',
    hypothesis: null,
    variables: corneringVariables(independent),
    variablesVersion: 2,
    trials,
    analysis: null,
    conclusion: null,
    stages: { question: 'done', hypothesis: 'done', design: 'done', collect: 'done', analyze: 'active', conclude: 'locked', report: 'locked' },
    tags: [],
    createdAt: 'x',
    updatedAt: 'x',
  }) as Experiment;

const trials = [
  mkTrial(1, 54, 50),
  mkTrial(2, 54, 50),
  mkTrial(3, 72, 60),
  mkTrial(4, 72, 50),
  mkTrial(5, 90, 50),
  mkTrial(6, 100, 50, 1, { status: 'invalid', invalidReason: '指标含非有限数值, 需排查', metrics: null as unknown as Trial['metrics'] }),
];

describe('CSV 导出（T05）', () => {
  const exp = mkExp(trials);
  const report = evaluateComparison(exp);

  it('UTF-8 BOM 开头，中文表头齐全', () => {
    const csv = buildExperimentCsv(exp, report, 'raw');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const header = csv.slice(1).split('\r\n')[0];
    for (const h of ['试跑ID', '记录时间', '自变量', '自变量单位', '车速(km/h)', '弯道半径(m)', '附着系数μ', '侧向加速度(m/s²)', '附着利用率(%)', '临界速度(km/h)', '试跑状态', '合格对照', '重复试跑', '无效原因']) {
      expect(header).toContain(h);
    }
  });

  it('原始口径包含全部试跑并标记混杂/无效/重复', () => {
    const lines = buildExperimentCsv(exp, report, 'raw').slice(1).trim().split('\r\n');
    expect(lines).toHaveLength(trials.length + 1);
    const confounded = lines.find((l) => l.startsWith('trial-3,'));
    expect(confounded).toContain(',否,否,');
    const invalid = lines.find((l) => l.startsWith('trial-6,'));
    expect(invalid).toContain('无效');
    expect(invalid).toContain('"指标含非有限数值, 需排查"');
    const replicate = lines.find((l) => l.startsWith('trial-2,'));
    expect(replicate).toContain(',是,是,');
  });

  it('合格口径仅含 eligible，且全部标记合格', () => {
    const lines = buildExperimentCsv(exp, report, 'eligible').slice(1).trim().split('\r\n');
    expect(lines).toHaveLength(report.eligible.length + 1);
    expect(report.eligible.map((t) => t.id)).toEqual(['trial-1', 'trial-2', 'trial-4', 'trial-5']);
    for (const l of lines.slice(1)) expect(l).toContain(',是,');
    expect(lines.some((l) => l.startsWith('trial-3,'))).toBe(false);
    expect(lines.some((l) => l.startsWith('trial-6,'))).toBe(false);
  });

  it('CSV 数值与页面表格口径一致（ay 2 位 / λ 百分比 1 位 / 临界速度 2 位）', () => {
    const lines = buildExperimentCsv(exp, report, 'eligible').slice(1).trim().split('\r\n');
    const row = lines.find((l) => l.startsWith('trial-4,'))!;
    const cells = row.split(',');
    const t = report.eligible.find((x) => x.id === 'trial-4')!;
    expect(cells[8]).toBe(readMetric(t, 'lateralAccelMs2')!.toFixed(2));
    expect(cells[9]).toBe((readMetric(t, 'gripUtilization')! * 100).toFixed(1));
    expect(cells[10]).toBe(readMetric(t, 'limitSpeedKmh')!.toFixed(2));
    expect(cells[3]).toBe(String(readParam(t, 'speedKmh')));
    expect(cells[2]).toBe('车速 v');
    expect(cells[4]).toBe('km/h');
  });

  it('半径自变量时自变量列切换为 R/m 且取值对应 radiusM', () => {
    const expR = mkExp([mkTrial(1, 54, 30), mkTrial(2, 54, 40), mkTrial(3, 54, 50)], 'radiusM');
    const repR = evaluateComparison(expR);
    const lines = buildExperimentCsv(expR, repR, 'eligible').slice(1).trim().split('\r\n');
    const row = lines.find((l) => l.startsWith('trial-2,'))!;
    const cells = row.split(',');
    expect(cells[2]).toBe('弯道半径 R');
    expect(cells[4]).toBe('m');
    expect(cells[3]).toBe('40');
  });

  it('每行都带试跑 ID 与时间戳', () => {
    const lines = buildExperimentCsv(exp, report, 'raw').slice(1).trim().split('\r\n').slice(1);
    for (const l of lines) {
      expect(l).toMatch(/^trial-\d,/);
      expect(l).toContain('2026-11-19T10:00:00.000Z');
    }
  });
});