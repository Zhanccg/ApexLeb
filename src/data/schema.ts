/**
 * ApexLab 统一实验数据结构。
 * 所有模块（物理引擎 / 教学规则 / 页面 / 报告生成）共享此 Schema，
 * 保证第二阶段扩展仿真与图表时无需迁移数据。
 */

/** 科研流程七阶段（与 pedagogy 模块的 StageId 保持一致） */
export type StageId =
  | 'question'
  | 'hypothesis'
  | 'design'
  | 'collect'
  | 'analyze'
  | 'conclude'
  | 'report';

export type StageStatus = 'locked' | 'active' | 'done';

/** 实验领域分类 */
export type ExperimentCategory = 'braking' | 'cornering' | 'acceleration' | 'aero';

/** 变量角色：自变量 / 因变量 / 控制变量 */
export type VariableRole = 'independent' | 'dependent' | 'controlled';

export interface VariableDef {
  id: string;
  /** 中文名称，如「路面摩擦系数」 */
  name: string;
  /** 物理符号，如 μ */
  symbol: string;
  unit: string;
  role: VariableRole;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  /** 教学提示：该变量在实验中的意义 */
  hint: string;
}

export type ExpectedDirection = 'increase' | 'decrease' | 'nonlinear' | 'unchanged';

export interface Hypothesis {
  id: string;
  /** 可检验的假设陈述 */
  statement: string;
  /** 预期的因变量变化方向 */
  expectedDirection: ExpectedDirection;
  /** 提出假设的物理依据 */
  rationale: string;
  createdAt: string;
}

/** 单帧遥测采样：t 为仿真时间(s)，channels 为通道名→数值 */
export interface TelemetrySample {
  t: number;
  channels: Record<string, number>;
}

export type TrialStatus = 'planned' | 'running' | 'completed' | 'invalid';

/** 一次试跑：一组自变量取值 + 采集到的遥测序列 + 汇总指标 */
export interface Trial {
  id: string;
  index: number;
  /** 变量 id → 本次取值；过弯试跑使用单位显式键：speedKmh / radiusM / mu */
  params: Record<string, number>;
  samples: TelemetrySample[];
  /** 指标名 → 数值；过弯试跑键：lateralAccelMs2 / gripUtilization / limitSpeedKmh / limitSpeedMs */
  metrics: Record<string, number>;
  status: TrialStatus;
  note: string;
  createdAt: string;
  /** 产出该记录的物理模型版本（旧记录可缺省） */
  modelVersion?: string;
  /** 历史容错：系统标记无效的原因（原始数值保留供排查） */
  invalidReason?: string;
}

export interface AnalysisFinding {
  id: string;
  /** 观察到的规律描述 */
  observation: string;
  /** 支撑该观察的试跑 id 列表 */
  evidenceTrialIds: string[];
  /** 是否支持原假设 */
  supportsHypothesis: boolean;
}

export interface Analysis {
  id: string;
  method: string;
  findings: AnalysisFinding[];
  createdAt: string;
}

export interface Conclusion {
  statement: string;
  /** 假设检验结果 */
  hypothesisVerdict: 'supported' | 'rejected' | 'inconclusive';
  limitations: string;
  createdAt: string;
}

export interface Experiment {
  id: string;
  title: string;
  category: ExperimentCategory;
  /** 研究问题（阶段一产出） */
  question: string;
  hypothesis: Hypothesis | null;
  variables: VariableDef[];
  trials: Trial[];
  analysis: Analysis | null;
  conclusion: Conclusion | null;
  /** 七阶段进度 */
  stages: Record<StageId, StageStatus>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** 变量契约版本：2 = 规范键（speedKmh/radiusM/mu/lateralAccelMs2） */
  variablesVersion?: number;
  /** 旧字段迁移说明（读取兼容时写入，供页面提示） */
  legacyMigrationNote?: string;
  /** 方法编辑后的对照资格重算说明 */
  methodNote?: string;
}

export interface ReportDoc {
  id: string;
  experimentId: string;
  title: string;
  markdown: string;
  createdAt: string;
}

/** 实验模板：创建新实验的起点（第一阶段预置，第二阶段接入仿真） */
export interface ExperimentTemplate {
  id: string;
  title: string;
  category: ExperimentCategory;
  question: string;
  suggestedHypothesis: Omit<Hypothesis, 'id' | 'createdAt'>;
  variables: VariableDef[];
  tags: string[];
  brief: string;
}

export const CATEGORY_LABEL: Record<ExperimentCategory, string> = {
  braking: '制动动力学',
  cornering: '弯道与抓地',
  acceleration: '加速性能',
  aero: '空气动力学',
};

export const ROLE_LABEL: Record<VariableRole, string> = {
  independent: '自变量',
  dependent: '因变量',
  controlled: '控制变量',
};

export const DIRECTION_LABEL: Record<ExpectedDirection, string> = {
  increase: '随自变量增大而增大',
  decrease: '随自变量增大而减小',
  nonlinear: '非线性关系',
  unchanged: '基本不变',
};