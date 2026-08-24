import { expandWeek } from '../core/expand.js';
import { filterCandidate } from '../core/filter.js';
import { scoreCandidate } from '../core/score.js';
import { buildContext, recommendSubstitutes } from '../core/substitute.js';
import { getWeekStart, getWeekDates, getWeekLabel } from '../core/week.js';
import { loadAll, saveSchedule, saveLeave } from '../data/store.js';
import { createSchedule, createLeave, SLOT_LABELS } from '../data/model.js';
import { openModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { enableDrag, enableDrop } from '../ui/dnd.js';
import { exportAttendance } from '../ui/excel.js';

let currentWeekStart = getWeekStart(new Date().toISOString().slice(0, 10));
let data = { projects: [], staffs: [], schedules: [], leaves: [] };
let ctx = null;

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
  bar.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;';
  const prev = btn('← 上周'), next = btn('下周 →'), label = btn(getWeekLabel(currentWeekStart), false, true);
  const autoBtn = btn('智能排班'), exportBtn = btn('导出考勤'), manualBtn = btn('手动建班次');
  bar.append(prev, next, label, autoBtn, manualBtn, exportBtn);
  container.appendChild(bar);

  prev.onclick = () => shiftWeek(-7);
  next.onclick = () => shiftWeek(7);
  autoBtn.onclick = () => smartFill();
  exportBtn.onclick = () => exportAttendance(data.schedules, data.projects, data.staffs);
  manualBtn.onclick = () => manualCreate();

  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const dates = getWeekDates(currentWeekStart);
  grid.appendChild(corner('时段'));
  dates.forEach((d, i) => grid.appendChild(corner(`${weekdayNames[i]}<br>${d.slice(5)}`)));

  for (const slotLabel of SLOT_LABELS) {
    grid.appendChild(corner(slotLabel));
    for (const date of dates) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      cell.dataset.date = date;
      cell.dataset.slot = slotLabel;
      const cellSchedules = data.schedules.filter(s => s.date === date && s.slotLabel === slotLabel);
      if (cellSchedules.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cal-cell empty';
        empty.textContent = '＋ 手动建班次';
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

function corner(text) {
  const c = document.createElement('div');
  c.innerHTML = text;
  c.className = 'cal-corner';
  return c;
}

function btn(text, active = false, plain = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.className = plain ? 'week-label' : `btn btn-${active ? 'primary' : 'default'}`;
  return b;
}

function renderScheduleCard(sch) {
  const card = document.createElement('div');
  card.className = 'sch-card';
  const project = data.projects.find(p => p.id === sch.projectId);
  const title = document.createElement('div');
  title.textContent = `${project?.name ?? sch.projectId}`;
  title.className = 'sch-title';
  card.appendChild(title);
  const names = document.createElement('div');
  for (const sid of sch.staffIds) {
    const staff = data.staffs.find(s => s.id === sid);
    const chip = document.createElement('span');
    chip.textContent = staff?.name ?? sid;
    chip.className = 'staff-chip';
    enableDrag(chip, { onDragStart: (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ staffId: sid, scheduleId: sch.id })); } });
    chip.onclick = () => staffDialog(staff, sch);
    names.appendChild(chip);
  }
  card.appendChild(names);
  return card;
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
  currentWeekStart = getWeekStart(date.toISOString().slice(0, 10));
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
  body.innerHTML = `
    <div style="margin-bottom:8px;">日期 <input class="input" data-k="date" value="${date ?? currentWeekStart}"></div>
    <div style="margin-bottom:8px;">时段
      <select class="select" data-k="slot">${SLOT_LABELS.map(s => `<option ${s === slotLabel ? 'selected' : ''}>${s}</option>`).join('')}</select>
    </div>
    <div style="margin-bottom:8px;">任务
      <select class="select" data-k="project">${data.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
    </div>`;
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
