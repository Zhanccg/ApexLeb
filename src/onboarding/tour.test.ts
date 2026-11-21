import { describe, expect, it } from 'vitest';
import { TOUR_STEPS } from './tour';

describe('引导动线数据', () => {
  it('步骤 id 唯一且文案完整', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of TOUR_STEPS) {
      expect(s.eyebrow.trim().length).toBeGreaterThan(0);
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.body.trim().length).toBeGreaterThan(0);
      expect(['race', 'tele', 'amber']).toContain(s.tone);
    }
  });

  it('要点不超过 4 条，避免引导卡片过长', () => {
    for (const s of TOUR_STEPS) expect(s.points.length).toBeLessThanOrEqual(4);
  });

  it('需要聚光的步骤一律用 data-tour 选择器', () => {
    for (const s of TOUR_STEPS) {
      if (s.target) expect(s.target).toMatch(/^\[data-tour="[a-z-]+"\]$/);
    }
  });

  it('跳转一律由用户点击触发：中间步骤不带 actions，visit 只指向站内路由', () => {
    for (const s of TOUR_STEPS.slice(0, -1)) expect(s.actions).toBeUndefined();
    for (const s of TOUR_STEPS) {
      if (s.visit) {
        expect(s.visit.to.startsWith('/')).toBe(true);
        expect(s.visit.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('自动跨页只为聚光目标服务，且不与 visit 按钮重复指同一页', () => {
    for (const s of TOUR_STEPS) {
      if (s.route) {
        expect(s.route.startsWith('/')).toBe(true);
        expect(s.target).toBeDefined();
      }
      if (s.route && s.visit) expect(s.visit.to).not.toBe(s.route);
    }
  });

  it('最后一步给出可执行的发车动作，且只有一条主行动', () => {
    const last = TOUR_STEPS[TOUR_STEPS.length - 1];
    expect(last.actions).toBeDefined();
    expect(last.actions?.filter((a) => a.kind === 'challenge')).toHaveLength(1);
    for (const a of TOUR_STEPS.flatMap((s) => s.actions ?? [])) {
      if (a.kind === 'goto') expect(a.to?.startsWith('/')).toBe(true);
    }
  });
});
