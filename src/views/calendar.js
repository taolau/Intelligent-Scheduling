import { expandWeek, expandWeeks } from '../core/expand.js';
import { filterCandidate } from '../core/filter.js';
import { scoreCandidate } from '../core/score.js';
import { buildContext, recommendSubstitutes } from '../core/substitute.js';
import { getWeekStart, getWeekDates, getWeekLabel, todayStr, toDateStr } from '../core/week.js';
import { loadAll, saveSchedule, saveLeave } from '../data/store.js';
import { createSchedule, createLeave, SLOT_LABELS, DEFAULT_TIMES } from '../data/model.js';
import { openModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { enableDrag, enableDrop } from '../ui/dnd.js';
import { exportAttendance } from '../ui/excel.js';
import { createSelect } from '../ui/select.js';

let currentWeekStart = getWeekStart(todayStr());
let data = { projects: [], staffs: [], schedules: [], leaves: [] };
let ctx = null;

const ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15 18l-6-6 6-6"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M9 18l6-6-6-6"/></svg>';
const ICON_ZAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>';
const ICON_BULK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>';
const ICON_EXPORT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';

// 确保本周班次已展开并持久化
async function ensureExpanded() {
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const expected = expandWeek(data.projects, currentWeekStart, createSchedule);
  const existing = new Set(data.schedules.map(s => `${s.date}|${s.projectId}|${s.slotLabel}`));
  for (const sch of expected) {
    if (!existing.has(`${sch.date}|${sch.projectId}|${sch.slotLabel}`)) {
      await saveSchedule(sch);
    }
  }
  data = await loadAll();
}

export async function renderCalendar(container) {
  data = await loadAll();
  await ensureExpanded();
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  ctx = buildContext(data.staffs, data.schedules, data.leaves, projectById);

  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'cal-bar';
  const left = document.createElement('div');
  left.className = 'cal-bar-group';
  const right = document.createElement('div');
  right.className = 'cal-bar-group';
  const prev = btn('上周', false, false, ICON_PREV), next = btn('下周', false, false, ICON_NEXT, true);
  const label = document.createElement('span');
  label.className = 'week-label';
  label.textContent = getWeekLabel(currentWeekStart);
  const todayBtn = btn('今天');
  const autoBtn = btn('智能排班', true, false, ICON_ZAP), bulkBtn = btn('批量铺排', false, false, ICON_BULK), exportBtn = btn('导出考勤', false, false, ICON_EXPORT);
  left.append(prev, label, next, todayBtn);
  right.append(autoBtn, bulkBtn, exportBtn);
  bar.append(left, right);
  container.appendChild(bar);

  prev.onclick = () => shiftWeek(-7);
  next.onclick = () => shiftWeek(7);
  todayBtn.onclick = () => { currentWeekStart = getWeekStart(todayStr()); renderCalendar(container); };
  autoBtn.onclick = () => smartFill();
  bulkBtn.onclick = () => bulkPlanDialog();
  exportBtn.onclick = () => exportAttendance(data.schedules, data.projects, data.staffs, currentWeekStart);

  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const dates = getWeekDates(currentWeekStart);
  const today = todayStr();
  grid.appendChild(corner('时段', 'cal-date'));
  dates.forEach((d, i) => {
    const c = corner(`${weekdayNames[i]}<br><b>${d.slice(5)}</b>`, 'cal-date');
    if (d === today) { c.classList.add('cal-today'); c.title = '今天'; }
    grid.appendChild(c);
  });

  for (const slotLabel of SLOT_LABELS) {
    const slot = document.createElement('div');
    slot.className = 'cal-corner cal-slot';
    slot.textContent = slotLabel;
    grid.appendChild(slot);
    for (const date of dates) {
      const cell = document.createElement('div');
      cell.className = `cal-cell${date === today ? ' cal-col-today' : ''}`;
      cell.dataset.date = date;
      cell.dataset.slot = slotLabel;
      const cellSchedules = data.schedules.filter(s => s.date === date && s.slotLabel === slotLabel);
      if (cellSchedules.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cal-cell empty';
        empty.innerHTML = '<span class="plus">＋</span>建班次';
        empty.title = '为此时段创建班次';
        empty.onclick = () => manualCreate(date, slotLabel);
        cell.appendChild(empty);
      }
      for (const sch of cellSchedules) {
        cell.appendChild(renderScheduleCard(sch));
      }
      enableDrop(cell, { onDrop: (e) => dropStaff(e, cell) });
      grid.appendChild(cell);
    }
  }
  container.appendChild(grid);
}

function corner(text, extra = '') {
  const c = document.createElement('div');
  c.innerHTML = text;
  c.className = `cal-corner${extra ? ' ' + extra : ''}`;
  return c;
}

function btn(text, active = false, plain = false, icon = '', iconAfter = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = iconAfter ? `<span>${text}</span>${icon}` : `${icon}<span>${text}</span>`;
  b.className = plain ? 'week-label' : `btn btn-${active ? 'primary' : 'default'}`;
  return b;
}

function renderScheduleCard(sch) {
  const card = document.createElement('div');
  card.className = 'sch-card';
  const project = data.projects.find(p => p.id === sch.projectId);
  const slot = project?.slots?.find(s => s.label === sch.slotLabel);
  const timeText = slot ? `${slot.startTime}-${slot.endTime}` : (DEFAULT_TIMES[sch.slotLabel] ?? '');
  const capacity = project?.requiredCapacity ?? 1;
  const filled = sch.staffIds.length;
  if (filled >= capacity) card.classList.add('full');
  else if (filled > 0) card.classList.add('short');

  const title = document.createElement('div');
  title.textContent = `${project?.name ?? sch.projectId}`;
  title.className = 'sch-title';
  card.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'sch-meta';
  const time = document.createElement('span');
  time.textContent = timeText;
  meta.appendChild(time);
  if (project) {
    const badge = document.createElement('span');
    badge.className = 'sch-badge';
    badge.textContent = '🔥'.repeat(project.fatigueScore);
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
    chip.className = staffChipClass(staff);
    chip.title = staffChipTitle(staff);
    enableDrag(chip, { onDragStart: (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ staffId: sid, scheduleId: sch.id })); } });
    chip.onclick = () => staffDialog(staff, sch);
    names.appendChild(chip);
  }
  card.appendChild(names);

  const cap = document.createElement('div');
  cap.className = `sch-capacity${filled >= capacity ? ' ok' : ''}`;
  cap.textContent = filled >= capacity ? '已满' : (filled === 0 ? `需 ${capacity} 人` : `缺 ${capacity - filled} 人`);
  card.appendChild(cap);
  return card;
}

