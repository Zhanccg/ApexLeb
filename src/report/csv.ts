/**
 * T05 实验数据 CSV 导出。
 * 与页面表格 / 图表共用 evaluateComparison 的同一份资格判定与格式化口径；
 * 原始记录口径保留全部试跑（含混杂 / 无效 / 重复）并以列明确标记，
 * 合格对照口径仅含 eligible，避免混杂记录被误认为分析证据。
 */
import type { Experiment } from '@/data/schema';
import type { ComparisonReport } from '@/pedagogy';
import { readMetric, readParam } from '@/data/integrity';

export type CsvScope = 'raw' | 'eligible';

const STATUS_LABEL: Record<string, string> = {
  completed: '已完成',
  invalid: '无效',
  planned: '计划中',
  running: '运行中',
};

const HEADERS = [
  '试跑ID',
  '记录时间',
  '自变量',
  '自变量取值',
  '自变量单位',
  '车速(km/h)',
  '弯道半径(m)',
  '附着系数μ',
  '侧向加速度(m/s²)',
  '附着利用率(%)',
  '临界速度(km/h)',
  '临界速度(m/s)',
  '试跑状态',
  '合格对照',
  '重复试跑',
  '无效原因',
];

const escape = (v: string): string => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const num = (v: number | undefined, digits: number): string => (v === undefined ? '' : v.toFixed(digits));
const raw = (v: number | undefined): string => (v === undefined ? '' : String(v));

export function buildExperimentCsv(_exp: Experiment, report: ComparisonReport, scope: CsvScope): string {
  const rows = scope === 'raw' ? report.evaluations : report.evaluations.filter((e) => e.eligible);
  const indName = report.independent ? `${report.independent.name} ${report.independent.symbol}` : '未设置';
  const indUnit = report.independent?.unit ?? '';
  const lines = [HEADERS.join(',')];
  for (const e of rows) {
    const t = e.trial;
    const lambda = readMetric(t, 'gripUtilization');
    lines.push(
      [
        escape(t.id),
        escape(t.createdAt),
        escape(indName),
        raw(readParam(t, report.independent?.id ?? '')),
        escape(indUnit),
        raw(readParam(t, 'speedKmh')),
        raw(readParam(t, 'radiusM')),
        raw(readParam(t, 'mu')),
        num(readMetric(t, 'lateralAccelMs2'), 2),
        num(lambda === undefined ? undefined : lambda * 100, 1),
        num(readMetric(t, 'limitSpeedKmh'), 2),
        num(readMetric(t, 'limitSpeedMs'), 2),
        escape(STATUS_LABEL[t.status] ?? t.status),
        e.eligible ? '是' : '否',
        e.replicate ? '是' : '否',
        escape(t.invalidReason ?? ''),
      ].join(','),
    );
  }
  // UTF-8 BOM：保证 Excel / WPS 等中文表格软件正确识别中文表头
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function downloadExperimentCsv(exp: Experiment, report: ComparisonReport, scope: CsvScope): void {
  const csv = buildExperimentCsv(exp, report, scope);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ApexLab_${exp.id}_${scope === 'raw' ? '原始记录' : '合格对照'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}