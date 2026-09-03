import html2canvas from 'html2canvas';
import { downloadBlob } from './excel.js';
import { toDateStr } from '../core/week.js';

function formatNow() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${toDateStr(d)} ${hh}:${mm}`;
}

const FONT_STACK = 'system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif';
// 导出宽度布局：周历 1200 固定（7 列均分，不随窗口/缩放变化）+ 白卡内边距 + 画布四周留白（不切边）
const GRID_WIDTH = 1200;
const CARD_PAD = 22;
const PAGE_PAD = 30;

// 周历导出 PNG：离屏构造「浅底画布 + 白色圆角内容卡（居中标题 + 周历克隆）」截图，原页面零扰动；
// 固定宽度保证任何窗口下导出大小一致；克隆时去掉今天高亮/小旗子（导出的图是长期排班表，不绑定"今天"）
export async function exportWeekImage(container, filename, weekLabel, viewLabel) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:absolute;left:-99999px;top:0;width:${GRID_WIDTH + CARD_PAD * 2 + PAGE_PAD * 2}px;padding:${PAGE_PAD}px;`;
  wrap.style.background = getComputedStyle(document.body).backgroundColor || '#f7f4f8';

  const card = document.createElement('div');
  card.style.cssText = `background:#fff;border:1px solid #eae5f0;border-radius:14px;padding:${CARD_PAD}px ${CARD_PAD}px ${CARD_PAD - 6}px;`;

  const header = document.createElement('div');
  header.style.cssText = `text-align:center;padding:2px 0 14px;border-bottom:1px solid #e0d2ef;margin-bottom:14px;font-family:${FONT_STACK};`;
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:700;font-size:20px;line-height:1.4;color:#5a1d78;';
  title.textContent = weekLabel;
  const meta = document.createElement('div');
  meta.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;';
  const left = document.createElement('span');
  left.style.cssText = 'font-size:13px;font-weight:500;color:#5a1d78;';
  left.textContent = viewLabel || '总览';
  const right = document.createElement('span');
  right.style.cssText = 'font-size:12px;color:#8b728f;';
  right.textContent = `导出时间：${formatNow()}`;
  meta.append(left, right);
  header.append(title, meta);

  // 导出的是静态视图：克隆时移除全部功能性 UI（建班次入口/智能排班按钮）与今天高亮/旗子
  const clone = container.cloneNode(true);
  clone.querySelectorAll('.cal-today').forEach(el => el.classList.remove('cal-today'));
  clone.querySelectorAll('.cal-today-flag, .cal-add-day, .sch-smart').forEach(el => el.remove());

  card.append(header, clone);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
  try {
    const canvas = await html2canvas(wrap, {
      scale: 2,
      backgroundColor: wrap.style.background,
      logging: false,
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG 生成失败');
    downloadBlob(blob, filename);
  } finally {
    wrap.remove();
  }
}

// 任务说明清单导出 PNG：与周历图同构（离屏浅底画布 + 白卡，居中标题 + 条目清单克隆，固定 1200 内容宽）
export async function exportTaskViewImage({ list, title, metaText, filename }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:absolute;left:-99999px;top:0;width:${GRID_WIDTH + CARD_PAD * 2 + PAGE_PAD * 2}px;padding:${PAGE_PAD}px;`;
  wrap.style.background = getComputedStyle(document.body).backgroundColor || '#f7f4f8';

  const card = document.createElement('div');
  card.style.cssText = `background:#fff;border:1px solid #eae5f0;border-radius:14px;padding:${CARD_PAD}px ${CARD_PAD}px ${CARD_PAD - 6}px;`;

  const header = document.createElement('div');
  header.style.cssText = `text-align:center;padding:2px 0 14px;border-bottom:1px solid #e0d2ef;margin-bottom:14px;font-family:${FONT_STACK};`;
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:700;font-size:22px;line-height:1.3;color:#5a1d78;';
  titleEl.textContent = title;
  const meta = document.createElement('div');
  meta.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-top:5px;';
  const left = document.createElement('span');
  left.style.cssText = 'font-size:13px;font-weight:500;color:#5a1d78;';
  left.textContent = metaText;
  const right = document.createElement('span');
  right.style.cssText = 'font-size:12px;color:#8b728f;';
  right.textContent = `导出时间：${formatNow()}`;
  meta.append(left, right);
  header.append(titleEl, meta);

  card.append(header, list.cloneNode(true));
  wrap.appendChild(card);
  document.body.appendChild(wrap);
  try {
    const canvas = await html2canvas(wrap, {
      scale: 2,
      backgroundColor: wrap.style.background,
      logging: false,
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG 生成失败');
    downloadBlob(blob, filename);
  } finally {
    wrap.remove();
  }
}
