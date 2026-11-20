import { describe, expect, it } from 'vitest';
import { checkStageCompletion } from './rules';
import type { Experiment, Trial } from '@/data/schema';

const trial = (over: Partial<Trial>): Trial => ({
  id: 't1',
  index: 1,
  params: { speedKmh: 54, radiusM: 50, mu: 1 },
  metrics: { lateralAccelMs2: 4.5, gripUtilization: 0.4587, limitSpeedKmh: 79.73, limitSpeedMs: 22.1472 },
  samples: [],
  status: 'completed',
  note: '',
  createdAt: '2026-11-19T10:00:00.000Z',
  ...over,
});

const exp = (trials: Trial[]): Experiment =>
  ({
    id: 'e1',
    title: 't',
    category: 'cornering',
    question: 'q',
    hypothesis: null,
    variables: [],
    trials,
    analysis: null,
    conclusion: null,
    stages: {
      question: 'done',
      hypothesis: 'done',
      design: 'done',
      collect: 'active',
      analyze: 'locked',
      conclude: 'locked',
      report: 'locked',
    },
    tags: [],
    createdAt: 'x',
    updatedAt: 'x',
  }) as Experiment;

describe('采集阶段退出条件不受无效记录影响', () => {
  it('3 条 completed 但含 NaN/Infinity 的记录 → 不满足', () => {
    const bad = [
      trial({ id: 'b1', metrics: { lateralAccelMs2: Number.NaN } as Trial['metrics'] }),
      trial({ id: 'b2', metrics: { lateralAccelMs2: Infinity } as Trial['metrics'] }),
      trial({ id: 'b3', params: { speedKmh: Infinity, radiusM: 50, mu: 1 } }),
    ];
    const r = checkStageCompletion(exp(bad), 'collect');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('当前 0 次');
  });
  it('3 条有效记录 + 2 条无效记录 → 满足且计数只算有效', () => {
    const trials = [
      trial({ id: 'g1' }),
      trial({ id: 'g2', index: 2 }),
      trial({ id: 'g3', index: 3 }),
      trial({ id: 'b1', index: 4, status: 'invalid' }),
      trial({ id: 'b2', index: 5, metrics: { lateralAccelMs2: null } as unknown as Trial['metrics'] }),
    ];
    const r = checkStageCompletion(exp(trials), 'collect');
    expect(r.ok).toBe(true);
    expect(r.reason).toContain('3 次');
  });
  it('2 条有效记录 → 不满足', () => {
    expect(checkStageCompletion(exp([trial({ id: 'g1' }), trial({ id: 'g2', index: 2 })]), 'collect').ok).toBe(false);
  });
});