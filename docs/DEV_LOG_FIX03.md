# ApexLab FIX-03 开发记录：试跑参数 / CSV / Markdown 精度统一

日期：2026-11-20 ｜ 基线：`f425f62`（FIX-02）｜ 状态：开发完成，待 Codex 复核

## 一、根因

1. 页面多处用 `fmtNum(readParam(...), 0)` 显示原始参数 → 54.5 被显示为 55、50.5 为 51（toFixed 取整）。
2. 坐标轴刻度 `v.toFixed(v>=10?0:2)` 对小数横轴取整 → 刻度与真实取值不符。
3. 运行器存储指标时 `r4()` 先舍入到 4 位小数 → 存储值与引擎全精度重算结果在 4 位以后不一致。
4. 各模块各自 toFixed，缺乏统一出口。

## 二、统一格式化规则（src/data/integrity.ts 唯一出口）

| 出口 | 适用字段 | 规则 |
| --- | --- | --- |
| `fmtParam` | speedKmh / radiusM / mu（原始输入） | `String(v)` 最短往返表示，保留输入精度，不取整不截断；非有限→「非有限」 |
| `fmtNum(v,2)` | lateralAccelMs2 / limitSpeedKmh / limitSpeedMs | 固定 2 位小数 |
| `fmtPercent(v,1)` | gripUtilization | ×100 固定 1 位（页面/CSV/MD 同） |
| `fmtTick` | 坐标轴刻度 | 最多 2 位并去多余零 |

存储与计算全程全精度：`addTrial` 存原始 params 与引擎全精度 metrics/samples（移除 r4）；输入框 `step="any"` 支持任意小数。
消费端统一：详情页试跑表（过弯+制动 μ 列）、MethodCoach 基准芯片、AnalysisWorkbench 结果表、TelemetryChart 刻度、csv.ts（λ 改 fmtPercent）、generator.ts（参数列与基准行改 fmtParam）。

## 三、小数回归试跑（真实浏览器运行，实验 exp-mwonp21l-lv96d）

| Trial ID | speedKmh | radiusM | mu | ay 存储值（全精度） |
| --- | --- | --- | --- | --- |
| trial-mwonpfn0-qytoj | 54.5 | 50.5 | 1 | 4.538335778022247 |
| trial-mwonpfvr-djbdu | 72.5 | 50.5 | 1 | 8.03118506295074 |
| trial-mwonpgne-lqfhe | 90.5 | 50.5 | 1 | 12.514133357780223 |

## 四、同一 Trial ID 跨输出核对（trial-mwonpfn0-qytoj）

| 输出 | 速度 | 半径 | μ | ay | λ | v_limit |
| --- | --- | --- | --- | --- | --- | --- |
| 页面工作台表 | 54.5 | （方案列 R=50.5 基准芯片） | 1 | 4.54 | 46.3% | 80.13 |
| 原始 CSV（真实下载载荷） | 54.5 | 50.5 | 1 | 4.54 | 46.3 | 80.13（m/s 22.26） |
| 合格 CSV（真实下载载荷） | 54.5 | 50.5 | 1 | 4.54 | 46.3 | 80.13（m/s 22.26） |
| Markdown（真实下载载荷） | 54.5 | 50.5 | 1 | 4.54 | 46.3 | 80.13 |
| 引擎重算（54.5/50.5/1） | — | — | — | 4.538335778→4.54 | 46.2623→46.3 | 80.1277→80.13 |

Markdown 数据行原文：`| trial-mwonpfn0-qytoj | 1 | 54.5 | 54.5 | 50.5 | 1 | 4.54 | 46.3 | 80.13 | 否 |`
基准行原文：`基准试跑 #01（trial-mwonpfn0-qytoj）：v = 54.5 km/h · R = 50.5 m · μ = 1。`
**结论：零不一致。** 刷新后 params 与全精度 metrics 不变（E 通过）。

## 五、真实下载验收方式说明

应用内浏览器不将 blob 下载落盘（Downloads/Desktop/Documents/Temp/.qoder-cn 均无产物）。
改为在页面内拦截 `URL.createObjectURL` 与 anchor.click，捕获**真实导出点击产生的 Blob 字节与下载文件名**：
- `ApexLab_exp-mwonp21l-lv96d_原始记录.csv`、`ApexLab_exp-mwonp21l-lv96d_合格对照.csv`、`研究报告：车速与侧向加速度.md`
- 载荷全文核对（CSV 双口径逐细胞、MD 数据行/基准行），非开发脚本样例。
- 存档副本 `docs/samples/fix03-page-export-raw.csv` / `-eligible.csv` 为捕获载荷原文（blob.text() 解码去除 BOM；实际下载 Blob 首字节为 EF BB BF）。
- BOM 由 Blob 携带（blob.text() 解码时按 UTF-8 规范去除 BOM，文件首字节此前已验证为 EF BB BF）。

## 六、测试与构建

- `npm test`：**193/193 通过**（新增 7 项：fmtParam/fmtNum/fmtPercent/fmtTick 4 项 + CSV 小数双口径 1 项 + MD 小数 1 项 + 对照资格小数 1 项）。
- `npm run build` 通过。
- 额外用例覆盖：A 整数（既有 186 项）、B 一位小数（54.5）、C 两位以上（0.855/72.25 格式化测试）、D 小于 1 正数（0.001）、E 刷新精度、F 历史读取（制动/旧实验回归）、G 资格不受格式化影响、H CSV 与 MD 同源同规范。
- 浏览器：小数三试跑→对照达标→发现→结论→报告→三种下载载荷核对→刷新复测；控制台无错误、无横向溢出。

## 七、未解决问题

- 应用内浏览器下载不落盘，磁盘级打开验证以捕获载荷字节替代（已披露）；如需磁盘文件可由用户在本机浏览器复点导出。
- 历史 4 位舍入存储的旧指标保持原值（兼容不重写），其 2 位显示与新记录一致；全精度重算差异仅存在于旧记录 4 位以后，属历史数据形态，披露于本记录。