import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AnalysisFinding, Conclusion, Experiment, Hypothesis, ReportDoc, StageId, TelemetrySample, Trial } from './schema';
import { TEMPLATES } from './templates';
import { buildSeedExperiments } from './seed';
import { STAGE_ORDER, canAdvanceTo, checkStageCompletion, checkFindingEvidence, evaluateComparison } from '@/pedagogy';
import { parsePersistedRaw, sanitizePersistedState, trialInvalidReason, type PersistedShape } from './integrity';
import { VARIABLES_VERSION, corneringVariables, type CorneringParamKey } from './variables';

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface LabState {
  experiments: Experiment[];
  reports: ReportDoc[];
  createFromTemplate: (templateId: string) => string | null;
  deleteExperiment: (id: string) => void;
  updateQuestion: (id: string, question: string) => void;
  setHypothesis: (id: string, hyp: Omit<Hypothesis, 'id' | 'createdAt'>) => void;
  updateMethod: (
    id: string,
    payload: {
      statement: string;
      rationale: string;
      expectedDirection: Hypothesis['expectedDirection'];
      roles: Record<CorneringParamKey, 'independent' | 'controlled'>;
    },
  ) => { ok: boolean; reason?: string; notice?: string };
  completeStage: (id: string, stage: StageId) => { ok: boolean; reason: string };
  addTrial: (
    expId: string,
    data: {
      params: Record<string, number>;
      metrics: Record<string, number>;
      samples?: TelemetrySample[];
      note?: string;
      modelVersion?: string;
    },
  ) => Trial | null;
  setConclusion: (id: string, conclusion: Omit<Conclusion, 'createdAt'>) => void;
  setAnalysisMeta: (id: string, meta: { method: string; limitations: string }) => void;
  addFinding: (
    id: string,
    finding: Omit<AnalysisFinding, 'id'>,
  ) => { ok: boolean; reason?: string };
  updateFinding: (
    id: string,
    findingId: string,
    patch: Omit<AnalysisFinding, 'id'>,
  ) => { ok: boolean; reason?: string };
  deleteFinding: (id: string, findingId: string) => void;
  addReport: (report: ReportDoc) => void;
  deleteReport: (id: string) => void;
  resetLab: () => void;
}

const touch = (exp: Experiment): Experiment => ({ ...exp, updatedAt: new Date().toISOString() });

/**
 * 安全存储包装：JSON 损坏或顶层结构损坏时回退种子数据，
 * 原始损坏内容备份到 `<name>.corrupt-backup` 供排查，不直接删除历史数据。
 */
const safeLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      const raw = localStorage.getItem(name);
      const parsed = parsePersistedRaw(raw);
      if (!parsed.ok) {
        if (raw !== null && raw !== '') {
          try {
            localStorage.setItem(`${name}.corrupt-backup`, raw);
          } catch {
            /* 备份失败不影响回退 */
          }
        }
        return null;
      }
      return raw;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* 存储不可用时保持内存态 */
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const useLabStore = create<LabState>()(
  persist(
    (set, get) => ({
      experiments: buildSeedExperiments(),
      reports: [],

      createFromTemplate: (templateId) => {
        const tpl = TEMPLATES.find((t) => t.id === templateId);
        if (!tpl) return null;
        const id = uid('exp');
        const ts = new Date().toISOString();
        const exp: Experiment = {
          id,
          title: tpl.title,
          category: tpl.category,
          question: tpl.question,
          hypothesis: { id: uid('hyp'), ...tpl.suggestedHypothesis, createdAt: ts },
          variables: tpl.variables,
          variablesVersion: VARIABLES_VERSION,
          trials: [],
          analysis: null,
          conclusion: null,
          stages: {
            question: 'done',
            hypothesis: 'active',
            design: 'locked',
            collect: 'locked',
            analyze: 'locked',
            conclude: 'locked',
            report: 'locked',
          },
          tags: tpl.tags,
          createdAt: ts,
          updatedAt: ts,
        };
        set((s) => ({ experiments: [exp, ...s.experiments] }));
        return id;
      },

      deleteExperiment: (id) =>
        set((s) => ({
          experiments: s.experiments.filter((e) => e.id !== id),
          reports: s.reports.filter((r) => r.experimentId !== id),
        })),

      updateQuestion: (id, question) =>
        set((s) => ({
          experiments: s.experiments.map((e) => (e.id === id ? touch({ ...e, question }) : e)),
        })),

      setHypothesis: (id, hyp) =>
        set((s) => ({
          experiments: s.experiments.map((e) =>
            e.id === id
              ? touch({ ...e, hypothesis: { id: uid('hyp'), ...hyp, createdAt: new Date().toISOString() } })
              : e,
          ),
        })),

      updateMethod: (id, payload) => {
        const exp = get().experiments.find((e) => e.id === id);
        if (!exp) return { ok: false, reason: '实验不存在' };
        if (exp.category !== 'cornering') return { ok: false, reason: '方法编辑器当前仅支持过弯实验' };
        const independents = (Object.keys(payload.roles) as CorneringParamKey[]).filter((k) => payload.roles[k] === 'independent');
        if (independents.length !== 1) {
          return { ok: false, reason: '必须恰好设置一个自变量（车速 v 或弯道半径 R），其余为控制变量' };
        }
        const independentKey = independents[0];
        if (independentKey !== 'speedKmh' && independentKey !== 'radiusM') {
          return { ok: false, reason: '本过弯实验的自变量只能是车速 v 或弯道半径 R' };
        }
        if (payload.roles.mu !== 'controlled') {
          return { ok: false, reason: '附着系数 μ 在本实验中必须作为控制变量保持恒定' };
        }
        if (payload.statement.trim().length < 8) return { ok: false, reason: '假设陈述至少 8 个字' };
        if (!payload.rationale.trim()) return { ok: false, reason: '请填写假设的物理依据' };

        const next: Experiment = {
          ...exp,
          variables: corneringVariables(independentKey),
          variablesVersion: VARIABLES_VERSION,
          hypothesis: {
            id: uid('hyp'),
            statement: payload.statement.trim(),
            rationale: payload.rationale.trim(),
            expectedDirection: payload.expectedDirection,
            createdAt: new Date().toISOString(),
          },
        };
        const before = evaluateComparison(exp);
        const after = evaluateComparison(next);
        const confoundedCount = after.evaluations.filter((e) => e.confounded.length > 0).length;
        const notice = `变量角色与假设已更新：合格对照 ${before.counts.eligible} → ${after.counts.eligible} 条，不同自变量取值 ${before.counts.distinct} → ${after.counts.distinct} 个；${confoundedCount} 条混杂记录已按新方案重新判定。历史试跑全部保留。`;
        set((s) => ({
          experiments: s.experiments.map((e) =>
            e.id === id
              ? touch({ ...next, methodNote: `${new Date().toLocaleString('zh-CN', { hour12: false })} · ${notice}` })
              : e,
          ),
        }));
        return { ok: true, notice };
      },

      completeStage: (id, stage) => {
        const exp = get().experiments.find((e) => e.id === id);
        if (!exp) return { ok: false, reason: '实验不存在' };
        if (exp.stages[stage] === 'done') return { ok: true, reason: '该阶段已完成' };
        if (!canAdvanceTo(exp, stage)) return { ok: false, reason: '请先完成前序阶段——科研流程不允许跳步' };
        const check = checkStageCompletion(exp, stage);
        if (!check.ok) return check;
        set((s) => ({
          experiments: s.experiments.map((e) => {
            if (e.id !== id) return e;
            const stages = { ...e.stages, [stage]: 'done' as const };
            const next = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
            if (next && stages[next] === 'locked') stages[next] = 'active';
            return touch({ ...e, stages });
          }),
        }));
        return { ok: true, reason: check.reason };
      },

      addTrial: (expId, data) => {
        const exp = get().experiments.find((e) => e.id === expId);
        if (!exp) return null;
        const trial: Trial = {
          id: uid('trial'),
          index: exp.trials.length + 1,
          params: data.params,
          metrics: data.metrics,
          samples: data.samples ?? [],
          status: 'completed',
          note: data.note ?? '',
          createdAt: new Date().toISOString(),
          modelVersion: data.modelVersion,
        };
        // 写入前拦截：任何非有限数值 / 结构缺陷都不进入持久化存储
        if (trialInvalidReason(trial) !== null) return null;
        set((s) => ({
          experiments: s.experiments.map((e) =>
            e.id === expId ? touch({ ...e, trials: [...e.trials, trial] }) : e,
          ),
        }));
        return trial;
      },

      setConclusion: (id, conclusion) =>
        set((s) => ({
          experiments: s.experiments.map((e) =>
            e.id === id ? touch({ ...e, conclusion: { ...conclusion, createdAt: new Date().toISOString() } }) : e,
          ),
        })),

      setAnalysisMeta: (id, meta) =>
        set((s) => ({
          experiments: s.experiments.map((e) => {
            if (e.id !== id) return e;
            const analysis = e.analysis ?? { id: uid('ana'), method: '', findings: [], createdAt: new Date().toISOString() };
            return touch({ ...e, analysis: { ...analysis, method: meta.method, limitations: meta.limitations } });
          }),
        })),

      addFinding: (id, finding) => {
        const exp = get().experiments.find((e) => e.id === id);
        if (!exp) return { ok: false, reason: '实验不存在' };
        const candidate: AnalysisFinding = { id: uid('f'), ...finding };
        const check = checkFindingEvidence(evaluateComparison(exp), candidate);
        if (!check.ok) return { ok: false, reason: check.problems.join('；') };
        set((s) => ({
          experiments: s.experiments.map((e) => {
            if (e.id !== id) return e;
            const analysis = e.analysis ?? {
              id: uid('ana'),
              method: '绘制 ay–自变量对照曲线并比较水平间差异',
              findings: [],
              createdAt: new Date().toISOString(),
            };
            return touch({ ...e, analysis: { ...analysis, findings: [...analysis.findings, candidate] } });
          }),
        }));
        return { ok: true };
      },

      updateFinding: (id, findingId, patch) => {
        const exp = get().experiments.find((e) => e.id === id);
        if (!exp || !exp.analysis) return { ok: false, reason: '分析记录不存在' };
        const candidate: AnalysisFinding = { id: findingId, ...patch };
        const check = checkFindingEvidence(evaluateComparison(exp), candidate);
        if (!check.ok) return { ok: false, reason: check.problems.join('；') };
        set((s) => ({
          experiments: s.experiments.map((e) =>
            e.id === id && e.analysis
              ? touch({
                  ...e,
                  analysis: {
                    ...e.analysis,
                    findings: e.analysis.findings.map((f) => (f.id === findingId ? candidate : f)),
                  },
                })
              : e,
          ),
        }));
        return { ok: true };
      },

      deleteFinding: (id, findingId) =>
        set((s) => ({
          experiments: s.experiments.map((e) =>
            e.id === id && e.analysis
              ? touch({ ...e, analysis: { ...e.analysis, findings: e.analysis.findings.filter((f) => f.id !== findingId) } })
              : e,
          ),
        })),

      addReport: (report) =>
        set((s) => {
          const experiments = s.experiments.map((e) =>
            e.id === report.experimentId
              ? touch({ ...e, stages: { ...e.stages, report: 'done' as const } })
              : e,
          );
          return { reports: [report, ...s.reports.filter((r) => r.id !== report.id)], experiments };
        }),

      deleteReport: (id) => set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),

      resetLab: () => set({ experiments: buildSeedExperiments(), reports: [] }),
    }),
    {
      name: 'apexlab-store-v1',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ experiments: s.experiments, reports: s.reports }),
      merge: (persisted, current) => {
        const p = persisted as PersistedShape | undefined;
        // 无有效持久化结构（首次启动 / 存储损坏回退）时保留种子数据，绝不清空
        if (!p || !Array.isArray(p.experiments)) return current;
        const clean = sanitizePersistedState(p);
        return { ...current, experiments: clean.experiments, reports: clean.reports };
      },
    },
  ),
);

// 同步存储下 rehydrate 已完成：若存在被标记无效的历史记录，立即落盘一次，
// 使 invalid 标记与原因可被后续读取 / 导出，而不必等待下一次业务写入。
if (useLabStore.getState().experiments.some((e) => e.trials.some((t) => t.status === 'invalid'))) {
  useLabStore.setState((s) => ({ experiments: [...s.experiments] }));
}