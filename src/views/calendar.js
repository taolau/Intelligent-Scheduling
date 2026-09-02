import { expandWeeks } from '../core/expand.js';
import { filterCandidate } from '../core/filter.js';
import { scoreCandidate } from '../core/score.js';
import { buildContext, recommendSubstitutes } from '../core/substitute.js';
import { getWeekStart, getWeekDates, getWeekLabel, todayStr, toDateStr, weekdayLabel } from '../core/week.js';
import { getCache, saveSchedule, getSettings, removeSchedule } from '../data/store.js';
import { KEYS } from '../data/keys.js';
import { createSchedule, SLOT_LABELS } from '../data/model.js';
import { openModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { enableDrag, enableDrop } from '../ui/dnd.js';
import { exportAttendance } from '../ui/excel.js';
import { exportWeekImage } from '../ui/exportImage.js';
import { createSelect } from '../ui/select.js';
import { ICON_FIRE } from '../ui/icons.js';

let currentWeekStart = getWeekStart(todayStr());
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

function persistViewState() {
  try { localStorage.setItem(KEYS.calView, JSON.stringify({ mode: viewMode, id: viewTargetId })); } catch { /* 存储不可用时静默 */ }
}

const ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15 18l-6-6 6-6"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M9 18l6-6-6-6"/></svg>';
const ICON_ZAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>';
const ICON_BULK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>';
const ICON_EXPORT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
const ICON_IMAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
const ICON_TODAY_FLAG = '<svg class="cal-today-flag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block"><path d="M5 21V4"/><path d="M5 4h12l-3 5 3 5H5"/></svg>';
const ICON_ADD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_CARET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M6 9l6 6 6-6"/></svg>';
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

  const prev = btn('上周', false, false, ICON_PREV), next = btn('下周', false, false, ICON_NEXT, true);
  const label = document.createElement('span');
  label.className = 'week-label';
  label.textContent = getWeekLabel(currentWeekStart);
  const todayBtn = btn('今天');
  const autoBtn = btn('智能排班', true, false, ICON_ZAP), bulkBtn = btn('批量铺排', false, false, ICON_BULK);
  // 合并导出入口：一个「导出」按钮 hover 下拉出 Excel/图片两项（纯 CSS hover 显隐，无需 JS 管理开合）
  const exportWrap = document.createElement('div');
  exportWrap.className = 'cal-export';
  const exportBtn = btn('导出', false, false, ICON_EXPORT);
  exportBtn.innerHTML += ICON_CARET;
  const exportMenu = document.createElement('div');
  exportMenu.className = 'cal-export-menu';
  const excelItem = document.createElement('button');
  excelItem.type = 'button';
  excelItem.className = 'cal-export-item';
  excelItem.innerHTML = `${ICON_EXPORT}<span>导出 Excel</span>`;
  const imgItem = document.createElement('button');
  imgItem.type = 'button';
  imgItem.className = 'cal-export-item';
  imgItem.innerHTML = `${ICON_IMAGE}<span>导出图片</span>`;
  exportMenu.append(excelItem, imgItem);
  exportWrap.append(exportBtn, exportMenu);
  left.append(prev, label, next, todayBtn);
  // 人员维度为只读视图：隐藏智能排班/批量铺排（导出仍可用，截图跟随当前视图）
  if (viewMode === 'staff') right.append(exportWrap);
  else right.append(autoBtn, bulkBtn, exportWrap);
  bar.append(left, right);
  container.appendChild(bar);

  prev.onclick = () => shiftWeek(-7);
  next.onclick = () => shiftWeek(7);
  todayBtn.onclick = () => { currentWeekStart = getWeekStart(todayStr()); renderCalendar(container); };
  autoBtn.onclick = () => smartFill();
  bulkBtn.onclick = () => bulkPlanDialog();
  excelItem.onclick = () => exportAttendance(data.schedules, data.projects, data.staffs, currentWeekStart);
  imgItem.onclick = async () => {
    if (!grid.isConnected) {
      showToast('当前视图暂无班次，无可导出的排班图', 'error');
      return;
    }
    const viewLabel = viewMode === 'overview' ? '总览'
      : viewMode === 'project' ? `任务：${data.projects.find(p => p.id === viewTargetId)?.name ?? ''}`
      : `人员：${data.staffs.find(s => s.id === viewTargetId)?.name ?? ''}`;
    imgItem.disabled = true;
    showToast('正在生成图片…');
    try {
      await exportWeekImage(grid, `Numbers-排班图-${currentWeekStart}.png`, getWeekLabel(currentWeekStart), viewLabel);
      showToast('排班图已导出', 'success');
    } catch (e) {
      showToast(`导出失败：${e.message}`, 'error');
    } finally {
      imgItem.disabled = false;
    }
  };

  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const dates = getWeekDates(currentWeekStart);
  const today = todayStr();

  // 维度过滤：项目=该任务全部班次；人员=该人已排入的班次（只读）
  const dateSet = new Set(dates);
  let visible = data.schedules.filter(s => dateSet.has(s.date));
  let readOnly = false;
  if (viewMode === 'project') visible = visible.filter(s => s.projectId === viewTargetId);
  if (viewMode === 'staff') { visible = visible.filter(s => s.staffIds.includes(viewTargetId)); readOnly = true; }

  // 过滤后整周为空 → 空态卡片（工具栏保留，可切回）
  if (viewMode !== 'overview' && visible.length === 0) {
    const name = viewMode === 'project'
      ? data.projects.find(p => p.id === viewTargetId)?.name
      : data.staffs.find(s => s.id === viewTargetId)?.name;
    const empty = document.createElement('div');
    empty.className = 'cal-empty';
    empty.textContent = viewMode === 'project'
      ? `本周暂无「${name}」的班次，可切换周或用「批量铺排」生成`
      : `本周「${name}」暂无排班`;
    container.appendChild(empty);
    return;
  }

  // 维度摘要行（按当前浏览周现算，不依赖 ctx——ctx 周积分锚定首个班次所在周）
  if (viewMode !== 'overview') container.appendChild(buildDimSummary(visible));

  // 按「日期|时段」预分组，避免逐格 O(n²) 过滤
  const byKey = new Map();
  for (const s of visible) {
    const key = `${s.date}|${s.slotLabel}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(s);
  }
  if (readOnly) grid.classList.add('readonly');

  dates.forEach((d, i) => {
    const col = document.createElement('div');
    col.className = 'cal-col';

    const head = document.createElement('div');
    head.className = `cal-date${d === today ? ' cal-today' : ''}`;
    head.innerHTML = `${weekdayNames[i]}<br><b>${d.slice(5)}</b>`;
    if (d === today) {
      head.title = '今天';
      head.insertAdjacentHTML('beforeend', ICON_TODAY_FLAG);
    }
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
  container.appendChild(grid);
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
    const info = document.createElement('span');
    info.textContent = `本周 ${visible.length} 个班次 · 已排 ${filled}/${cap} 人`;
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
    info.textContent = `本周 ${visible.length} 个班次 · 疲劳 ${fatigue}/${st?.maxWeeklyFatigue ?? 0} · 高强度 ${heavy}/${st?.maxHeavyTaskCount ?? 0}`;
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
    chip.textContent = staff?.name ?? sid;
    chip.className = staffChipClass(staff, sch.date);
    chip.title = staffChipTitle(staff, sch.date);
    if (!readOnly) { // 只读视图：不可拖拽，仍可点击人名进入替换弹窗
      enableDrag(chip, { onDragStart: (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ staffId: sid, scheduleId: sch.id })); } });
    }
    chip.onclick = (e) => { e.stopPropagation(); openReplaceDialog(staff, sch); };
    names.appendChild(chip);
  }
  card.appendChild(names);

  const cap = document.createElement('div');
  cap.className = `sch-capacity${filled >= capacity ? ' ok' : ''}`;
  cap.textContent = filled >= capacity ? '已满' : (filled === 0 ? `需 ${capacity} 人` : `缺 ${capacity - filled} 人`);
  if (!readOnly && filled < capacity) {
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
  return card;
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
  delBtn.style.marginRight = 'auto';
  delBtn.textContent = '删除班次';
  delBtn.title = '删除该班次，已排人员计数自动回退';
  let confirmTimer = null;
  delBtn.onclick = () => {
    if (delBtn.textContent !== '确认删除？') {
      delBtn.textContent = '确认删除？';
      delBtn.classList.add('confirming');
      confirmTimer = setTimeout(() => {
        delBtn.textContent = '删除班次';
        delBtn.classList.remove('confirming');
      }, 3000);
      return;
    }
    clearTimeout(confirmTimer);
    delBtn.disabled = true;
    delBtn.textContent = '删除中…';
    deleteSchedule();
  };
  footer.appendChild(delBtn);
  const modal = openModal({ title: '排班分配', body, footer });

  async function deleteSchedule() {
    for (const sid of sch.staffIds) {
      ctx.weeklyFatigue.set(sid, Math.max(0, (ctx.weeklyFatigue.get(sid) ?? 0) - (project?.fatigueScore ?? 0)));
      if (project?.fatigueScore === 3) ctx.heavyCounts.set(sid, Math.max(0, (ctx.heavyCounts.get(sid) ?? 0) - 1));
      const dKey = `${sid}|${sch.date}`;
      const sKey = `${sid}|${sch.date}|${sch.slotLabel}`;
      ctx.dailyCounts.set(dKey, Math.max(0, (ctx.dailyCounts?.get(dKey) ?? 0) - 1));
      ctx.slotCounts.set(sKey, Math.max(0, (ctx.slotCounts?.get(sKey) ?? 0) - 1));
    }
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
        ctx.weeklyFatigue.set(sid, Math.max(0, (ctx.weeklyFatigue.get(sid) ?? 0) - project.fatigueScore));
        if (project.fatigueScore === 3) ctx.heavyCounts.set(sid, Math.max(0, (ctx.heavyCounts.get(sid) ?? 0) - 1));
        const dailyKey = `${sid}|${sch.date}`;
        const slotKey = `${sid}|${sch.date}|${sch.slotLabel}`;
        ctx.dailyCounts.set(dailyKey, Math.max(0, (ctx.dailyCounts?.get(dailyKey) ?? 0) - 1));
        ctx.slotCounts.set(slotKey, Math.max(0, (ctx.slotCounts?.get(slotKey) ?? 0) - 1));
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
      const done = document.createElement('div');
      done.className = 'asg-full';
      done.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M20 6L9 17l-5-5"/></svg>本班次已满员';
      list.appendChild(done);
    }
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
      info.textContent = `周疲劳 ${ctx.weeklyFatigue.get(s.id) ?? 0}/${s.maxWeeklyFatigue}`;
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
          const dailyKey = `${s.id}|${sch.date}`;
          const slotKey = `${s.id}|${sch.date}|${sch.slotLabel}`;
          const dailyAfter = (ctx.dailyCounts?.get(dailyKey) ?? 0) + 1;
          ctx.dailyCounts.set(dailyKey, dailyAfter);
          ctx.slotCounts.set(slotKey, (ctx.slotCounts?.get(slotKey) ?? 0) + 1);
          ctx.weeklyFatigue.set(s.id, (ctx.weeklyFatigue.get(s.id) ?? 0) + project.fatigueScore);
          if (project.fatigueScore === 3) ctx.heavyCounts.set(s.id, (ctx.heavyCounts.get(s.id) ?? 0) + 1);
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
    body.append(head, progress, filledSec, chips, listSec, list);
  }
  renderBody();
}

function staffChipClass(staff, date) {
  if (!staff) return 'staff-chip';
  const fatigue = ctx.weeklyFatigue.get(staff.id) ?? 0;
  const heavy = ctx.heavyCounts.get(staff.id) ?? 0;
  const daily = date ? (ctx.dailyCounts?.get(`${staff.id}|${date}`) ?? 0) : 0;
  const warnDaily = ctx.settings?.warnDailyCount ?? 0;
  if (fatigue > staff.maxWeeklyFatigue || heavy > staff.maxHeavyTaskCount) return 'staff-chip over';
  if (daily >= warnDaily || fatigue >= staff.maxWeeklyFatigue * 0.8 || (staff.maxHeavyTaskCount > 0 && heavy >= staff.maxHeavyTaskCount)) return 'staff-chip warn';
  return 'staff-chip';
}

function staffChipTitle(staff, date) {
  if (!staff) return '';
  const fatigue = ctx.weeklyFatigue.get(staff.id) ?? 0;
  const heavy = ctx.heavyCounts.get(staff.id) ?? 0;
  const daily = date ? (ctx.dailyCounts?.get(`${staff.id}|${date}`) ?? 0) : 0;
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
  const ctxAfterMove = {
    ...ctx,
    weeklyFatigue: new Map(ctx.weeklyFatigue),
    heavyCounts: new Map(ctx.heavyCounts),
    dailyCounts: new Map(ctx.dailyCounts),
    slotCounts: new Map(ctx.slotCounts),
  };
  if (from && from.staffIds.includes(staffId)) {
    const fromProject = data.projects.find(p => p.id === from.projectId);
    ctxAfterMove.weeklyFatigue.set(staffId, Math.max(0, (ctxAfterMove.weeklyFatigue.get(staffId) ?? 0) - (fromProject?.fatigueScore ?? 0)));
    if (fromProject?.fatigueScore === 3) ctxAfterMove.heavyCounts.set(staffId, Math.max(0, (ctxAfterMove.heavyCounts.get(staffId) ?? 0) - 1));
    const fDailyKey = `${staffId}|${from.date}`;
    const fSlotKey = `${staffId}|${from.date}|${from.slotLabel}`;
    ctxAfterMove.dailyCounts.set(fDailyKey, Math.max(0, (ctxAfterMove.dailyCounts?.get(fDailyKey) ?? 0) - 1));
    ctxAfterMove.slotCounts.set(fSlotKey, Math.max(0, (ctxAfterMove.slotCounts?.get(fSlotKey) ?? 0) - 1));
  }
  const res = filterCandidate(staff, pseudoSchedule, projectById, ctxAfterMove);
  if (!res.ok) { showToast(res.reasons.join('；'), 'error'); return; }

  if (to.staffIds.length >= (toProject?.requiredCapacity ?? 1)) {
    showToast('目标班次已满员', 'error'); return;
  }

  if (from && from.staffIds.includes(staffId)) {
    from.staffIds = from.staffIds.filter(id => id !== staffId);
    const fromProject = data.projects.find(p => p.id === from.projectId);
    ctx.weeklyFatigue.set(staffId, Math.max(0, (ctx.weeklyFatigue.get(staffId) ?? 0) - (fromProject?.fatigueScore ?? 0)));
    if (fromProject?.fatigueScore === 3) ctx.heavyCounts.set(staffId, Math.max(0, (ctx.heavyCounts.get(staffId) ?? 0) - 1));
    const fDailyKey = `${staffId}|${from.date}`;
    const fSlotKey = `${staffId}|${from.date}|${from.slotLabel}`;
    ctx.dailyCounts.set(fDailyKey, Math.max(0, (ctx.dailyCounts?.get(fDailyKey) ?? 0) - 1));
    ctx.slotCounts.set(fSlotKey, Math.max(0, (ctx.slotCounts?.get(fSlotKey) ?? 0) - 1));
    await saveSchedule(from);
  }
  to.staffIds = [...new Set([...to.staffIds, staffId])];
  const tDailyKey = `${staffId}|${to.date}`;
  const tSlotKey = `${staffId}|${to.date}|${to.slotLabel}`;
  const dailyAfter = (ctx.dailyCounts?.get(tDailyKey) ?? 0) + 1;
  ctx.dailyCounts.set(tDailyKey, dailyAfter);
  ctx.slotCounts.set(tSlotKey, (ctx.slotCounts?.get(tSlotKey) ?? 0) + 1);
  ctx.weeklyFatigue.set(staffId, (ctx.weeklyFatigue.get(staffId) ?? 0) + (toProject?.fatigueScore ?? 0));
  if (toProject?.fatigueScore === 3) ctx.heavyCounts.set(staffId, (ctx.heavyCounts.get(staffId) ?? 0) + 1);
  if ((ctx.settings?.warnDailyCount ?? 0) > 0 && dailyAfter >= ctx.settings.warnDailyCount) {
    showToast(`${staff.name} 当日已达预警阈值 ${ctx.settings.warnDailyCount} 个任务`, 'info');
  } else {
    showToast(`${staff.name} 已调整至 ${toProject?.name ?? ''} ${to.slotLabel}`, 'success');
  }
  await saveSchedule(to);
  renderCalendar(document.querySelector('#view'));
}

function shiftWeek(days) {
  const [y, m, d] = currentWeekStart.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  currentWeekStart = getWeekStart(toDateStr(date));
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
    const dailyKey = `${best.s.id}|${sch.date}`;
    const slotKey = `${best.s.id}|${sch.date}|${sch.slotLabel}`;
    const dailyAfter = (ctx.dailyCounts?.get(dailyKey) ?? 0) + 1;
    ctx.dailyCounts.set(dailyKey, dailyAfter);
    ctx.slotCounts.set(slotKey, (ctx.slotCounts?.get(slotKey) ?? 0) + 1);
    ctx.weeklyFatigue.set(best.s.id, (ctx.weeklyFatigue.get(best.s.id) ?? 0) + project.fatigueScore);
    if (project.fatigueScore === 3) ctx.heavyCounts.set(best.s.id, (ctx.heavyCounts.get(best.s.id) ?? 0) + 1);
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
    const v = ctx.weeklyFatigue.get(staff.id) ?? 0;
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
          ctx.weeklyFatigue.set(staff.id, Math.max(0, (ctx.weeklyFatigue.get(staff.id) ?? 0) - project.fatigueScore));
          if (project.fatigueScore === 3) ctx.heavyCounts.set(staff.id, Math.max(0, (ctx.heavyCounts.get(staff.id) ?? 0) - 1));
          const srcDaily = `${staff.id}|${s.date}`;
          const srcSlot = `${staff.id}|${s.date}|${s.slotLabel}`;
          ctx.dailyCounts.set(srcDaily, Math.max(0, (ctx.dailyCounts?.get(srcDaily) ?? 0) - 1));
          ctx.slotCounts.set(srcSlot, Math.max(0, (ctx.slotCounts?.get(srcSlot) ?? 0) - 1));
          const tgtDaily = `${r.staff.id}|${s.date}`;
          const tgtSlot = `${r.staff.id}|${s.date}|${s.slotLabel}`;
          ctx.dailyCounts.set(tgtDaily, (ctx.dailyCounts?.get(tgtDaily) ?? 0) + 1);
          ctx.slotCounts.set(tgtSlot, (ctx.slotCounts?.get(tgtSlot) ?? 0) + 1);
          ctx.weeklyFatigue.set(r.staff.id, (ctx.weeklyFatigue.get(r.staff.id) ?? 0) + project.fatigueScore);
          if (project.fatigueScore === 3) ctx.heavyCounts.set(r.staff.id, (ctx.heavyCounts.get(r.staff.id) ?? 0) + 1);

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

  const dateRow = document.createElement('div');
  dateRow.style.cssText = 'margin-bottom:10px;display:flex;align-items:center;gap:8px;';
  dateRow.appendChild(document.createTextNode('日期'));
  const dateInput = document.createElement('input');
  dateInput.className = 'input';
  dateInput.type = 'date';
  dateInput.dataset.k = 'date';
  dateInput.value = date ?? currentWeekStart;
  dateRow.appendChild(dateInput);

  const slotRow = document.createElement('div');
  slotRow.style.cssText = 'margin-bottom:10px;display:flex;align-items:center;gap:8px;';
  slotRow.appendChild(document.createTextNode('时段'));
  const slotSel = createSelect({ options: SLOT_LABELS, value: slotLabel ?? SLOT_LABELS[0] });
  slotSel.dataset.k = 'slot';
  slotRow.appendChild(slotSel);

  const projRow = document.createElement('div');
  projRow.style.cssText = 'margin-bottom:10px;display:flex;align-items:center;gap:8px;';
  projRow.appendChild(document.createTextNode('任务'));
  const projSel = createSelect({
    options: data.projects.map((p) => ({ value: p.id, label: p.name })),
    value: presetProjectId || data.projects[0]?.id || '',
    placeholder: '请选择任务',
  });
  projSel.dataset.k = 'project';
  projRow.appendChild(projSel);

  body.append(dateRow, slotRow, projRow);
  const footer = document.createElement('div');
  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn-primary';
  okBtn.textContent = '创建';
  footer.appendChild(okBtn);
  const modal = openModal({ title: '手动建班次', body, footer });
  okBtn.onclick = async () => {
    const sch = createSchedule({
      date: body.querySelector('[data-k="date"]').value,
      slotLabel: body.querySelector('[data-k="slot"]').value,
      projectId: body.querySelector('[data-k="project"]').value,
    });
    await saveSchedule(sch);
    modal.close();
    renderCalendar(document.querySelector('#view'));
  };
}

function bulkPlanDialog() {
  const body = document.createElement('div');
  const hint = document.createElement('p');
  hint.style.cssText = 'margin-bottom:10px;color:#6a6178;font-size:13px;';
  hint.textContent = '按各任务的重复规则，从当前周开始向后展开班次空壳（不分配人员，已存在的自动跳过）。';
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
    const expected = expandWeeks(scopeProjects, currentWeekStart, n, createSchedule);
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
