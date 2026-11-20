/**
 * 报告生成模块：把统一实验数据结构渲染为 Markdown 科研报告（T06 证据链闭环）。
 * 纯函数，无副作用。正式对照数据唯一来源：evaluateComparison(exp).eligible（过弯），
 * 与工作台 / CSV 同口径；制动等历史实验沿用有效记录口径并保持兼容。
 */
import type { Experiment, ReportDoc } from '@/data/schema';
import { CATEGORY_LABEL, DIRECTION_LABEL, ROLE_LABEL } from '@/data/schema';
import { fmtNum, fmtParam, isUsableTrial, readMetric, readParam } from '@/data/integrity';
import { CORNERING_MODEL_VERSION } from '@/engine/cornering';
import { STAGES, checkFindingEvidence, evaluateComparison, type ComparisonReport } from '@/pedagogy';

const fmtDate = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

const VERDICT_LABEL = {
  supported: '✅ 假设被数据支持（用户确认）',
  rejected: '❌ 假设被数据拒绝（用户确认）',
  inconclusive: '⚠️ 证据不足，无法判定（用户确认）',
} as const;

const MODEL_LIMITATION_BASE =
  '本实验采用简化车辆质点模型：不包含完整轮胎特性、空气动力（下压力与阻力）、纵/横向载荷转移与真实车辆控制过程；结论仅适用于所测参数取值范围。';

const DATA_SOURCE_BASE = '本实验数据由简化物理模型计算生成，不属于真实赛车实测数据。';

/** 生成前的证据复核：引用失效 / 缺少发现时禁止产出误导性新报告（T06） */
export function reportEvidenceBlockers(exp: Experiment): string[] {
  const problems: string[] = [];
  // FIX-02：结论必填缺口（含历史空局限性）不得包装为通过复核的新报告
  if (!exp.conclusion || (exp.conclusion.statement?.trim().length ?? 0) < 8 || !exp.conclusion.limitations?.trim()) {
    problems.push('结论必填缺口：请在结论阶段补充结论陈述与模型局限性后重新保存');
  }
  if (exp.category !== 'cornering') return problems;
  const report = evaluateComparison(exp);
  if (!exp.analysis || exp.analysis.findings.length === 0) {
    problems.push('缺少研究发现：请先在分析工作台保存带证据的研究发现');
    return problems;
  }
  exp.analysis.findings.forEach((f, i) => {
    for (const p of checkFindingEvidence(report, f).problems) problems.push(`发现 #${i + 1}：${p}`);
  });
  return problems;
}

function formalRows(exp: Experiment, report: ComparisonReport | null) {
  if (exp.category === 'cornering' && report) {
    const replicateIds = new Set(report.evaluations.filter((e) => e.replicate).map((e) => e.trial.id));
    return { rows: report.eligible, replicateIds, total: exp.trials.length, eligible: report.counts.eligible };
  }
  const rows = exp.trials.filter(isUsableTrial);
  return { rows, replicateIds: new Set<string>(), total: exp.trials.length, eligible: rows.length };
}

