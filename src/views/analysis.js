import { getCache } from '../data/store.js';
import { getWeekStart, getWeekLabel, todayStr, toDateStr, weekdayLabel, parseDate } from '../core/week.js';

let mode = 'week'; // day | week | month
let anchor = anchorStart(mode, todayStr()); // 窗口首日（day/week 为日期串，month 恒为 yyyy-mm-01）
let resizeHandler = null;

// 侧栏菜单进入时重置为默认视图：周粒度 + 本周窗口
export function resetAnalysisView() {
  mode = 'week';
  anchor = anchorStart(mode, todayStr());
}

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
  const data = getCache();
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const { start, end } = windowRange(mode, anchor);
  const windowSchedules = data.schedules.filter(s => s.date >= start && s.date <= end);
  // 窗口内每人劳累积分（窗口班次已按粒度滤好，本地聚合；不依赖算法 ctx 的窗口轨）
  const winFat = new Map();
  for (const s of windowSchedules) {
    const f = projectById[s.projectId]?.fatigueScore ?? 0;
    for (const sid of s.staffIds) winFat.set(sid, (winFat.get(sid) ?? 0) + f);
  }

  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'cal-bar';

  const seg = document.createElement('div');
  seg.className = 'seg';
  [['day', '日'], ['week', '周'], ['month', '月']].forEach(([key, text]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.classList.toggle('active', key === mode);
    b.onclick = () => {
      if (key === mode) return;
      const center = windowCenter(mode, anchor);
      mode = key;
      anchor = anchorStart(mode, center);
      renderAnalysis(container);
    };
    seg.appendChild(b);
  });

  const group = document.createElement('div');
  group.className = 'cal-bar-group';
  const prev = btn('上一个', false, ICON_PREV), next = btn('下一个', false, ICON_NEXT, true);
  const label = document.createElement('span');
  label.className = 'week-label';
  label.textContent = windowLabel(mode, anchor);
  const today = btn(mode === 'day' ? '今天' : mode === 'week' ? '本周' : '本月');
  group.append(prev, label, next, today);
  bar.append(seg, group);
  container.appendChild(bar);
  prev.onclick = () => { anchor = shiftAnchor(mode, anchor, -1); renderAnalysis(container); };
  next.onclick = () => { anchor = shiftAnchor(mode, anchor, 1); renderAnalysis(container); };
  today.onclick = () => { anchor = anchorStart(mode, todayStr()); renderAnalysis(container); };

  const activeStaffs = data.staffs.filter(s => s.status !== 'left');
  const participants = new Set(windowSchedules.flatMap(s => s.staffIds)).size;
  const statRow = document.createElement('div');
  statRow.className = 'stat-row';
  if (mode === 'week') {
    const overCount = activeStaffs.filter(s => (winFat.get(s.id) ?? 0) > s.maxWeeklyFatigue).length;
    statRow.innerHTML = `
      <div class="stat"><div class="stat-value">${windowSchedules.length}</div><div class="stat-label">本周班次</div></div>
      <div class="stat"><div class="stat-value">${participants}</div><div class="stat-label">参与人员</div></div>
      <div class="stat"><div class="stat-value"${overCount ? ' style="color:#dc2626"' : ''}>${overCount}</div><div class="stat-label">疲劳超限</div></div>`;
  } else {
    statRow.innerHTML = `
      <div class="stat"><div class="stat-value">${windowSchedules.length}</div><div class="stat-label">${mode === 'day' ? '本日班次' : '本月班次'}</div></div>
      <div class="stat"><div class="stat-value">${participants}</div><div class="stat-label">参与人员</div></div>`;
  }
  container.appendChild(statRow);

  const card = document.createElement('div');
  card.className = 'chart-card';
  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.innerHTML = `
    <span class="lg-item"><i class="lg-swatch lg-fatigue"></i>累计劳累积分</span>`;
  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  card.append(legend, wrap);
  container.appendChild(card);
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
    draw(canvas, data.staffs, winFat, mode === 'week');
  };
  fit();
  requestAnimationFrame(fit);
  resizeHandler = fit;
  window.addEventListener('resize', resizeHandler);
}

function addDays(dateStr, n) {
  const dt = parseDate(dateStr);
  dt.setDate(dt.getDate() + n);
  return toDateStr(dt);
}

// 某日期所属窗口的首日：日=当天 / 周=周一起 / 月=当月 1 号（yyyy-mm-01）
function anchorStart(m, dateStr) {
  if (m === 'day') return dateStr;
  if (m === 'week') return getWeekStart(dateStr);
  return dateStr.slice(0, 7) + '-01';
}