function staffChipClass(staff) {
  if (!staff) return 'staff-chip';
  const fatigue = ctx.weeklyFatigue.get(staff.id) ?? 0;
  const heavy = ctx.heavyCounts.get(staff.id) ?? 0;
  if (fatigue > staff.maxWeeklyFatigue || heavy > staff.maxHeavyTaskCount) return 'staff-chip over';
  if (fatigue >= staff.maxWeeklyFatigue * 0.8 || (staff.maxHeavyTaskCount > 0 && heavy >= staff.maxHeavyTaskCount)) return 'staff-chip warn';
  return 'staff-chip';
}

function staffChipTitle(staff) {
  if (!staff) return '';
  const fatigue = ctx.weeklyFatigue.get(staff.id) ?? 0;
  const heavy = ctx.heavyCounts.get(staff.id) ?? 0;
  return `本周疲劳 ${fatigue}/${staff.maxWeeklyFatigue}，高强度 ${heavy}/${staff.maxHeavyTaskCount}`;
}

async function dropStaff(e, cell) {
  const { staffId, scheduleId } = JSON.parse(e.dataTransfer.getData('text/plain'));
  const targetDate = cell.dataset.date;
  const targetSlot = cell.dataset.slot;
  const targetProject = data.projects.find(p => p.id === data.schedules.find(s => s.date === targetDate && s.slotLabel === targetSlot)?.projectId);
  if (!targetProject) { showToast('目标格无班次', 'error'); return; }
  const staff = data.staffs.find(s => s.id === staffId);
  const pseudoSchedule = { date: targetDate, projectId: targetProject.id, slotLabel: targetSlot };
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const res = filterCandidate(staff, pseudoSchedule, projectById, ctx);
  if (!res.ok) { showToast(res.reasons.join('；'), 'error'); return; }

  const from = data.schedules.find(s => s.id === scheduleId);
  const to = data.schedules.find(s => s.date === targetDate && s.slotLabel === targetSlot);
  if (!to) { showToast('目标格无班次，请先手动建班次', 'error'); return; }
  if (from && from.staffIds.includes(staffId)) {
    from.staffIds = from.staffIds.filter(id => id !== staffId);
    await saveSchedule(from);
  }
  to.staffIds = [...new Set([...to.staffIds, staffId])];
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

async function smartFill() {
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const empties = data.schedules.filter(s => s.staffIds.length < (projectById[s.projectId]?.requiredCapacity ?? 1));
  empties.sort((a, b) => a.date.localeCompare(b.date) || SLOT_LABELS.indexOf(a.slotLabel) - SLOT_LABELS.indexOf(b.slotLabel));
  let filled = 0;
  for (const sch of empties) {
    while (sch.staffIds.length < projectById[sch.projectId].requiredCapacity) {
      const project = projectById[sch.projectId];
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
      ctx.weeklyFatigue.set(best.s.id, (ctx.weeklyFatigue.get(best.s.id) ?? 0) + project.fatigueScore);
      if (project.fatigueScore === 3) ctx.heavyCounts.set(best.s.id, (ctx.heavyCounts.get(best.s.id) ?? 0) + 1);
      await saveSchedule(sch);
      filled++;
    }
  }
  showToast(`智能排班完成：填充 ${filled} 个名额`, filled ? 'success' : 'info');
  renderCalendar(document.querySelector('#view'));
}

function staffDialog(staff, sch) {
  const body = document.createElement('div');
  body.innerHTML = `<p><strong>${staff.name}</strong>（${staff.status}）</p><p>本周劳累积分：${ctx.weeklyFatigue.get(staff.id) ?? 0}</p>`;
  const footer = document.createElement('div');
  const leaveBtn = document.createElement('button');
  leaveBtn.type = 'button';
  leaveBtn.className = 'btn btn-danger';
  leaveBtn.textContent = '标记请假并找替补';
  footer.appendChild(leaveBtn);
  const modal = openModal({ title: staff.name, body, footer });
  leaveBtn.onclick = async () => {
    const l = createLeave({ staffId: staff.id, date: sch.date });
    await saveLeave(l);
    modal.close();
    const daySchedules = data.schedules.filter(s => s.date === sch.date && s.staffIds.includes(staff.id));
    for (const s of daySchedules) {
      const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
      const recom = recommendSubstitutes(data.staffs, s, projectById, ctx, staff.id);
      if (recom.length > 0) {
        s.staffIds = s.staffIds.filter(id => id !== staff.id);
        await saveSchedule(s);
        await openSubstituteModal(s, recom);
      } else {
        s.staffIds = s.staffIds.filter(id => id !== staff.id);
        await saveSchedule(s);
        showToast(`班次 ${s.date} ${s.slotLabel} 无可替补人员`, 'error');
      }
    }
    renderCalendar(document.querySelector('#view'));
  };
}

function openSubstituteModal(sch, recom) {
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const body = document.createElement('div');
  body.innerHTML = `<p><strong>${sch.date} ${sch.slotLabel} ${projectById[sch.projectId]?.name}</strong> 候选替补：</p>`;
  for (const r of recom) {
    const row = document.createElement('div');
    row.style.cssText = 'border:1px solid #eee;border-radius:6px;padding:10px;margin:8px 0;';
    const name = document.createElement('div');
    name.innerHTML = `<strong>${r.staff.name}</strong>（得分 ${r.score}）`;
    const why = document.createElement('div');
    why.style.cssText = 'color:#6b7280;font-size:13px;';
    why.textContent = r.reasons.join('；');
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'btn btn-success btn-sm';
    pick.textContent = '选此替补';
    pick.onclick = async () => {
      sch.staffIds = [...sch.staffIds, r.staff.id];
      await saveSchedule(sch);
      showToast('已替换', 'success');
      renderCalendar(document.querySelector('#view'));
    };
    row.append(name, why, pick);
    body.appendChild(row);
  }
  openModal({ title: '替补推荐', body });
}

function manualCreate(date, slotLabel) {
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
    value: data.projects[0]?.id ?? '',
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
  hint.style.cssText = 'margin-bottom:10px;color:#6b7280;font-size:13px;';
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
    const expected = expandWeeks(data.projects, currentWeekStart, n, createSchedule);
    const existing = new Set(data.schedules.map(s => `${s.date}|${s.projectId}|${s.slotLabel}`));
    let created = 0;
    for (const sch of expected) {
      if (!existing.has(`${sch.date}|${sch.projectId}|${sch.slotLabel}`)) {
        await saveSchedule(sch);
        created++;
      }
    }
    data = await loadAll();
    modal.close();
    showToast(`已铺排 ${n} 周、新建 ${created} 个班次`, created ? 'success' : 'info');
    renderCalendar(document.querySelector('#view'));
  };
}
