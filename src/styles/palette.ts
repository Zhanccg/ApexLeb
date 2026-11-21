/** 图表与内联样式的取色入口：只指向 index.css @theme 令牌，改配色无需改动本文件。 */

export const T = {
  race500: 'var(--color-race-500)',
  race400: 'var(--color-race-400)',
  tele400: 'var(--color-tele-400)',
  amber: 'var(--color-signal-amber)',
  lime: 'var(--color-signal-lime)',
  ice: 'var(--color-signal-ice)',
  violet: 'var(--color-signal-violet)',
  mist600: 'var(--color-mist-600)',
  stage1: 'var(--color-stage-1)',
  stage2: 'var(--color-stage-2)',
  stage3: 'var(--color-stage-3)',
  stage4: 'var(--color-stage-4)',
  stage5: 'var(--color-stage-5)',
  stage6: 'var(--color-stage-6)',
  stage7: 'var(--color-stage-7)',
} as const;

/** 七阶段固定取色顺序（蓝→青→橙单向色阶），
 * 与 ui.tsx 的 SEG_COLORS、StageTracker 的 STAGE_ACCENT、LearnPage 的 ACCENTS 同序 */
export const STAGE_SERIES = [
  T.stage1,
  T.stage2,
  T.stage3,
  T.stage4,
  T.stage5,
  T.stage6,
  T.stage7,
] as const;
