/** 轻量 SVG 遥测曲线：零依赖，直接渲染统一数据结构中的采样序列 */
import { fmtTick } from '@/data/integrity';

export interface SeriesPoint {
  x: number;
  y: number;
}

export function TelemetryChart({
  points,
  color = '#00d2be',
  height = 150,
  xLabel,
  yLabel,
  area = true,
  animate = true,
  reference,
  annotations,
}: {
  points: SeriesPoint[];
  color?: string;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  area?: boolean;
  animate?: boolean;
  /** 水平参考线（如附着极限 μg），超出即变色警示 */
  reference?: { y: number; label: string; color?: string };
  /** 逐点 annotation：直接标签（样本数 / 试跑号）与重复记录同心环 */
  annotations?: Array<{ label?: string; rings?: number }>;
}) {
  if (points.length < 2) return null;
  const W = 560;
  const H = height;
  const PAD = { l: 44, r: 14, t: 14, b: 26 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(...ys, reference?.y ?? 0) * 1.08 || 1;
  const sx = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin || 1)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => H - PAD.b - ((y - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const areaPath = `${path} L${sx(xMax).toFixed(1)},${(H - PAD.b).toFixed(1)} L${sx(xMin).toFixed(1)},${(H - PAD.b).toFixed(1)} Z`;
  const gid = `g-${color.replace('#', '')}`;
  const yTicks = [0, 0.5, 1].map((f) => yMin + f * (yMax - yMin));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${yLabel ?? 'y'} 随 ${xLabel ?? 'x'} 变化曲线`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="#1c2634" strokeDasharray="3 5" />
          <text x={PAD.l - 6} y={sy(v) + 3.5} textAnchor="end" fontSize="9.5" fill="#647182" fontFamily="JetBrains Mono, monospace">
            {fmtTick(v)}
          </text>
        </g>
      ))}
      {[xMin, (xMin + xMax) / 2, xMax].map((v, i) => (
        <text key={i} x={sx(v)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize="9.5" fill="#647182" fontFamily="JetBrains Mono, monospace">
          {fmtTick(v)}
        </text>
      ))}
      {reference && reference.y <= yMax && (
        <g>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={sy(reference.y)}
            y2={sy(reference.y)}
            stroke={reference.color ?? '#ffb800'}
            strokeWidth="1.2"
            strokeDasharray="6 4"
            className="dash-march"
          />
          <text
            x={W - PAD.r}
            y={sy(reference.y) - 4}
            textAnchor="end"
            fontSize="9"
            fill={reference.color ?? '#ffb800'}
            fontFamily="JetBrains Mono, monospace"
          >
            {reference.label}
          </text>
        </g>
      )}
      {area && <path d={areaPath} fill={`url(#${gid})`} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        className={animate ? 'trace-in' : ''}
        style={{ ['--trace-len' as string]: 900 }}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={sx(p.x)}
          cy={sy(p.y)}
          r="3"
          fill="#090d13"
          stroke={reference && p.y > reference.y ? (reference.color ?? '#ffb800') : color}
          strokeWidth="1.6"
        />
      ))}
      {annotations?.map((a, i) => {
        const p = points[i];
        if (!p) return null;
        const stroke = reference && p.y > reference.y ? (reference.color ?? '#ffb800') : color;
        return (
          <g key={`a-${i}`}>
            {Array.from({ length: a.rings ?? 0 }, (_, r) => (
              <circle key={r} cx={sx(p.x)} cy={sy(p.y)} r={5.5 + r * 3} fill="none" stroke={stroke} strokeWidth="1" opacity={Math.max(0.15, 0.5 - r * 0.12)} />
            ))}
            {a.label && (
              <text x={sx(p.x)} y={sy(p.y) - 9 - (a.rings ?? 0) * 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke} fontFamily="JetBrains Mono, monospace">
                {a.label}
              </text>
            )}
          </g>
        );
      })}
      {xLabel && (
        <text x={W - PAD.r} y={12} textAnchor="end" fontSize="9" fill="#8b98a9" letterSpacing="1.5">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={PAD.l} y={12} fontSize="9" fill="#8b98a9" letterSpacing="1.5">
          {yLabel}
        </text>
      )}
    </svg>
  );
}

/** 迷你速度曲线（试跑卡片内嵌） */
export function Sparkline({ values, color = '#00d2be', width = 120, height = 32 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values) || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}