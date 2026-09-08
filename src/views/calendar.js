import { expandWeeks, previewExpand } from '../core/expand.js';
import { filterCandidate, checkAvailability } from '../core/filter.js';
import { scoreCandidate } from '../core/score.js';
import { buildContext, recommendSubstitutes, narrateReasons, cloneCtx, splitEligible } from '../core/substitute.js';
import { simulateAutoFill, accumulateDelta } from '../core/auto.js';
import { getWeekStart, getWeekDates, getWeekLabel, todayStr, toDateStr, weekdayLabel, monthKey, shiftMonth, weeksCovering, inMonth } from '../core/week.js';
import { getCache, saveSchedule, saveSchedules, getSettings, removeSchedule } from '../data/store.js';
import { KEYS } from '../data/keys.js';
import { createSchedule, SLOT_LABELS, monthlyFatigueLimitOf, monthlyHeavyLimitOf } from '../data/model.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { enableDrag, enableDrop } from '../ui/dnd.js';
import { exportScheduleImage, exportTaskViewImage } from '../ui/exportImage.js';
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
let staffTagFilter = []; // 人员维度标签多选过滤（页内临时态，不持久记忆）

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
  staffTagFilter = [];
  try { localStorage.removeItem(KEYS.calView); localStorage.removeItem(KEYS.calScale); } catch { /* 忽略 */ }
}

const ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15 18l-6-6 6-6"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M9 18l6-6-6-6"/></svg>';
const ICON_ZAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>';
const ICON_BULK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
const ICON_IMAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
const ICON_TODAY_FLAG = '<svg class="cal-today-flag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block"><path d="M5 21V4"/><path d="M5 4h12l-3 5 3 5H5"/></svg>';
const ICON_ADD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_DAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>';

