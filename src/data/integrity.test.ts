import { describe, expect, it } from 'vitest';
import {
  fmtNum,
  fmtParam,
  fmtPercent,
  fmtTick,
  isUsableTrial,
  parsePersistedRaw,
  readChannel,
  readMetric,
  readParam,
  requiredMetricKeys,
  samplesOf,
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

describe('旧变量字段迁移（T04 案例五）', () => {
  const legacyExp = {
    id: 'exp-legacy',
    title: '弯道半径与极限过弯速度',
    category: 'cornering',
    question: 'q',
    hypothesis: null,
    variables: [
      { id: 'radius', name: '弯道半径', symbol: 'r', unit: 'm', role: 'independent', min: 15, max: 200, step: 5, defaultValue: 60, hint: '' },
      { id: 'vLimit', name: '极限过弯速度', symbol: 'v', unit: 'km/h', role: 'dependent', min: 0, max: 250, step: 0.1, defaultValue: 0, hint: '' },
      { id: 'mu', name: '轮胎摩擦系数', symbol: 'μ', unit: '—', role: 'controlled', min: 0.5, max: 1.6, step: 0.05, defaultValue: 1.35, hint: '' },
    ],
    trials: [goodTrial],
    analysis: null,
    conclusion: null,
    stages: { question: 'done', hypothesis: 'done', design: 'done', collect: 'done', analyze: 'active', conclude: 'locked', report: 'locked' },
    tags: [],
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T10:00:00.000Z',
  };
  it('旧 id 迁移为规范键，保留原自变量选择与全部试跑、阶段', () => {
    const out = sanitizeExperiment(legacyExp);
    expect(out).not.toBeNull();
    if (!out) return;
    expect(out.variablesVersion).toBe(2);
    expect(out.variables.map((v) => v.id).sort()).toEqual(['lateralAccelMs2', 'mu', 'radiusM', 'speedKmh']);
    expect(out.variables.find((v) => v.role === 'independent')?.id).toBe('radiusM');
    expect(out.variables.find((v) => v.role === 'dependent')?.id).toBe('lateralAccelMs2');
    expect(out.legacyMigrationNote).toContain('radius');
    expect(out.trials).toHaveLength(1);
    expect(out.stages.collect).toBe('done');
    expect(out.stages.analyze).toBe('active');
  });
  it('规范定义二次读取不重建、不产生迁移提示', () => {
    const once = sanitizeExperiment(legacyExp);
    const twice = sanitizeExperiment(once);
    expect(twice?.legacyMigrationNote).toBe(once?.legacyMigrationNote);
    expect(twice?.variables).toEqual(once?.variables);
  });
  it('迁移后试跑参数键无需改动即可被对照判定读取', () => {
    const out = sanitizeExperiment(legacyExp);
    expect(readParam(out?.trials[0], 'radiusM')).toBe(50);
    expect(readMetric(out?.trials[0], 'lateralAccelMs2')).toBe(4.5);
  });
});

describe('预置制动示例披露回填（T06 兼容）', () => {
  it('旧持久化制动示例读取时回填数据来源披露，不改动试跑', () => {
    const out = sanitizeExperiment({
      id: 'exp-braking-mu',
      title: '摩擦系数对制动距离的影响',
      category: 'braking',
      question: 'q',
      hypothesis: null,
      variables: [],
      trials: [goodTrial],
      analysis: null,
      conclusion: null,
      stages: {},
      tags: [],
      createdAt: '2026-11-19T10:00:00.000Z',
      updatedAt: '2026-11-19T10:00:00.000Z',
    });
    expect(out?.dataSourceNote).toContain('人为扰动');
    expect(out?.dataSourceNote).toContain('不属于真实实测');
    expect(out?.trials).toHaveLength(1);
  });
  it('用户自建制动实验不被强加预置披露', () => {
    const out = sanitizeExperiment({
      id: 'exp-user-braking',
      title: 't',
      category: 'braking',
      question: 'q',
      hypothesis: null,
      variables: [],
      trials: [],
      analysis: null,
      conclusion: null,
      stages: {},
      tags: [],
      createdAt: 'x',
      updatedAt: 'x',
    });
    expect(out?.dataSourceNote).toBeUndefined();
  });
});

describe('FIX-03 统一数值格式化出口', () => {
  it('fmtParam 保留输入精度（不取整不截断）', () => {
    expect(fmtParam(54.5)).toBe('54.5');
    expect(fmtParam(50.5)).toBe('50.5');
    expect(fmtParam(1)).toBe('1');
    expect(fmtParam(0.855)).toBe('0.855');
    expect(fmtParam(0.001)).toBe('0.001');
    expect(fmtParam(72.25)).toBe('72.25');
    expect(fmtParam(null)).toBe('非有限');
    expect(fmtParam(Number.NaN)).toBe('非有限');
  });
  it('fmtNum 指标固定小数位', () => {
    expect(fmtNum(4.587155, 2)).toBe('4.59');
    expect(fmtNum(79.7309, 2)).toBe('79.73');
  });
  it('fmtPercent 利用率百分比 1 位', () => {
    expect(fmtPercent(0.458715)).toBe('45.9');
    expect(fmtPercent(1.2742)).toBe('127.4');
    expect(fmtPercent(undefined)).toBe('非有限');
  });
  it('fmtTick 刻度最多两位去零', () => {
    expect(fmtTick(54.5)).toBe('54.5');
    expect(fmtTick(4.587155)).toBe('4.59');
    expect(fmtTick(90)).toBe('90');
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

describe('metrics 整对象异常（T03 最终修复）', () => {
  it.each([
    ['A: metrics 为 null', null],
    ['B: metrics 为 undefined', undefined],
    ['C: metrics 为数组', []],
    ['C: metrics 为字符串', 'broken'],
    ['C: metrics 为数字', 42],
    ['C: metrics 为布尔', true],
    ['C: metrics 为空对象', {}],
  ])('%s → 判定无效且不抛异常', (_label, metrics) => {
    const bad = { ...goodTrial, metrics };
    expect(() => trialInvalidReason(bad)).not.toThrow();
    expect(trialInvalidReason(bad)).toContain('指标结构非法');
    expect(isUsableTrial(bad as Trial)).toBe(false);
  });
  it('B: metrics 键缺失 → 判定无效', () => {
    const { metrics: _m, ...rest } = goodTrial;
    expect(trialInvalidReason(rest)).toContain('指标结构非法');
  });
  it('D: 单个指标为 null → 判定无效', () => {
    const bad = { ...goodTrial, metrics: { ...goodTrial.metrics, gripUtilization: null } };
    expect(trialInvalidReason(bad)).not.toBeNull();
  });
  it('必要计算字段缺失 → 判定无效并列出字段', () => {
    const bad = { ...goodTrial, metrics: { lateralAccelMs2: 4.5 } };
    const reason = trialInvalidReason(bad);
    expect(reason).toContain('缺少必要计算字段');
    expect(reason).toContain('gripUtilization');
  });
  it('制动形状记录按制动必要字段校验', () => {
    const braking = {
      ...goodTrial,
      params: { mu: 1, v0: 100, mass: 570 },
      metrics: { brakeDistance: 39.33, stopTime: 2.83, peakDecelG: 1 },
    };
    expect(trialInvalidReason(braking)).toBeNull();
    expect(trialInvalidReason({ ...braking, metrics: { brakeDistance: 39.33 } })).toContain('stopTime');
    expect(requiredMetricKeys(braking.params)).toEqual(['brakeDistance', 'stopTime']);
  });
  it('sanitizeTrial 保留 null metrics 原值并标记 invalid', () => {
    const out = sanitizeTrial({ ...goodTrial, metrics: null });
    expect(out?.status).toBe('invalid');
    expect(out?.metrics).toBeNull();
    expect(out?.invalidReason).toContain('指标结构非法');
  });
  it('异常记录不删除所属实验，其余记录保留', () => {
    const out = sanitizeExperiment({
      id: 'e1',
      title: 't',
      trials: [goodTrial, { ...goodTrial, id: 'bad-null', metrics: null }],
      stages: {},
    });
    expect(out?.trials).toHaveLength(2);
    expect(out?.trials[1].status).toBe('invalid');
  });
});

describe('安全读取函数（展示路径不抛异常）', () => {
  it.each([[null], [undefined], [[]], ['x'], [{}]])('metrics=%s 时 readMetric 返回 undefined', (metrics) => {
    expect(readMetric({ ...goodTrial, metrics }, 'lateralAccelMs2')).toBeUndefined();
  });
  it('readMetric / readParam 对 null 记录安全', () => {
    expect(readMetric(null, 'lateralAccelMs2')).toBeUndefined();
    expect(readParam(null, 'mu')).toBeUndefined();
    expect(readChannel(null, 'speed')).toBeUndefined();
  });
  it('正常记录读取值正确', () => {
    expect(readMetric(goodTrial, 'lateralAccelMs2')).toBe(4.5);
    expect(readParam(goodTrial, 'speedKmh')).toBe(54);
    expect(readChannel(goodTrial.samples[0], 'speed')).toBe(54);
  });
  it('samples 为 null / 非数组时 samplesOf 返回空数组', () => {
    expect(samplesOf({ ...goodTrial, samples: null })).toEqual([]);
    expect(samplesOf({ ...goodTrial, samples: 'x' })).toEqual([]);
    expect(samplesOf(null)).toEqual([]);
  });
  it('channels 为 null 时 readChannel 返回 undefined', () => {
    expect(readChannel({ t: 0, channels: null }, 'speed')).toBeUndefined();
  });
  it('崩溃路径回归：fmtNum(readMetric(nullMetrics)) 不抛异常且显示非有限', () => {
    const bad = { ...goodTrial, metrics: null };
    expect(() => fmtNum(readMetric(bad, 'lateralAccelMs2'))).not.toThrow();
    expect(fmtNum(readMetric(bad, 'lateralAccelMs2'))).toBe('非有限');
    expect(fmtNum(readMetric(bad, 'limitSpeedKmh'))).toBe('非有限');
  });
});