import { describe, expect, it } from 'vitest';
import {
  fmtNum,
  isUsableTrial,
  parsePersistedRaw,
  sanitizeExperiment,
  sanitizePersistedState,
  sanitizeTrial,
  trialInvalidReason,
} from './integrity';
import type { Trial } from './schema';

const goodTrial: Trial = {
  id: 'trial-good-1',
  index: 1,
  params: { speedKmh: 54, radiusM: 50, mu: 1 },
  metrics: { lateralAccelMs2: 4.5, gripUtilization: 0.4587, limitSpeedKmh: 79.73, limitSpeedMs: 22.1472 },
  samples: [{ t: 0, channels: { speed: 54, lateralAccelMs2: 4.5 } }],
  status: 'completed',
  note: '',
  createdAt: '2026-11-19T10:00:00.000Z',
  modelVersion: 'cornering-flat-noaero-v1',
};

describe('记录完整性判定 trialInvalidReason', () => {
  it('完整有限记录 → null', () => {
    expect(trialInvalidReason(goodTrial)).toBeNull();
  });
  it.each([
    ['Infinity 指标', { ...goodTrial, metrics: { ...goodTrial.metrics, lateralAccelMs2: Infinity } }],
    ['NaN 指标', { ...goodTrial, metrics: { ...goodTrial.metrics, gripUtilization: Number.NaN } }],
    ['null 指标（JSON 序列化 Infinity 的产物）', { ...goodTrial, metrics: { ...goodTrial.metrics, limitSpeedKmh: null } }],
    ['字符串指标', { ...goodTrial, metrics: { ...goodTrial.metrics, lateralAccelMs2: '4.5' } }],
    ['缺失 metrics', { ...goodTrial, metrics: undefined }],
    ['Infinity 参数', { ...goodTrial, params: { ...goodTrial.params, mu: Infinity } }],
    ['遥测通道非有限', { ...goodTrial, samples: [{ t: 0, channels: { speed: Number.NaN } }] }],
    ['遥测时间非有限', { ...goodTrial, samples: [{ t: Infinity, channels: { speed: 54 } }] }],
    ['缺少 ID', { ...goodTrial, id: '' }],
    ['序号非有限', { ...goodTrial, index: Number.NaN }],
    ['缺少时间戳', { ...goodTrial, createdAt: '' }],
  ])('%s → 判定无效', (_label, bad) => {
    expect(trialInvalidReason(bad)).not.toBeNull();
  });
  it('JSON.parse 1e999 产生 Infinity 也能识别', () => {
    const parsed = JSON.parse('{"metrics":{"lateralAccelMs2":1e999}}') as { metrics: Record<string, number> };
    expect(parsed.metrics.lateralAccelMs2).toBe(Infinity);
    expect(trialInvalidReason({ ...goodTrial, metrics: parsed.metrics })).not.toBeNull();
  });
});

describe('无效标记 sanitizeTrial', () => {
  it('保留原始数值与 ID，仅标记 invalid 并写入原因', () => {
    const bad = { ...goodTrial, metrics: { ...goodTrial.metrics, lateralAccelMs2: Infinity } };
    const out = sanitizeTrial(bad);
    expect(out).not.toBeNull();
    if (!out) return;
    expect(out.id).toBe(goodTrial.id);
    expect(out.status).toBe('invalid');
    expect(out.invalidReason).toContain('非有限');
    expect(out.metrics.lateralAccelMs2).toBe(Infinity);
    expect(out.params).toEqual(goodTrial.params);
    expect(out.note).toContain('数据异常');
  });
  it('有效记录原样返回', () => {
    expect(sanitizeTrial(goodTrial)).toBe(goodTrial);
  });
  it('彻底无法识别的结构返回 null（仅丢弃该条）', () => {
    expect(sanitizeTrial(null)).toBeNull();
    expect(sanitizeTrial({ foo: 1 })).toBeNull();
    expect(sanitizeTrial('trial')).toBeNull();
  });
});

