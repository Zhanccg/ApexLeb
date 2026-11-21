import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOUR_STEPS, markTourSeen, type TourTone } from '@/onboarding/tour';
import { createCorneringChallenge } from '@/onboarding/challenge';
import { EDGE, NARROW_VW, PAD, isInView, isSpotlightable, narrowScrollDelta, placeCentered, placeSpotlight } from '@/onboarding/spotlight';
import { T } from '@/styles/palette';

const CARD_W = 384;

const TONE: Record<TourTone, string> = { race: T.race400, tele: T.tele400, amber: T.amber };

/** '/' 需要精确匹配，其余前缀匹配即可：/experiments/xxx 也算站在实验库里 */
const onRoute = (route: string, path: string) => (route === '/' ? path === '/' : path.startsWith(route));

/** 同一个 data-tour 桌面与窄屏各有一份（如侧栏导航与顶部导航条），取真正布局出来的那一个 */
const findTarget = (sel: string) =>
  [...document.querySelectorAll<HTMLElement>(sel)].find((el) => {
    const r = el.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4;
  }) ?? null;

/** 吸顶头部会盖住它下面的内容，窄屏让位要把它算进上边界；目标自己在头部里（如窄屏导航条）就不算遮挡 */
const topInset = (el: HTMLElement) => {
  const header = document.querySelector<HTMLElement>('[data-app-header]');
  if (!header || header.contains(el)) return EDGE;
  return Math.max(EDGE, header.getBoundingClientRect().bottom);
};

