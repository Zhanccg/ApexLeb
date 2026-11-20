import { STAGES } from '@/pedagogy';
import { Panel } from '@/components/ui';

const ACCENTS = [
  { text: 'text-race-400', border: 'border-race-500/40', bg: 'bg-race-500', glow: 'rgba(225,6,0,0.14)' },
  { text: 'text-signal-amber', border: 'border-signal-amber/40', bg: 'bg-signal-amber', glow: 'rgba(255,184,0,0.12)' },
  { text: 'text-signal-lime', border: 'border-signal-lime/40', bg: 'bg-signal-lime', glow: 'rgba(163,230,53,0.10)' },
  { text: 'text-tele-400', border: 'border-tele-500/40', bg: 'bg-tele-400', glow: 'rgba(0,210,190,0.12)' },
  { text: 'text-signal-ice', border: 'border-signal-ice/40', bg: 'bg-signal-ice', glow: 'rgba(76,195,255,0.12)' },
  { text: 'text-signal-violet', border: 'border-signal-violet/40', bg: 'bg-signal-violet', glow: 'rgba(167,139,250,0.12)' },
  { text: 'text-signal-magenta', border: 'border-signal-magenta/40', bg: 'bg-signal-magenta', glow: 'rgba(244,113,181,0.12)' },
];

export default function LearnPage() {
  return (
    <div className="space-y-6">
      <header className="fade-up panel telemetry-grid relative overflow-hidden px-6 py-7 sm:px-8">
        <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-signal-violet/10 blur-3xl" />
        <p className="num text-[11px] tracking-[0.35em] text-signal-violet">ACADEMY · RESEARCH METHOD</p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-wide text-mist-100 sm:text-4xl">科研七阶段方法论</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-500">
          科学研究不是灵感一闪，而是一条可复现的流水线。ApexLab 把它拆成七个阶段，每个阶段都有明确的目标、
          操作要点、常见误区和退出条件——就像车队不会跳过风洞验证直接上赛道，科研也不允许跳过假设直接下结论。
        </p>
      </header>

      <div className="relative space-y-4">
        {/* 时间轴线 */}
        <div className="absolute top-4 bottom-4 left-[21px] hidden w-px bg-gradient-to-b from-race-500 via-tele-400 to-signal-magenta opacity-40 sm:block" />
        {STAGES.map((s, i) => {
          const a = ACCENTS[i];
          return (
            <article key={s.id} className="fade-up relative sm:pl-14" style={{ animationDelay: `${i * 0.06}s` }}>
              <span
                className={`num absolute top-5 left-0 hidden h-11 w-11 items-center justify-center rounded-full border bg-carbon-900 text-sm font-bold sm:flex ${a.border} ${a.text}`}
                style={{ boxShadow: `0 0 20px ${a.glow}` }}
              >
                {String(s.order).padStart(2, '0')}
              </span>
              <div className={`panel overflow-hidden border-l-2 ${a.border}`}>
                <div className="p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-xl font-bold tracking-wide text-mist-100">
                      <span className={`num mr-2 sm:hidden ${a.text}`}>{String(s.order).padStart(2, '0')}</span>
                      {s.name}
                    </h2>
                    <p className={`text-xs font-semibold italic ${a.text}`}>🏁 {s.racingAnalogy}</p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-mist-300">{s.goal}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="panel-title mb-2">操作要点</p>
                      <ul className="space-y-1.5">
                        {s.guidance.map((g, j) => (
                          <li key={j} className="flex gap-2 text-xs leading-relaxed text-mist-500">
                            <span className={`mt-1 h-1 w-1 shrink-0 rounded-full ${a.bg}`} />
                            {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded border border-race-500/30 bg-race-500/8 p-3">
                        <p className="text-[10px] font-bold tracking-widest text-race-400">常见误区 · PITFALL</p>
                        <p className="mt-1 text-xs leading-relaxed text-mist-500">{s.pitfall}</p>
                      </div>
                      <div className="rounded border border-line bg-carbon-900/70 p-3">
                        <p className="text-[10px] font-bold tracking-widest text-tele-400">退出条件 · EXIT</p>
                        <p className="mt-1 text-xs leading-relaxed text-mist-500">{s.exitCriteria}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Panel title="核心原则 · Golden Rules" className="fade-up">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { t: '控制变量', d: '每次只改一个因素。同时改两个设定，你永远不知道是哪个起了作用。', c: 'text-race-400' },
            { t: '可证伪性', d: '假设必须允许被数据推翻。被拒绝的假设和被支持的一样有价值。', c: 'text-signal-amber' },
            { t: '可复现性', d: '完整记录方法与参数，让任何人重跑都能得到相近结果。', c: 'text-tele-400' },
          ].map((r) => (
            <div key={r.t} className="rounded-lg border border-line bg-carbon-900/70 p-4">
              <p className={`font-display text-base font-bold tracking-widest ${r.c}`}>{r.t}</p>
              <p className="mt-2 text-xs leading-relaxed text-mist-500">{r.d}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}