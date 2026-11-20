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
    runnable: false,
    statusNote: '预置示例同款模板：车库中的制动示例含教学扰动数据供观摩与报告演练；制动运行器尚未接入，新建后无法运行试跑。',
  },
  {
    id: 'tpl-cornering-ay',
    title: '车速与侧向加速度',
    category: 'cornering',
    question: '在相同弯道半径与路面附着条件下，车速 v 如何影响赛车过弯时的侧向加速度 ay？',
    suggestedHypothesis: {
      statement: '侧向加速度 ay 随车速 v 增大而增大，且与 v² 成正比（非线性）。',
      expectedDirection: 'nonlinear',
      rationale: 'ay = v²/R：R 与 μ 固定时，车速翻倍则侧向加速度变为 4 倍。',
    },
    variables: [
      { id: 'speedKmh', name: '车速', symbol: 'v', unit: 'km/h', role: 'independent', min: 0, max: 10000, step: 1, defaultValue: 54, hint: '默认自变量：逐次改变车速，观察侧向加速度 ay = v²/R 的变化。' },
      { id: 'lateralAccelMs2', name: '侧向加速度', symbol: 'ay', unit: 'm/s²', role: 'dependent', min: 0, max: 100000, step: 0.01, defaultValue: 0, hint: '由 ay = v²/R 计算得出；本版本固定为因变量。' },
      { id: 'radiusM', name: '弯道半径', symbol: 'R', unit: 'm', role: 'controlled', min: 0.001, max: 1000000, step: 1, defaultValue: 50, hint: '控制变量：与基准试跑保持一致；可在方法编辑器中切换为自变量。' },
      { id: 'mu', name: '路面附着系数', symbol: 'μ', unit: '—', role: 'controlled', min: 0.001, max: 100, step: 0.05, defaultValue: 1, hint: '控制变量：保持恒定以单独考察自变量的作用。' },
    ],
    tags: ['弯道', '非线性', '平方关系'],
    brief: '完整科研流程：运行过弯试跑、识别混杂与重复、用证据链形成结论与报告。',
    runnable: true,
    statusNote: '已接入完整运行流程：试跑运行器、对照判定、分析工作台、结论与报告均可用。',
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
    runnable: false,
    statusNote: '展示模板：空气动力学运行器尚未接入（赛后扩展方向），新建后采集阶段无法运行试跑。',
  },
];