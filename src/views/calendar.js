import { expandWeeks } from '../core/expand.js';
import { filterCandidate } from '../core/filter.js';
import { scoreCandidate } from '../core/score.js';
import { buildContext, recommendSubstitutes } from '../core/substitute.js';
import { getWeekStart, getWeekDates, getWeekLabel, todayStr, toDateStr, weekdayLabel, monthKey, shiftMonth, weeksCovering, inMonth } from '../core/week.js';
import { getCache, saveSchedule, getSettings, removeSchedule } from '../data/store.js';
import { KEYS } from '../data/keys.js';
import { createSchedule, SLOT_LABELS } from '../data/model.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { enableDrag, enableDrop } from '../ui/dnd.js';
import { exportScheduleImage } from '../ui/exportImage.js';
import { createSelect } from '../ui/select.js';
import { field, setError } from '../ui/fields.js';
import { ICON_FIRE } from '../ui/icons.js';

let currentWeekStart = getWeekStart(todayStr());
let timeScale = 'week'; // 'week' 单周 | 'month' 自然月（月锚 monthAnchor = 'YYYY-MM'）
let monthAnchor = todayStr().slice(0, 7);
let data = { projects: [], staffs: [], schedules: [] };
let ctx = null;

// ===== 视图维度（总览/项目/人员），localStorage 持久记忆 =====
let viewMode = 'overview'; // 'overview' | 'project' | 'staff'
let viewTargetId = '';

try {
  const saved = JSON.parse(localStorage.getItem(KEYS.calView) ?? 'null');
  if (saved && ['overview', 'project', 'staff'].includes(saved.mode)) {
    viewMode = saved.mode;
    viewTargetId = saved.id ?? '';
  }
} catch { /* 持久化状态损坏则忽略，回退总览 */ }

try {
  timeScale = JSON.parse(localStorage.getItem(KEYS.calScale) ?? 'null') === 'month' ? 'month' : 'week';
} catch { /* 损坏则忽略，回退周粒度 */ }

function persistViewState() {
  try {
    localStorage.setItem(KEYS.calView, JSON.stringify({ mode: viewMode, id: viewTargetId }));
    localStorage.setItem(KEYS.calScale, JSON.stringify(timeScale));
  } catch { /* 存储不可用时静默 */ }
}

// 侧栏菜单进入时重置为默认视图：周粒度 + 本周 + 总览，维度/粒度记忆一并清除
export function resetCalendarView() {
  currentWeekStart = getWeekStart(todayStr());
  timeScale = 'week';
  monthAnchor = todayStr().slice(0, 7);
  viewMode = 'overview';
  viewTargetId = '';
  try { localStorage.removeItem(KEYS.calView); localStorage.removeItem(KEYS.calScale); } catch { /* 忽略 */ }
}

const ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15 18l-6-6 6-6"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M9 18l6-6-6-6"/></svg>';
const ICON_ZAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>';
const ICON_BULK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>';
const ICON_IMAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
const ICON_TODAY_FLAG = '<svg class="cal-today-flag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block"><path d="M5 21V4"/><path d="M5 4h12l-3 5 3 5H5"/></svg>';
const ICON_ADD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M20 6L9 17l-5-5"/></svg>';

