/**
 * 轻量 Markdown 渲染器：仅覆盖报告生成器输出的受控子集
 * （标题 / 表格 / 列表 / 引用 / 粗体 / 分隔线），零外部依赖。
 */
import type { ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i} className="font-bold text-mist-100">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export default function MarkdownView({ source }: { source: string }) {
  const lines = source.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^-{2,}$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto rounded border border-line">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-carbon-800/80">
                {head?.map((h, j) => (
                  <th key={j} className="px-3 py-2 font-bold tracking-wide text-tele-300">{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-b border-line/50 last:border-0 odd:bg-carbon-900/40">
                  {r.map((c, ci) => (
                    <td key={ci} className="num px-3 py-1.5 text-mist-300">{inline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push(<h4 key={key++} className="mt-4 mb-1.5 text-sm font-bold text-signal-amber">{inline(line.slice(4))}</h4>);
    } else if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={key++} className="font-display mt-6 mb-2 flex items-center gap-2 border-b border-line pb-1.5 text-lg font-bold tracking-wide text-mist-100">
          <span className="inline-block h-4 w-1 bg-race-500" />{inline(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith('# ')) {
      blocks.push(<h2 key={key++} className="font-display mb-3 text-2xl font-bold tracking-wide text-mist-100">{inline(line.slice(2))}</h2>);
    } else if (line.startsWith('> ')) {
      blocks.push(<p key={key++} className="my-2 rounded border-l-2 border-tele-500 bg-tele-500/8 px-3 py-2 text-xs text-mist-500">{inline(line.slice(2))}</p>);
    } else if (line.startsWith('- ')) {
      blocks.push(
        <p key={key++} className="my-1 flex gap-2 text-sm leading-relaxed text-mist-300">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-tele-400" />{inline(line.slice(2))}
        </p>,
      );
    } else if (line.trim() === '---') {
      blocks.push(<hr key={key++} className="my-4 border-line" />);
    } else if (line.trim() === '') {
      // skip
    } else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      blocks.push(<p key={key++} className="num mt-2 text-[10px] tracking-wider text-mist-600 italic">{line.slice(1, -1)}</p>);
    } else {
      blocks.push(<p key={key++} className="my-1.5 text-sm leading-relaxed text-mist-300">{inline(line)}</p>);
    }
    i++;
  }

  return <div>{blocks}</div>;
}