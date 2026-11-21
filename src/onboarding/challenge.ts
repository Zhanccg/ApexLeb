import { TEMPLATES } from '@/data/templates';
import { useLabStore } from '@/data/store';

/** 首页主按钮与引导共用的发车动作：创建过弯对照实验，返回实验 id */
export function createCorneringChallenge(): string | null {
  const tpl = TEMPLATES.find((t) => t.runnable && t.category === 'cornering');
  return tpl ? useLabStore.getState().createFromTemplate(tpl.id) : null;
}
