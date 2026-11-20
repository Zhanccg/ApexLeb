/**
 * 生成比赛留证用 CSV 样例（真实模型计算值，非虚构数据）：
 * npx tsx scripts/export-sample.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildExperimentCsv } from '../src/report/csv';
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
  analysis: null,
  conclusion: null,
  stages: { question: 'done', hypothesis: 'done', design: 'done', collect: 'done', analyze: 'active', conclude: 'locked', report: 'locked' },
  tags: ['T05样例'],
  createdAt: '2026-11-19T09:00:00.000Z',
  updatedAt: '2026-11-19T10:05:00.000Z',
};

const report = evaluateComparison(exp);
mkdirSync('docs/samples', { recursive: true });
writeFileSync('docs/samples/apexlab-sample-raw.csv', buildExperimentCsv(exp, report, 'raw'), 'utf8');
writeFileSync('docs/samples/apexlab-sample-eligible.csv', buildExperimentCsv(exp, report, 'eligible'), 'utf8');
console.log('raw rows:', report.counts.total, 'eligible rows:', report.counts.eligible, 'distinct:', report.counts.distinct);