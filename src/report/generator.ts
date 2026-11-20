/**
 * 报告生成模块：把统一实验数据结构渲染为 Markdown 科研报告。
 * 纯函数，无副作用；第二阶段可扩展 PDF / HTML 渲染器。
 */
import type { Experiment, ReportDoc } from '@/data/schema';
import { CATEGORY_LABEL, DIRECTION_LABEL, ROLE_LABEL } from '@/data/schema';
import { isUsableTrial } from '@/data/integrity';
import { STAGES } from '@/pedagogy';

const fmtDate = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

const VERDICT_LABEL = {
  supported: '✅ 假设被数据支持',
  rejected: '❌ 假设被数据拒绝',
  inconclusive: '⚠️ 证据不足，无法判定',
} as const;

export function renderReportMarkdown(exp: Experiment): string {
  const lines: string[] = [];
  lines.push(`# 实验报告：${exp.title}`, '');
  lines.push(`> ApexLab 极速科研实验室 · ${CATEGORY_LABEL[exp.category]} · 生成时间 ${fmtDate(new Date().toISOString())}`, '');

  lines.push('## 1. 研究问题', '', exp.question || '（未填写）', '');

  lines.push('## 2. 假设', '');
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

  lines.push('## 3. 实验方法', '', '### 变量定义', '', '| 变量 | 符号 | 单位 | 角色 | 默认值 | 范围 |', '|---|---|---|---|---|---|');
  for (const v of exp.variables) {
    lines.push(`| ${v.name} | ${v.symbol} | ${v.unit} | ${ROLE_LABEL[v.role]} | ${v.defaultValue} | ${v.min} – ${v.max} |`);
  }
  lines.push('', '采用单变量控制法：每次试跑仅改变自变量，其余控制变量保持恒定。', '');

  lines.push('## 4. 数据记录', '');
  const completed = exp.trials.filter(isUsableTrial);
  if (completed.length > 0) {
    const independent = exp.variables.find((v) => v.role === 'independent');
    const metricKeys = Object.keys(completed[0].metrics);
    lines.push(
      `共 ${exp.trials.length} 次试跑，其中有效 ${completed.length} 次。`,
      '',
      `| # | ${independent ? `${independent.name} ${independent.symbol}` : '参数'} | ${metricKeys.join(' | ')} | 备注 |`,
      `|---|---|${metricKeys.map(() => '---').join('|')}|---|`,
    );
    for (const t of completed) {
      const p = independent ? t.params[independent.id] : '—';
      lines.push(`| ${t.index} | ${p} | ${metricKeys.map((k) => t.metrics[k]).join(' | ')} | ${t.note || '—'} |`);
    }
    lines.push('');
  } else {
    lines.push('（尚无已完成的试跑数据）', '');
  }

  lines.push('## 5. 分析', '');
  if (exp.analysis) {
    lines.push(`**方法**：${exp.analysis.method}`, '');
    for (const f of exp.analysis.findings) {
      lines.push(`- ${f.observation}（证据：${f.evidenceTrialIds.join('、')}；${f.supportsHypothesis ? '支持假设' : '不支持假设'}）`);
    }
    lines.push('');
  } else {
    lines.push('（尚未进行分析）', '');
  }

  lines.push('## 6. 结论', '');
  if (exp.conclusion) {
    lines.push(
      exp.conclusion.statement,
      '',
      `**假设判定**：${VERDICT_LABEL[exp.conclusion.hypothesisVerdict]}`,
      '',
      `**局限与适用范围**：${exp.conclusion.limitations || '（未说明）'}`,
      '',
    );
  } else {
    lines.push('（尚未得出结论）', '');
  }

  lines.push('## 7. 科研流程存档', '', '| 阶段 | 状态 |', '|---|---|');
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
    title: `实验报告：${exp.title}`,
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