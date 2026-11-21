import { describe, expect, it } from 'vitest';
import { EDGE, PAD, isInView, isSpotlightable, narrowScrollDelta, placeCentered, placeSpotlight, type SpotlightRect } from './spotlight';

const rect = (left: number, top: number, width: number, height: number): SpotlightRect => ({ left, top, width, height });
const CARD = { w: 384, h: 260 };
const VW = 1440;
const VH = 900;

describe('isSpotlightable', () => {
  it('窄屏照样聚光，只有没布局出来的目标（隐藏的侧栏导航）不聚光', () => {
    expect(isSpotlightable(rect(16, 100, 358, 80), 390, 844)).toBe(true);
    expect(isSpotlightable(rect(100, 100, 0, 0), VW, VH)).toBe(false);
    expect(isSpotlightable(null, VW, VH)).toBe(false);
  });

  it('只有完整落在视口内才聚光，出了视口就交给居中卡片', () => {
    expect(isSpotlightable(rect(100, 100, 300, 80), VW, VH)).toBe(true);
    expect(isSpotlightable(rect(100, VH - 40, 300, 80), VW, VH)).toBe(false);
    expect(isSpotlightable(rect(100, -60, 300, 80), VW, VH)).toBe(false);
    expect(isSpotlightable(rect(100, 100, 300, VH + 10), VW, VH)).toBe(false);
    expect(isSpotlightable(rect(-10, 100, 300, 80), VW, VH)).toBe(false);
  });

  it('窄屏允许目标底部出视口，至少露出顶部；桌面宽度仍要求完整可见', () => {
    expect(isSpotlightable(rect(16, 102, 328, 544), 360, 640, true)).toBe(true);
    expect(isSpotlightable(rect(16, 102, 328, 544), 360, 640)).toBe(false);
    expect(isSpotlightable(rect(16, 620, 328, 544), 360, 640, true)).toBe(false);
  });

  it('贴边而完整的侧栏照样聚光', () => {
    expect(isSpotlightable(rect(0, 81, 239, 652), VW, VH)).toBe(true);
    expect(isSpotlightable(rect(VW - 200, 0, 200, 100), VW, VH)).toBe(true);
  });
});

describe('isInView', () => {
  it('窄屏也判断可见性，与是否聚光无关', () => {
    expect(isInView(rect(0, 81, 239, 652), 800, VH)).toBe(true);
    expect(isInView(rect(100, 1436, 320, 300), VW, VH)).toBe(false);
  });

  it('视口外的目标判为不可见', () => {
    expect(isInView(rect(100, VH - 40, 300, 80), VW, VH)).toBe(false);
    expect(isInView(rect(100, -60, 300, 80), VW, VH)).toBe(false);
  });
});

describe('narrowScrollDelta', () => {
  const VH = 844;
  const CARD_H = 300;
  const HEADER = 100;
  // 空隙：头部下沿 100 + PAD 到 视口 - 卡片 - 边距 - 间距 - PAD，即 110 ~ 504

  it('目标已经落在头部与卡片之间的空隙里就不动', () => {
    expect(narrowScrollDelta(rect(16, 300, 358, 80), VH, CARD_H, HEADER)).toBe(0);
  });

  it('目标压到卡片上时把顶部让到吸顶头部下面', () => {
    expect(narrowScrollDelta(rect(16, 500, 358, 80), VH, CARD_H, HEADER)).toBe(500 - (HEADER + PAD));
  });

  it('目标滚过头藏进头部下面时往回滚', () => {
    expect(narrowScrollDelta(rect(16, 20, 358, 80), VH, CARD_H, HEADER)).toBe(20 - (HEADER + PAD));
  });

  it('目标比空隙还高时至少把顶部露在头部下面', () => {
    expect(narrowScrollDelta(rect(16, 249, 358, 544), VH, 336, HEADER)).toBe(249 - (HEADER + PAD));
  });

  it('卡片高到没有空隙时不滚，交给居中卡片', () => {
    expect(narrowScrollDelta(rect(16, 500, 358, 80), VH, 820, HEADER)).toBe(0);
  });

  it('目标本身就在吸顶头部里（窄屏导航条）时按边距算，不用滚', () => {
    expect(narrowScrollDelta(rect(0, 56, 390, 36), VH, 454, EDGE)).toBe(0);
  });
});

describe('placeSpotlight', () => {
  it('优先放目标下方', () => {
    const p = placeSpotlight(rect(120, 100, 320, 80), CARD, VW, VH);
    expect(p).toEqual({ left: 120 - PAD, top: 180 + PAD + 14 });
  });

  it('下方放不下时翻到上方', () => {
    const p = placeSpotlight(rect(120, 640, 320, 220), CARD, VW, VH);
    expect(p.top).toBe(640 - PAD - 14 - CARD.h);
    expect(p.top).toBeGreaterThanOrEqual(16);
  });

  it('上下都放不下时移到右侧', () => {
    const p = placeSpotlight(rect(120, 260, 200, 460), CARD, VW, VH);
    expect(p.left).toBe(120 + 200 + PAD + 14);
  });

  it('右侧也放不下时移到左侧', () => {
    const p = placeSpotlight(rect(1000, 200, 400, 600), CARD, 1200, VH);
    expect(p.left + CARD.w).toBeLessThanOrEqual(1000 - PAD);
  });

  it('被目标包围时落到底部且不出视口', () => {
    const p = placeSpotlight(rect(20, 20, 1400, 860), CARD, VW, VH);
    expect(p.top + CARD.h).toBeLessThanOrEqual(VH);
    expect(p.left).toBeGreaterThanOrEqual(16);
  });

  it('靠右边缘的目标会把卡片夹回视口内', () => {
    const p = placeSpotlight(rect(1300, 100, 120, 60), CARD, VW, VH);
    expect(p.left + CARD.w).toBeLessThanOrEqual(VW - 16);
  });
});

describe('placeCentered', () => {
  it('手机宽度贴底并留边', () => {
    expect(placeCentered({ w: 343, h: 300 }, 375, 812)).toEqual({ left: 16, top: 812 - 300 - 16 });
  });

  it('宽屏水平垂直居中', () => {
    expect(placeCentered(CARD, VW, VH)).toEqual({ left: (VW - CARD.w) / 2, top: (VH - CARD.h) / 2 });
  });

  it('卡片高于视口时不顶出上边', () => {
    expect(placeCentered({ w: 384, h: 1200 }, VW, VH).top).toBe(16);
  });
});
