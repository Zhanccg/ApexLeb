import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Conclusion, Experiment, Hypothesis, ReportDoc, StageId, TelemetrySample, Trial } from './schema';
import { TEMPLATES } from './templates';
import { buildSeedExperiments } from './seed';
import { STAGE_ORDER, canAdvanceTo, checkStageCompletion } from '@/pedagogy';
import { parsePersistedRaw, sanitizePersistedState, trialInvalidReason, type PersistedShape } from './integrity';

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface LabState {
  experiments: Experiment[];
  reports: ReportDoc[];
  createFromTemplate: (templateId: string) => string | null;
  deleteExperiment: (id: string) => void;
  updateQuestion: (id: string, question: string) => void;
  setHypothesis: (id: string, hyp: Omit<Hypothesis, 'id' | 'createdAt'>) => void;
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