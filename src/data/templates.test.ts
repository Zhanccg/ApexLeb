import { describe, expect, it } from 'vitest';
import { TEMPLATES, experimentFlowStatus } from './templates';
import { buildSeedExperiments } from './seed';
import type { Experiment } from './schema';

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

describe('UX-02 实验可用状态唯一出口', () => {
  const base = {
    id: 'e-x',
    title: 't',
    question: 'q',
    hypothesis: null,
    variables: [],
    trials: [],
    analysis: null,
    conclusion: null,
    stages: { question: 'active', hypothesis: 'locked', design: 'locked', collect: 'locked', analyze: 'locked', conclude: 'locked', report: 'locked' },
    tags: [],
    createdAt: 'x',
    updatedAt: 'x',
  } as unknown as Experiment;

  it('预置示例优先于类别判定', () => {
    expect(experimentFlowStatus({ ...base, category: 'braking', dataSourceNote: '预置教学示例' }).key).toBe('preset');
  });
  it('过弯（含已完成闭环）为完整流程', () => {
    expect(experimentFlowStatus({ ...base, category: 'cornering' }).label).toBe('完整流程');
    expect(experimentFlowStatus({ ...base, category: 'cornering', stages: { ...base.stages, report: 'done' } }).key).toBe('full');
  });
  it('历史气动实验标注运行器未接入', () => {
    expect(experimentFlowStatus({ ...base, category: 'aero' }).label).toBe('运行器未接入');
  });
  it('与实验库徽章共用同一函数（无第二套逻辑）', () => {
    const seeds = buildSeedExperiments();
    expect(experimentFlowStatus(seeds.find((e) => e.id === 'exp-braking-mu')!).key).toBe('preset');
    expect(experimentFlowStatus(seeds.find((e) => e.category === 'cornering')!).key).toBe('full');
  });
});