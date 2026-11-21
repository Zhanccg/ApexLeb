import { useEffect, useState, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLabStore } from '@/data/store';
import OnboardingTour from '@/components/OnboardingTour';
import { hasSeenTour } from '@/onboarding/tour';

const NAV = [
  { to: '/', label: '实验台', en: 'PIT WALL', icon: 'M3 13h4l2-7 4 14 2-7h6' },
  { to: '/experiments', label: '实验库', en: 'GARAGE', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/learn', label: '科研方法论', en: 'ACADEMY', icon: 'M12 4L2 9l10 5 10-5-10-5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5' },
  { to: '/reports', label: '报告中心', en: 'DEBRIEF', icon: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6' },
];

/** 展开 240px / 收起 60px 都写进同一个变量，页面内容与整页背景靠它对齐 */
const COLLAPSE_KEY = 'apexlab-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'justify-center' : 'gap-2.5'}`}>
      <svg viewBox="0 0 32 32" className={compact ? 'h-8 w-8 shrink-0' : 'h-9 w-9'}>
        <rect width="32" height="32" rx="6" className="fill-carbon-800 stroke-carbon-600" />
        <path d="M6 24 L16 6 L26 24 L20.5 24 L16 15 L11.5 24 Z" className="fill-race-500" />
        <rect x="13" y="24" width="6" height="2.5" className="fill-tele-400" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <p className="font-display text-lg font-bold tracking-[0.18em] text-mist-100">
            APEX<span className="text-race-400">LAB</span>
          </p>
          <p className="mt-0.5 text-[10px] tracking-[0.3em] text-mist-500">极速科研实验室</p>
        </div>
      )}
    </div>
  );
}

function CollapseToggle({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  const label = collapsed ? '展开侧边栏' : '收起侧边栏';
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={!collapsed}
      className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-line-bright text-mist-500 transition-colors hover:border-tele-500/50 hover:text-tele-300"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-3.5 w-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );
}

function SessionClock() {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return (
    <span className="num flex items-center gap-2 text-xs text-mist-500">
      <span className="led inline-block h-1.5 w-1.5 rounded-full bg-tele-400 text-tele-400" />
      SESSION {mm}:{ss}
    </span>
  );
}

const TITLES: Record<string, string> = {
  '/': '实验台 · Pit Wall',
  '/experiments': '实验库 · Garage',
  '/learn': '科研方法论 · Academy',
  '/reports': '报告中心 · Debrief',
};

export default function AppShell() {
  const { pathname } = useLocation();
  const resetLab = useLabStore((s) => s.resetLab);
  const [confirmReset, setConfirmReset] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => !hasSeenTour());
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const title = pathname.startsWith('/experiments/') ? '实验详情 · Telemetry' : TITLES[pathname] ?? 'ApexLab';

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* 存储不可用时本次会话内仍然可收起 */
      }
      return next;
    });
  };

  return (
    <div
      className="min-h-screen bg-carbon-950"
      style={{ '--shell-nav': collapsed ? '60px' : '240px' } as CSSProperties}
    >
      {/* 侧边导航（桌面），收起后只剩一条图标轨道 */}
      <aside
        data-tour-region
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-carbon-900 transition-[width] duration-300 ease-out lg:flex lg:w-[var(--shell-nav)]"
      >
        <div
          className={`flex items-center border-b border-line ${
            collapsed ? 'flex-col gap-2 px-2 py-4' : 'justify-between gap-2 px-5 py-5'
          }`}
        >
          <Logo compact={collapsed} />
          <CollapseToggle collapsed={collapsed} onClick={toggleSidebar} />
        </div>
        <nav data-tour="nav" className={`flex-1 space-y-1 py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              title={collapsed ? n.label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-md py-2.5 transition-colors ${
                  collapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  isActive
                    ? 'bg-race-500/12 text-mist-100 rail-left-race'
                    : 'text-mist-500 hover:bg-carbon-800 hover:text-mist-300'
                }`
              }
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon} />
              </svg>
              {!collapsed && <span className="flex-1 text-sm font-medium">{n.label}</span>}
              {!collapsed && <span className="font-display text-[9px] font-bold tracking-[0.2em] opacity-50">{n.en}</span>}
            </NavLink>
          ))}
        </nav>
        <div className={`space-y-3 border-t border-line py-4 ${collapsed ? 'px-2' : 'px-5'}`}>
          {!collapsed && (
            <p className="num text-[10px] leading-relaxed text-mist-600">
              MODE · LOCAL-FIRST
              <br />
              STORAGE · BROWSER
              <br />
              BUILD · PHASE 1 / v0.1
            </p>
          )}
          <button
            onClick={() => setTourOpen(true)}
            data-tour="tour-guide"
            title={collapsed ? '使用指南' : undefined}
            className={`flex w-full cursor-pointer items-center justify-center rounded border border-tele-500/40 bg-tele-500/10 py-1.5 text-[11px] font-bold text-tele-300 transition-colors hover:bg-tele-500/20 ${
              collapsed ? 'px-0' : 'gap-2 px-2'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            {!collapsed && '使用指南'}
          </button>
          <button
            onClick={() => {
              if (confirmReset) {
                resetLab();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 3000);
              }
            }}
            title={collapsed ? (confirmReset ? '再次点击确认重置' : '重置演示数据') : undefined}
            className={`flex w-full cursor-pointer items-center justify-center rounded border py-1.5 text-[11px] font-semibold transition-colors ${
              collapsed ? 'px-0' : 'px-2'
            } ${
              confirmReset
                ? 'border-race-500 bg-race-500/20 text-race-400'
                : 'border-line-bright text-mist-500 hover:text-mist-300'
            }`}
          >
            {collapsed ? (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
              </svg>
            ) : confirmReset ? (
              '再次点击确认重置'
            ) : (
              '重置演示数据'
            )}
          </button>
        </div>
      </aside>

      {/* 顶栏 */}
      <div data-tour-region className="transition-[padding] duration-300 ease-out lg:pl-[var(--shell-nav)]">
        <header data-app-header className="sticky top-0 z-30 border-b border-line bg-carbon-900/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3 lg:hidden">
              <Logo />
            </div>
            <h1 className="hidden font-display text-sm font-bold tracking-[0.22em] text-mist-300 uppercase lg:block">
              {title}
            </h1>
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => setTourOpen(true)}
                className="cursor-pointer rounded border border-line-bright bg-carbon-800/70 px-2.5 py-1 text-[11px] font-bold text-mist-300 transition-colors hover:border-tele-500/50 hover:text-tele-300 lg:hidden"
              >
                使用指南
              </button>
              <span className="num hidden rounded border border-race-500/50 bg-race-500/10 px-2 py-1 text-[10px] tracking-widest text-race-300 sm:block">
                STUDYHACK 2026
              </span>
              <SessionClock />
            </div>
          </div>
          {/* 移动端导航 */}
          <nav data-tour="nav" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `shrink-0 rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                    isActive ? 'bg-race-500/15 text-race-400' : 'text-mist-500'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="relative h-px overflow-hidden bg-line">
            <div className="sweep-line absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-race-400 to-transparent" />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
        <footer className="relative border-t border-line bg-carbon-950 px-6 py-4 text-center">
          <p className="num text-[10px] tracking-[0.25em] text-mist-600">
            APEXLAB · RACING DYNAMICS × RESEARCH METHOD · 2026 QODER 高校创造力大赛 · STUDYHACK
          </p>
        </footer>
      </div>

      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}