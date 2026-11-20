import type { StageId } from '@/data/schema';

export interface StageDef {
  id: StageId;
  order: number;
  name: string;
  shortName: string;
  /** 赛车语境下的类比 */
  racingAnalogy: string;
  goal: string;
  /** 给初学者的操作要点 */
  guidance: string[];
  /** 常见误区 */
  pitfall: string;
  /** 完成本阶段需要满足的条件说明 */
  exitCriteria: string;
}

export const STAGES: StageDef[] = [
  {
    id: 'question',
    order: 1,
    name: '提出问题',
    shortName: '问题',
    racingAnalogy: '赛前简报：圈速慢在哪个弯？',
    goal: '把模糊的好奇心变成一个可测量、可比较的具体问题。',
    guidance: [
      '问题中必须包含明确的自变量与因变量，例如「摩擦系数如何影响制动距离」',
      '避免「赛车怎样才能更快」这类无法直接检验的大问题',
      '用一句话写下问题，并确认它能用实验数据回答',
    ],
    pitfall: '把工程目标（让车更快）误当成科学问题（某因素如何影响某结果）。',
    exitCriteria: '实验记录中已填写包含自变量与因变量的研究问题。',
  },
  {
    id: 'hypothesis',
    order: 2,
    name: '建立假设',
    shortName: '假设',
    racingAnalogy: '车队策略预判：换软胎能快 0.3 秒。',
    goal: '基于已有物理知识，对问题给出一个可被证伪的预测。',
    guidance: [
      '假设要写明预期方向：增大、减小、非线性或不变',
      '写出依据，例如「制动距离 d = v²/2μg，故 μ 减小则 d 增大」',
      '好的假设允许被实验推翻——被推翻同样是有价值的结果',
    ],
    pitfall: '先跑实验再「补」假设，这叫事后解释，不是假设检验。',
    exitCriteria: '已记录假设陈述、预期方向与物理依据。',
  },
  {
    id: 'design',
    order: 3,
    name: '实验设计',
    shortName: '设计',
    racingAnalogy: '试车计划：只改一个设定，其他全部锁死。',
    goal: '规划变量控制方案：每次只改变一个自变量。',
    guidance: [
      '明确自变量、因变量与需要保持不变的控制变量',
      '为自变量选取覆盖范围的取值点（至少 5 组，含边界）',
      '每个取值点计划重复试跑，以识别随机误差',
    ],
    pitfall: '一次改动多个设定，导致无法归因——赛车调校与科研同样忌讳。',
    exitCriteria: '变量表完整（含控制变量），且自变量取值范围合理。',
  },
  {
    id: 'collect',
    order: 4,
    name: '数据采集',
    shortName: '采集',
    racingAnalogy: '遥测记录：每一圈的数据都要留档。',
    goal: '按计划执行试跑，完整记录遥测与异常情况。',
    guidance: [
      '严格按设计取值执行，不中途「顺手」改参数',
      '异常试跑标记为无效并写明原因，而不是悄悄删除',
      '记录环境条件（路面、温度设定）作为元数据',
    ],
    pitfall: '只保留「好看」的数据点——选择性记录会系统性歪曲结论。',
    exitCriteria: '完成的试跑覆盖全部设计取值点。',
  },
  {
    id: 'analyze',
    order: 5,
    name: '分析数据',
    shortName: '分析',
    racingAnalogy: '赛后数据复盘：叠图对比每一段刹车区。',
    goal: '用图表与统计量寻找规律，区分趋势与噪声。',
    guidance: [
      '先画图再下结论：散点图 / 折线图优先',
      '关注量级与函数形态（线性？平方？反比？）',
      '将观察与具体试跑编号关联，形成证据链',
    ],
    pitfall: '凭两个数据点断言趋势，或把随机波动当成规律。',
    exitCriteria: '至少一条有试跑证据支撑的分析发现。',
  },
  {
    id: 'conclude',
    order: 6,
    name: '得出结论',
    shortName: '结论',
    racingAnalogy: '工程师签字：这条升级方向确认有效。',
    goal: '回答最初的问题，并明确假设是否被支持。',
    guidance: [
      '结论必须回扣阶段一的问题与阶段二的假设',
      '明确写出适用范围与局限（模型简化、取值范围）',
      '假设被拒绝时，如实记录并讨论可能原因',
    ],
    pitfall: '结论超出数据支持的范围（只测了 60–140 km/h 却断言所有速度）。',
    exitCriteria: '已记录结论、假设判定与局限说明。',
  },
  {
    id: 'report',
    order: 7,
    name: '撰写报告',
    shortName: '报告',
    racingAnalogy: '提交技术报告：让没看过试车的人也能复现。',
    goal: '按标准结构整理全过程，让他人可以复现实验。',
    guidance: [
      '结构：问题 → 假设 → 方法 → 数据 → 分析 → 结论 → 局限',
      '附上关键数据表与参数设置，保证可复现性',
      'ApexLab 可一键生成报告草稿，再人工修订',
    ],
    pitfall: '只写结论不写方法——不可复现的结果在科学上没有说服力。',
    exitCriteria: '已生成并保存实验报告。',
  },
];

export const STAGE_MAP: Record<StageId, StageDef> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<StageId, StageDef>;

export const STAGE_ORDER: StageId[] = STAGES.map((s) => s.id);