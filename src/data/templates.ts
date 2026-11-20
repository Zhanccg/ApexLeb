import type { ExperimentTemplate } from './schema';

/** 第一阶段预置实验模板；第二阶段将接入数值仿真器执行试跑 */
export const TEMPLATES: ExperimentTemplate[] = [
  {
    id: 'tpl-braking-mu',
    title: '摩擦系数对制动距离的影响',
    category: 'braking',
    question: '在相同初速度下，路面摩擦系数 μ 如何影响赛车从 100 km/h 完全刹停所需的距离？',
    suggestedHypothesis: {
      statement: '制动距离随摩擦系数 μ 增大而减小，且呈反比关系。',
      expectedDirection: 'decrease',
      rationale: '理想制动模型 d = v²/(2μg)：初速度固定时，d 与 μ 成反比。',
    },
    variables: [
      { id: 'mu', name: '路面摩擦系数', symbol: 'μ', unit: '—', role: 'independent', min: 0.3, max: 1.4, step: 0.05, defaultValue: 1.0, hint: '干沥青约 1.2–1.4，湿路面约 0.6–0.8，冰面低于 0.3。' },
      { id: 'brakeDistance', name: '制动距离', symbol: 'd', unit: 'm', role: 'dependent', min: 0, max: 300, step: 0.1, defaultValue: 0, hint: '从制动开始到完全停止驶过的距离。' },
      { id: 'v0', name: '制动初速度', symbol: 'v₀', unit: 'km/h', role: 'controlled', min: 60, max: 200, step: 5, defaultValue: 100, hint: '本实验中必须保持恒定，否则无法归因。' },
      { id: 'mass', name: '整车质量', symbol: 'm', unit: 'kg', role: 'controlled', min: 500, max: 800, step: 5, defaultValue: 570, hint: '理想模型中质量不影响制动距离——这本身就是值得检验的点。' },
    ],
    tags: ['入门推荐', '制动', '单变量'],
    brief: '最经典的单变量实验：验证 d = v²/2μg，理解「控制变量法」。',
  },
  {
    id: 'tpl-cornering-radius',
    title: '弯道半径与极限过弯速度',
    category: 'cornering',
    question: '在相同轮胎抓地条件下，弯道半径 r 如何影响赛车的理论极限过弯速度？',
    suggestedHypothesis: {
      statement: '极限过弯速度随弯道半径增大而增大，近似与 √r 成正比。',
      expectedDirection: 'nonlinear',
      rationale: '向心力由摩擦力提供：μmg = mv²/r，得 v = √(μgr)。',
    },
    variables: [
      { id: 'radius', name: '弯道半径', symbol: 'r', unit: 'm', role: 'independent', min: 15, max: 200, step: 5, defaultValue: 60, hint: '发夹弯约 15–30 m，高速弯可超过 150 m。' },
      { id: 'vLimit', name: '极限过弯速度', symbol: 'v', unit: 'km/h', role: 'dependent', min: 0, max: 250, step: 0.1, defaultValue: 0, hint: '超过此速度摩擦力不足以提供向心力，赛车将滑出弯道。' },
      { id: 'mu', name: '轮胎摩擦系数', symbol: 'μ', unit: '—', role: 'controlled', min: 0.5, max: 1.6, step: 0.05, defaultValue: 1.35, hint: '保持恒定以单独考察半径的作用。' },
    ],
    tags: ['弯道', '非线性', '平方根'],
    brief: '体验非线性关系：为什么半径翻 4 倍，极限速度只翻 2 倍？',
  },
  {
    id: 'tpl-aero-speed',
    title: '速度对气动下压力的影响',
    category: 'aero',
    question: '车速 v 如何影响赛车产生的气动下压力？下压力与速度是线性关系吗？',
    suggestedHypothesis: {
      statement: '下压力随速度增大而增大，且与 v² 成正比（非线性）。',
      expectedDirection: 'nonlinear',
      rationale: '下压力 F = ½ρ·ClA·v²，速度翻倍时下压力变为 4 倍。',
    },
    variables: [
      { id: 'speed', name: '车速', symbol: 'v', unit: 'km/h', role: 'independent', min: 40, max: 300, step: 10, defaultValue: 150, hint: '覆盖低速到高速，才能看清平方关系的弯曲形态。' },
      { id: 'downforce', name: '气动下压力', symbol: 'F', unit: 'N', role: 'dependent', min: 0, max: 12000, step: 1, defaultValue: 0, hint: '下压力把车「按」在路面上，高速弯抓地更强。' },
      { id: 'cl', name: '下压力系数', symbol: 'ClA', unit: 'm²', role: 'controlled', min: 0.5, max: 3, step: 0.1, defaultValue: 1.8, hint: '由翼片设定决定，本实验保持恒定。' },
    ],
    tags: ['空气动力学', '平方关系'],
    brief: '理解「速度平方律」：为什么快车在高速弯反而更稳。',
  },
];