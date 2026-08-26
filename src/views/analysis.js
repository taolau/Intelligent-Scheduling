import { buildContext } from '../core/substitute.js';
import { loadAll } from '../data/store.js';
import { getWeekStart, getWeekDates, todayStr, toDateStr } from '../core/week.js';

let weekStart = getWeekStart(todayStr());
let resizeHandler = null;

const ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15 18l-6-6 6-6"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M9 18l6-6-6-6"/></svg>';

function btn(text, active = false, icon = '', iconAfter = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = iconAfter ? `<span>${text}</span>${icon}` : `${icon}<span>${text}</span>`;
  b.className = `btn btn-${active ? 'primary' : 'default'}`;
  return b;
}

export async function renderAnalysis(container) {
  if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
  const data = await loadAll();
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const weekSchedules = data.schedules.filter(s => s.date >= weekStart && s.date <= getWeekDates(weekStart)[6]);
  const ctx = buildContext(data.staffs, weekSchedules, data.leaves, projectById);

  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'cal-bar';
  const group = document.createElement('div');
  group.className = 'cal-bar-group';
  const prev = btn('上周', false, ICON_PREV), next = btn('下周', false, ICON_NEXT, true);
  const label = document.createElement('span');
  label.className = 'week-label';
  label.textContent = `${weekStart} ~ ${getWeekDates(weekStart)[6]}`;
  const today = btn('今天');
  group.append(prev, label, next, today);
  bar.append(group);
  container.appendChild(bar);
  prev.onclick = () => { weekStart = shift(weekStart, -7); renderAnalysis(container); };
  next.onclick = () => { weekStart = shift(weekStart, 7); renderAnalysis(container); };
  today.onclick = () => { weekStart = getWeekStart(todayStr()); renderAnalysis(container); };

  const activeStaffs = data.staffs.filter(s => s.status !== 'left');
  const participants = new Set(weekSchedules.flatMap(s => s.staffIds)).size;
  const overCount = activeStaffs.filter(s => (ctx.weeklyFatigue.get(s.id) ?? 0) > s.maxWeeklyFatigue).length;
  const statRow = document.createElement('div');
  statRow.className = 'stat-row';
  statRow.innerHTML = `
    <div class="stat"><div class="stat-value">${weekSchedules.length}</div><div class="stat-label">本周班次</div></div>
    <div class="stat"><div class="stat-value">${participants}</div><div class="stat-label">参与人员</div></div>
    <div class="stat"><div class="stat-value"${overCount ? ' style="color:#dc2626"' : ''}>${overCount}</div><div class="stat-label">疲劳超限</div></div>`;
  container.appendChild(statRow);

  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  container.appendChild(wrap);
  if (activeStaffs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'chart-empty';
    empty.textContent = '暂无人员，请先到配置页添加';
    wrap.appendChild(empty);
    return;
  }
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, canvas.clientWidth);
    const ch = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(canvas, data.staffs, ctx);
  };
  fit();
  requestAnimationFrame(fit);
  resizeHandler = fit;
  window.addEventListener('resize', resizeHandler);
}

function shift(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return getWeekStart(toDateStr(dt));
}

function roundedBar(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
  g.fill();
}

function draw(canvas, staffs, ctx) {
  const g = canvas.getContext('2d');
  const W = Math.max(1, canvas.clientWidth), H = Math.max(1, canvas.clientHeight);
  g.clearRect(0, 0, W, H);
  const active = staffs.filter(s => s.status !== 'left');
  if (active.length === 0) return;
  const sorted = [...active].sort((a, b) => (ctx.weeklyFatigue.get(b.id) ?? 0) - (ctx.weeklyFatigue.get(a.id) ?? 0));
  const pad = { top: 30, right: 20, bottom: 50, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const groupW = innerW / sorted.length;
  const barW = Math.min(30, groupW * 0.35);
  const maxFatigue = Math.max(6, ...sorted.map(s => ctx.weeklyFatigue.get(s.id) ?? 0));
  const maxHeavy = Math.max(1, ...sorted.map(s => ctx.heavyCounts.get(s.id) ?? 0));

  // 网格线
  g.strokeStyle = '#ece7f3';
  g.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const y = pad.top + innerH - (i / 6) * innerH;
    g.beginPath(); g.moveTo(pad.left, y); g.lineTo(W - pad.right, y); g.stroke();
  }

  const fatigueGrad = g.createLinearGradient(0, pad.top, 0, pad.top + innerH);
  fatigueGrad.addColorStop(0, '#b186d6');
  fatigueGrad.addColorStop(1, '#5a1d78');
  const heavyGrad = g.createLinearGradient(0, pad.top, 0, pad.top + innerH);
  heavyGrad.addColorStop(0, '#f87171');
  heavyGrad.addColorStop(1, '#dc2626');

  sorted.forEach((s, i) => {
    const cx = pad.left + groupW * i + groupW / 2;
    const fatigue = ctx.weeklyFatigue.get(s.id) ?? 0;
    const heavy = ctx.heavyCounts.get(s.id) ?? 0;
    // 劳累柱（紫渐变，圆角）
    const fh = (fatigue / maxFatigue) * innerH;
    g.fillStyle = fatigueGrad;
    roundedBar(g, cx - barW - 3, pad.top + innerH - fh, barW, fh, 4);
    // 高强度柱（红渐变，圆角）
    const hh = (heavy / maxHeavy) * innerH;
    g.fillStyle = heavyGrad;
    roundedBar(g, cx + 3, pad.top + innerH - hh, barW, hh, 4);
    // 姓名（超限标红）
    const over = fatigue > s.maxWeeklyFatigue;
    g.fillStyle = over ? '#dc2626' : '#3d3747';
    g.font = over ? 'bold 12px sans-serif' : '12px sans-serif';
    g.textAlign = 'center';
    g.fillText(s.name, cx, H - 20);
    // 数值
    g.fillStyle = '#5a1d78';
    g.font = '11px sans-serif';
    g.fillText(String(fatigue), cx - barW / 2 - 3, pad.top + innerH - fh - 4);
    g.fillStyle = '#dc2626';
    g.fillText(String(heavy), cx + barW / 2 + 3, pad.top + innerH - hh - 4);
    // 超限标注
    if (over) {
      g.fillStyle = '#dc2626';
      g.font = 'bold 12px sans-serif';
      g.fillText('超限', cx, pad.top + 12);
    }
  });
}
