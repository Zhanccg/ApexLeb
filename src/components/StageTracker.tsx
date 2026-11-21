import type { Experiment, StageId } from '@/data/schema';
import { STAGES, currentStage } from '@/pedagogy';

const STAGE_ACCENT = [
  'text-stage-1 border-stage-1',
  'text-stage-2 border-stage-2',
  'text-stage-3 border-stage-3',
  'text-stage-4 border-stage-4',
  'text-stage-5 border-stage-5',
  'text-stage-6 border-stage-6',
  'text-stage-7 border-stage-7',
];

export default function StageTracker({ exp, onSelect }: { exp: Experiment; onSelect?: (id: StageId) => void }) {
  const active = currentStage(exp);
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {STAGES.map((s, i) => {
        const st = exp.stages[s.id];
        const isActive = s.id === active && st !== 'done';
        return (
          <li key={s.id}>
            <button
              onClick={() => onSelect?.(s.id)}
              className={`group w-full cursor-pointer rounded-md border px-1 py-2.5 text-center transition-all ${
                st === 'done'
                  ? 'border-line bg-carbon-800/80'
                  : isActive
                    ? `bg-carbon-800 ${STAGE_ACCENT[i].split(' ')[1]} glow-tele`
                    : 'border-line bg-carbon-900 opacity-55'
              }`}
              title={`${s.name} · ${st === 'done' ? '已完成' : isActive ? '进行中' : '未解锁'}`}
            >
              <span
                className={`num mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold ${
                  st === 'done'
                    ? 'border-tele-500/60 bg-tele-500/15 text-tele-300'
                    : isActive
                      ? `${STAGE_ACCENT[i]} led`
                      : 'border-line-bright text-mist-600'
                }`}
              >
                {st === 'done' ? '✓' : s.order}
              </span>
              <span className={`mt-1.5 block text-[11px] font-semibold ${st === 'done' ? 'text-mist-300' : isActive ? 'text-mist-100' : 'text-mist-600'}`}>
                {s.shortName}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}