export default function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [size, setSize] = useState({ w: CARD_W, h: 240 });
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  /** 换步时卡片高还是上一步的实测值，够用来估窄屏要让出多少空隙 */
  const cardHRef = useRef(240);
  cardHRef.current = size.h;
  /** 当前目标的窄屏让位动作，卡片高变了要按新空隙再来一次 */
  const alignRef = useRef<(() => void) | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const hereRef = useRef(location);
  hereRef.current = location;
  /** 打开引导时用户所在的页与滚动位置，引导结束时原样送回 */
  const originRef = useRef<{ path: string; y: number } | null>(null);

  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;
  const accent = TONE[step.tone];
  // 已经站在那一页就不必再给跳转按钮
  const visit = step.visit && !onRoute(step.visit.to, location.pathname) ? step.visit : undefined;

  const backToOrigin = () => {
    const origin = originRef.current;
    if (!origin) return;
    if (hereRef.current.pathname !== origin.path) navigate(origin.path);
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, origin.y)));
  };

  const finish = (action?: 'challenge' | 'goto', to?: string) => {
    markTourSeen();
    onClose();
    if (action === 'challenge') {
      const id = createCorneringChallenge();
      navigate(id ? `/experiments/${id}` : '/experiments');
    } else if (action === 'goto' && to) {
      navigate(to);
    } else {
      backToOrigin();
    }
  };

  useEffect(() => {
    if (!open) return;
    originRef.current = { path: hereRef.current.pathname, y: window.scrollY };
    setIndex(0);
  }, [open]);

  // 讲到别的页面上的区块时，引导自己过去；退出时由 backToOrigin 送回原位
  useEffect(() => {
    if (open && step.route && !onRoute(step.route, location.pathname)) navigate(step.route);
  }, [open, step.route, location.pathname, navigate]);

  // 目标不在视口内时先把页面滑过去，聚光跟得上滚动；窄屏还要把目标让到卡片上方，动画挪完元素后补一次对齐
  useEffect(() => {
    if (!open) return;
    const el = step.target ? findTarget(step.target) : null;
    if (!el) {
      setRect(null);
      return;
    }
    /** 窄屏卡片贴在目标下方，先把目标让到卡片上方的空隙里 */
    const alignNarrow = () => {
      if (window.innerWidth >= NARROW_VW) return;
      const delta = narrowScrollDelta(el.getBoundingClientRect(), window.innerHeight, cardHRef.current, topInset(el));
      if (Math.abs(delta) > 6) window.scrollTo({ top: window.scrollY + delta });
    };
    alignRef.current = alignNarrow;
    if (window.innerWidth < NARROW_VW) {
      alignNarrow();
    } else if (!isInView(el.getBoundingClientRect(), window.innerWidth, window.innerHeight)) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = el.getBoundingClientRect();
        setRect((prev) =>
          prev && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height
            ? prev
            : next,
        );
      });
    };
    // fade-up 入场动画在测量之后还会挪动元素，动画停下时补一次重测与对齐
    const settle = () => {
      measure();
      alignNarrow();
    };
    measure();
    window.addEventListener('resize', settle);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('animationend', settle, true);
    window.addEventListener('transitionend', settle, true);
    return () => {
      alignRef.current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', settle);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('animationend', settle, true);
      window.removeEventListener('transitionend', settle, true);
    };
  }, [open, step.target, location.pathname]);

  // 卡片实测高换步后会变，窄屏让出来的空隙跟着变，按新高度再对齐一次
  useEffect(() => {
    if (open) alignRef.current?.();
  }, [open, size.h, step.target, location.pathname]);

  // 旋屏或改窗口大小时，卡片落位与空隙都要按新视口重算
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !open) return;
    const next = { w: el.offsetWidth, h: el.offsetHeight };
    setSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
  }, [open, index, size.w, size.h]);

  useEffect(() => {
    if (!open) return;
    // 引导期间把整个应用设为 inert：Tab / Enter / 点击都摸不到下层页面
    const regions = [...document.querySelectorAll<HTMLElement>('[data-tour-region]')];
    regions.forEach((r) => r.setAttribute('inert', ''));
    primaryRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight' && !isLast) setIndex((i) => i + 1);
      if (e.key === 'ArrowLeft' && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      regions.forEach((r) => r.removeAttribute('inert'));
      window.removeEventListener('keydown', onKey);
    };
  }, [open, index, isLast, location.pathname]);

  if (!open) return null;

  const vw = vp.w;
  const vh = vp.h;
  const spotlight = isSpotlightable(rect, vw, vh, vw < NARROW_VW) ? rect : null;
  const w = Math.min(CARD_W, Math.max(240, vw - EDGE * 2));
  const pos = spotlight ? placeSpotlight(spotlight, { w, h: size.h }, vw, vh) : placeCentered({ w, h: size.h }, vw, vh);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="ApexLab 使用指南">
      {/* 拦截底层点击：聚光模式下的压暗由光斑外阴影负责 */}
      <div className={`absolute inset-0 ${spotlight ? '' : 'bg-carbon-950/85'}`} aria-hidden="true" />
      {spotlight && (
        <div
          className="pointer-events-none absolute rounded-xl"
          aria-hidden="true"
          style={{
            left: spotlight.left - PAD,
            top: spotlight.top - PAD,
            width: spotlight.width + PAD * 2,
            height: spotlight.height + PAD * 2,
            border: `1px solid ${accent}`,
            boxShadow: `0 0 0 2000px color-mix(in srgb, var(--color-carbon-950) 82%, transparent), 0 0 22px color-mix(in srgb, ${accent} 45%, transparent)`,
            transition: 'left .3s ease, top .3s ease, width .3s ease, height .3s ease',
          }}
        />
      )}

      <div
        ref={cardRef}
        className="fade-up absolute w-full overflow-y-auto rounded-xl border border-line-bright bg-carbon-850 p-5 shadow-2xl"
        style={{
          left: pos.left,
          top: pos.top,
          width: w,
          maxWidth: `calc(100vw - ${EDGE * 2}px)`,
          maxHeight: `calc(100vh - ${EDGE * 2}px)`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="num text-[10px] font-bold tracking-[0.28em]" style={{ color: accent }}>
            {step.eyebrow}
          </p>
          <button
            onClick={() => finish()}
            className="num shrink-0 cursor-pointer text-[11px] text-mist-600 transition-colors hover:text-mist-300"
          >
            跳过 ✕
          </button>
        </div>

        <h2 aria-live="polite" className="font-display mt-2 text-lg font-bold leading-snug text-mist-100">
          {step.title}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-mist-500">{step.body}</p>

        {step.points.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {step.points.map((p) => (
              <li key={p} className="flex gap-2 text-xs leading-relaxed text-mist-300">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-sm" style={{ background: accent }} />
                {p}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center gap-1" aria-hidden="true">
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.id}
              className="h-1 flex-1 rounded-sm transition-colors"
              style={{ background: i <= index ? accent : 'var(--color-carbon-700)' }}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {step.actions ? (
            step.actions.map((a, i) => (
              <button
                key={a.label}
                ref={i === 0 ? primaryRef : undefined}
                onClick={() => finish(a.kind, a.to)}
                className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded px-3.5 py-2 text-sm font-semibold transition-all active:scale-[0.97] ${
                  i === 0
                    ? 'bg-race-500 text-white glow-race hover:bg-race-400'
                    : 'border border-tele-500/40 bg-tele-500/15 text-tele-300 hover:bg-tele-500/25'
                }`}
              >
                {a.label}
              </button>
            ))
          ) : (
            <>
              {!isLast && (
                <button
                  onClick={() => finish()}
                  className="cursor-pointer rounded px-2 py-1.5 text-xs font-semibold text-mist-600 transition-colors hover:text-mist-300"
                >
                  稍后再说
                </button>
              )}
              {visit && (
                <button
                  onClick={() => finish('goto', visit.to)}
                  className="cursor-pointer rounded border border-tele-500/40 bg-tele-500/15 px-3 py-1.5 text-xs font-semibold text-tele-300 transition-colors hover:bg-tele-500/25"
                >
                  {visit.label}
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <span className="num text-[11px] text-mist-600">
                  {String(index + 1).padStart(2, '0')} / {String(TOUR_STEPS.length).padStart(2, '0')}
                </span>
                {index > 0 && (
                  <button
                    onClick={() => setIndex((i) => i - 1)}
                    className="cursor-pointer rounded border border-line-bright bg-carbon-700/60 px-3 py-1.5 text-xs font-semibold text-mist-300 hover:bg-carbon-600/60"
                  >
                    上一步
                  </button>
                )}
                <button
                  ref={primaryRef}
                  onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
                  className="cursor-pointer rounded bg-race-500 px-3.5 py-1.5 text-xs font-bold text-white glow-race transition-all hover:bg-race-400 active:scale-[0.97]"
                >
                  {isLast ? '知道了' : '下一步'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
