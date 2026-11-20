import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './templates';
import { buildSeedExperiments } from './seed';

describe('UX-01 模板可用状态', () => {
  it('过弯模板为唯一完整流程模板', () => {
    const runnable = TEMPLATES.filter((t) => t.runnable);
    expect(runnable).toHaveLength(1);
    expect(runnable[0].id).toBe('tpl-cornering-ay');
    expect(runnable[0].category).toBe('cornering');
  });
  it('制动与气动模板明确标注不可运行且保留不删除', () => {
    const braking = TEMPLATES.find((t) => t.id === 'tpl-braking-mu');
    const aero = TEMPLATES.find((t) => t.id === 'tpl-aero-speed');
    expect(braking?.runnable).toBe(false);
    expect(aero?.runnable).toBe(false);
    expect(braking?.statusNote).toContain('运行器');
    expect(aero?.statusNote).toContain('尚未接入');
    expect(TEMPLATES).toHaveLength(3);
  });
  it('每个模板都有状态说明文案', () => {
    for (const t of TEMPLATES) expect(t.statusNote.length).toBeGreaterThan(8);
  });
  it('预置制动示例保留且带数据来源披露', () => {
    const seeds = buildSeedExperiments();
    const braking = seeds.find((e) => e.id === 'exp-braking-mu');
    expect(braking?.dataSourceNote).toContain('人为扰动');
    expect(braking?.trials.length).toBeGreaterThan(0);
  });
});