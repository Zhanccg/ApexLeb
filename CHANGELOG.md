# 更新记录

本项目自 2026-11-20 起没有 Git 历史可用（首次提交即 squash），因此从该日起逐轮记录行为变更。更早的审计轮次见 [PROGRESS.md](PROGRESS.md) 与 [DECISIONS.md](DECISIONS.md)。

## v4 · 2026-11-21 · 使用指南 + 配色重构 + 侧栏收起 + 移动端聚光修复

相对 `b710b23`（UX-02-FIX）的 21 个文件、+1262/−321 行。本轮不加新课题，把已有的科研闭环讲清楚、带着走完，并统一视觉语言。

### 新增：使用指南（引导动线）

- `src/onboarding/tour.ts`：七步动线数据 —— 概览 → 上手（那颗主按钮）→ 七阶段流程条 → 采集与曲线 → 纠错与证据 → 四个区域 → 选路线。步骤只声明 `target` / `route` / `visit` / `actions`，文案与几何分离，`tour.test.ts` 锁住不变量（id 唯一、要点 ≤ 4 条、中间步骤不得自带跳转动作、`route` 必须伴随 `target`）。
- `src/onboarding/spotlight.ts`：聚光几何纯函数（`isInView` / `isSpotlightable` / `placeSpotlight` / `placeCentered` / `narrowScrollDelta`），常量集中为 `PAD=10`、`GAP=14`、`EDGE=16`、`NARROW_VW=640`，全部可单测。
- `src/components/OnboardingTour.tsx`：光环 + 卡片 + 进度点 + 键盘导航（←/→/Esc）。引导期间把 `[data-tour-region]` 整片设为 `inert`，Tab / Enter / 点击都摸不到下层页面。
- 动线**自己跨页并滚动**到目标（用户不再需要点「带我看这一处」）；打开时记下 `{ path, y }`，跳过 / 稍后再说 / Esc / 知道了解散时回到原页原位（换页后双 rAF 再 `scrollTo`）；`开始第一次科研挑战`、`先去实验库挑模板` 这类用户主动选择的动作不回原位。
- 重测触发点除 `scroll`(capture) / `resize` 外还含 `animationend` / `transitionend`：`fade-up` 入场动画在测量之后仍会挪元素，漏掉会让聚光环差 ~4px。

### 变更：配色按角色重构

- `src/styles/index.css` 的 `@theme` 落成中性 carbon 阶（950/900/850/800/700/600）+ `line` / `line-bright`、核心蓝 `race` 7 档标量、次要橙 `tele`、`signal-amber`，并把**错误/破坏性从品牌色里单独拆成 `danger-400/500`**；七阶段用 `stage-1..7` 有序渐变。
- 新增 `src/styles/palette.ts` 导出 `T` 常量，组件不再写死 hex：`TelemetryChart.tsx` 的 `#00d2be` / `#ffb800` / `#1c2634` / `#647182` / `#090d13` 换成 token 或 `stroke-line` / `fill-mist-600` 类。
- SVG 渐变 id 从 `g-${color}` 改为 `grad${useId()}`：同页多条同色曲线时旧写法会串渐变。
- 拆色后重查对比度：卡片正文、次要说明、进度点在 `carbon-850` 底上仍达 WCAG AA。

### 变更：实验台简化

- 实验台只留居中的动线入口 + 两条进行中实验（带七段进度条），其余收进「显示更多」弹出的监控面板，逐实验一张阶段卡；核心功能说明迁到实验库与使用指南。
- 装饰层改为真背景：`fixed inset-0 pointer-events-none`，并跟随侧栏宽度 `lg:left-[var(--shell-nav)]`。

### 新增：侧边栏可收起

- 单一真源 CSS 变量 `--shell-nav`（展开 240px / 收起 60px）写在 AppShell 根节点，侧栏宽、内容 `lg:pl-[var(--shell-nav)]`、背景 `lg:left-[var(--shell-nav)]` 全部消费它；三处各自声明 300ms ease-out 的过渡（侧栏过渡宽、内容过渡左内边距、背景层过渡 left），不用逗号或多属性合写形式。
- 顶部箭头按钮切换，状态存 `localStorage['apexlab-sidebar-collapsed']`；收起后为图标轨道，`title` 给出名称。
- 实测：1440×900 下 hero 重居中偏差 0.5px，1440 / 1024 / 420 均无横向溢出，刷新后状态保留，聚光环对收起后 60px 导航仍零偏差。

### 修复：移动端使用指南聚光对不上

根因是旧规则「窄屏不聚光」—— 居中卡片自带压暗层直接盖住目标，光环根本不存在，看起来就是「对不上」。

- 任意宽度都聚光，只有没布局出来的目标（窄屏没有侧栏导航时的 0×0）才退化成居中卡片。
- 窄屏卡片贴在目标下方，先按 `narrowScrollDelta(rect, vh, cardH, topInset)` 把目标让进「吸顶头部下沿 + PAD ~ 视口 − 卡片 − EDGE − GAP − PAD」的空隙；卡片实测高（`size.h`）一变就按新空隙重新对齐一次。
- `topInset`：目标自己就在 `[data-app-header]` 里（窄屏导航条）按 `EDGE` 算，否则取头部下沿，避免被吸顶头部遮住还判为可见。
- 同一 `data-tour="nav"` 桌面侧栏与窄屏导航条各一份，`findTarget` 取第一份真正布局出来（≥4×4）的。
- 目标比视口还高（360×640 的七阶段流程条 544px）时用 `allowBottomOverflow`，宁可底部出视口也要露出顶部，而不是整个丢掉聚光。
- 旋屏 / 改窗口大小：`vp` state 由 resize 监听驱动卡片落位，卡片加 `maxHeight: calc(100vh - 32px)` + `overflow-y-auto`，否则横屏时按旧视口算会顶出屏幕。
- 实测光环四边偏差：360×640、390×844、1440×900 全部 0；768×1024 是新启用聚光的档位；横向溢出 0。

### 质量与发布

- `npm test`：10 个文件 **234/234**（原 8 文件 207/207，新增 `src/onboarding/{spotlight,tour}.test.ts` 共 27 例）。
- `npm run build`：通过，`dist/assets/index-B2I_HkTW.js` 376.85 kB（gzip 118.94 kB）+ `index-B5T1P9bP.css` 80.31 kB。
- 已发布 Qoder Sites `https://apexlab-jbp6yiff8m8.qoder.zone`，线上 JS 与本地构建 sha256 逐字节一致（`0f81674f…`）。

## v3 · 2026-11-20 · UX-02 及审计修复

见提交 `f5efc18`、`b710b23`：试跑资格反馈可见化与下一步引导；摘要计数、刷新后一键纠错、阶段文案、浮层遮挡四项缺陷。

## v2 · 2026-11-20 · FIX-01/02/03

`16d4879` 对照判定的关键参数完整性与合法基准选择；`f425f62` 结论表单可编辑恢复与局限性必填提示；`d7cd781` 统一试跑参数 / CSV / Markdown 的数值精度出口。

## v1 · 2026-11-19 及更早 · T01–T07

`c851cd2` T04 假设编辑与统一变量契约；`d1fe534` T05 分析工作台与双口径 CSV；`4f1eb0c` T06 结论证据链与报告闭环。逐轮验收记录见 [PROGRESS.md](PROGRESS.md)，任务权重见 [ROADMAP.md](ROADMAP.md)。