describe('有效试跑判定 isUsableTrial', () => {
  it('completed 且完整 → 可用', () => {
    expect(isUsableTrial(goodTrial)).toBe(true);
  });
  it('invalid 状态 → 不可用', () => {
    expect(isUsableTrial({ ...goodTrial, status: 'invalid' })).toBe(false);
  });
  it('completed 但含 NaN → 不可用（不满足阶段条件）', () => {
    expect(isUsableTrial({ ...goodTrial, metrics: { ...goodTrial.metrics, gripUtilization: Number.NaN } })).toBe(false);
  });
});

describe('实验级清洗 sanitizeExperiment', () => {
  const exp = {
    id: 'exp-x',
    title: '测试实验',
    category: 'cornering',
    question: 'q',
    hypothesis: null,
    variables: [],
    trials: [goodTrial, { ...goodTrial, id: 'trial-bad', metrics: { lateralAccelMs2: Infinity } }, null],
    analysis: null,
    conclusion: null,
    stages: { question: 'done', hypothesis: 'done', design: 'done', collect: 'active', analyze: 'locked', conclude: 'locked', report: 'locked' },
    tags: [],
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T10:00:00.000Z',
  };
  it('保留有效记录、标记无效记录、丢弃无结构条目', () => {
    const out = sanitizeExperiment(exp);
    expect(out).not.toBeNull();
    if (!out) return;
    expect(out.trials).toHaveLength(2);
    expect(out.trials[0].status).toBe('completed');
    expect(out.trials[1].status).toBe('invalid');
    expect(out.trials[1].id).toBe('trial-bad');
  });
  it('stages 损坏时重建为合法状态机', () => {
    const out = sanitizeExperiment({ ...exp, stages: { question: 'bogus' } });
    expect(out?.stages.question).toBe('active');
    expect(out?.stages.report).toBe('locked');
  });
  it('缺少 id 或 trials 非数组 → 丢弃该实验而非崩溃', () => {
    expect(sanitizeExperiment({ ...exp, id: '' })).toBeNull();
    expect(sanitizeExperiment({ ...exp, trials: 'broken' })).toBeNull();
    expect(sanitizeExperiment(undefined)).toBeNull();
  });
});

describe('持久化解析 parsePersistedRaw', () => {
  it.each([
    ['null', null],
    ['空串', ''],
    ['截断 JSON', '{"state":'],
    ['顶层非对象', '"hello"'],
    ['缺少 state', '{"foo":1}'],
    ['experiments 非数组', '{"state":{"experiments":{}}}'],
  ])('%s → 损坏', (_label, raw) => {
    expect(parsePersistedRaw(raw as string | null).ok).toBe(false);
  });
  it('合法结构通过', () => {
    const r = parsePersistedRaw('{"state":{"experiments":[],"reports":[]},"version":0}');
    expect(r.ok).toBe(true);
  });
  it('reports 缺失时容忍为空数组', () => {
    const r = parsePersistedRaw('{"state":{"experiments":[]}}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.reports).toEqual([]);
  });
});

describe('持久化清洗 sanitizePersistedState', () => {
  it('混合数据逐条容错，不整体清空', () => {
    const out = sanitizePersistedState({
      experiments: [
        { id: 'e1', title: 't', trials: [goodTrial], stages: {} },
        { id: '', title: 'broken', trials: [] },
      ],
      reports: [{ id: 'r1', experimentId: 'e1', markdown: '# ok', title: 't', createdAt: 'x' }, { id: 5 }, null],
    });
    expect(out.experiments).toHaveLength(1);
    expect(out.reports).toHaveLength(1);
  });
  it('空对象 / 缺失数组不抛异常', () => {
    expect(sanitizePersistedState({} as never)).toEqual({ experiments: [], reports: [] });
  });
});

describe('展示格式化 fmtNum', () => {
  it('有限数值正常格式化', () => {
    expect(fmtNum(4.5)).toBe('4.50');
    expect(fmtNum(79.7309, 2)).toBe('79.73');
  });
  it.each([[Infinity], [-Infinity], [Number.NaN], [null], [undefined], ['4.5']])('%s → 非有限', (v) => {
    expect(fmtNum(v)).toBe('非有限');
  });
});