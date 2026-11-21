export interface SpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 光斑与目标之间留的呼吸位 */
export const PAD = 10;
const GAP = 14;
export const EDGE = 16;
/** 窄屏以下卡片按满宽排 */
export const NARROW_VW = 640;

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/** 目标是否完整落在视口内：贴边元素算可见，容 2px 亚像素误差 */
export function isInView(rect: SpotlightRect, vw: number, vh: number): boolean {
  const TOL = 2;
  return (
    rect.left >= -TOL &&
    rect.top >= -TOL &&
    rect.left + rect.width <= vw + TOL &&
    rect.top + rect.height <= vh + TOL
  );
}

/**
 * 目标过小（被隐藏 / 未布局，如窄屏没有侧栏导航）或滑过去之后仍然放不进视口时不聚光，交给居中模式。
 * 窄屏经常放不下比屏幕还高的目标，allowBottomOverflow 让它至少露出顶部，光斑底部被视口裁掉。
 */
export function isSpotlightable(rect: SpotlightRect | null, vw: number, vh: number, allowBottomOverflow = false): rect is SpotlightRect {
  if (!rect || rect.width < 4 || rect.height < 4) return false;
  if (allowBottomOverflow) return rect.left >= -2 && rect.top >= -2 && rect.left + rect.width <= vw + 2 && rect.top <= vh - 40;
  return isInView(rect, vw, vh);
}

/**
 * 窄屏卡片贴在目标下方，目标要先让到「吸顶头部之下、卡片之上」的空隙里才看得见。
 * 返回还要往下滚的像素数（可为负），0 表示已经落在空隙内、不用动。
 * topInset 是会被吸顶头部盖住的高度；目标本身在头部里时按 EDGE 算。
 */
export function narrowScrollDelta(rect: SpotlightRect, vh: number, cardH: number, topInset: number): number {
  const bandTop = topInset + PAD;
  const bandBottom = vh - cardH - EDGE - GAP - PAD;
  if (bandBottom <= bandTop) return 0;
  if (rect.top >= bandTop && rect.top + rect.height <= bandBottom) return 0;
  return rect.top - bandTop;
}

/** 卡片落位优先级：下 → 上 → 右 → 左 → 底部兜底，并保证不出视口 */
export function placeSpotlight(
  rect: SpotlightRect,
  size: { w: number; h: number },
  vw: number,
  vh: number,
): { left: number; top: number } {
  const rightEdge = rect.left + rect.width;
  const bottomEdge = rect.top + rect.height;
  const maxLeft = Math.max(EDGE, vw - size.w - EDGE);
  const horizontal = clamp(rect.left - PAD, EDGE, maxLeft);
  const vertical = clamp(rect.top - PAD, EDGE, Math.max(EDGE, vh - size.h - EDGE));
  if (bottomEdge + PAD + GAP + size.h <= vh - EDGE) return { left: horizontal, top: bottomEdge + PAD + GAP };
  if (rect.top - PAD - GAP - size.h >= EDGE) return { left: horizontal, top: rect.top - PAD - GAP - size.h };
  if (rightEdge + PAD + GAP + size.w <= vw - EDGE) return { left: rightEdge + PAD + GAP, top: vertical };
  const left = rect.left - PAD - GAP - size.w;
  if (left >= EDGE) return { left, top: vertical };
  return { left: horizontal, top: Math.max(EDGE, vh - size.h - EDGE) };
}

/** 居中模式：手机贴底，其余按视口居中（size.w 已是卡片实测宽） */
export function placeCentered(size: { w: number; h: number }, vw: number, vh: number): { left: number; top: number } {
  if (vw < NARROW_VW) return { left: EDGE, top: Math.max(EDGE, vh - size.h - EDGE) };
  return { left: clamp((vw - size.w) / 2, EDGE, Math.max(EDGE, vw - size.w - EDGE)), top: Math.max(EDGE, (vh - size.h) / 2) };
}
