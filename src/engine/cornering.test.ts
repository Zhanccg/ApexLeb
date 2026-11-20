import { describe, expect, it } from 'vitest';
import { G } from './constants';
import { brakingDistance, corneringLimitSpeed, kmhToMs, lateralAccel, lateralG, msToKmh } from './vehicle';
import { computeCorneringRun, validateCorneringInputs } from './cornering';

describe('单位换算', () => {
  it('km/h → m/s', () => {
    expect(kmhToMs(54)).toBe(15);
    expect(kmhToMs(72)).toBe(20);
    expect(kmhToMs(90)).toBe(25);
  });
  it('m/s → km/h 往返一致', () => {
    expect(msToKmh(kmhToMs(79.73))).toBeCloseTo(79.73, 10);
  });
});

describe('侧向加速度 ay = v²/R', () => {
  const cases: Array<[number, number, number]> = [
    [54, 50, 4.5],
    [72, 50, 8.0],
    [90, 50, 12.5],
  ];
  it.each(cases)('v=%i km/h, R=%i m → ay=%f m/s²', (v, r, ay) => {
    expect(lateralAccel(kmhToMs(v), r)).toBeCloseTo(ay, 10);
  });
  it('lateralG 与 lateralAccel 保持 g 换算一致', () => {
    expect(lateralG(kmhToMs(90), 50)).toBeCloseTo(12.5 / G, 10);
  });
  it('非正半径返回 0 而非 NaN/Infinity', () => {
    expect(lateralAccel(15, 0)).toBe(0);
    expect(lateralAccel(15, -5)).toBe(0);
  });
});

describe('临界速度 v_limit = √(μgR)', () => {
  it('R=50 m, μ=1.0 → 约 79.73 km/h', () => {
    const limitMs = corneringLimitSpeed(50, 1.0);
    expect(limitMs).toBeCloseTo(Math.sqrt(9.81 * 50), 10);
    expect(msToKmh(limitMs)).toBeCloseTo(79.73, 2);
  });
});

describe('过弯工况计算 computeCorneringRun', () => {
  const cases: Array<[number, number, number, 'grip-ok' | 'grip-exceeded']> = [
    [54, 4.5, 4.5 / 9.81, 'grip-ok'],
    [72, 8.0, 8 / 9.81, 'grip-ok'],
    [90, 12.5, 12.5 / 9.81, 'grip-exceeded'],
  ];
  it.each(cases)('v=%i km/h → ay=%f, λ=%f, status=%s', (v, ay, lambda, status) => {
    const comp = computeCorneringRun({ speedKmh: v, radiusM: 50, mu: 1.0 });
    expect(comp.ok).toBe(true);
    if (!comp.ok) return;
    const res = comp.result;
    expect(res.lateralAccelMs2).toBeCloseTo(ay, 10);
    expect(res.gripUtilization).toBeCloseTo(lambda, 10);
    expect(res.ayMaxMs2).toBeCloseTo(9.81, 10);
    expect(res.limitSpeedKmh).toBeCloseTo(79.73, 2);
    expect(res.status).toBe(status);
  });
  it('零速度：ay=0、λ=0、状态附着内', () => {
    const comp = computeCorneringRun({ speedKmh: 0, radiusM: 50, mu: 1 });
    expect(comp.ok).toBe(true);
    if (!comp.ok) return;
    expect(comp.result.lateralAccelMs2).toBe(0);
    expect(comp.result.gripUtilization).toBe(0);
    expect(comp.result.status).toBe('grip-ok');
  });
});

describe('极端有限值溢出防护', () => {
  const ok = { speedKmh: '54', radiusM: '50', mu: '1.0' };
  const envelopeCases: Array<[Parameters<typeof validateCorneringInputs>[0], string]> = [
    [{ ...ok, speedKmh: '1e308' }, 'speedKmh'],
    [{ ...ok, speedKmh: '10001' }, 'speedKmh'],
    [{ ...ok, radiusM: '1e-308' }, 'radiusM'],
    [{ ...ok, radiusM: '1e7' }, 'radiusM'],
    [{ ...ok, mu: '1e308' }, 'mu'],
    [{ ...ok, mu: '1e-4' }, 'mu'],
  ];
  it.each(envelopeCases)('包络外有限值被拒绝 %j', (raw, field) => {
    const r = validateCorneringInputs(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe(field);
      expect(r.error).toContain('溢出');
    }
  });
  it('包络边界组合仍可安全计算且结果有限', () => {
    const r = validateCorneringInputs({ speedKmh: '10000', radiusM: '0.001', mu: '0.001' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const comp = computeCorneringRun(r.value);
    expect(comp.ok).toBe(true);
    if (!comp.ok) return;
    for (const v of Object.values(comp.result)) {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    }
  });
  it.each([
    { speedKmh: 1e300, radiusM: 50, mu: 1 },
    { speedKmh: 54, radiusM: 1e-310, mu: 1 },
    { speedKmh: 54, radiusM: 50, mu: 1e-320 },
    { speedKmh: 1e200, radiusM: 1e200, mu: 1e200 },
  ])('绕过校验直接计算极端值 → 拒绝而非产出 Infinity %j', (input) => {
    const comp = computeCorneringRun(input);
    expect(comp.ok).toBe(false);
    if (!comp.ok) expect(comp.error).toContain('非有限');
  });
  it.each([
    { speedKmh: 54, radiusM: 0, mu: 1 },
    { speedKmh: 54, radiusM: 50, mu: 0 },
    { speedKmh: -1, radiusM: 50, mu: 1 },
    { speedKmh: Number.NaN, radiusM: 50, mu: 1 },
    { speedKmh: 54, radiusM: Number.POSITIVE_INFINITY, mu: 1 },
  ])('非法域直接计算 → 拒绝 %j', (input) => {
    expect(computeCorneringRun(input).ok).toBe(false);
  });
});

describe('输入校验 validateCorneringInputs', () => {
  const ok = { speedKmh: '54', radiusM: '50', mu: '1.0' };
  it('合法输入通过并返回数值', () => {
    const r = validateCorneringInputs(ok);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ speedKmh: 54, radiusM: 50, mu: 1 });
  });
  const badCases: Array<[Parameters<typeof validateCorneringInputs>[0], string]> = [
    [{ ...ok, speedKmh: '-10' }, 'speedKmh'],
    [{ ...ok, speedKmh: '' }, 'speedKmh'],
    [{ ...ok, speedKmh: 'abc' }, 'speedKmh'],
    [{ ...ok, radiusM: '0' }, 'radiusM'],
    [{ ...ok, radiusM: '-50' }, 'radiusM'],
    [{ ...ok, radiusM: '' }, 'radiusM'],
    [{ ...ok, mu: '0' }, 'mu'],
    [{ ...ok, mu: '-1' }, 'mu'],
    [{ ...ok, mu: 'xyz' }, 'mu'],
  ];
  it.each(badCases)('拒绝非法输入 %j', (raw, field) => {
    const r = validateCorneringInputs(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe(field);
  });
  it('零速度合法（静止工况）', () => {
    expect(validateCorneringInputs({ ...ok, speedKmh: '0' }).ok).toBe(true);
  });
});

describe('既有制动模型回归', () => {
  it('d = v²/2μg：100 km/h, μ=1.0 → 约 39.33 m', () => {
    expect(brakingDistance(kmhToMs(100), 1.0)).toBeCloseTo(39.33, 1);
  });
  it('μ≤0 返回 Infinity', () => {
    expect(brakingDistance(20, 0)).toBe(Infinity);
  });
});