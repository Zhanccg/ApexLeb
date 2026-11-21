export type TourTone = 'race' | 'tele' | 'amber';

export interface TourAction {
  kind: 'challenge' | 'goto';
  label: string;
  to?: string;
}

export interface TourStep {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  /** 对应页面上的 data-tour 属性；缺失或窄屏时退化为居中卡片 */
  target?: string;
  /** 目标所在页面：不在这一页时引导自己过去，退出时再把用户送回打开引导时的页面与位置 */
  route?: string;
  /** 想让用户实际过去看的页面：由用户点按钮跳转，引导自己不换页 */
  visit?: { to: string; label: string };
  tone: TourTone;
  actions?: TourAction[];
}

/** 引导动线：是什么 → 上手 → 流程条 → 采集 → 证据 → 四个区域 → 选路线 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'overview',
    eyebrow: '概览 · WHAT THIS IS',
    title: 'ApexLab 把科研流程做成能校验的实验台',
    body: '赛车遥测风格的科研流程训练台：把科学方法拆成七个可校验的阶段，不跳步、不臆断。实验与报告只存在你本机浏览器，无需注册。',
    points: [
      '学到：控制变量、识别混杂、用试跑 ID 证据链支撑结论',
      '每个阶段有 locked / active / done 三态，条件不满足就推不动',
      '实验台只报数据，动手去实验库，方法细节在科研方法论',
    ],
    tone: 'race',
  },
  {
    id: 'challenge',
    eyebrow: '01 · 上手',
    title: '这颗主按钮就是唯一的动手入口',
    body: '点它创建「固定 R 与 μ，车速如何影响抓地需求比 λ」的实验，并把假设阶段打开等你填。实验台只留这块居中的入口与两条进行中实验，其余点「显示更多」在监控面板里看。',
    points: [
      '约 3 分钟走完一次完整闭环',
      '进行中实验列表带七段进度条，点进去接着上次做',
      '想观摩预置示例或换课题，去实验库的模板区',
    ],
    target: '[data-tour="challenge"]',
    route: '/',
    tone: 'amber',
  },
  {
    id: 'flow',
    eyebrow: '02 · 实验流程',
    title: '实验库顶部的七阶段流程条既是导航也是筛选',
    body: '问题 → 假设 → 设计 → 采集 → 分析 → 结论 → 报告。点任意阶段会把列表收到停在该阶段的实验，再点一次取消。',
    points: [
      '「设计」要求恰好一个自变量，μ 必须锁为控制变量',
      '「分析」的发现要关联到试跑编号才成立',
      '「结论」得写明适用范围与局限',
    ],
    target: '[data-tour="flow"]',
    route: '/experiments',
    tone: 'tele',
  },
  {
    id: 'collect',
    eyebrow: '03 · 采集与曲线',
    title: '三组对照跑完，遥测只收有效试跑',
    body: '54 / 72 / 90 km/h 各运行一次，λ 约 0.459 → 0.815 → 1.274，逐条存成带 ID 的记录。',
    points: [
      'ay = v²/R，λ = ay/μg，超出模型包络的点在图上自动变色警示',
      'd–μ 曲线是反比形态：μ 越大，制动距离越短',
      '无效试跑保留原值供排查，但不进图表也不进报告',
    ],
    tone: 'race',
  },
  {
    id: 'proof',
    eyebrow: '04 · 纠错与证据',
    title: '改错了要能发现，结论要指得到具体记录',
    body: '同一批记录里若 R 也变了，这些试跑会被判为混杂；纠正后重跑，而不是删数据。',
    points: [
      '方法编辑器管变量角色，实验方法纠错管混杂检测',
      '每条发现点「引用」挂上试跑 ID 才算成立',
      '证据复核通过后按七段结构生成 Markdown，可直接下载 .md',
    ],
    tone: 'tele',
  },
  {
    id: 'areas',
    eyebrow: '05 · 四个区域',
    title: '实验台 / 实验库 / 科研方法论 / 报告中心',
    body: '侧边栏这四个入口就是全部动线，不用记路径：做实验、看数据、补方法、出报告各占一格。顶部的箭头能把侧栏收成一条图标轨道，悬停有名称提示，再点一下展开。',
    points: [
      '实验台 Pit Wall：居中的动线入口 + 两条进行中实验 + 监控面板',
      '实验库 Garage：流程条筛选、模板创建、两步确认删除',
      '科研方法论 Academy：七阶段的目标、要点、误区与退出条件',
      '报告中心 Debrief：证据复核通过后生成 Markdown 并可下载',
    ],
    target: '[data-tour="nav"]',
    visit: { to: '/learn', label: '去看七阶段拆解' },
    tone: 'race',
  },
  {
    id: 'start',
    eyebrow: '准备发车 · PICK A LANE',
    title: '现在选一条路线',
    body: '引导随时能从侧边栏底部「使用指南」重新打开；数据只写在你自己的浏览器里，可随时重置演示数据。',
    points: [],
    tone: 'amber',
    actions: [
      { kind: 'challenge', label: '开始第一次科研挑战' },
      { kind: 'goto', to: '/experiments', label: '先去实验库挑模板' },
    ],
  },
];

export const TOUR_SEEN_KEY = 'apexlab-tour-seen-v1';

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === 'seen';
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, 'seen');
  } catch {
    /* 存储不可用时，下次进入再弹一次 */
  }
}
