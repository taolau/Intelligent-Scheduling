// 劳累指数强度刻度：斜切小格亮 N 格 = 指数 N（1-3），全档位统一淡杏乳（只以格数区分，低存在感角标），空槽浅紫灰；
// 屏幕与导出同构。svgH 给定 = 导出图例用内联定尺寸，缺省由 .int-mark 样式控制
const INTENSITY_FILL = '#f6cfaa';
const INTENSITY_EMPTY = '#e3dbf0';

export function intensityMark(score, svgH = 0) {
  const n = Math.max(1, Math.min(3, Math.round(score) || 1));
  const W = 6, GAP = 1.6, H = 5;
  const total = 3 * W + 2 * GAP;
  const skew = H * Math.tan(15 * Math.PI / 180);
  let cells = '';
  for (let i = 0; i < 3; i++) {
    const x = i * (W + GAP);
    cells += `<rect x="${x}" y="0" width="${W}" height="${H}" rx="1" fill="${i < n ? INTENSITY_FILL : INTENSITY_EMPTY}"/>`;
  }
  const style = svgH ? ` style="height:${svgH}px;width:auto;display:block"` : '';
  return `<svg viewBox="${(-skew).toFixed(2)} 0 ${(total + skew).toFixed(2)} ${H}" aria-hidden="true"${style}><g transform="skewX(-15)">${cells}</g></svg>`;
}

export const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
export const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
export const ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:block"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
