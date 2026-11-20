# ApexLab 极速科研实验室

Apex Explorers · 2026 Qoder 高校创造力大赛 · StudyHack

面向第一次做科研实验的学生。两位来自不同高校、喜欢赛车且准备考研的队员，用赛车过弯问题教会用户提出可检验假设、做对照实验、用数据写结论。

## 参赛版交付

从首页进入过弯工作台，在约 3 分钟内完成：选题 → 写假设和依据 → 指定变量角色 → 纠正混杂变量 → 运行并保存至少三次试跑 → 对照图表 → 写有试跑证据和适用范围的结论 → 查看可导出的报告。P0 优先打通选题到结论，报告复用现有 Markdown，P1 增加打印/PDF、导师提示和视觉打磨。CSV 属于 P0 数据交付。首发只要求一个完整过弯实验。

演示题目为「固定 R 和 μ，提高速度如何影响抓地需求比 λ？」先用 54 km/h、R=50 m、μ=1 做基线，然后同时修改 v 与 R 演示归因纠错，再恢复 R，完成 54、72、90 km/h 三组有效对照。让用户在图表上看到 λ 从约 0.459、0.815 增至 1.274，最后用同一组记录写结论。本路线和数值是验收样例，正式报告引用用户实际运行所得记录。

## 现有工程

- 本地目录 `D:\match\Zhanccg\apexlab`，包版本 0.1.0。首次审计未见 Git 元数据、README 或等价项目文档。
- React 18、TypeScript 5.6、Vite 6、Tailwind CSS 4、React Router 6、Zustand 5。图表是现有 SVG，记录和报告通过 Zustand persist 保存到当前浏览器 localStorage。
- `src/pages` 是页面入口，`src/engine` 放物理纯函数，`src/pedagogy` 放教学阶段与规则，`src/data` 放数据结构与状态，`src/report` 放报告生成，`src/components` 包含图表与流程组件。
- 基础命令为 `npm ci`、`npm run dev`、`npm run build`、`npm run preview`。审计使用 Node 22.20.0、npm 10.9.3 和已安装依赖；洁净安装列入交接验收。当前没有项目测试脚本。

推进以 [ROADMAP.md](ROADMAP.md) 为准，验收看 [QA_CHECKLIST.md](QA_CHECKLIST.md)，产品与工程取舍见 [DECISIONS.md](DECISIONS.md)。
