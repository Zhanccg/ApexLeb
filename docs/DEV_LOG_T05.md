# ApexLab T05 开发记录（数据分析、对照图表与 CSV 导出）

日期：2026-11-19 ｜ 基线提交：`c851cd2`（T04）｜ 状态：开发完成，待人工复核（未自行勾选验收）

## 一、T04 额外核实（全新实验 exp-mwol4nxx-tvi09）

按任务序列手动运行五条试跑，逐步断言（浏览器 DOM 实测）：

| 步骤 | 参数 | 已保存 | 数据有效 | 合格对照 | 不同取值 | 采集推进 |
| --- | --- | --- | --- | --- | --- | --- |
| #1 | 54 / R50 / μ1 | 1 | 1 | 1 | 1 | 禁用 |
| #2 | 54 / R50 / μ1（重复） | 2 | 2 | 2 | 1 | 禁用 |
| #3 | 72 / R60 / μ1（混杂） | 3 | 3 | 2 | 1 | 禁用 |
| #4 | 72 / R50 / μ1 | 4 | 4 | 3 | 2 | 禁用 |
| #5 | 90 / R50 / μ1 | 5 | 5 | 4 | 3 | 放行 |

- 第 3 条触发精确文案：「本次试跑改变了弯道半径 R（50 → 60），不能直接用于当前控制变量实验的有效对照」。
- **eligible 语义确认**：重复试跑（#2）**包含在 `ComparisonReport.eligible` 中**（控制变量与基准一致），但 `distinctValues` 不因其增加；使用规则：eligible = 可进入对照计算/图表/合格 CSV 的记录集合，replicate 标记用于汇总样本数与重复展示；confounded / invalid 永不进入 eligible。T04 无需修复。

## 二、T05 实现与复用接口

- 唯一数据源：`evaluateComparison(exp)`（T04），工作台 / 图表 / CSV / 阶段校验全部消费其 `eligible / evaluations / distinctValues / counts / independent / controlled / feedback`，未新建第二套判定。
- 新增 `checkFindingEvidence(report, finding)`：证据必须存在且当前合格；失效时提示「请重新确认研究发现」。
- 分析工作台 `AnalysisWorkbench`：研究上下文、双视图对照曲线（水平汇总 n=样本数 / 逐条记录同心环+试跑号）、合格试跑结果表（含试跑 ID 与引用勾选）、研究发现编辑（观察/证据/假设判断）、分析方法与模型局限、双口径 CSV 导出。
- 阶段规则：`analyze`（过弯）要求 ≥1 条证据合格的研究发现；历史已完成阶段保留不降级；制动实验沿用旧校验。
- CSV：`report/csv.ts`，UTF-8 BOM，16 列含试跑 ID/时间/自变量及单位/三参数/四指标/状态/合格对照/重复试跑/无效原因；原始口径含全部记录并标记，合格口径仅 eligible。
- 存储：`setAnalysisMeta / addFinding / updateFinding / deleteFinding`，写入前证据校验；`Analysis.limitations` 新增可选字段（向后兼容）。

## 三、测试与构建

- `npm test`：**143/143 通过**（6 文件：engine 41 / integrity 65 / comparison 19 / rules 4 / analysis 8 / csv 6）。
- `npm run build`：tsc + vite 通过。
- 新增覆盖：CSV BOM/表头/双口径/数值与页面一致/半径自变量列/ID 与时间戳/转义；证据合格/混杂/不存在/空引用/方案切换失效与恢复/制动历史兼容/读取清洗保留 analysis。

## 四、浏览器实测（localhost:5173，DOM 断言）

1. 五条试跑后标记采集完成 → 分析工作台渲染：上下文、`n=2` 汇总标签、合格 4 条、CSV 双按钮。
2. 新建发现：观察描述 + 勾选 #01/#04/#05 → 保存后 `analysis.findings[0].evidenceTrialIds` = 三条真实试跑 ID；「证据齐全」提示出现；分析推进按钮启用 → 推进后结论阶段激活。
3. 点击「导出原始记录 CSV」「导出合格对照 CSV」→ 导出 Toast 正常、控制台无错误。
4. 切换自变量为半径 → 发现卡片与_analysis 状态_出现「已不符合当前对照资格…请重新确认研究发现」；历史 analyze=done 保留；切回车速 → 警告清除、证据齐全恢复。
5. 刷新页面 → findings/证据/阶段/工作台/`n=2` 全部恢复；无横向溢出。
6. 回归：预置制动报告再生成完好（7 阶段存档、99.5/29.04 数据、结论、无 NaN/Infinity/非有限泄漏）。

## 五、留证素材

- CSV 样例（真实模型计算值，`npx tsx scripts/export-sample.ts` 生成）：
  - `docs/samples/apexlab-sample-raw.csv`（5 行：含混杂 #03 标记否、重复 #02 标记是）
  - `docs/samples/apexlab-sample-eligible.csv`（4 行合格对照）
- 对照曲线图：`docs/figures/t05-comparison.svg`（水平汇总 n 标签 + 重复同心环 + 证据编号）。
- 截图说明：本轮应用内浏览器可视 surface 不可用（`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`），工作台截图未能采集；以上述 DOM 断言转录、CSV 样例与 SVG 图作为关键证据。既往界面实拍见 `docs/screenshots/dashboard.png`、`cornering-runner.png`。

合格对照 CSV 样例全文：

```csv
试跑ID,记录时间,自变量,自变量取值,自变量单位,车速(km/h),弯道半径(m),附着系数μ,侧向加速度(m/s²),附着利用率(%),临界速度(km/h),临界速度(m/s),试跑状态,合格对照,重复试跑,无效原因
trial-sample-1,2026-11-19T10:01:00.000Z,车速 v,54,km/h,54,50,1,4.50,45.9,79.73,22.15,已完成,是,否,
trial-sample-2,2026-11-19T10:02:00.000Z,车速 v,54,km/h,54,50,1,4.50,45.9,79.73,22.15,已完成,是,是,
trial-sample-4,2026-11-19T10:04:00.000Z,车速 v,72,km/h,72,50,1,8.00,81.5,79.73,22.15,已完成,是,否,
trial-sample-5,2026-11-19T10:05:00.000Z,车速 v,90,km/h,90,50,1,12.50,127.4,79.73,22.15,已完成,是,否,
```

（文件首字节为 UTF-8 BOM ``，此处展示省略。）

## 六、未解决问题与 T06 所需接口

- 工作台截图待浏览器 surface 恢复后补拍；窄视口下结果表横向滚动为既有设计。
- 重复试跑在逐条视图以同心环表示 multiplicity，数值完全相同（确定性模型），未加噪声。
- T06 接口：`exp.analysis.{method, limitations, findings[]}`（findings 含 `evidenceTrialIds / supportsHypothesis`）可直接注入报告「分析」与「局限」章节；`checkFindingEvidence` 供结论前复核；`report.eligible` 为报告数据表唯一来源；结论表单已存在（statement / hypothesisVerdict / limitations），T06 只需打通分析→结论→报告的证据链与三分钟演练。