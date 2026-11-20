import type { ReactNode } from 'react';
import type { ExperimentCategory } from '@/data/schema';
import { CATEGORY_LABEL } from '@/data/schema';

export const CATEGORY_COLOR: Record<ExperimentCategory, string> = {
  braking: 'text-race-400 border-race-500/40 bg-race-500/10',
  cornering: 'text-signal-amber border-signal-amber/40 bg-signal-amber/10',
  acceleration: 'text-signal-lime border-signal-lime/40 bg-signal-lime/10',
  aero: 'text-signal-ice border-signal-ice/40 bg-signal-ice/10',
};

export function CategoryBadge({ category }: { category: ExperimentCategory }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${CATEGORY_COLOR[category]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

export function Panel({
  title,
  right,
  children,
  className = '',
  id,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`panel overflow-hidden ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="panel-title flex items-center gap-2">
            <span className="inline-block h-3 w-1 bg-race-500" />
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  unit,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="panel relative overflow-hidden p-4">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
      <p className="panel-title">{label}</p>
      <p className="num mt-2 text-3xl font-bold text-mist-100">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-mist-500">{unit}</span>}
      </p>
      {sub && <p className="mt-1 text-xs text-mist-500">{sub}</p>}
    </div>
  );
}

const SEG_COLORS = [
  'bg-race-500',
  'bg-signal-amber',
  'bg-signal-lime',
  'bg-tele-400',
  'bg-signal-ice',
  'bg-signal-violet',
  'bg-signal-magenta',
];

/** 七段式阶段进度条：每段对应一个科研阶段 */
export function StageSegments({
  stages,
  className = '',
}: {
  stages: Record<string, string>;
  className?: string;
}) {
  const order = ['question', 'hypothesis', 'design', 'collect', 'analyze', 'conclude', 'report'];
  return (
    <div className={`flex gap-1 ${className}`}>
      {order.map((id, i) => (
        <div
          key={id}
          title={id}
          className={`h-1.5 flex-1 rounded-sm transition-colors ${
            stages[id] === 'done'
              ? SEG_COLORS[i]
              : stages[id] === 'active'
                ? `${SEG_COLORS[i]} opacity-45 led`
                : 'bg-carbon-700'
          }`}
        />
      ))}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'tele';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary:
      'bg-race-500 text-white hover:bg-race-400 shadow-[0_0_18px_rgba(225,6,0,0.35)] disabled:shadow-none',
    tele: 'bg-tele-500/15 text-tele-300 border border-tele-500/40 hover:bg-tele-500/25',
    ghost: 'bg-carbon-700/60 text-mist-300 border border-line-bright hover:bg-carbon-600/60',
    danger: 'bg-transparent text-race-400 border border-race-500/40 hover:bg-race-500/15',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded px-3.5 py-2 text-sm font-semibold tracking-wide transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-bright px-6 py-10 text-center">
      <span className="text-3xl opacity-70">{icon}</span>
      <p className="font-display text-sm font-bold tracking-widest text-mist-300">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-mist-500">{hint}</p>
    </div>
  );
}

export function Toast({ message, tone }: { message: string; tone: 'ok' | 'err' }) {
  return (
    <div
      className={`fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border px-4 py-2.5 text-sm font-medium shadow-xl backdrop-blur ${
        tone === 'ok'
          ? 'border-tele-500/50 bg-carbon-800/95 text-tele-300'
          : 'border-race-500/50 bg-carbon-800/95 text-race-400'
      }`}
    >
      {tone === 'ok' ? '✓ ' : '✕ '}
      {message}
    </div>
  );
}