export async function renderCalendar(container) {
  data = getCache();
  // 过滤视图目标已被删除时回退总览（状态是渲染参数而非 DOM 反读，操作后重渲染不丢失维度）
  if (viewMode === 'project' && !data.projects.some(p => p.id === viewTargetId)) { viewMode = 'overview'; viewTargetId = ''; persistViewState(); }
  if (viewMode === 'staff' && !data.staffs.some(s => s.id === viewTargetId)) { viewMode = 'overview'; viewTargetId = ''; persistViewState(); }
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  ctx = buildContext(data.staffs, data.schedules, projectById, getSettings());

  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'cal-bar';
  const left = document.createElement('div');
  left.className = 'cal-bar-group';
  const right = document.createElement('div');
  right.className = 'cal-bar-group';

  // 粒度切换：周（单周精细）/ 月（整月统筹，自然月内面板纵向堆叠）
  const scaleSeg = document.createElement('div');
  scaleSeg.className = 'seg seg-sm';
  for (const [scale, scaleLabel] of [['week', '周'], ['month', '月']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = scaleLabel;
    if (timeScale === scale) b.classList.add('active');
    b.onclick = () => {
      if (timeScale === scale) return;
      switchScale(scale);
      renderCalendar(container);
    };
    scaleSeg.appendChild(b);
  }
  left.appendChild(scaleSeg);

  // 维度切换：总览 / 项目 / 人员
  const seg = document.createElement('div');
  seg.className = 'seg seg-sm';
  for (const [mode, label] of [['overview', '总览'], ['project', '项目'], ['staff', '人员']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (viewMode === mode) b.classList.add('active');
    b.onclick = () => {
      if (viewMode === mode) return;
      viewMode = mode;
      // 切维度时沿用已选目标（仍存在时），否则自动选第一个，避免空选
      if (viewMode === 'project') viewTargetId = data.projects.some(p => p.id === viewTargetId) ? viewTargetId : (data.projects[0]?.id ?? '');
      if (viewMode === 'staff') viewTargetId = data.staffs.some(s => s.id === viewTargetId) ? viewTargetId : (data.staffs[0]?.id ?? '');
      persistViewState();
      renderCalendar(container);
    };
    seg.appendChild(b);
  }
  left.appendChild(seg);

  if (viewMode === 'project') {
    const sel = createSelect({
      options: data.projects.map(p => ({ value: p.id, label: p.name })),
      value: viewTargetId, placeholder: '请选择任务', searchable: true,
    });
    sel.classList.add('cal-dim-select');
    sel.addEventListener('change', () => { viewTargetId = sel.value; persistViewState(); renderCalendar(container); });
    left.appendChild(sel);
  } else if (viewMode === 'staff') {
    const sel = createSelect({
      options: data.staffs.map(s => ({ value: s.id, label: s.name })),
      value: viewTargetId, placeholder: '请选择人员', searchable: true,
    });
    sel.classList.add('cal-dim-select');
    sel.addEventListener('change', () => { viewTargetId = sel.value; persistViewState(); renderCalendar(container); });
    left.appendChild(sel);
  }

  const monthScale = timeScale === 'month';
  const prev = btn(monthScale ? '上月' : '上周', false, false, ICON_PREV);
  const next = btn(monthScale ? '下月' : '下周', false, false, ICON_NEXT, true);
  const label = document.createElement('span');
  label.className = 'week-label';
  label.textContent = monthScale ? monthAnchor : getWeekLabel(currentWeekStart);
  const todayBtn = btn(monthScale ? '本月' : '今天');
  const autoBtn = btn('智能排班', true, false, ICON_ZAP), bulkBtn = btn('批量铺排', false, false, ICON_BULK);
  // 导出图片：直接按钮（无下拉）；周 = 当前周面板，月 = 整月视图长图（含首尾灰显邻月日）
  const exportBtn = btn('导出图片', false, false, ICON_IMAGE);
  left.append(prev, label, next, todayBtn);
  // 人员维度为只读视图：隐藏智能排班/批量铺排（导出仍可用，截图跟随当前视图）
  if (viewMode === 'staff') right.append(exportBtn);
  else right.append(autoBtn, bulkBtn, exportBtn);
  bar.append(left, right);
  container.appendChild(bar);

  prev.onclick = () => navShift(-1);
  next.onclick = () => navShift(1);
  todayBtn.onclick = () => gotoNow();
  autoBtn.onclick = () => smartFill();
  bulkBtn.onclick = () => bulkPlanDialog();
  exportBtn.onclick = async () => {
    const isMonth = timeScale === 'month';
    const content = container.querySelector(isMonth ? '.cal-month-stack' : '.cal-grid');
    if (!content) {
      showToast('当前视图暂无班次，无可导出的排班图', 'error');
      return;
    }
    const viewLabel = viewMode === 'overview' ? '总览'
      : viewMode === 'project' ? `任务：${data.projects.find(p => p.id === viewTargetId)?.name ?? ''}`
      : `人员：${data.staffs.find(s => s.id === viewTargetId)?.name ?? ''}`;
    const scope = viewMode === 'overview' ? '总览'
      : viewMode === 'project' ? `项目·${data.projects.find(p => p.id === viewTargetId)?.name ?? ''}`
      : `人员·${data.staffs.find(s => s.id === viewTargetId)?.name ?? ''}`;
    const cleanName = s => s.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
    const title = isMonth
      ? `${Number(monthAnchor.slice(0, 4))} 年 ${Number(monthAnchor.slice(5))} 月`
      : getWeekLabel(currentWeekStart);
    const filename = `Numbers-排班图-${isMonth ? '月' : '周'}-${cleanName(scope)}-${isMonth ? monthAnchor : currentWeekStart}.png`;
    exportBtn.disabled = true;
    showToast('正在生成图片…');
    try {
      await exportScheduleImage(content, { filename, title, subtitle: viewLabel });
      showToast('排班图已导出', 'success');
    } catch (e) {
      showToast(`导出失败：${e.message}`, 'error');
    } finally {
      exportBtn.disabled = false;
    }
  };

  renderScaleView(container);
}

// 跨粒度切换保持阅读位置：周→月 = 浏览周周四所在月；月→周 = 浏览月 15 号所在周（不跳今天）
function switchScale(next) {
  if (next === 'month') {
    const [y, m, d] = currentWeekStart.split('-').map(Number);
    const thursday = new Date(y, m - 1, d);
    thursday.setDate(thursday.getDate() + 3);
    monthAnchor = monthKey(toDateStr(thursday));
  } else {
    currentWeekStart = getWeekStart(`${monthAnchor}-15`);
  }
  timeScale = next;
  persistViewState();
}

function navShift(dir) {
  if (timeScale === 'week') {
    const [y, m, d] = currentWeekStart.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dir * 7);
    currentWeekStart = getWeekStart(toDateStr(dt));
  } else {
    monthAnchor = shiftMonth(monthAnchor, dir);
  }
  renderCalendar(document.querySelector('#view'));
}

function gotoNow() {
  if (timeScale === 'week') currentWeekStart = getWeekStart(todayStr());
  else monthAnchor = todayStr().slice(0, 7);
  renderCalendar(document.querySelector('#view'));
}

// 内容渲染：周 = 单面板；月 = 覆盖整月的完整自然周面板纵向堆叠
function renderScaleView(container) {
  const today = todayStr();
  const weekStarts = timeScale === 'month' ? weeksCovering(monthAnchor) : [currentWeekStart];
  const dateSet = new Set();
  for (const ws of weekStarts) for (const d of getWeekDates(ws)) dateSet.add(d);

  // 维度过滤：项目=该任务全部班次；人员=该人已排入的班次（只读）
  let visible = data.schedules.filter(s => dateSet.has(s.date));
  let readOnly = false;
  if (viewMode === 'project') visible = visible.filter(s => s.projectId === viewTargetId);
  if (viewMode === 'staff') { visible = visible.filter(s => s.staffIds.includes(viewTargetId)); readOnly = true; }

  // 过滤后整窗为空 → 空态卡片（工具栏保留，可切回）
  if (viewMode !== 'overview' && visible.length === 0) {
    const scope = timeScale === 'month' ? '本月' : '本周';
    const name = viewMode === 'project'
      ? data.projects.find(p => p.id === viewTargetId)?.name
      : data.staffs.find(s => s.id === viewTargetId)?.name;
    const empty = document.createElement('div');
    empty.className = 'cal-empty';
    empty.textContent = viewMode === 'project'
      ? `${scope}暂无「${name}」的班次，可切换周/月或用「批量铺排」生成`
      : `${scope}「${name}」暂无排班`;
    container.appendChild(empty);
    return;
  }

  // 维度摘要行（按当前浏览窗口现算，不依赖 ctx——ctx 窗口轨以今天为锚）
  if (viewMode !== 'overview') container.appendChild(buildDimSummary(visible));

  if (timeScale === 'week') {
    buildGridPanel(container, currentWeekStart, visible, readOnly, null);
    return;
  }

  // 月粒度：逐周面板 + 周范围分隔条；非本月日期灰显（班次照常显示与操作）
  const outSet = new Set();
  for (const ws of weekStarts) {
    for (const d of getWeekDates(ws)) if (!inMonth(d, monthAnchor)) outSet.add(d);
  }
  const stack = document.createElement('div');
  stack.className = 'cal-month-stack';
  weekStarts.forEach((ws, i) => {
    const end = getWeekDates(ws)[6];
    const sep = document.createElement('div');
    sep.className = 'cal-month-sep';
    const no = document.createElement('b');
    no.textContent = `第 ${i + 1} 周`;
    const range = document.createElement('span');
    range.textContent = `${ws} ~ ${end}`;
    sep.append(no, range);
    const panel = document.createElement('div');
    panel.className = 'cal-month-panel';
    const panelScheds = visible.filter(s => s.date >= ws && s.date <= end);
    buildGridPanel(panel, ws, panelScheds, readOnly, outSet);
    stack.append(sep, panel);
  });
  container.appendChild(stack);
}

// 单个完整自然周面板：列 = 周一~周日（date head），行 = 预置时段；月粒度传 outSet（灰显日）
function buildGridPanel(host, weekStart, panelScheds, readOnly, outSet) {
  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const dates = getWeekDates(weekStart);
  const today = todayStr();
  if (readOnly) grid.classList.add('readonly');

  // 按「日期|时段」预分组，避免逐格 O(n²) 过滤
  const byKey = new Map();
  for (const s of panelScheds) {
    const key = `${s.date}|${s.slotLabel}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(s);
  }

  dates.forEach((d, i) => {
    const col = document.createElement('div');
    col.className = 'cal-col';
    if (outSet?.has(d)) col.classList.add('cal-out-month');

    const head = document.createElement('div');
    head.className = `cal-date${d === today ? ' cal-today' : ''}`;
    head.innerHTML = `${weekdayNames[i]}<br><b>${d.slice(5)}</b>`;
    if (d === today) {
      head.title = '今天';
      head.insertAdjacentHTML('beforeend', ICON_TODAY_FLAG);
    }
    if (outSet?.has(d)) head.title = '相邻月份日期，班次照常可操作';
    if (viewMode !== 'staff') { // 人员维度只读，不提供建班次入口
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'cal-add-day';
      addBtn.title = '为此日创建班次';
      addBtn.innerHTML = ICON_ADD;
      addBtn.onclick = () => manualCreate(d, null, viewMode === 'project' ? viewTargetId : null);
      head.appendChild(addBtn);
    }
    col.appendChild(head);

    let dayHasCard = false;
    SLOT_LABELS.forEach((slotLabel, si) => {
      const scheds = byKey.get(`${d}|${slotLabel}`);
      if (!scheds || scheds.length === 0) return;
      dayHasCard = true;
      const slotCard = document.createElement('div');
      slotCard.className = `cal-slot-card cal-slot-${si}`;
      const chip = document.createElement('span');
      chip.className = 'cal-slot-chip';
      chip.textContent = slotLabel;
      slotCard.appendChild(chip);
      for (const sch of scheds) slotCard.appendChild(renderScheduleCard(sch, readOnly));
      col.appendChild(slotCard);
    });

    // 人员维度：当天无班次 → 「未排班」占位，一眼看出空档
    if (readOnly && !dayHasCard) {
      const off = document.createElement('div');
      off.className = 'cal-day-off';
      off.textContent = '未排班';
      col.appendChild(off);
    }

    grid.appendChild(col);
  });
  host.appendChild(grid);
  return grid;
}

function buildDimSummary(visible) {
  const line = document.createElement('div');
  line.className = 'cal-dim-summary';
  if (viewMode === 'project') {
    const p = data.projects.find(x => x.id === viewTargetId);
    const cap = visible.reduce((n, s) => n + (p?.requiredCapacity ?? 1), 0);
    const filled = visible.reduce((n, s) => n + s.staffIds.length, 0);
    const lack = Math.max(0, cap - filled);
    const name = document.createElement('b');
    name.textContent = p?.name ?? viewTargetId;
    const scope = timeScale === 'month' ? '本月' : '本周';
    const info = document.createElement('span');
    info.textContent = `${scope} ${visible.length} 个班次 · 已排 ${filled}/${cap} 人`;
    line.append(name, info);
    const tail = document.createElement('span');
    if (cap > 0 && lack === 0) { tail.className = 's-ok'; tail.textContent = '✓ 已满员'; }
    else if (lack > 0) { tail.className = 's-warn'; tail.textContent = `缺 ${lack} 人`; }
    if (tail.textContent) line.appendChild(tail);
  } else if (viewMode === 'staff') {
    const st = data.staffs.find(x => x.id === viewTargetId);
    let fatigue = 0, heavy = 0;
    for (const s of visible) {
      const f = data.projects.find(p => p.id === s.projectId)?.fatigueScore ?? 0;
      fatigue += f;
      if (f === 3) heavy++;
    }
    const name = document.createElement('b');
    name.textContent = st?.name ?? viewTargetId;
    line.appendChild(name);
    const STATUS_TXT = { new: '新入', rest: '休假中', left: '已退出' };
    if (st && STATUS_TXT[st.status]) {
      const tag = document.createElement('span');
      tag.className = 's-tag';
      tag.textContent = STATUS_TXT[st.status];
      line.appendChild(tag);
    }
    const info = document.createElement('span');
    info.textContent = timeScale === 'month'
      ? `本月 ${visible.length} 个班次 · 疲劳 ${fatigue} · 高强度 ${heavy}`
      : `本周 ${visible.length} 个班次 · 疲劳 ${fatigue}/${st?.maxWeeklyFatigue ?? 0} · 高强度 ${heavy}/${st?.maxHeavyTaskCount ?? 0}`;
    line.appendChild(info);
  }
  return line;
}

function btn(text, active = false, plain = false, icon = '', iconAfter = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = iconAfter ? `<span>${text}</span>${icon}` : `${icon}<span>${text}</span>`;
  b.className = plain ? 'week-label' : `btn btn-${active ? 'primary' : 'default'}`;
  return b;
}

function renderScheduleCard(sch, readOnly = false) {
  const card = document.createElement('div');
  card.className = 'sch-card';
  const project = data.projects.find(p => p.id === sch.projectId);
  const capacity = project?.requiredCapacity ?? 1;
  const filled = sch.staffIds.length;
  if (filled >= capacity) card.classList.add('full');
  else if (filled > 0) card.classList.add('short');
  if (!readOnly) {
    card.title = '点击手动分配人员';
    card.onclick = () => scheduleDialog(sch);
    // 落点精确到卡片：拖到哪张任务卡片，人就进哪个班次（同格多班次不再取第一个）
    enableDrop(card, { onDrop: (e) => dropStaff(e, sch.id) });
  }

  const title = document.createElement('div');
  title.textContent = `${project?.name ?? sch.projectId}`;
  title.className = 'sch-title';
  title.title = `${project?.name ?? sch.projectId}`; // 省略号截断后 hover 看全名
  card.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'sch-meta';
  if (project) {
    if (project.timeRange) {
      const time = document.createElement('span');
      time.className = 'sch-time';
      time.textContent = `${project.timeRange.start}–${project.timeRange.end}`;
      meta.appendChild(time);
    }
    const badge = document.createElement('span');
    badge.className = 'sch-badge';
    badge.innerHTML = ICON_FIRE.repeat(project.fatigueScore);
    badge.title = `劳累指数 ${project.fatigueScore}/3`;
    meta.appendChild(badge);
  }
  card.appendChild(meta);

  const names = document.createElement('div');
  names.className = 'sch-staff';
  for (const sid of sch.staffIds) {
    const staff = data.staffs.find(s => s.id === sid);
    const chip = document.createElement('span');
    chip.className = staffChipClass(staff, sch.date);
    chip.title = staffChipTitle(staff, sch.date);
    chip.append(document.createTextNode(staff?.name ?? sid));
    if (timeScale === 'month' && staff) {
      const mf = document.createElement('i');
      mf.className = 'cal-mfat';
      mf.textContent = ctx.fatigueByMonth.get(`${sid}|${monthKey(sch.date)}`) ?? 0;
      chip.appendChild(mf);
    }
    if (!readOnly) { // 只读视图：不可拖拽，仍可点击人名进入替换弹窗
      enableDrag(chip, { onDragStart: (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ staffId: sid, scheduleId: sch.id })); } });
    }
    chip.onclick = (e) => { e.stopPropagation(); openReplaceDialog(staff, sch); };
    names.appendChild(chip);
  }
  card.appendChild(names);

  if (filled >= capacity) {
    // 满员：底部不展示「已满」，卡片 .full 绿框视觉已表达
  } else {
    const cap = document.createElement('div');
    cap.className = 'sch-capacity';
    cap.textContent = filled === 0 ? `需 ${capacity} 人` : `缺 ${capacity - filled} 人`;
    if (!readOnly) {
      // 底部一行：需/缺 N 人（左）+ 智能排班小图标（右）；闪电与工具栏「智能排班」同款
      // 条件与 fillSchedule 对齐：未满员即逐名额填充，非仅空班次（原 filled===0，手动加 1 人后闪电消失）
      const row = document.createElement('div');
      row.className = 'sch-cap-row';
      const smart = document.createElement('button');
      smart.type = 'button';
      smart.className = 'sch-smart';
      smart.innerHTML = ICON_ZAP;
      smart.title = '智能排班：为本班次自动填充人员';
      smart.onclick = (e) => { e.stopPropagation(); smartFillOne(sch); };
      row.append(cap, smart);
      card.appendChild(row);
    } else {
      card.appendChild(cap);
    }
  }
  return card;
}

// ===== ctx 三轨计数统一增减（窗口/自然周/自然月 + daily/slot）=====
// 视图层所有 ± 计数必须经此入口，手动散写漏轨会造成静默错乱
function applyDelta(ctxObj, sid, sch, sign) {
  const project = data.projects.find(p => p.id === sch.projectId);
  if (!project) return;
  const d = sign * project.fatigueScore;
  if (sch.date >= (ctxObj.fatigueCutoff ?? '')) { // 未来与窗口内班次自然计入均衡轨
    ctxObj.fatigueWindow.set(sid, Math.max(0, (ctxObj.fatigueWindow.get(sid) ?? 0) + d));
  }
  const wk = `${sid}|${getWeekStart(sch.date)}`;
  const mk = `${sid}|${monthKey(sch.date)}`;
  ctxObj.fatigueByWeek.set(wk, Math.max(0, (ctxObj.fatigueByWeek.get(wk) ?? 0) + d));
  ctxObj.fatigueByMonth.set(mk, Math.max(0, (ctxObj.fatigueByMonth.get(mk) ?? 0) + d));
  if (project.fatigueScore === 3) {
    ctxObj.heavyByWeek.set(wk, Math.max(0, (ctxObj.heavyByWeek.get(wk) ?? 0) + sign));
  }
  ctxObj.dailyCounts.set(`${sid}|${sch.date}`, Math.max(0, (ctxObj.dailyCounts.get(`${sid}|${sch.date}`) ?? 0) + sign));
  ctxObj.slotCounts.set(`${sid}|${sch.date}|${sch.slotLabel}`, Math.max(0, (ctxObj.slotCounts.get(`${sid}|${sch.date}|${sch.slotLabel}`) ?? 0) + sign));
}

function cloneCtx(c) {
  return {
    ...c,
    fatigueWindow: new Map(c.fatigueWindow ?? []),
    fatigueByWeek: new Map(c.fatigueByWeek ?? []),
    heavyByWeek: new Map(c.heavyByWeek ?? []),
    fatigueByMonth: new Map(c.fatigueByMonth ?? []),
    dailyCounts: new Map(c.dailyCounts ?? []),
    slotCounts: new Map(c.slotCounts ?? []),
  };
}

function scheduleDialog(sch) {
  const project = data.projects.find(p => p.id === sch.projectId);
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const capacity = project?.requiredCapacity ?? 1;
  const body = document.createElement('div');
  const footer = document.createElement('div');
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn btn-danger';
  delBtn.textContent = '删除班次';
  delBtn.title = '删除该班次，已排人员计数自动回退';
  delBtn.onclick = () => {
    confirmDialog({
      title: '删除班次',
      message: '确认删除该班次？已排人员将从当天任务数与本周疲劳计数中回退。',
      onConfirm: async () => { delBtn.disabled = true; await deleteSchedule(); },
    });
  };
  footer.appendChild(delBtn);
  const modal = openModal({ title: '排班分配', body, footer });

  async function deleteSchedule() {
    for (const sid of sch.staffIds) applyDelta(ctx, sid, sch, -1);
    await removeSchedule(sch.id);
    modal.close();
    showToast('班次已删除', 'success');
    renderCalendar(document.querySelector('#view'));
  }

  function renderBody() {
    body.innerHTML = '';
    const filled = sch.staffIds.length;
    const full = filled >= capacity;

    const head = document.createElement('div');
    head.className = 'asg-head';
    const titleRow = document.createElement('div');
    titleRow.className = 'asg-title';
    titleRow.innerHTML = `<span>${project?.name ?? sch.projectId}</span>${project ? `<span class="sch-badge">${ICON_FIRE.repeat(project.fatigueScore)}</span>` : ''}`;
    const sub = document.createElement('div');
    sub.className = 'asg-sub';
    sub.innerHTML = `${sch.date} · ${sch.slotLabel}${project?.timeRange ? ` · ${project.timeRange.start}–${project.timeRange.end}` : ''}`;
    head.append(titleRow, sub);

    const progress = document.createElement('div');
    progress.className = 'asg-progress';
    const bar = document.createElement('div');
    bar.className = `asg-bar${full ? ' full' : ''}`;
    const fillEl = document.createElement('div');
    fillEl.className = 'asg-fill';
    fillEl.style.width = `${Math.min(100, (filled / capacity) * 100)}%`;
    bar.appendChild(fillEl);
    const label = document.createElement('span');
    label.className = 'asg-progress-label';
    label.textContent = full ? `✓ 已满员 ${filled}/${capacity}` : `已排 ${filled}/${capacity} 人`;
    progress.append(bar, label);

    const filledSec = document.createElement('div');
    filledSec.className = 'asg-section';
    filledSec.textContent = '已排人员';
    const chips = document.createElement('div');
    chips.className = 'asg-chips';
    if (filled === 0) {
      const empty = document.createElement('span');
      empty.className = 'asg-empty';
      empty.textContent = '暂无人员，从下方选择加入';
      chips.appendChild(empty);
    }
    for (const sid of sch.staffIds) {
      const staff = data.staffs.find(s => s.id === sid);
      const chip = document.createElement('span');
      chip.className = 'asg-chip';
      const chipName = document.createElement('span');
      chipName.textContent = staff?.name ?? sid;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'asg-chip-x';
      rm.title = '移除';
      rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      rm.onclick = async () => {
        sch.staffIds = sch.staffIds.filter(id => id !== sid);
        applyDelta(ctx, sid, sch, -1);
        await saveSchedule(sch);
        renderBody();
        renderCalendar(document.querySelector('#view'));
      };
      chip.append(chipName, rm);
      chips.appendChild(chip);
    }

    const listSec = document.createElement('div');
    listSec.className = 'asg-section';
    listSec.textContent = '可选人员';
    const list = document.createElement('div');
    if (full) {
      // 满员：仅显示提示，不渲染候选行（无「＋ 添加」入口）；移除一人后 renderBody 重算即恢复
      const done = document.createElement('div');
      done.className = 'asg-full';
      done.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M20 6L9 17l-5-5"/></svg>本班次已满员';
      list.appendChild(done);
    } else {
      for (const s of data.staffs) {
      if (sch.staffIds.includes(s.id)) continue;
      const res = filterCandidate(s, sch, projectById, ctx);
      const row = document.createElement('div');
      row.className = 'assign-row';
      const name = document.createElement('span');
      name.className = 'assign-name';
      name.textContent = s.name;
      if (s.status === 'new') {
        const tag = document.createElement('span');
        tag.className = 'assign-tag';
        tag.textContent = '新入';
        name.appendChild(tag);
      }
      const info = document.createElement('span');
      info.className = 'assign-info';
      info.textContent = `周疲劳 ${ctx.fatigueByWeek.get(`${s.id}|${getWeekStart(sch.date)}`) ?? 0}/${s.maxWeeklyFatigue}`;
      row.append(name, info);
      if (!res.ok) {
        row.classList.add('blocked');
        const why = document.createElement('span');
        why.className = 'assign-why';
        why.textContent = res.reasons.join('；');
        row.append(why);
      } else {
        row.classList.add('pickable');
        const addHint = document.createElement('span');
        addHint.className = 'assign-add';
        addHint.textContent = '＋ 添加';
        row.appendChild(addHint);
        row.onclick = async () => {
          sch.staffIds.push(s.id);
          applyDelta(ctx, s.id, sch, 1);
          const dailyAfter = ctx.dailyCounts.get(`${s.id}|${sch.date}`) ?? 0;
          await saveSchedule(sch);
          if ((ctx.settings?.warnDailyCount ?? 0) > 0 && dailyAfter >= ctx.settings.warnDailyCount) {
            showToast(`${s.name} 当日已达预警阈值 ${ctx.settings.warnDailyCount} 个任务`, 'info');
          } else {
            showToast(`${s.name} 已加入`, 'success');
          }
          renderBody();
          renderCalendar(document.querySelector('#view'));
        };
      }
      list.appendChild(row);
      }
    }
    body.append(head, progress, filledSec, chips, listSec, list);
  }
  renderBody();
}

function staffChipClass(staff, date) {
  if (!staff) return 'staff-chip';
  if (timeScale === 'month') return 'staff-chip'; // 周上限红黄语义仅周粒度成立（月粒度不判超限）
  const weekKey = `${staff.id}|${getWeekStart(date)}`; // 该班次所在自然周
  const fatigue = ctx.fatigueByWeek.get(weekKey) ?? 0;
  const heavy = ctx.heavyByWeek.get(weekKey) ?? 0;
  const daily = date ? (ctx.dailyCounts?.get(`${staff.id}|${date}`) ?? 0) : 0;
  const warnDaily = ctx.settings?.warnDailyCount ?? 0;
  if (fatigue > staff.maxWeeklyFatigue || heavy > staff.maxHeavyTaskCount) return 'staff-chip over';
  if (daily >= warnDaily || fatigue >= staff.maxWeeklyFatigue * 0.8 || (staff.maxHeavyTaskCount > 0 && heavy >= staff.maxHeavyTaskCount)) return 'staff-chip warn';
  return 'staff-chip';
}

function staffChipTitle(staff, date) {
  if (!staff) return '';
  const daily = date ? (ctx.dailyCounts?.get(`${staff.id}|${date}`) ?? 0) : 0;
  if (timeScale === 'month') {
    const mf = ctx.fatigueByMonth.get(`${staff.id}|${monthKey(date)}`) ?? 0;
    const wk = ctx.fatigueByWeek.get(`${staff.id}|${getWeekStart(date)}`) ?? 0;
    return `本月累计 ${mf} · 本周 ${wk}/${staff.maxWeeklyFatigue} · 当日 ${daily} 个任务`;
  }
  const weekKey = `${staff.id}|${getWeekStart(date)}`;
  const fatigue = ctx.fatigueByWeek.get(weekKey) ?? 0;
  const heavy = ctx.heavyByWeek.get(weekKey) ?? 0;
  return `本周疲劳 ${fatigue}/${staff.maxWeeklyFatigue}，高强度 ${heavy}/${staff.maxHeavyTaskCount}，当日 ${daily} 个任务`;
}

async function dropStaff(e, targetId) {
  const { staffId, scheduleId } = JSON.parse(e.dataTransfer.getData('text/plain'));
  const to = data.schedules.find(s => s.id === targetId);
  if (!to) { showToast('目标班次不存在', 'error'); return; }
  if (scheduleId === to.id) return; // 原地拖放，无操作
  const staff = data.staffs.find(s => s.id === staffId);
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const toProject = data.projects.find(p => p.id === to.projectId);
  const pseudoSchedule = { date: to.date, projectId: to.projectId, slotLabel: to.slotLabel };
  if (to.staffIds.includes(staffId)) { showToast(`${staff?.name ?? staffId} 已在该班次中`, 'info'); return; }

  const from = data.schedules.find(s => s.id === scheduleId);

  // 拖拽是"移动"而非"新增"：校验基于"移走源班次后"的计数快照，避免误报超限
  const ctxAfterMove = cloneCtx(ctx);
  if (from && from.staffIds.includes(staffId)) applyDelta(ctxAfterMove, staffId, from, -1);
  const res = filterCandidate(staff, pseudoSchedule, projectById, ctxAfterMove);
  if (!res.ok) { showToast(res.reasons.join('；'), 'error'); return; }

  if (to.staffIds.length >= (toProject?.requiredCapacity ?? 1)) {
    showToast('目标班次已满员', 'error'); return;
  }

  if (from && from.staffIds.includes(staffId)) {
    from.staffIds = from.staffIds.filter(id => id !== staffId);
    applyDelta(ctx, staffId, from, -1);
    await saveSchedule(from);
  }
  to.staffIds = [...new Set([...to.staffIds, staffId])];
  applyDelta(ctx, staffId, to, 1);
  const dailyAfter = ctx.dailyCounts.get(`${staffId}|${to.date}`) ?? 0;
  if ((ctx.settings?.warnDailyCount ?? 0) > 0 && dailyAfter >= ctx.settings.warnDailyCount) {
    showToast(`${staff.name} 当日已达预警阈值 ${ctx.settings.warnDailyCount} 个任务`, 'info');
  } else {
    showToast(`${staff.name} 已调整至 ${toProject?.name ?? ''} ${to.slotLabel}`, 'success');
  }
  await saveSchedule(to);
  renderCalendar(document.querySelector('#view'));
}

async function fillSchedule(sch) {
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const project = projectById[sch.projectId];
  let filled = 0;
  const warned = [];
  const warnDaily = ctx.settings?.warnDailyCount ?? 0;
  while (sch.staffIds.length < project.requiredCapacity) {
    const candidates = data.staffs
      .filter(s => !sch.staffIds.includes(s.id))
      .map(s => ({ s, res: filterCandidate(s, sch, projectById, ctx) }))
      .filter(x => x.res.ok);
    if (candidates.length === 0) break;
    let best = null;
    for (const c of candidates) {
      const { score } = scoreCandidate(c.s, sch, projectById, ctx);
      if (!best || score > best.score) best = { s: c.s, score };
    }
    sch.staffIds.push(best.s.id);
    applyDelta(ctx, best.s.id, sch, 1);
    const dailyAfter = ctx.dailyCounts.get(`${best.s.id}|${sch.date}`) ?? 0;
    if (warnDaily > 0 && dailyAfter >= warnDaily) warned.push(best.s.id);
    await saveSchedule(sch);
    filled++;
  }
  return { filled, warned };
}

async function smartFillOne(sch) {
  const { filled, warned } = await fillSchedule(sch);
  const warnMsg = warned.map(id => data.staffs.find(s => s.id === id)?.name ?? id).join('、');
  showToast(warnMsg ? `已填充 ${filled} 个名额；${warnMsg} 当日已达预警阈值` : `已填充 ${filled} 个名额`, filled ? 'success' : 'info');
  renderCalendar(document.querySelector('#view'));
}

async function smartFill() {
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  let empties = data.schedules.filter(s => s.staffIds.length < (projectById[s.projectId]?.requiredCapacity ?? 1));
  if (viewMode === 'project') empties = empties.filter(s => s.projectId === viewTargetId); // 项目维度下只填当前任务
  empties.sort((a, b) => a.date.localeCompare(b.date)
    || (a.slotLabel === '自主安排' ? 1 : 0) - (b.slotLabel === '自主安排' ? 1 : 0)
    || SLOT_LABELS.indexOf(a.slotLabel) - SLOT_LABELS.indexOf(b.slotLabel));
  let filled = 0;
  const warnedAll = new Set();
  for (const sch of empties) {
    const { filled: f, warned } = await fillSchedule(sch);
    filled += f;
    warned.forEach(id => warnedAll.add(id));
  }
  const scopeName = viewMode === 'project' ? (data.projects.find(p => p.id === viewTargetId)?.name ?? '') : '';
  const scopeTxt = scopeName ? `已为「${scopeName}」填充` : '智能排班完成：填充';
  const warnMsg = [...warnedAll].map(id => data.staffs.find(s => s.id === id)?.name ?? id).join('、');
  const msg = warnMsg ? `${scopeTxt} ${filled} 个名额；${warnMsg} 当日已达预警阈值` : `${scopeTxt} ${filled} 个名额`;
  showToast(msg, filled ? 'success' : 'info');
  renderCalendar(document.querySelector('#view'));
}

function openReplaceDialog(staff, sch) {
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const STATUS_TXT = { new: '新入', rest: '休假中', left: '已退出' };
  const body = document.createElement('div');

  const daySchedules = data.schedules.filter(s => s.date === sch.date && s.staffIds.includes(staff.id));
  // 按时段行序（自主安排/早/中/晚，同周历网格）排序，同段保持原序
  daySchedules.sort((a, b) => SLOT_LABELS.indexOf(a.slotLabel) - SLOT_LABELS.indexOf(b.slotLabel));

  // —— 头部：被替换人信息 ——
  const head = document.createElement('div');
  head.className = 'rpl-head';
  const who = document.createElement('div');
  who.className = 'rpl-who';
  const nameEl = document.createElement('span');
  nameEl.textContent = staff.name;
  who.appendChild(nameEl);
  if (STATUS_TXT[staff.status]) {
    const tag = document.createElement('span');
    tag.className = 'assign-tag';
    tag.textContent = STATUS_TXT[staff.status];
    who.appendChild(tag);
  }
  const meta = document.createElement('div');
  meta.className = 'rpl-meta';
  meta.append(`今日 ${daySchedules.length} 个班次 · 周劳累积分 `);
  const fat = document.createElement('span');
  const refreshFat = () => {
    const v = ctx.fatigueByWeek.get(`${staff.id}|${getWeekStart(sch.date)}`) ?? 0;
    fat.textContent = `${v}/${staff.maxWeeklyFatigue}`;
    fat.className = 'rpl-fatigue' + (v > staff.maxWeeklyFatigue ? ' over' : '');
  };
  meta.appendChild(fat);
  refreshFat();
  head.append(who, meta);
  body.appendChild(head);

  if (daySchedules.length === 0) {
    const none = document.createElement('div');
    none.className = 'asg-empty';
    none.textContent = '当天没有排班';
    body.appendChild(none);
  }

  openModal({ title: '人员替换', body });

  function renderGroup(container, s) {
    const project = projectById[s.projectId];
    const group = document.createElement('div');
    group.className = 'rpl-group';
    const gTitle = document.createElement('div');
    gTitle.className = 'rpl-group-title';
    const dt = document.createElement('span');
    dt.className = 'rpl-date';
    dt.textContent = `${weekdayLabel(s.date)} · ${s.date.slice(5)}`;
    const slotTag = document.createElement('span');
    slotTag.className = 'rpl-slot';
    slotTag.textContent = s.slotLabel;
    const task = document.createElement('span');
    task.className = 'rpl-task';
    task.textContent = project?.name ?? s.projectId;
    gTitle.append(dt, slotTag, task);
    const list = document.createElement('div');
    list.className = 'rpl-list';
    group.append(gTitle, list);

    function renderCandidates() {
      list.innerHTML = '';
      const recom = recommendSubstitutes(data.staffs, s, projectById, ctx, staff.id);
      if (recom.length === 0) {
        const none = document.createElement('div');
        none.className = 'asg-empty';
        none.textContent = '暂无可用替补人员';
        list.appendChild(none);
        return;
      }
      recom.forEach((r, i) => {
        const card = document.createElement('div');
        card.className = 'rpl-cand';
        const main = document.createElement('div');
        main.className = 'rpl-cand-main';
        const nm = document.createElement('span');
        nm.className = 'rpl-cand-name';
        nm.textContent = r.staff.name;
        const score = document.createElement('span');
        score.className = 'rpl-cand-score' + (i === 0 ? ' top' : '');
        score.textContent = `${Math.round(r.score)} 分`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rpl-cand-btn';
        btn.textContent = '选此替补';
        main.append(nm, score, btn);
        card.appendChild(main);
        if (r.reasons.length > 0) {
          const why = document.createElement('div');
          why.className = 'rpl-cand-why';
          why.textContent = r.reasons.join('；');
          card.appendChild(why);
        }
        async function replace() {
          // 一减一增：移除被替换者计数、累加替补者计数，ctx 同步防算法层计数错乱
          applyDelta(ctx, staff.id, s, -1);
          applyDelta(ctx, r.staff.id, s, 1);
          s.staffIds = s.staffIds.filter(id => id !== staff.id);
          s.staffIds.push(r.staff.id);
          await saveSchedule(s);

          // 整组折叠为完成条（done 标记供后续替换跳过重算），释放纵向空间
          group.classList.add('done');
          group.innerHTML = '';
          const bar = document.createElement('div');
          bar.className = 'rpl-done-bar';
          const barInfo = document.createElement('span');
          barInfo.className = 'rpl-done-info';
          barInfo.textContent = `${weekdayLabel(s.date)} · ${s.date.slice(5)} · ${s.slotLabel} · ${project?.name ?? s.projectId}`;
          const ok = document.createElement('span');
          ok.className = 'rpl-done-ok';
          const nameSpan = document.createElement('span');
          nameSpan.textContent = r.staff.name;
          const iconEl = document.createElement('span');
          iconEl.innerHTML = ICON_CHECK;
          ok.append(iconEl, `已由 `, nameSpan, ` 替换`);
          bar.append(barInfo, ok);
          group.appendChild(bar);

          refreshFat();
          showToast(`已由 ${r.staff.name} 替换`, 'success');
          renderCalendar(document.querySelector('#view'));
          // 其余未替换组的候选基于旧 ctx 计算，替换后可能过期（如替补者当日已达上限），重算
          for (const other of container.children) {
            if (other !== group && !other.classList.contains('done')) other._rerender?.();
          }
        }
        card.onclick = replace;
        btn.onclick = (e) => { e.stopPropagation(); replace(); };
        list.appendChild(card);
      });
    }
    renderCandidates();
    group._rerender = renderCandidates;
    container.appendChild(group);
  }

  for (const s of daySchedules) renderGroup(body, s);
}

function manualCreate(date, slotLabel, presetProjectId) {
  const body = document.createElement('div');

  const dateInput = document.createElement('input');
  dateInput.className = 'input';
  dateInput.type = 'date';
  dateInput.value = date ?? currentWeekStart;
  const dateF = field({ label: '日期', required: true, control: dateInput });
  // hint 实时回显星期，核对所选日期（field 未传 hint 不创建元素，手动插入 err 之前）
  const dateHint = document.createElement('div');
  dateHint.className = 'hint';
  dateF.wrap.insertBefore(dateHint, dateF.err);
  const syncDateHint = () => { dateHint.textContent = dateInput.value ? weekdayLabel(dateInput.value) : ''; };
  syncDateHint();
  dateInput.addEventListener('change', syncDateHint);

  // 时段：四 chip 单选点选（与配置页时段 chip 同构）
  const slotWrap = document.createElement('div');
  slotWrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  let slotValue = slotLabel ?? SLOT_LABELS[0];
  for (const label of SLOT_LABELS) {
    const lab = document.createElement('label');
    lab.className = 'day-chip';
    const rb = document.createElement('input');
    rb.type = 'radio';
    rb.name = 'mc-slot';
    rb.value = label;
    rb.checked = label === slotValue;
    lab.classList.toggle('on', rb.checked);
    rb.onchange = () => {
      slotValue = label;
      slotWrap.querySelectorAll('.day-chip').forEach(c => c.classList.toggle('on', c.querySelector('input').checked));
    };
    lab.append(rb, document.createTextNode(label));
    slotWrap.appendChild(lab);
  }
  const slotF = field({ label: '时段', required: true, control: slotWrap });

  // 任务：可搜索下拉；无任务时引导先去配置页
  const noProjects = data.projects.length === 0;
  const projSel = createSelect({
    options: data.projects.map((p) => ({ value: p.id, label: p.name })),
    value: presetProjectId || data.projects[0]?.id || '',
    placeholder: '请选择任务',
    searchable: true,
  });
  const projF = field({
    label: '任务',
    required: true,
    control: projSel,
    hint: noProjects ? '暂无任务，请先到「数据配置」页添加任务' : '',
  });

  body.append(dateF.wrap, slotF.wrap, projF.wrap);

  const footer = document.createElement('div');
  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn-primary';
  okBtn.textContent = '创建';
  if (noProjects) okBtn.disabled = true;
  footer.appendChild(okBtn);
  const modal = openModal({ title: '手动建班次', body, footer });
  okBtn.onclick = async () => {
    const dateVal = dateInput.value;
    const projectId = projSel.value;
    let valid = true;
    if (!dateVal) { setError(dateF, '请选择日期'); valid = false; } else setError(dateF, '');
    if (!projectId) { setError(projF, '请选择任务'); valid = false; } else setError(projF, '');
    if (!valid) return;
    const sch = createSchedule({ date: dateVal, slotLabel: slotValue, projectId });
    await saveSchedule(sch);
    modal.close();
    const project = data.projects.find(p => p.id === projectId);
    showToast(`已创建班次：${weekdayLabel(dateVal)} ${dateVal.slice(5)} · ${slotValue} · ${project?.name ?? projectId}`, 'success');
    // 目标不在当前浏览粒度范围时跟随跳转，创建即所见（周=所在周；月=所在月）
    if (timeScale === 'month') {
      const mk = monthKey(dateVal);
      if (mk !== monthAnchor) monthAnchor = mk;
    } else {
      const weekOf = getWeekStart(dateVal);
      if (weekOf !== currentWeekStart) currentWeekStart = weekOf;
    }
    renderCalendar(document.querySelector('#view'));
  };
}

function bulkPlanDialog() {
  const body = document.createElement('div');
  const hint = document.createElement('p');
  hint.style.cssText = 'margin-bottom:10px;color:#6a6178;font-size:13px;';
  hint.textContent = '按各任务的重复规则，从当前浏览位置所在周开始向后展开班次空壳（不分配人员，已存在的自动跳过）。';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;';
  row.appendChild(document.createTextNode('铺排周数'));
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'number';
  input.min = '1';
  input.max = '4';
  input.value = '2';
  input.style.maxWidth = '90px';
  row.appendChild(input);
  body.append(hint, row);

  const footer = document.createElement('div');
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'btn btn-primary';
  ok.textContent = '开始铺排';
  footer.appendChild(ok);
  const modal = openModal({ title: '批量铺排未来 N 周', body, footer });
  ok.onclick = async () => {
    const n = Math.min(Math.max(parseInt(input.value, 10) || 1, 1), 4);
    // 项目维度下只铺排当前任务
    const scopeProjects = viewMode === 'project' ? data.projects.filter(p => p.id === viewTargetId) : data.projects;
    // 起点 = 当前浏览锚点对应周的周一（周粒度 = 当前周；月粒度 = 月初所在周）
    const planStart = timeScale === 'month' ? weeksCovering(monthAnchor)[0] : currentWeekStart;
    const expected = expandWeeks(scopeProjects, planStart, n, createSchedule);
    const existing = new Set(data.schedules.map(s => `${s.date}|${s.projectId}|${s.slotLabel}`));
    let created = 0;
    for (const sch of expected) {
      if (!existing.has(`${sch.date}|${sch.projectId}|${sch.slotLabel}`)) {
        await saveSchedule(sch);
        created++;
      }
    }
    data = getCache();
    modal.close();
    showToast(`已铺排 ${n} 周、新建 ${created} 个班次`, created ? 'success' : 'info');
    renderCalendar(document.querySelector('#view'));
  };
}