function shiftAnchor(m, a, dir) {
  if (m === 'day') return addDays(a, dir);
  if (m === 'week') return addDays(a, dir * 7);
  const [y, mo] = a.slice(0, 7).split('-').map(Number);
  const dt = new Date(y, mo - 1 + dir, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
}

// 窗口视觉中心日（用于跨粒度换算保持阅读位置）：日=当天 / 周=周四 / 月=15 号
function windowCenter(m, a) {
  if (m === 'day') return a;
  if (m === 'week') return addDays(a, 3);
  return addDays(a, 14);
}

function windowRange(m, a) {
  if (m === 'day') return { start: a, end: a };
  if (m === 'week') return { start: a, end: addDays(a, 6) };
  const [y, mo] = a.slice(0, 7).split('-').map(Number);
  return { start: a, end: toDateStr(new Date(y, mo, 0)) };
}

function windowLabel(m, a) {
  if (m === 'day') return `${a} · ${weekdayLabel(a)}`;
  if (m === 'week') return getWeekLabel(a);
  return a.slice(0, 7);
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

function draw(canvas, staffs, winFat, checkLimit) {
  const g = canvas.getContext('2d');
  const W = Math.max(1, canvas.clientWidth), H = Math.max(1, canvas.clientHeight);
  g.clearRect(0, 0, W, H);
  const active = staffs.filter(s => s.status !== 'left');
  if (active.length === 0) return;
  const sorted = [...active].sort((a, b) => (winFat.get(b.id) ?? 0) - (winFat.get(a.id) ?? 0));
  const pad = { top: 26, right: 20, bottom: 50, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const groupW = innerW / sorted.length;
  const barW = Math.min(34, groupW * 0.4);
  // 纵轴整数刻度：默认 0-6，数据超限自动扩到 8/10/12…
  const rawMax = Math.max(6, ...sorted.map(s => winFat.get(s.id) ?? 0));
  const NICE = [[6, 6], [8, 4], [10, 5], [12, 6], [16, 4], [20, 5], [24, 6], [30, 6], [36, 6], [48, 8], [60, 10]];
  const [axisMax, divisions] = NICE.find(([m]) => rawMax <= m) ?? [Math.ceil(rawMax / 10) * 10, 10];

  // 网格线（虚线）+ 左侧刻度数值
  g.font = '10px sans-serif';
  g.textAlign = 'right';
  for (let i = 1; i <= divisions; i++) {
    const y = pad.top + innerH - (i / divisions) * innerH;
    g.strokeStyle = '#ece7f3';
    g.lineWidth = 1;
    g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(pad.left, y); g.lineTo(W - pad.right, y); g.stroke();
    g.fillStyle = '#9b91a7';
    g.fillText(String((axisMax / divisions) * i), pad.left - 6, y + 3);
  }
  g.setLineDash([]);
  // 底部基线
  g.strokeStyle = '#e0d2ef';
  g.beginPath(); g.moveTo(pad.left, pad.top + innerH); g.lineTo(W - pad.right, pad.top + innerH); g.stroke();

  const fatigueGrad = g.createLinearGradient(0, pad.top, 0, pad.top + innerH);
  fatigueGrad.addColorStop(0, '#fbbf24');
  fatigueGrad.addColorStop(1, '#d97706');

  sorted.forEach((s, i) => {
    const cx = pad.left + groupW * i + groupW / 2;
    const fatigue = winFat.get(s.id) ?? 0;
    const over = checkLimit && fatigue > s.maxWeeklyFatigue;
    // 劳累柱（黄渐变，圆角）——全图唯一柱，高度即积分
    const fh = (fatigue / axisMax) * innerH;
    const barTop = pad.top + innerH - fh;
    g.fillStyle = fatigueGrad;
    roundedBar(g, cx - barW / 2, barTop, barW, fh, 4);
    // 姓名（超限标红）
    g.fillStyle = over ? '#dc2626' : '#3d3747';
    g.font = over ? 'bold 12px sans-serif' : '12px sans-serif';
    g.textAlign = 'center';
    g.fillText(s.name, cx, H - 20);
    // 柱顶：超限红章或积分数值
    g.textAlign = 'center';
    if (over) {
      g.font = 'bold 10px sans-serif';
      const bw = g.measureText('超限').width + 10;
      g.fillStyle = '#dc2626';
      roundedBar(g, cx - bw / 2, barTop - 18, bw, 15, 7.5);
      g.fillStyle = '#fff';
      g.fillText('超限', cx, barTop - 7);
    } else {
      g.fillStyle = '#5a1d78';
      g.font = '11px sans-serif';
      g.fillText(String(fatigue), cx, barTop - 4);
    }
  });
}