export async function renderCalendar(container, opts = {}) {
  // 批量删除多选态：任何外部触发/重渲染自动退出（本态进入/退出自渲染走 opts.keepBatch）
  if (batchDeleteActive && !opts.keepBatch) exitBatchState();
  data = getCache();
  // 过滤视图目标已被删除时回退总览（状态是渲染参数而非 DOM 反读，操作后重渲染不丢失维度）
  if (viewMode === 'project' && !data.projects.some(p => p.id === viewTargetId)) { viewMode = 'overview'; viewTargetId = ''; persistViewState(); }
  if (viewMode === 'staff' && !data.staffs.some(s => s.id === viewTargetId)) { viewMode = 'overview'; viewTargetId = ''; persistViewState(); }
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  ctx = buildContext(data.staffs, data.schedules, projectById, getSettings());

  // 人员维度可选池：标签多选过滤（与关系，页内临时态）；目标被过滤出候选时自动回退过滤首位（无匹配清空）
  let staffPool = data.staffs;
  const allTags = [...new Set(data.staffs.flatMap(s => s.tags ?? []))].sort((a, b) => a.localeCompare(b, 'zh'));
  if (staffTagFilter.length && !staffTagFilter.every(t => allTags.includes(t))) staffTagFilter = [];
  if (staffTagFilter.length) {
    staffPool = data.staffs.filter(s => staffTagFilter.every(t => (s.tags ?? []).includes(t)));
    if (viewMode === 'staff' && viewTargetId && !staffPool.some(s => s.id === viewTargetId)) {
      viewTargetId = staffPool[0]?.id ?? '';
      persistViewState();
    }
  }

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
      staffTagFilter = []; // 标签过滤是人员维度专属页内态，切走即清
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
      options: staffPool.map(s => ({ value: s.id, label: s.name })),
      value: viewTargetId, placeholder: '请选择人员', searchable: true,
    });
    sel.classList.add('cal-dim-select');
    sel.addEventListener('change', () => { viewTargetId = sel.value; persistViewState(); renderCalendar(container); });
    left.appendChild(sel);
    if (allTags.length) {
      const tagSel = createSelect({
        multiple: true,
        placeholder: '按标签筛',
        options: allTags.map(t => ({ value: t, label: t })),
        value: staffTagFilter,
      });
      tagSel.classList.add('cal-dim-tag');
      tagSel.title = '按标签过滤可选人员（可多选）';
      tagSel.addEventListener('change', () => { staffTagFilter = tagSel.value; renderCalendar(container); });
      left.appendChild(tagSel);
    }
  }

  const monthScale = timeScale === 'month';
  const prev = btn(monthScale ? '上月' : '上周', false, false, ICON_PREV);
  const next = btn(monthScale ? '下月' : '下周', false, false, ICON_NEXT, true);
  const label = document.createElement('span');
  label.className = 'week-label';
  label.textContent = monthScale ? monthAnchor : getWeekLabel(currentWeekStart);
  const todayBtn = btn(monthScale ? '本月' : '本周');
  const autoBtn = btn('智能排班', true, false, ICON_ZAP), bulkBtn = btn('批量铺排', false, false, ICON_BULK);
  autoBtn.className = 'btn btn-soft'; // 主操作淡紫款（同备份导出钮/替换确认钮），工具栏其余为 btn-default 白款
  const delBatchBtn = btn('批量删除', false, false, ICON_TRASH);
  // 导出图片：直接按钮（无下拉）；周 = 当前周面板，月 = 整月视图长图（含首尾灰显邻月日）
  const exportBtn = btn('导出图片', false, false, ICON_IMAGE);
  left.append(prev, label, next, todayBtn);
  // 人员维度为只读视图：隐藏 智能排班/批量铺排/批量删除（导出仍可用，截图跟随当前视图）
  if (viewMode === 'staff') right.append(exportBtn);
  else right.append(autoBtn, bulkBtn, delBatchBtn, exportBtn);
  bar.append(left, right);
  container.appendChild(bar);
  if (batchDeleteActive) container.appendChild(buildBatchBar());

  prev.onclick = () => navShift(-1);
  next.onclick = () => navShift(1);
  todayBtn.onclick = () => gotoNow();
  autoBtn.onclick = () => smartPlanDialog();
  delBatchBtn.onclick = () => {
    batchDeleteActive = true;
    batchSel.clear();
    renderCalendar(container, { keepBatch: true });
    // 当前可见区无可删班次（空周/空月/空态）→ 退出并提示，避免空选择态
    if (!document.querySelectorAll('.cal-slot-card .sch-card.selectable').length) {
      exitBatchState();
      renderCalendar(container);
      showToast('当前视图没有可删除的班次', 'info');
    }
  };
  bulkBtn.onclick = () => bulkPlanDialog();
  exportBtn.onclick = async () => {
    const isMonth = timeScale === 'month';
    const content = container.querySelector(isMonth ? '.cal-month-stack' : '.cal-grid');
    if (!content) {
      showToast('当前视图暂无班次，无可导出的排班图', 'error');
      return;
    }
    const { label: viewLabel, scope } = viewLabels();
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

// 粒度切换回默认锚（不沿用另一粒度的浏览位置）：周 = 本周；月 = 本月
function switchScale(next) {
  if (next === 'month') monthAnchor = todayStr().slice(0, 7);
  else currentWeekStart = getWeekStart(todayStr());
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

// 维度展示文案（工具栏导出/当日弹窗共用）：label = 人话副题，scope = 导出文件名段
function viewLabels() {
  if (viewMode === 'overview') return { label: '总览', scope: '总览' };
  const isProj = viewMode === 'project';
  const name = isProj
    ? data.projects.find(p => p.id === viewTargetId)?.name
    : data.staffs.find(s => s.id === viewTargetId)?.name;
  return isProj
    ? { label: `任务：${name ?? ''}`, scope: `项目·${name ?? ''}` }
    : { label: `人员：${name ?? ''}`, scope: `人员·${name ?? ''}` };
}

function cleanName(s) {
  return s.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
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
    const noPoolStaff = viewMode === 'staff' && staffTagFilter.length
      && !data.staffs.some(s => staffTagFilter.every(t => (s.tags ?? []).includes(t)));
    const empty = document.createElement('div');
    empty.className = 'cal-empty';
    empty.textContent = viewMode === 'project'
      ? `${scope}暂无「${name ?? ''}」的班次，可切换周/月或用「批量铺排」生成`
      : noPoolStaff
        ? `${scope}所选标签组合下暂无人员，可在上方清除标签过滤`
        : name
          ? `${scope}「${name}」暂无排班`
          : `${scope}暂无排班人员`;
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

    // 当日排班弹窗入口：所有维度可用（人员只读维度无建班次钮时贴右缘）；灰显邻月日同样可看
    const dayBtn = document.createElement('button');
    dayBtn.type = 'button';
    dayBtn.className = 'cal-day-btn';
    dayBtn.title = '当日排班 · 查看并导出图片';
    dayBtn.innerHTML = ICON_DAY;
    dayBtn.onclick = () => openDayDialog(d);
    head.appendChild(dayBtn);

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

// 当日排班弹窗（日期列头日历钮入口）：只读当日清单按时段分组 + 导出图片。
// 口径跟随当前维度（总览 = 当天全部 / 项目 = 该任务 / 人员 = 该人），人员只读维度同样可进
function openDayDialog(date) {
  const staffById = Object.fromEntries(data.staffs.map(s => [s.id, s]));
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  let dayScheds = data.schedules.filter(s => s.date === date);
  if (viewMode === 'project') dayScheds = dayScheds.filter(s => s.projectId === viewTargetId);
  if (viewMode === 'staff') dayScheds = dayScheds.filter(s => s.staffIds.includes(viewTargetId));
  const [y, m, d] = date.split('-').map(Number);
  const title = `${y} 年 ${m} 月 ${d} 日 · ${weekdayLabel(date)}`;

  const body = document.createElement('div');
  const list = document.createElement('div');
  list.className = 'day-list';
  if (dayScheds.length) {
    // 组序 = 预置时段序（自主安排置顶，同周历行序/替换弹窗）；组内班次横排成行：
    // 任务配了 timeRange 按开始时间升序，未配时间的殿后（无定序基准，保持原数据序）
    SLOT_LABELS.forEach(slotLabel => {
      const scheds = dayScheds
        .filter(s => s.slotLabel === slotLabel)
        .sort((a, b) => {
          const ta = projectById[a.projectId]?.timeRange?.start;
          const tb = projectById[b.projectId]?.timeRange?.start;
          if (ta && tb) return ta < tb ? -1 : ta > tb ? 1 : 0;
          return ta ? -1 : tb ? 1 : 0;
        });
      if (!scheds.length) return;
      const group = document.createElement('div');
      group.className = 'day-group';
      const head = document.createElement('div');
      head.className = 'day-group-head';
      const chip = document.createElement('span');
      chip.className = 'day-head-tag';
      chip.textContent = slotLabel;
      const line = document.createElement('span');
      line.className = 'day-group-line';
      head.append(chip, line);
      const cards = document.createElement('div');
      cards.className = 'day-group-cards';
      if (scheds.length === 1) cards.classList.add('single'); // 单卡不拉满整行
      for (const sch of scheds) cards.appendChild(buildDayItem(sch, projectById, staffById));
      group.append(head, cards);
      list.appendChild(group);
    });
    body.appendChild(list);
  } else {
    const empty = document.createElement('div');
    empty.className = 'grid-empty';
    empty.textContent = `${m} 月 ${d} 日当天暂无班次`;
    body.appendChild(empty);
  }

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn btn-soft';
  exportBtn.innerHTML = `${ICON_IMAGE}<span>导出图片</span>`;
  exportBtn.disabled = dayScheds.length === 0;
  if (exportBtn.disabled) exportBtn.title = '当天暂无班次，无可导出';
  const { label: dimLabel, scope } = viewLabels();
  exportBtn.onclick = async () => {
    exportBtn.disabled = true;
    showToast('正在生成图片…');
    try {
      await exportTaskViewImage({
        list,
        title,
        metaText: dimLabel,
        filename: `Numbers-排班图-日-${cleanName(scope)}-${date}.png`,
      });
      showToast('当日排班图已导出', 'success');
    } catch (e) {
      showToast(`导出失败：${e.message}`, 'error');
    } finally {
      exportBtn.disabled = dayScheds.length === 0;
    }
  };
  openModal({ title, body, footer: exportBtn, boxClass: 'box-day' });
}

// 当日班次卡：任务名(+劳累指数火焰徽章) +（时间段 · 人名 / 暂未分配）+（任务说明），执行信息主次，屏幕与导出同构
function buildDayItem(sch, projectById, staffById) {
  const p = projectById[sch.projectId];
  const item = document.createElement('div');
  item.className = 'day-item';
  const top = document.createElement('div');
  top.className = 'day-item-top';
  const name = document.createElement('div');
  name.className = 'day-item-name';
  name.textContent = p ? p.name : sch.projectId;
  top.appendChild(name);
  if (p) {
    const fire = document.createElement('span');
    fire.className = 'day-fire';
    fire.title = `劳累指数 ${p.fatigueScore}/3`;
    fire.innerHTML = ICON_FIRE.repeat(p.fatigueScore);
    top.appendChild(fire);
  }
  item.appendChild(top);

  const meta = document.createElement('div');
  meta.className = 'day-item-meta';
  const parts = [];
  if (p?.timeRange) {
    const t = document.createElement('span');
    t.className = 'time';
    t.textContent = `${p.timeRange.start}–${p.timeRange.end}`;
    parts.push(t);
  }
  const names = sch.staffIds.map(id => staffById[id]?.name ?? id);
  const nameSpan = document.createElement('span');
  nameSpan.textContent = names.length ? names.join('、') : '暂未分配';
  if (names.length) nameSpan.className = 'names';
  parts.push(nameSpan);
  parts.forEach((part, i) => {
    if (i > 0) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.textContent = '·';
      meta.appendChild(dot);
    }
    meta.appendChild(part);
  });
  if (!names.length) meta.classList.add('empty'); // 无人排班 = 未定，灰字弱化（时段/时间段信息仍在）
  item.appendChild(meta);

  const descText = p?.description?.trim();
  if (descText) {
    const desc = document.createElement('div');
    desc.className = 'day-item-desc';
    desc.textContent = descText;
    item.appendChild(desc);
  }
  return item;
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
      ? `本月 ${visible.length} 个班次 · 疲劳 ${fatigue}/${monthlyFatigueLimitOf(st, ctx.settings)} · 高强度 ${heavy}/${monthlyHeavyLimitOf(st, ctx.settings)}`
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
  if (batchDeleteActive && !readOnly) {
    // 批量删除态：整卡点击即勾选/取消（不打开分配弹窗），右上角勾选点随选中填充
    card.classList.add('selectable');
    card.title = batchSel.has(sch.id) ? '取消选择该班次' : '选择该班次（可多选，点卡片切换）';
    if (batchSel.has(sch.id)) card.classList.add('selected');
    card.onclick = () => toggleBatchSel(sch.id, card);
    const tick = document.createElement('span');
    tick.className = 'sch-sel-tick';
    tick.textContent = '✓';
    card.appendChild(tick);
  } else if (!readOnly) {
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
    if (!readOnly && !batchDeleteActive) { // 只读/批量删除态：不可拖拽
      enableDrag(chip, { onDragStart: (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ staffId: sid, scheduleId: sch.id })); } });
    }
    // 批量删除态：人名不单独开替换——点击事件冒泡到卡片即勾选；只读（人员维度）仍可点人名替换
    if (!batchDeleteActive) chip.onclick = (e) => { e.stopPropagation(); openReplaceDialog(staff, sch); };
    names.appendChild(chip);
  }
  card.appendChild(names);

  if (filled >= capacity) {
    // 满员：底部不展示「已满」，卡片 .full 绿框视觉已表达
  } else {
    const cap = document.createElement('div');
    cap.className = 'sch-capacity';
    cap.textContent = filled === 0 ? `需 ${capacity} 人` : `缺 ${capacity - filled} 人`;
    if (!readOnly && !batchDeleteActive) {
      // 底部一行：需/缺 N 人（左）+ 智能排班小图标（右）；闪电与工具栏「智能排班」同款
      // 条件与智能排班对齐：未满员即逐名额填充，非仅空班次（原 filled===0，手动加 1 人后闪电消失）
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
// 视图层所有 ± 计数必须经此入口，手动散写漏轨会造成静默错乱；
// 规则唯一实现在 core/auto.js accumulateDelta（自动填充模拟共用），本层仅按班次查项目转调
function applyDelta(ctxObj, sid, sch, sign) {
  const project = data.projects.find(p => p.id === sch.projectId);
  if (project) accumulateDelta(ctxObj, project, sch, sid, sign);
}

// ===== 批量删除多选态 =====
let batchDeleteActive = false;
const batchSel = new Set(); // 选中的班次 sch.id

function exitBatchState() { batchDeleteActive = false; batchSel.clear(); }

function toggleBatchSel(schId, card) {
  if (batchSel.has(schId)) {
    batchSel.delete(schId);
    card.classList.remove('selected');
    card.title = '选择该班次（可多选，点卡片切换）';
  } else {
    batchSel.add(schId);
    card.classList.add('selected');
    card.title = '取消选择该班次';
  }
  const n = batchSel.size;
  const del = document.querySelector('.cal-batch-del');
  const cnt = document.querySelector('.cal-batch-count');
  if (del) { del.disabled = n === 0; del.textContent = `删除所选 (${n})`; }
  if (cnt) cnt.textContent = String(n);
}

function batchDeleteConfirm() {
  const ids = [...batchSel];
  if (!ids.length) return;
  const previews = ids.slice(0, 5).map(id => {
    const s = data.schedules.find(x => x.id === id);
    const p = data.projects.find(x => x.id === s?.projectId);
    return s ? `${s.date.slice(5)} · ${s.slotLabel} · ${p?.name ?? s.projectId}` : '';
  }).filter(Boolean).join('\n');
  const more = ids.length > 5 ? `\n… 等共 ${ids.length} 个` : '';
  confirmDialog({
    title: '批量删除班次',
    message: `确认删除所选 ${ids.length} 个班次？删除后不可恢复。\n其中已排人员将从当日任务数与周/月疲劳计数中回退。\n${previews}${more}`,
    boxClass: 'box-confirm-wide', // 预览多行排版需更宽（Tao 反馈）
    okClass: 'btn-soft', // 确认钮淡紫款（同恢复确认，勿红——Tao 定）
    confirmText: `删除所选 ${ids.length} 个`,
    onConfirm: async () => {
      for (const id of ids) {
        const s = data.schedules.find(x => x.id === id);
        if (!s) continue;
        for (const sid of s.staffIds) applyDelta(ctx, sid, s, -1); // 三轨回退（唯一实现 accumulateDelta）
        await removeSchedule(id);
      }
      exitBatchState();
      showToast(`已删除 ${ids.length} 个班次`, 'success');
      renderCalendar(document.querySelector('#view'));
    },
  });
}

function buildBatchBar() {
  const bar = document.createElement('div');
  bar.className = 'cal-batch-bar';
  const tip = document.createElement('div');
  tip.className = 'cal-batch-tip';
  const pre = document.createElement('span');
  pre.textContent = '批量删除 · 已选 ';
  const cnt = document.createElement('b');
  cnt.className = 'cal-batch-count';
  cnt.textContent = '0';
  const post = document.createElement('span');
  post.textContent = ' 个班次，点卡片勾选/取消';
  tip.append(pre, cnt, post);
  const right = document.createElement('div');
  right.className = 'cal-batch-right';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'btn btn-danger cal-batch-del';
  del.textContent = '删除所选 (0)';
  del.disabled = true;
  del.onclick = () => batchDeleteConfirm();
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn-default';
  cancel.textContent = '取消';
  cancel.onclick = () => { exitBatchState(); renderCalendar(document.querySelector('#view')); };
  right.append(del, cancel);
  bar.append(tip, right);
  return bar;
}

function scheduleDialog(sch) {
  const project = data.projects.find(p => p.id === sch.projectId);
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const capacity = project?.requiredCapacity ?? 1;
  const body = document.createElement('div');
  const footer = document.createElement('div');
  let tagFilter = []; // 候选标签多选过滤（弹窗级临时，视图层过滤不参与算法）
  let nameQuery = ''; // 候选名称搜索（同弹窗级临时，与 tagFilter 叠加为与关系）
  const allTags = () => [...new Set(data.staffs.flatMap(s => s.tags ?? []))].sort((a, b) => a.localeCompare(b, 'zh'));

  // 暂存模型：draft = 工作副本、dctx = 弹窗内演进 ctx——本弹窗不写真实 sch/ctx。
  // 点「确认保存」才按净差写真实 ctx 并 saveSchedule；直接关闭/ESC = 放弃本次改动（不落库）。
  const origStaffIds = [...sch.staffIds];
  const draft = { ...sch, staffIds: [...sch.staffIds] };
  const dctx = cloneCtx(ctx);
  const dirty = () => {
    if (origStaffIds.length !== draft.staffIds.length) return true;
    const o = new Set(origStaffIds);
    return draft.staffIds.some(id => !o.has(id));
  };

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn-primary';
  okBtn.textContent = '确认保存';
  okBtn.title = '把本次加/移的人员一次性落库（无改动时不可用）';
  okBtn.disabled = true;
  footer.appendChild(okBtn);
  const modal = openModal({ title: '排班分配', body, footer });

  okBtn.onclick = async () => {
    const o = new Set(origStaffIds);
    const added = draft.staffIds.filter(id => !o.has(id));        // 净增
    const removed = origStaffIds.filter(id => !draft.staffIds.includes(id)); // 净减
    for (const sid of removed) applyDelta(ctx, sid, draft, -1);
    for (const sid of added) applyDelta(ctx, sid, draft, +1);
    await saveSchedule(draft);
    modal.close();
    const parts = [];
    if (added.length) parts.push(`新增 ${added.length}`);
    if (removed.length) parts.push(`移出 ${removed.length}`);
    showToast(parts.length ? `已保存 · ${parts.join('、')}` : '已保存', 'success');
    const warnDaily = ctx.settings?.warnDailyCount ?? 0;
    if (warnDaily > 0) {
      const warns = added.filter(id => (ctx.dailyCounts.get(`${id}|${draft.date}`) ?? 0) >= warnDaily)
        .map(id => data.staffs.find(s => s.id === id)?.name ?? id);
      if (warns.length) showToast(`${warns.join('、')} 当日已达预警阈值 ${warnDaily} 个任务`, 'info');
    }
    renderCalendar(document.querySelector('#view'));
  };
  function syncDirty() { okBtn.disabled = !dirty(); }

  function renderBody() {
    body.innerHTML = '';
    const filled = draft.staffIds.length;
    const full = filled >= capacity;

    const head = document.createElement('div');
    head.className = 'asg-head';
    const titleRow = document.createElement('div');
    titleRow.className = 'asg-title';
    titleRow.innerHTML = `<span>${project?.name ?? draft.projectId}</span>${project ? `<span class="sch-badge">${ICON_FIRE.repeat(project.fatigueScore)}</span>` : ''}`;
    const sub = document.createElement('div');
    sub.className = 'asg-sub';
    sub.innerHTML = `${draft.date} · ${draft.slotLabel}${project?.timeRange ? ` · ${project.timeRange.start}–${project.timeRange.end}` : ''}`;
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
    function renderChips() {
      chips.innerHTML = '';
      if (draft.staffIds.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'asg-empty';
        empty.textContent = '暂无人员，从下方选择加入';
        chips.appendChild(empty);
        return;
      }
      for (const sid of draft.staffIds) chips.appendChild(makeChip(sid));
    }
    function makeChip(sid) {
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
      rm.onclick = () => { // 暂存移除（不落库）：整窗重绘，被移者按 dctx 重算回候选
        draft.staffIds = draft.staffIds.filter(id => id !== sid);
        applyDelta(dctx, sid, draft, -1);
        syncDirty();
        renderBody();
      };
      chip.append(chipName, rm);
      return chip;
    }
    function updateProgressBar() {
      const filled = draft.staffIds.length;
      const full = filled >= capacity;
      bar.classList.toggle('full', full);
      fillEl.style.width = `${Math.min(100, (filled / capacity) * 100)}%`;
      label.textContent = full ? `✓ 已满员 ${filled}/${capacity}` : `已排 ${filled}/${capacity} 人`;
    }
    renderChips();
    updateProgressBar();

    const listSec = document.createElement('div');
    listSec.className = 'asg-section';
    const secHead = document.createElement('div');
    secHead.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const secTitle = document.createElement('span');
    secTitle.textContent = '可选人员';
    secHead.appendChild(secTitle);
    const list = document.createElement('div');
    if (full) {
      // 满员：仅显示提示，不渲染候选行（无「＋ 添加」入口）；移除一人后 renderBody 重算即恢复
      const done = document.createElement('div');
      done.className = 'asg-full';
      done.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M20 6L9 17l-5-5"/></svg>本班次已满员';
      list.appendChild(done);
    } else {
      // 候选过滤（视图层，算法判断不变）：名称搜索 + 标签多选；切行 display 不重建 DOM（输入不失焦）
      const nameInput = document.createElement('input');
      nameInput.className = 'input asg-name-input';
      nameInput.type = 'text';
      nameInput.placeholder = '搜姓名';
      nameInput.value = nameQuery;
      nameInput.title = '按姓名过滤候选行';
      secHead.appendChild(nameInput);
      const candTags = allTags();
      if (candTags.length) {
        const fsel = createSelect({
          multiple: true,
          placeholder: '按标签筛',
          options: candTags.map(t => ({ value: t, label: t })),
          value: tagFilter,
        });
        fsel.classList.add('asg-tag-sel');
        fsel.title = '按标签过滤候选名单（不影响算法排序）';
        fsel.addEventListener('change', () => { tagFilter = fsel.value; refresh(); });
        secHead.appendChild(fsel);
      }
      const none = document.createElement('div');
      none.className = 'asg-empty';
      none.style.display = 'none';
      // 候选分两区：可添加（按推荐分排序）/ 暂不可添加（受限原因集中；默认折叠，原因单行省略）
      const secAvail = document.createElement('div');
      secAvail.className = 'asg-cand-sec';
      const headAvail = document.createElement('div');
      headAvail.className = 'asg-subhead';
      const listAvail = document.createElement('div');
      listAvail.className = 'asg-cand-list';
      secAvail.append(headAvail, listAvail);
      const secLimited = document.createElement('div');
      secLimited.className = 'asg-cand-sec asg-limited';
      const headLimited = document.createElement('div');
      headLimited.className = 'asg-subhead collap';
      const listLimited = document.createElement('div');
      listLimited.className = 'asg-cand-list';
      listLimited.hidden = true; // 暂不可添加默认折叠
      secLimited.append(headLimited, listLimited);
      list.append(none, secAvail, secLimited);
      const pickedRows = new Map(); // sid -> 本次点选已加入的行（保留高亮，不整窗重绘）
      const availEntries = []; // 可添加候选 {staff,row,info}，按推荐分排序
      let limitedOpen = false;
      // 连任豁免：仅当无可其他可排人选时，仅因连任被拦者上浮为可点选（保运转不空班）
      const { base, tenured } = splitEligible(data.staffs, draft, projectById, dctx, draft.staffIds);
      const tenureExempt = base.length === 0 && tenured.length > 0;
      const exemptSet = new Set(tenureExempt ? tenured.map(s => s.id) : []);
      for (const s of data.staffs) {
        if (draft.staffIds.includes(s.id)) continue; // 已在班者进上方 chips，不重复作候选
        const res = filterCandidate(s, draft, projectById, dctx);
        const isAvail = res.ok || exemptSet.has(s.id);
        const row = document.createElement('div');
        row.className = 'assign-row' + (isAvail ? ' pickable' : ' blocked');
        row.dataset.name = s.name;
        row.dataset.tags = JSON.stringify(s.tags ?? []);
        const name = document.createElement('span');
        name.className = 'assign-name';
        name.textContent = s.name;
        if (s.status === 'new') {
          const tag = document.createElement('span');
          tag.className = 'assign-tag';
          tag.textContent = '新入';
          name.appendChild(tag);
        }
        row.appendChild(name);
        if (isAvail) {
          const info = document.createElement('span');
          info.className = 'assign-info';
          info.textContent = `周疲劳 ${dctx.fatigueByWeek.get(`${s.id}|${getWeekStart(draft.date)}`) ?? 0}/${s.maxWeeklyFatigue}`;
          const { score, breakdown } = scoreCandidate(s, draft, projectById, dctx);
          row.dataset.score = String(score);
          // 分徽章（学替换候选卡）+ 周疲劳小字右置：主行信息更直观；行点击仍为暂存加/取消
          const scoreEl = document.createElement('span');
          scoreEl.className = 'assign-score';
          scoreEl.textContent = `${Math.round(score)} 分`;
          row.append(name, scoreEl, info);
          // 优选理由副行（同替换弹窗人话规则）：擅长原因 / 窗口偏少建议优先等，选人依据更清晰
          const reco = narrateReasons(s, draft, projectById, breakdown, dctx);
          if (tenureExempt && res.tenureOnly) reco.unshift('（仅因无其他可排人选，破例连任）');
          if (reco.length) {
            const re = document.createElement('span');
            re.className = 'assign-reco';
            re.textContent = reco.join('；');
            row.appendChild(re);
          }
          // 放行但需提醒（可用日仅设时段 + 任务未填时间）：黄字提示，不阻断点选
          if (res.warnings?.length) {
            const wa = document.createElement('span');
            wa.className = 'assign-warn';
            wa.textContent = res.warnings.join('；');
            row.appendChild(wa);
          }
          availEntries.push({ staff: s, row, info, scoreEl });
        } else {
          const why = document.createElement('span');
          why.className = 'assign-why';
          const reasons = res.reasons.join('；');
          why.textContent = reasons;
          why.title = reasons; // 单行省略时 hover 看全文
          row.append(name, why);
          listLimited.appendChild(row);
        }
      }
      // 可添加按推荐分（擅长 + 窗口均衡）降序；stable 保持同分原序
      availEntries.sort((a, b) => (Number(b.row.dataset.score) || 0) - (Number(a.row.dataset.score) || 0));
      if (tenureExempt) {
        const note = document.createElement('div');
        note.className = 'asg-exempt-note';
        note.textContent = '当前无可其他可排人选，以下连任人员破例放行';
        listAvail.appendChild(note);
      }
      for (const it of availEntries) listAvail.appendChild(it.row);
      const fullNow = () => draft.staffIds.length >= capacity;
      const syncNoSlot = () => { // 满员后其余未选行置灰禁点
        const f = fullNow();
        for (const it of availEntries) {
          const r = it.row;
          if (r.classList.contains('picked')) r.classList.remove('no-slot');
          else r.classList.toggle('no-slot', f);
        }
      };
      const refresh = () => {
        syncNoSlot();
        const hitOf = row => (!nameQuery || row.dataset.name.includes(nameQuery))
          && (!tagFilter.length || tagFilter.every(t => JSON.parse(row.dataset.tags || '[]').includes(t)));
        let addable = 0;
        let any = false;
        let topIt = null; // 最高分徽章随「可见且可点」动态转移：已选/置灰/被过滤不占位（学替换 Top1 观感）
        for (const it of availEntries) {
          const r = it.row;
          const hit = hitOf(r);
          r.style.display = hit ? '' : 'none';
          if (hit) any = true;
          if (hit && !r.classList.contains('picked') && !r.classList.contains('no-slot')) {
            addable++;
            if (!topIt) topIt = it;
          }
        }
        for (const it of availEntries) it.scoreEl.classList.toggle('top', it === topIt);
        let limited = 0;
        for (const r of listLimited.querySelectorAll('.assign-row')) {
          const hit = hitOf(r);
          r.style.display = hit ? '' : 'none';
          if (hit) { any = true; limited++; }
        }
        headAvail.textContent = pickedRows.size ? `已选 ${pickedRows.size} · 可添加 ${addable}` : `可添加 ${addable}`;
        secAvail.style.display = (addable > 0 || pickedRows.size > 0) ? '' : 'none';
        headLimited.textContent = `${limitedOpen ? '▾' : '▸'} 暂不可添加 ${limited}`;
        secLimited.style.display = limited ? '' : 'none';
        listLimited.hidden = !limitedOpen;
        none.style.display = any ? 'none' : '';
        if (!any) {
          const totalRows = availEntries.length + listLimited.querySelectorAll('.assign-row').length;
          none.textContent = totalRows === 0 ? '暂无可用人员'
            : nameQuery
              ? (tagFilter.length ? `未找到名称含「${nameQuery}」且带所选标签的候选人员` : `未找到名称含「${nameQuery}」的人员`)
              : '所选标签下暂无候选人员，可清除标签过滤';
        }
      };
      nameInput.addEventListener('input', () => { nameQuery = nameInput.value.trim(); refresh(); });
      headLimited.onclick = () => { limitedOpen = !limitedOpen; refresh(); };
      const unselect = ({ staff, row, info }) => {
        if (!draft.staffIds.includes(staff.id)) return;
        draft.staffIds = draft.staffIds.filter(id => id !== staff.id);
        applyDelta(dctx, staff.id, draft, -1);
        pickedRows.delete(staff.id);
        row.classList.remove('picked');
        info.textContent = `周疲劳 ${dctx.fatigueByWeek.get(`${staff.id}|${getWeekStart(draft.date)}`) ?? 0}/${staff.maxWeeklyFatigue}`;
        renderChips();
        updateProgressBar();
        refresh(); // 取消后不再满员则其余 no-slot 自动解除
        syncDirty();
      };
      const pick = ({ staff, row, info }) => {
        if (row.classList.contains('no-slot')) return; // 他人满员置灰禁点
        if (row.classList.contains('picked')) { unselect({ staff, row, info }); return; } // 再点一次 = 取消选中
        if (draft.staffIds.length >= capacity) return;
        draft.staffIds.push(staff.id);
        applyDelta(dctx, staff.id, draft, 1);
        // 点行即加：行保留「已选」高亮不再整窗重绘，仅局部更新 chips/进度/区计数（暂存，不落库）
        pickedRows.set(staff.id, row);
        row.classList.add('picked');
        row.classList.remove('no-slot');
        info.textContent = '✓ 已选';
        renderChips();
        updateProgressBar();
        refresh();
        syncDirty();
      };
      for (const it of availEntries) it.row.onclick = () => pick(it);
      refresh();
    }
    listSec.appendChild(secHead);
    body.append(head, progress, filledSec, chips, listSec, list);
  }
  renderBody();
}

function staffChipClass(staff, date) {
  if (!staff) return 'staff-chip';
  if (timeScale === 'month') {
    // 月粒度红黄换绑到月上限（周上限滚动语义仅周粒度成立）
    const mkey = monthKey(date);
    const mf = ctx.fatigueByMonth.get(`${staff.id}|${mkey}`) ?? 0;
    const mh = ctx.heavyByMonth?.get(`${staff.id}|${mkey}`) ?? 0;
    const limit = monthlyFatigueLimitOf(staff, ctx.settings);
    const hlim = monthlyHeavyLimitOf(staff, ctx.settings);
    if (mf > limit || (hlim > 0 && mh > hlim)) return 'staff-chip over';
    if (mf >= limit * 0.8 || (hlim > 0 && mh >= hlim * 0.8)) return 'staff-chip warn';
    return 'staff-chip';
  }
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
    const mh = ctx.heavyByMonth?.get(`${staff.id}|${monthKey(date)}`) ?? 0;
    const wk = ctx.fatigueByWeek.get(`${staff.id}|${getWeekStart(date)}`) ?? 0;
    return `本月累计 ${mf}/${monthlyFatigueLimitOf(staff, ctx.settings)} · 本月高强度 ${mh}/${monthlyHeavyLimitOf(staff, ctx.settings)} · 本周 ${wk}/${staff.maxWeeklyFatigue} · 当日 ${daily} 个任务`;
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

async function smartFillOne(sch) {
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const [r] = simulateAutoFill([sch], data.staffs, projectById, ctx);
  if (r.added.length > 0) await saveSchedule(r.sch);
  const warnMsg = r.warned.map(id => data.staffs.find(s => s.id === id)?.name ?? id).join('、');
  showToast(warnMsg ? `已填充 ${r.added.length} 个名额；${warnMsg} 当日已达预警阈值` : `已填充 ${r.added.length} 个名额`, r.added.length ? 'success' : 'info');
  renderCalendar(document.querySelector('#view'));
}

// 智能排班范围 = 当前浏览范围（与批量铺排同构）：周 = 当前浏览周；月 = 浏览月覆盖的整段自然周（含灰列邻月日）。
// 已排序（日期→时段序）；孤儿班次（任务已不存在）不列入，core 层亦有防御。
function smartScopeSchedules() {
  const starts = timeScale === 'month' ? weeksCovering(monthAnchor) : [currentWeekStart];
  const inRange = new Set();
  for (const ws of starts) for (const d of getWeekDates(ws)) inRange.add(d);
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  let empties = data.schedules.filter(s =>
    inRange.has(s.date) && projectById[s.projectId] && s.staffIds.length < projectById[s.projectId].requiredCapacity);
  if (viewMode === 'project') empties = empties.filter(s => s.projectId === viewTargetId); // 项目维度下只填当前任务
  empties.sort((a, b) => a.date.localeCompare(b.date)
    || (a.slotLabel === '自主安排' ? 1 : 0) - (b.slotLabel === '自主安排' ? 1 : 0)
    || SLOT_LABELS.indexOf(a.slotLabel) - SLOT_LABELS.indexOf(b.slotLabel));
  return empties;
}

// 智能排班「预览 + 确认」：预览 = simulateAutoFill 模拟执行（同一决策通道、不写库），确认后按预览结果一次批量落盘
function smartPlanDialog() {
  const isMonth = timeScale === 'month';
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const empties = smartScopeSchedules();
  const results = simulateAutoFill(empties, data.staffs, projectById, ctx);
  const totalFilled = results.reduce((n, r) => n + r.added.length, 0);
  const gaps = results.filter(r => !r.full);
  const changed = results.filter(r => r.added.length > 0);
  const scopeName = viewMode === 'project' ? (data.projects.find(p => p.id === viewTargetId)?.name ?? '') : '';

  // 黄字提醒：自动选中者属「可用日只设了时段 + 任务无具体时间」→ 仍会填，但预览需黄字提示（不阻断）
  const staffName = id => data.staffs.find(s => s.id === id)?.name ?? id;
  const availWarnRows = [];
  for (const r of results) {
    if (!r.added.length) continue;
    const proj = projectById[r.sch.projectId];
    const warned = r.added.filter(id => {
      const st = data.staffs.find(x => x.id === id);
      return !!st && checkAvailability(st, r.sch, proj).warn;
    });
    if (warned.length) availWarnRows.push({
      date: r.sch.date, slot: r.sch.slotLabel, name: proj?.name ?? r.sch.projectId, names: warned.map(staffName),
    });
  }

  // 范围行（与批量铺排同构）
  const starts = isMonth ? weeksCovering(monthAnchor) : [currentWeekStart];
  const spanEnd = starts.length === 1 ? getWeekLabel(starts[0])
    : `${getWeekDates(starts[0])[0]} ~ ${getWeekDates(starts[starts.length - 1])[6]}`;
  const scopeLine = isMonth ? `${monthAnchor}（覆盖 ${spanEnd}）` : spanEnd;

  const body = document.createElement('div');

  const scopeRow = document.createElement('div');
  scopeRow.className = 'smart-scope';
  const tag = document.createElement('span');
  tag.className = 'smart-tag';
  tag.textContent = isMonth ? '月粒度' : '周粒度';
  const range = document.createElement('span');
  range.className = 'smart-range';
  range.textContent = scopeLine;
  const dim = document.createElement('span');
  dim.className = 'smart-range';
  dim.textContent = scopeName ? `项目·${scopeName}` : '总览';
  scopeRow.append(tag, range, dim);
  body.appendChild(scopeRow);

  // 计数条
  const count = document.createElement('div');
  count.className = 'smart-count' + (totalFilled === 0 ? ' none' : '');
  const cFilled = document.createElement('b');
  cFilled.textContent = `将填充 ${totalFilled} 个名额`;
  const cSch = document.createElement('span');
  cSch.textContent = `需填班次 ${empties.length} 个`;
  count.append(cFilled, cSch);
  if (gaps.length > 0) {
    const cGap = document.createElement('span');
    cGap.className = 'gap';
    cGap.textContent = `${gaps.length} 个班次仍缺人`;
    count.append(cGap);
  }
  body.appendChild(count);

  // 预览明细：按任务聚合「填补班次/名额 + 仍缺」
  const tmap = new Map();
  for (const r of results) {
    const t = tmap.get(r.sch.projectId) ?? { projectId: r.sch.projectId, filledSch: 0, filledSlots: 0, gapSlots: 0 };
    if (r.added.length > 0) { t.filledSch++; t.filledSlots += r.added.length; }
    if (!r.full) t.gapSlots += projectById[r.sch.projectId].requiredCapacity - r.sch.staffIds.length;
    tmap.set(r.sch.projectId, t);
  }

  if (empties.length > 0) {
    const list = document.createElement('div');
    list.className = 'smart-list';
    const head = document.createElement('div');
    head.className = 'smart-row head';
    const hName = document.createElement('span'); hName.textContent = '任务';
    const hCnt = document.createElement('span'); hCnt.className = 'cnt'; hCnt.textContent = '填补班次 · 名额';
    const hGap = document.createElement('span'); hGap.className = 'gap'; hGap.textContent = '仍缺';
    head.append(hName, hCnt, hGap);
    list.appendChild(head);
    for (const t of tmap.values()) {
      const row = document.createElement('div');
      row.className = 'smart-row';
      const nm = document.createElement('span'); nm.className = 'name';
      nm.textContent = projectById[t.projectId]?.name ?? t.projectId;
      const cnt = document.createElement('span'); cnt.className = 'cnt';
      cnt.innerHTML = t.filledSlots > 0 ? `<b>${t.filledSlots}</b> 名额 <span class="sub">· ${t.filledSch} 班次</span>` : '<span class="sub">—</span>';
      const gp = document.createElement('span'); gp.className = 'gap';
      if (t.gapSlots > 0) gp.textContent = `仍缺 ${t.gapSlots} 人`;
      row.append(nm, cnt, gp);
      list.appendChild(row);
    }
    body.appendChild(list);

    // 黄字提醒区：可用日仅部分时段 + 无具体时间任务的被选者（仍会安排，预览先行告知）
    if (availWarnRows.length) {
      const warnBox = document.createElement('div');
      warnBox.className = 'smart-warnbox';
      const wTitle = document.createElement('div');
      wTitle.className = 'smart-warn-title';
      wTitle.textContent = '提醒：班次没写具体时间，排到的人员当天仅在部分时段可排';
      warnBox.appendChild(wTitle);
      for (const row of availWarnRows) {
        const wr = document.createElement('div');
        wr.className = 'smart-warn';
        const dt = document.createElement('span');
        dt.className = 'smart-warn-date';
        dt.textContent = `${weekdayLabel(row.date)} · ${row.date.slice(5)}`;
        const slot = document.createElement('span');
        slot.className = 'smart-slot';
        slot.textContent = row.slot;
        const nm = document.createElement('span');
        nm.className = 'smart-warn-name';
        nm.textContent = `${row.name} → ${row.names.join('、')}`;
        wr.append(dt, slot, nm);
        warnBox.appendChild(wr);
      }
      body.appendChild(warnBox);
    }

    // 缺口班次明细：填不满的逐条单列，确认前可见「需人工收尾」的全貌
    if (gaps.length > 0) {
      const gapBox = document.createElement('div');
      gapBox.className = 'smart-gapbox';
      const gTitle = document.createElement('div');
      gTitle.className = 'smart-gap-title';
      gTitle.textContent = '仍缺人 · 需人工安排';
      gapBox.appendChild(gTitle);
      for (const r of gaps) {
        const project = projectById[r.sch.projectId];
        const missing = project.requiredCapacity - r.sch.staffIds.length;
        const row = document.createElement('div');
        row.className = 'smart-gap';
        const dt = document.createElement('span');
        dt.className = 'smart-gap-date';
        dt.textContent = `${weekdayLabel(r.sch.date)} · ${r.sch.date.slice(5)}`;
        const slot = document.createElement('span');
        slot.className = 'smart-slot';
        slot.textContent = r.sch.slotLabel;
        const nm = document.createElement('span');
        nm.className = 'smart-gap-name';
        nm.textContent = project?.name ?? r.sch.projectId;
        const miss = document.createElement('span');
        miss.className = 'smart-gap-miss';
        miss.textContent = `仍缺 ${missing} 人`;
        row.append(dt, slot, nm, miss);
        gapBox.appendChild(row);
      }
      body.appendChild(gapBox);
    }
  } else {
    const empty = document.createElement('div');
    empty.className = 'smart-empty';
    empty.textContent = `当前${isMonth ? '月' : '周'}无未满员班次，无需自动填充`;
    body.appendChild(empty);
  }

  // 有班次缺人但零候选可填的分因提示
  if (empties.length > 0 && totalFilled === 0) {
    const reason = document.createElement('div');
    reason.className = 'smart-reason';
    reason.textContent = '范围内班次暂无可用人员可自动填充（受权限/每日时段上限/休假/疲劳等硬性约束限制）';
    body.appendChild(reason);
  }

  const hint = document.createElement('div');
  hint.className = 'smart-hint';
  hint.textContent = '按擅长与劳累均衡自动选人；受每日/时段上限、周疲劳、高强度次数等硬性约束限制；仅处理当前浏览范围内的未满员班次，范围外不受影响。结果立即生效，可在周历中逐班次手动调整。';
  body.appendChild(hint);

  const footer = document.createElement('div');
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'btn btn-primary';
  ok.textContent = '开始填充';
  ok.disabled = totalFilled === 0;
  footer.appendChild(ok);
  const modal = openModal({ title: '智能排班', body, footer, closeText: '取消' });

  ok.onclick = async () => {
    const updated = changed.map(r => r.sch);
    if (updated.length > 0) await saveSchedules(updated);
    data = getCache();
    modal.close();
    const warnedAll = new Set(results.flatMap(r => r.warned));
    const warnMsg = [...warnedAll].map(id => data.staffs.find(s => s.id === id)?.name ?? id).join('、');
    const scopeTxt = scopeName ? `已为「${scopeName}」填充` : '智能排班完成：填充';
    const msg = warnMsg ? `${scopeTxt} ${totalFilled} 个名额；${warnMsg} 当日已达预警阈值` : `${scopeTxt} ${totalFilled} 个名额`;
    showToast(msg, totalFilled > 0 ? 'success' : 'info');
    renderCalendar(document.querySelector('#view'));
  };
}

function openReplaceDialog(staff, sch) {
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const STATUS_TXT = { new: '新入', rest: '休假中', left: '已退出' };
  const body = document.createElement('div');
  let tagFilter = []; // 替补候选标签多选过滤（弹窗级临时，视图层过滤不参与算法）
  let nameQuery = ''; // 替补候选名称搜索（同弹窗级临时，与 tagFilter 叠加为与关系）
  const moreOpen = new Set(); // 各组「其他可选」展开态（key = schedule.id）；过滤重算保留展开，点折叠行切换

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

  // 替补候选过滤栏（视图层：算法推荐名单不变，仅按名称/标签收窄展示）；当天无班次不出现
  const candTags = [...new Set(data.staffs.flatMap(s => s.tags ?? []))].sort((a, b) => a.localeCompare(b, 'zh'));
  if (daySchedules.length) {
    const bar = document.createElement('div');
    bar.className = 'rpl-filter';
    const lab = document.createElement('span');
    lab.className = 'rpl-filter-label';
    lab.textContent = '替补候选';
    const nameInput = document.createElement('input');
    nameInput.className = 'input asg-name-input';
    nameInput.type = 'text';
    nameInput.placeholder = '搜姓名';
    nameInput.value = nameQuery;
    nameInput.title = '按姓名过滤替补候选';
    bar.append(lab, nameInput);
    const rerenderGroups = () => {
      for (const g of body.querySelectorAll('.rpl-group')) {
        if (!g.classList.contains('done')) g._rerender?.();
      }
    };
    if (candTags.length) {
      const fsel = createSelect({
        multiple: true,
        placeholder: '按标签筛',
        options: candTags.map(t => ({ value: t, label: t })),
        value: tagFilter,
      });
      fsel.classList.add('asg-tag-sel');
      fsel.title = '按标签过滤替补候选（不影响算法推荐）';
      fsel.addEventListener('change', () => { tagFilter = fsel.value; rerenderGroups(); });
      bar.appendChild(fsel);
    }
    nameInput.addEventListener('input', () => { nameQuery = nameInput.value.trim(); rerenderGroups(); });
    body.appendChild(bar);
  }

  const rplModal = openModal({ title: '人员替换', body });

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
      const full = recommendSubstitutes(data.staffs, s, projectById, ctx, staff.id); // 全量通过者可替（按分降序）
      const matches = r => (!tagFilter.length || tagFilter.every(t => (r.staff.tags ?? []).includes(t)))
        && (!nameQuery || r.staff.name.includes(nameQuery));
      // 分区先于过滤：推荐 = 全量前 3，其余 = 第 4 名起「其他可选」。名称/标签过滤只在两区内各自筛——原第 4 名不上浮（Tao 定）
      const top = full.slice(0, 3).filter(matches);
      const rest = full.slice(3).filter(matches);
      const mkEmpty = (text) => {
        const none = document.createElement('div');
        none.className = 'asg-empty';
        none.textContent = text;
        list.appendChild(none);
      };
      if (full.length === 0) { mkEmpty('暂无可用替补人员'); return; }
      if (top.length + rest.length === 0) {
        if (nameQuery) mkEmpty(tagFilter.length ? `未找到名称含「${nameQuery}」且带所选标签的替补候选` : `未找到名称含「${nameQuery}」的替补候选`);
        else mkEmpty('所选标签下暂无可用替补人员，可清除标签过滤');
        return;
      }
      const mkCard = (r, isTop) => {
        const card = document.createElement('div');
        card.className = 'rpl-cand';
        const main = document.createElement('div');
        main.className = 'rpl-cand-main';
        const nm = document.createElement('span');
        nm.className = 'rpl-cand-name';
        nm.textContent = r.staff.name;
        const score = document.createElement('span');
        score.className = 'rpl-cand-score' + (isTop ? ' top' : '');
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
        if (r.warning) {
          const wa = document.createElement('div');
          wa.className = 'rpl-cand-warn';
          wa.textContent = r.warning;
          card.appendChild(wa);
        }
        async function doReplace() {
          // 一减一增：移除被替换者计数、累加替补者计数，ctx 同步防算法层计数错乱
          applyDelta(ctx, staff.id, s, -1);
          applyDelta(ctx, r.staff.id, s, 1);
          s.staffIds = s.staffIds.filter(id => id !== staff.id);
          s.staffIds.push(r.staff.id);
          await saveSchedule(s);
          showToast(`已将 ${staff.name} 换为 ${r.staff.name}`, 'success');
          renderCalendar(document.querySelector('#view'));
          // 替换完成即关闭整个替换弹窗（不留绿条/多余弹框）；需再换下一班次时重新点人名进入
          rplModal.close();
        }
        function askReplace() {
          // 二次确认：列明「把谁从哪个班次换下、换上谁」，防误触连点（原一点即写库）
          const name = project?.name ?? s.projectId;
          confirmDialog({
            title: '确认替换',
            message: `${staff.name} 现排于「${weekdayLabel(s.date)} · ${s.date.slice(5)} · ${s.slotLabel} · ${name}」\n确认改为 ${r.staff.name} 顶替？`,
            confirmText: '确认替换',
            okClass: 'btn-soft', // 非破坏性变更 → 淡紫确认钮；删除类破坏操作仍为红 btn-danger
            onConfirm: doReplace,
          });
        }
        // 二次确认仅由「选此替补」按钮触发；点行空白不触发（原 card.onclick 整卡触发易误触）
        btn.onclick = askReplace;
        return card;
      };
      // 推荐区 = 全量前 3（首位带 Top1 徽章）
      top.forEach((r, idx) => list.appendChild(mkCard(r, idx === 0)));
      // 其他可选 = 第 4 名起按分序（默认折叠；展开态存 moreOpen，跨名称/标签重算保留）
      if (rest.length) {
        const bar = document.createElement('button');
        bar.type = 'button';
        bar.className = 'rpl-more-bar';
        const moreBody = document.createElement('div');
        moreBody.className = 'rpl-more-body';
        moreBody.hidden = !moreOpen.has(s.id);
        rest.forEach(r => moreBody.appendChild(mkCard(r, false)));
        const syncBar = () => { bar.textContent = `${moreBody.hidden ? '▸' : '▾'} 其他可选 ${rest.length} 人`; };
        syncBar();
        bar.onclick = () => {
          if (moreOpen.has(s.id)) moreOpen.delete(s.id); else moreOpen.add(s.id);
          moreBody.hidden = !moreOpen.has(s.id);
          syncBar();
        };
        list.append(bar, moreBody);
      }
    }
    renderCandidates();
    group._rerender = renderCandidates;
    container.appendChild(group);
  }

  for (const s of daySchedules) renderGroup(body, s);
}

function manualCreate(date, slotLabel, presetProjectId) {
  const body = document.createElement('div');

  // 目标日由入口决定（点哪天的 ＋ 即建哪天），不再提供日期选择——原生 date 控件与自建 select/chip 割裂，且改期非必需
  const fixedDate = date ?? currentWeekStart;
  const dateRow = document.createElement('div');
  dateRow.className = 'cal-dim-summary';
  const datePill = document.createElement('span');
  datePill.className = 's-tag';
  datePill.textContent = `${weekdayLabel(fixedDate)} · ${fixedDate}`;
  dateRow.append('将建班次：', datePill);

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

  body.append(dateRow, slotF.wrap, projF.wrap);

  const footer = document.createElement('div');
  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn-primary';
  okBtn.textContent = '创建';
  if (noProjects) okBtn.disabled = true;
  footer.appendChild(okBtn);
  const modal = openModal({ title: '手动建班次', body, footer, boxClass: 'box-sm' });
  okBtn.onclick = async () => {
    const dateVal = fixedDate;
    const projectId = projSel.value;
    let valid = true;
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
  // 范围 = 当前浏览范围（周 = 当前浏览周；月 = 浏览月覆盖的整段自然周，所见即所铺）
  const isMonth = timeScale === 'month';
  const weekStarts = isMonth ? weeksCovering(monthAnchor) : [currentWeekStart];
  let scopeProjects = data.projects;
  if (viewMode === 'project') scopeProjects = data.projects.filter(p => p.id === viewTargetId);
  const key = s => `${s.date}|${s.projectId}|${s.slotLabel}`;
  const preview = previewExpand(scopeProjects, weekStarts, new Set(data.schedules.map(key)));

  const scopeText = viewMode === 'project'
    ? `项目·${data.projects.find(p => p.id === viewTargetId)?.name ?? ''}`
    : '总览';
  const spanEnd = weekStarts.length === 1 ? getWeekLabel(weekStarts[0])
    : `${getWeekDates(weekStarts[0])[0]} ~ ${getWeekDates(weekStarts[weekStarts.length - 1])[6]}`;
  const scopeLine = isMonth ? `${monthAnchor}（覆盖 ${spanEnd}）` : spanEnd;

  const body = document.createElement('div');

  // 范围行
  const scopeRow = document.createElement('div');
  scopeRow.className = 'bulk-scope';
  const tag = document.createElement('span');
  tag.className = 'bulk-tag';
  tag.textContent = isMonth ? '月粒度' : '周粒度';
  const range = document.createElement('span');
  range.className = 'bulk-range';
  range.textContent = scopeLine;
  const dim = document.createElement('span');
  dim.className = 'bulk-range';
  dim.textContent = scopeText;
  scopeRow.append(tag, range, dim);
  body.appendChild(scopeRow);

  // 计数条
  const count = document.createElement('div');
  count.className = 'bulk-count' + (preview.totalNew === 0 ? ' none' : '');
  const cNew = document.createElement('b');
  cNew.textContent = `将新建 ${preview.totalNew} 个班次`;
  const cSkip = document.createElement('span');
  cSkip.className = 'skip';
  cSkip.textContent = `已存在跳过 ${preview.totalSkip}`;
  count.append(cNew, cSkip);
  body.appendChild(count);

  const wdText = days => [...days].sort((a, b) => a - b).map(d => '日一二三四五六'[d]).join('、');

  if (preview.perTask.length > 0) {
    // 预览明细
    const list = document.createElement('div');
    list.className = 'bulk-list';
    const head = document.createElement('div');
    head.className = 'bulk-row head';
    const hName = document.createElement('span'); hName.textContent = '任务';
    const hCnt = document.createElement('span'); hCnt.className = 'cnt'; hCnt.textContent = '新建/跳过';
    const hWd = document.createElement('span'); hWd.className = 'wd'; hWd.textContent = '重复星期';
    head.append(hName, hCnt, hWd);
    list.appendChild(head);
    for (const t of preview.perTask) {
      const name = data.projects.find(p => p.id === t.projectId)?.name ?? t.projectId;
      const row = document.createElement('div');
      row.className = 'bulk-row';
      const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = name;
      const cnt = document.createElement('span'); cnt.className = 'cnt';
      cnt.innerHTML = `<b>${t.created}</b><span class="skip"> / ${t.skipped}</span>`;
      const wd = document.createElement('span'); wd.className = 'wd';
      wd.textContent = t.weekDays.length ? `每周${wdText(t.weekDays)}` : '一次性';
      row.append(nm, cnt, wd);
      list.appendChild(row);
    }
    body.appendChild(list);
  } else {
    const empty = document.createElement('div');
    empty.className = 'bulk-empty';
    empty.textContent = '该范围无启用中的周期任务（一次性任务请手动建班次）';
    body.appendChild(empty);
  }

  // 空态（无周期任务）时已由空块说明；此处仅补「范围内已全部铺好」的原因
  const reasonText = preview.totalNew === 0 && preview.perTask.length > 0
    ? '范围内周期班次已全部铺好，无需新建'
    : '';
  if (reasonText) {
    const reason = document.createElement('div');
    reason.className = 'bulk-reason';
    reason.textContent = reasonText;
    body.appendChild(reason);
  }

  const hint = document.createElement('div');
  hint.className = 'bulk-hint';
  hint.textContent = '仅启用中的周期任务会铺排；新建班次为空壳（不分配人员）；已存在的自动跳过。';
  body.appendChild(hint);

  // footer：主按钮「开始铺排」（取消由 openModal 左侧自动补）
  const footer = document.createElement('div');
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'btn btn-primary';
  ok.textContent = '开始铺排';
  ok.disabled = preview.totalNew === 0;
  footer.appendChild(ok);
  const modal = openModal({ title: '批量铺排', body, footer, closeText: '取消' });

  ok.onclick = async () => {
    const existing = new Set(data.schedules.map(key));
    const rows = expandWeeks(scopeProjects, weekStarts[0], weekStarts.length, createSchedule);
    let created = 0;
    for (const sch of rows) {
      if (!existing.has(key(sch))) {
        await saveSchedule(sch);
        created++;
      }
    }
    data = getCache();
    modal.close();
    const skipped = rows.length - created;
    showToast(`已铺排当前${isMonth ? '月' : '周'} · 新建 ${created} · 跳过 ${skipped}`, created ? 'success' : 'info');
    renderCalendar(document.querySelector('#view'));
  };
}
