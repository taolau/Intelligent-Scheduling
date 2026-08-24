import { buildContext } from '../core/substitute.js';
import { loadAll } from '../data/store.js';
import { getWeekStart, getWeekDates } from '../core/week.js';

let weekStart = getWeekStart(new Date().toISOString().slice(0, 10));

export async function renderAnalysis(container) {
  const data = await loadAll();
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const weekSchedules = data.schedules.filter(s => s.date >= weekStart && s.date <= getWeekDates(weekStart)[6]);
  const ctx = buildContext(data.staffs, weekSchedules, data.leaves, projectById);

  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:12px;';
  const prev = document.createElement('button'), next = document.createElement('button');
  prev.type = 'button'; next.type = 'button';
  prev.className = 'btn btn-default'; next.className = 'btn btn-default';
  prev.textContent = '← 上周'; next.textContent = '下周 →';
  const label = document.createElement('span');
  label.className = 'week-label';
  label.textContent = `${weekStart} ~ ${getWeekDates(weekStart)[6]}`;
  bar.append(prev, label, next);
  container.appendChild(bar);
  prev.onclick = () => { weekStart = shift(weekStart, -7); renderAnalysis(container); };
  next.onclick = () => { weekStart = shift(weekStart, 7); renderAnalysis(container); };

  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 400;
  container.appendChild(canvas);
  draw(canvas, data.staffs, ctx);
}

function shift(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return getWeekStart(dt.toISOString().slice(0, 10));
}

function draw(canvas, staffs, ctx) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  const active = staffs.filter(s => s.status !== 'left');
  if (active.length === 0) return;
  const sorted = [...active].sort((a, b) => (ctx.weeklyFatigue.get(b.id) ?? 0) - (ctx.weeklyFatigue.get(a.id) ?? 0));
  const pad = { top: 30, right: 20, bottom: 50, left: 40 };
  const innerW = canvas.width - pad.left - pad.right;
  const innerH = canvas.height - pad.top - pad.bottom;
  const groupW = innerW / sorted.length;
  const barW = Math.min(30, groupW * 0.35);
  const maxFatigue = Math.max(6, ...sorted.map(s => ctx.weeklyFatigue.get(s.id) ?? 0));
  const maxHeavy = Math.max(1, ...sorted.map(s => ctx.heavyCounts.get(s.id) ?? 0));

  // 网格线
  g.strokeStyle = '#eee';
  for (let i = 0; i <= 6; i++) {
    const y = pad.top + innerH - (i / 6) * innerH;
    g.beginPath(); g.moveTo(pad.left, y); g.lineTo(canvas.width - pad.right, y); g.stroke();
  }

  sorted.forEach((s, i) => {
    const cx = pad.left + groupW * i + groupW / 2;
    const fatigue = ctx.weeklyFatigue.get(s.id) ?? 0;
    const heavy = ctx.heavyCounts.get(s.id) ?? 0;
    // 劳累柱（蓝）
    const fh = (fatigue / maxFatigue) * innerH;
    g.fillStyle = '#2563eb';
    g.fillRect(cx - barW - 3, pad.top + innerH - fh, barW, fh);
    // 高强度柱（红）
    const hh = (heavy / maxHeavy) * innerH;
    g.fillStyle = '#dc2626';
    g.fillRect(cx + 3, pad.top + innerH - hh, barW, hh);
    // 姓名
    g.fillStyle = '#222';
    g.font = '12px sans-serif';
    g.textAlign = 'center';
    g.fillText(s.name, cx, canvas.height - 20);
    // 数值
    g.fillStyle = '#2563eb';
    g.fillText(String(fatigue), cx - barW / 2 - 3, pad.top + innerH - fh - 4);
    g.fillStyle = '#dc2626';
    g.fillText(String(heavy), cx + barW / 2 + 3, pad.top + innerH - hh - 4);
    // 超限标注
    if (fatigue > s.maxWeeklyFatigue) {
      g.fillStyle = '#dc2626';
      g.font = 'bold 12px sans-serif';
      g.fillText('超限', cx, pad.top + 12);
    }
  });
}
