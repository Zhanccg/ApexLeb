/**
 * 生成比赛留证用 CSV 样例（真实模型计算值，非虚构数据）：
 * npx tsx scripts/export-sample.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildExperimentCsv } from '../src/report/csv';
import { generateReport } from '../src/report/generator';
import { evaluateComparison } from '../src/pedagogy';
import { corneringVariables } from '../src/data/variables';
import { computeCorneringRun } from '../src/engine';
import type { Experiment, Trial } from '../src/data/schema';

const mkTrial = (index: number, speedKmh: number, radiusM: number): Trial => {
  const comp = computeCorneringRun({ speedKmh, radiusM, mu: 1 });
  if (!comp.ok) throw new Error('compute failed');
  return {
    id: `trial-sample-${index}`,
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
    note: index === 2 ? '重复试跑：验证稳定性' : index === 3 ? '混杂：半径被同时改变' : '',
    createdAt: `2026-11-19T10:0${index}:00.000Z`,
    modelVersion: 'cornering-flat-noaero-v1',
  };
};

const exp: Experiment = {
  id: 'exp-sample-t05',
  title: '车速与侧向加速度',
  category: 'cornering',
  question: '在相同弯道半径与路面附着条件下，车速 v 如何影响赛车过弯时的侧向加速度 ay？',
  hypothesis: {
    id: 'h-sample',
    statement: '侧向加速度 ay 随车速 v 增大而增大，且与 v² 成正比。',
    expectedDirection: 'nonlinear',
    rationale: 'ay = v²/R',
    createdAt: '2026-11-19T09:00:00.000Z',
  },
  variables: corneringVariables('speedKmh'),
  variablesVersion: 2,
  trials: [mkTrial(1, 54, 50), mkTrial(2, 54, 50), mkTrial(3, 72, 60), mkTrial(4, 72, 50), mkTrial(5, 90, 50)],
  analysis: {
    id: 'ana-sample',
    method: '绘制 ay–v 对照曲线（水平汇总 n=样本数）并比较水平间差异',
    findings: [
      {
        id: 'f-sample-1',
        observation: '在弯道半径保持 50 m 时，车速从 54 km/h 提高到 72 km/h 与 90 km/h，所需侧向加速度从 4.50 m/s² 提高到 8.00 与 12.50 m/s²，与 ay = v²/R 的平方关系一致。',
        evidenceTrialIds: ['trial-sample-1', 'trial-sample-4', 'trial-sample-5'],
        supportsHypothesis: true,
      },
    ],
    createdAt: '2026-11-19T11:00:00.000Z',
    limitations: '仅覆盖 54–90 km/h、R=50 m、μ=1；90 km/h 工况 λ=127.4% 已超出简化附着极限。',
  },
  conclusion: {
    statement: '在 R=50 m、μ=1 条件下，侧向加速度需求与车速平方成正比；54→72→90 km/h 对应 4.50→8.00→12.50 m/s²，假设被数据支持。',
    hypothesisVerdict: 'supported',
    limitations: '结论仅适用于所测取值范围；简化质点模型未含轮胎特性、气动与载荷转移。',
    createdAt: '2026-11-19T11:30:00.000Z',
  },
  stages: { question: 'done', hypothesis: 'done', design: 'done', collect: 'done', analyze: 'done', conclude: 'done', report: 'done' },
  tags: ['T05样例'],
  createdAt: '2026-11-19T09:00:00.000Z',
  updatedAt: '2026-11-19T10:05:00.000Z',
};

const report = evaluateComparison(exp);
mkdirSync('docs/samples', { recursive: true });
writeFileSync('docs/samples/apexlab-sample-raw.csv', buildExperimentCsv(exp, report, 'raw'), 'utf8');
writeFileSync('docs/samples/apexlab-sample-eligible.csv', buildExperimentCsv(exp, report, 'eligible'), 'utf8');
writeFileSync('docs/samples/apexlab-sample-report.md', generateReport(exp).markdown, 'utf8');
console.log('raw rows:', report.counts.total, 'eligible rows:', report.counts.eligible, 'distinct:', report.counts.distinct);