export function renderReportMarkdown(exp: Experiment): string {
  const report = exp.category === 'cornering' ? evaluateComparison(exp) : null;
  const { rows, replicateIds, total, eligible } = formalRows(exp, report);
  const independent = exp.variables.find((v) => v.role === 'independent') ?? null;
  const dependent = exp.variables.find((v) => v.role === 'dependent') ?? null;
  const controlled = exp.variables.filter((v) => v.role === 'controlled');
  const baseline = report?.baseline ?? rows[0] ?? null;
  const lines: string[] = [];

  // 1 研究标题
  lines.push(`# 研究报告：${exp.title}`, '');
  lines.push(`> ApexLab 极速科研实验室 · ${CATEGORY_LABEL[exp.category]} · 生成时间 ${fmtDate(new Date().toISOString())}`, '');

  // 2 研究背景
  lines.push('## 1. 研究背景', '');
  lines.push(exp.question || '（未填写研究问题）', '');
  lines.push(
    `研究目的：在控制其余参数的条件下，量化${independent ? `${independent.name} ${independent.symbol}` : '自变量'}对${dependent ? `${dependent.name} ${dependent.symbol}` : '因变量'}的影响，并通过对照实验检验研究假设。`,
    '',
  );

  // 3 研究假设
  lines.push('## 2. 研究假设', '');
  if (exp.hypothesis) {
    lines.push(
      `- **陈述**：${exp.hypothesis.statement}`,
      `- **预期方向**：${DIRECTION_LABEL[exp.hypothesis.expectedDirection]}`,
      `- **物理依据**：${exp.hypothesis.rationale}`,
      '',
    );
  } else {
    lines.push('（未建立假设）', '');
  }

  // 4 理论模型
  lines.push('## 3. 理论模型', '');
  if (exp.category === 'cornering') {
    lines.push(
      '简化过弯模型（水平道路、匀速圆周运动、忽略空气动力与纵向轮胎力）：',
      '',
      '```',
      'v[m/s] = v[km/h] / 3.6        # 单位换算',
      'ay     = v² / R               # 侧向加速度, m/s²',
      'ay_max = μ × 9.81             # 最大简化侧向加速度, m/s²',
      'λ      = ay / ay_max          # 附着利用率, 无量纲',
      'v_limit = sqrt(μ × 9.81 × R)  # 简化临界速度, m/s',
      '```',
      '',
      `模型版本：${CORNERING_MODEL_VERSION}。λ > 1 仅表示在该简化模型中无法维持指定半径的匀速圆周运动，不构成真实车辆失控预测。`,
      '',
    );
  } else if (exp.category === 'braking') {
    lines.push('理想制动模型：`d = v² / (2μg)`（不含反应时间，忽略气动下压力与载荷转移）。', '');
  } else {
    lines.push('简化气动模型：`F = ½ρ·ClA·v²`。', '');
  }

  // 5 实验设计
  lines.push('## 4. 实验设计', '', '| 变量 | 符号 | 单位 | 角色 | 取值范围 |', '|---|---|---|---|---|');
  for (const v of exp.variables) {
    lines.push(`| ${v.name} | ${v.symbol} | ${v.unit} | ${ROLE_LABEL[v.role]} | ${v.min} – ${v.max} |`);
  }
  lines.push('');
  if (baseline) {
    lines.push(
      `基准试跑 #${String(baseline.index).padStart(2, '0')}（${baseline.id}）：v = ${fmtParam(readParam(baseline, 'speedKmh'))} km/h · R = ${fmtParam(readParam(baseline, 'radiusM'))} m · μ = ${fmtParam(readParam(baseline, 'mu'))}。`,
      '',
    );
  }
  if (report) {
    lines.push(
      `有效对照判定方法：试跑记录数值有限且状态有效；控制变量（${report.controlled.map((v) => `${v.name} ${v.symbol}`).join('、')}）与基准试跑保持一致；自变量（${report.independent?.name ?? '—'}）至少 ${3} 个不同取值且合格对照至少 ${3} 条。当前合格对照 ${report.counts.eligible} 条、不同取值 ${report.counts.distinct} 个；混杂与无效记录不计入，重复试跑保留并标记、不新增对照水平。`,
      '',
    );
  } else {
    lines.push(
      `有效对照判定方法：单变量控制——每次试跑仅改变${independent?.name ?? '自变量'}，其余控制变量（${controlled.map((v) => v.symbol).join('、')}）保持恒定；记录数值有限且状态有效者计入。`,
      '',
    );
  }

  // 6 实验数据
  lines.push('## 5. 实验数据（合格对照）', '');
  if (rows.length > 0) {
    lines.push(`共 ${total} 次试跑，正式对照纳入 ${eligible} 条（口径与分析工作台、合格对照 CSV 一致）。`, '');
    if (exp.category === 'cornering') {
      lines.push(
        '| 试跑ID | # | ' + `${independent?.name ?? '自变量'} ${independent?.symbol ?? ''}（${independent?.unit ?? ''}）` + ' | 车速(km/h) | 半径(m) | μ | ay(m/s²) | λ(%) | v_limit(km/h) | 重复 |',
        '|---|---|---|---|---|---|---|---|---|---|',
      );
      for (const t of rows) {
        const lambda = readMetric(t, 'gripUtilization');
        lines.push(
          `| ${t.id} | ${t.index} | ${fmtParam(readParam(t, independent?.id ?? ''))} | ${fmtParam(readParam(t, 'speedKmh'))} | ${fmtParam(readParam(t, 'radiusM'))} | ${fmtParam(readParam(t, 'mu'))} | ${fmtNum(readMetric(t, 'lateralAccelMs2'))} | ${lambda === undefined ? '—' : (lambda * 100).toFixed(1)} | ${fmtNum(readMetric(t, 'limitSpeedKmh'))} | ${replicateIds.has(t.id) ? '是' : '否'} |`,
        );
      }
    } else {
      const metricKeys = Object.keys(rows[0].metrics);
      lines.push(
        `| 试跑ID | # | ${independent ? `${independent.name} ${independent.symbol}` : '参数'} | ${metricKeys.join(' | ')} | 备注 |`,
        `|---|---|---|${metricKeys.map(() => '---').join('|')}|---|`,
      );
      for (const t of rows) {
        lines.push(
          `| ${t.id} | ${t.index} | ${independent ? (readParam(t, independent.id) ?? '—') : '—'} | ${metricKeys.map((k) => fmtNum(readMetric(t, k))).join(' | ')} | ${t.note || '—'} |`,
        );
      }
    }
    lines.push('');
  } else {
    lines.push('（尚无合格对照数据）', '');
  }

  // 7 数据分析
  lines.push('## 6. 数据分析', '');
  if (exp.analysis && exp.analysis.findings.length > 0) {
    lines.push(`**方法**：${exp.analysis.method}`, '');
    for (const f of exp.analysis.findings) {
      const check = report ? checkFindingEvidence(report, f) : { ok: true, problems: [] };
      lines.push(
        `- ${f.observation}`,
        `  - 证据试跑：${f.evidenceTrialIds.join('、') || '（无）'}`,
        `  - 假设判断：${f.supportsHypothesis ? '支持假设' : '不支持假设'} · 证据复核：${check.ok ? '当前合格' : `失效（${check.problems.join('；')}）`}`,
      );
    }
    lines.push('');
  } else {
    lines.push('（尚未保存研究发现）', '');
  }

  // 8 科研结论
  lines.push('## 7. 科研结论', '');
  if (exp.conclusion) {
    lines.push(
      exp.conclusion.statement,
      '',
      `**假设判定**：${VERDICT_LABEL[exp.conclusion.hypothesisVerdict]}`,
      '',
    );
  } else {
    lines.push('（尚未得出结论）', '');
  }

  // 9 模型局限性
  lines.push('## 8. 模型局限性', '', MODEL_LIMITATION_BASE, '');
  if (exp.conclusion?.limitations) lines.push(`研究者补充：${exp.conclusion.limitations}`, '');
  if (exp.analysis?.limitations) lines.push(`分析阶段声明：${exp.analysis.limitations}`, '');

  // 10 数据来源说明
  lines.push('## 9. 数据来源说明', '', DATA_SOURCE_BASE, '');
  if (exp.dataSourceNote) lines.push(exp.dataSourceNote, '');
  if (exp.category === 'cornering') {
    lines.push(`过弯试跑由模型 ${CORNERING_MODEL_VERSION} 逐次计算生成；重复试跑为同参数重复计算，结果相同，未添加人为测量噪声。`, '');
  }

  // 11 流程存档
  lines.push('## 10. 科研流程存档', '', '| 阶段 | 状态 |', '|---|---|');
  for (const s of STAGES) {
    const st = exp.stages[s.id];
    lines.push(`| ${s.order}. ${s.name} | ${st === 'done' ? '已完成' : st === 'active' ? '进行中' : '未开始'} |`);
  }
  lines.push('', '---', `*实验 ID：${exp.id} · 创建于 ${fmtDate(exp.createdAt)} · 由 ApexLab 报告生成器输出*`);
  return lines.join('\n');
}

export function generateReport(exp: Experiment): ReportDoc {
  // 生成报告这一动作本身即完成「撰写报告」阶段
  const finalized: Experiment = { ...exp, stages: { ...exp.stages, report: 'done' } };
  return {
    id: `rpt-${exp.id}`,
    experimentId: exp.id,
    title: `研究报告：${exp.title}`,
    markdown: renderReportMarkdown(finalized),
    createdAt: new Date().toISOString(),
  };
}

export function downloadMarkdown(doc: ReportDoc): void {
  const blob = new Blob([doc.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}