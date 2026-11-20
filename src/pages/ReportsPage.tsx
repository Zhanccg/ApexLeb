import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLabStore } from '@/data/store';
import { generateReport, downloadMarkdown, reportEvidenceBlockers } from '@/report/generator';
import { STAGE_ORDER } from '@/pedagogy';
import { Button, EmptyState, Panel, StageSegments } from '@/components/ui';
import MarkdownView from '@/components/MarkdownView';

const fmt = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

export default function ReportsPage() {
  const reports = useLabStore((s) => s.reports);
  const experiments = useLabStore((s) => s.experiments);
  const addReport = useLabStore((s) => s.addReport);
  const deleteReport = useLabStore((s) => s.deleteReport);

  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id ?? null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const selected = reports.find((r) => r.id === selectedId) ?? reports[0] ?? null;
  const readyExps = experiments.filter(
    (e) => STAGE_ORDER.slice(0, 6).every((s) => e.stages[s] === 'done'),
  );

  return (
    <div className="space-y-6">
      <header className="fade-up">
        <p className="num text-[11px] tracking-[0.35em] text-signal-magenta">DEBRIEF · REPORT CENTER</p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-wide text-mist-100">报告中心</h1>
        <p className="mt-1.5 text-sm text-mist-500">
          按「问题 → 假设 → 方法 → 数据 → 分析 → 结论 → 局限」标准结构生成可复现的 Markdown 报告。
        </p>
      </header>

      {/* 可生成报告的实验 */}
      <Panel title="待生成 · Ready to Debrief" className="fade-up">
        {readyExps.length === 0 ? (
          <p className="py-3 text-center text-xs text-mist-500">
            暂无完成全部前序阶段的实验。推进实验流程至「结论」完成后，即可在此生成报告。
          </p>
        ) : (
          <div className="space-y-2.5">
            {readyExps.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-carbon-800/50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link to={`/experiments/${e.id}`} className="text-sm font-bold text-mist-100 hover:text-tele-300">{e.title}</Link>
                  <StageSegments stages={e.stages} className="mt-2 max-w-xs" />
                </div>
                <Button variant="tele" onClick={() => {
                  const blockers = reportEvidenceBlockers(e);
                  if (blockers.length > 0) {
                    setGenError(`「${e.title}」证据复核未通过：${blockers[0]}`);
                    return;
                  }
                  setGenError(null);
                  const doc = generateReport(e);
                  addReport(doc);
                  setSelectedId(doc.id);
                }}>
                  生成报告
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {genError && (
        <p role="alert" className="fade-up rounded border border-race-500/50 bg-race-500/10 px-3 py-2 text-xs font-semibold text-race-400">
          ✕ {genError}
        </p>
      )}

      {reports.length === 0 ? (
        <EmptyState icon="📄" title="还没有报告" hint="完成一个实验的七个阶段后生成报告；种子制动实验已推进到分析阶段，再走两步即可体验完整流程。" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* 报告列表 */}
          <div className="space-y-2.5">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full cursor-pointer rounded-lg border p-3.5 text-left transition-colors ${
                  selected?.id === r.id ? 'border-signal-magenta/50 bg-signal-magenta/8' : 'border-line bg-carbon-850 hover:border-line-bright'
                }`}
              >
                <p className="text-sm font-bold text-mist-100">{r.title}</p>
                <p className="num mt-1 text-[10px] text-mist-600">{fmt(r.createdAt)} · {r.markdown.length} CHARS</p>
              </button>
            ))}
          </div>

          {/* 报告预览 */}
          <Panel
            title="报告预览 · Preview"
            className="lg:col-span-2"
            right={
              selected && (
                <div className="flex gap-2">
                  <button onClick={() => downloadMarkdown(selected)} className="cursor-pointer rounded border border-tele-500/40 bg-tele-500/10 px-2.5 py-1 text-[11px] font-bold text-tele-300 hover:bg-tele-500/25">
                    ↓ 下载 .md
                  </button>
                  <button
                    onClick={() => {
                      if (pendingDelete === selected.id) {
                        deleteReport(selected.id);
                        setPendingDelete(null);
                        setSelectedId(null);
                      } else {
                        setPendingDelete(selected.id);
                        setTimeout(() => setPendingDelete(null), 3000);
                      }
                    }}
                    className={`cursor-pointer rounded border px-2.5 py-1 text-[11px] font-bold ${
                      pendingDelete === selected.id ? 'border-race-500 bg-race-500/25 text-race-400' : 'border-line text-mist-600 hover:text-race-400'
                    }`}
                  >
                    {pendingDelete === selected.id ? '确认删除?' : '删除'}
                  </button>
                </div>
              )
            }
          >
            {selected ? (
              <div className="max-h-[70vh] overflow-y-auto pr-1">
                <MarkdownView source={selected.markdown} />
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-mist-500">选择左侧报告查看预览。</p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}