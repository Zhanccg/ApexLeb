/**
 * 种子数据：首屏即有可信的实验记录。
 * 制动实验的试跑数据由引擎解析模型离线生成（含微小噪声），
 * 第二阶段替换为数值仿真器输出，Schema 不变。
 */
import { brakingDistance, kmhToMs, G } from '@/engine';
import type { Experiment, StageId, StageStatus, TelemetrySample, Trial } from './schema';
import { TEMPLATES } from './templates';

const now = new Date();
const iso = (daysAgo: number, hour = 10) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 24, 0, 0);
  return d.toISOString();
};

function stagesUpTo(doneThrough: StageId | null): Record<StageId, StageStatus> {
  const order: StageId[] = ['question', 'hypothesis', 'design', 'collect', 'analyze', 'conclude', 'report'];
  const result = {} as Record<StageId, StageStatus>;
  let passed = doneThrough === null;
  let activeSet = false;
  for (const id of order) {
    if (!passed) {
      result[id] = 'done';
      if (id === doneThrough) passed = true;
    } else if (!activeSet) {
      result[id] = 'active';
      activeSet = true;
    } else {
      result[id] = 'locked';
    }
  }
  return result;
}

/** 匀减速制动过程的遥测序列：速度 / 已驶距离 / 减速度(g) */
function brakingSamples(v0Ms: number, mu: number): TelemetrySample[] {
  const a = mu * G;
  const tStop = v0Ms / a;
  const n = 36;
  const samples: TelemetrySample[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (tStop * i) / n;
    const v = Math.max(0, v0Ms - a * t);
    const dist = v0Ms * t - 0.5 * a * t * t;
    samples.push({
      t: Number(t.toFixed(3)),
      channels: {
        speed: Number((v * 3.6).toFixed(2)),
        distance: Number(Math.min(dist, brakingDistance(v0Ms, mu)).toFixed(2)),
        decelG: v > 0 ? Number(mu.toFixed(3)) : 0,
      },
    });
  }
  return samples;
}

function seedBrakingTrials(): Trial[] {
  const v0 = kmhToMs(100);
  const muPoints = [0.4, 0.6, 0.8, 1.0, 1.2, 1.35];
  // 确定性的微小扰动，模拟真实测量噪声
  const noise = [1.012, 0.994, 1.007, 0.99, 1.009, 0.997];
  return muPoints.map((mu, i) => ({
    id: `trial-brk-${i + 1}`,
    index: i + 1,
    params: { mu, v0: 100, mass: 570 },
    samples: brakingSamples(v0, mu),
    metrics: {
      brakeDistance: Number((brakingDistance(v0, mu) * noise[i]).toFixed(2)),
      stopTime: Number((v0 / (mu * G)).toFixed(2)),
      peakDecelG: mu,
    },
    status: 'completed',
    note: i === 3 ? '复跑一次确认，两次结果差 < 1 m。' : '',
    createdAt: iso(4, 14 + i),
  }));
}

export function buildSeedExperiments(): Experiment[] {
  const braking = TEMPLATES[0];
  const cornering = TEMPLATES[1];

  const expBraking: Experiment = {
    id: 'exp-braking-mu',
    title: braking.title,
    category: braking.category,
    question: braking.question,
    hypothesis: {
      id: 'hyp-brk',
      ...braking.suggestedHypothesis,
      createdAt: iso(5),
    },
    variables: braking.variables,
    trials: seedBrakingTrials(),
    analysis: {
      id: 'ana-brk',
      method: '绘制 d–μ 散点图并拟合反比曲线 d = k/μ',
      findings: [
        {
          id: 'f-brk-1',
          observation: 'μ 从 0.4 提升到 1.35，制动距离由约 99 m 缩短至约 30 m，趋势与 d ∝ 1/μ 一致。',
          evidenceTrialIds: ['trial-brk-1', 'trial-brk-4', 'trial-brk-6'],
          supportsHypothesis: true,
        },
        {
          id: 'f-brk-2',
          observation: '各点相对反比曲线的偏差均小于 1.5%，可视为测量噪声而非系统偏离。',
          evidenceTrialIds: ['trial-brk-2', 'trial-brk-3', 'trial-brk-5'],
          supportsHypothesis: true,
        },
      ],
      createdAt: iso(3),
    },
    conclusion: null,
    stages: stagesUpTo('analyze'),
    tags: braking.tags,
    createdAt: iso(6),
    updatedAt: iso(3, 16),
  };

  const expCornering: Experiment = {
    id: 'exp-cornering-radius',
    title: cornering.title,
    category: cornering.category,
    question: cornering.question,
    hypothesis: {
      id: 'hyp-cor',
      ...cornering.suggestedHypothesis,
      createdAt: iso(1),
    },
    variables: cornering.variables,
    trials: [],
    analysis: null,
    conclusion: null,
    stages: stagesUpTo('hypothesis'),
    tags: cornering.tags,
    createdAt: iso(2),
    updatedAt: iso(1, 11),
  };

  return [expBraking, expCornering];
}