import { openModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { field, setError, rowsEditor } from '../ui/fields.js';
import { createSelect } from '../ui/select.js';
import { getCache, saveProject, saveStaff, exportJSON, importJSON } from '../data/store.js';
import { importProjects, importStaffs, exportProjects, exportStaffs } from '../ui/excel.js';
import { createProject, createStaff, validateProject, validateStaff, SLOT_LABELS, STAFF_STATUSES, FATIGUE_MAX, DEFAULT_TIMES, fillSlotTimes } from '../data/model.js';

function esc(v) {
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_UPLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 15V3m0 0L7 8m5-5l5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';

export function renderConfig(container) {
  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'seg';
  bar.style.marginBottom = '12px';
  const tabStaff = document.createElement('button');
  tabStaff.type = 'button';
  tabStaff.className = 'active';
  tabStaff.textContent = '人员管理';
  const tabProject = document.createElement('button');
  tabProject.type = 'button';
  tabProject.textContent = '任务管理';
  bar.append(tabStaff, tabProject);
  container.appendChild(bar);
  const body = document.createElement('div');
  container.appendChild(body);
  renderStaffs(body);
  tabStaff.onclick = () => { setTab(tabStaff, tabProject); renderStaffs(body); };
  tabProject.onclick = () => { setTab(tabProject, tabStaff); renderProjects(body); };
}

function btn(text, active = false, icon = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `${icon}<span>${text}</span>`;
  b.className = `btn btn-${active ? 'primary' : 'default'}`;
  return b;
}

function setTab(on, off) {
  on.classList.add('active');
  off.classList.remove('active');
}

function statusBadge(status) {
  const map = {
    active: ['badge-success', '活跃'],
    new: ['badge-primary', '新入'],
    left: ['badge-muted', '已退出'],
  };
  const [cls, label] = map[status] ?? ['badge-muted', status];
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${label}</span>`;
}

function activeBadge(on) {
  return on
    ? '<span class="badge badge-success"><span class="badge-dot"></span>启用</span>'
    : '<span class="badge badge-muted"><span class="badge-dot"></span>停用</span>';
}

async function renderStaffs(body) {
  body.innerHTML = '';
  const { staffs, projects } = getCache();
  const projName = new Map(projects.map(p => [p.id, p.name]));
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;';
  actions.append(
    btn('新增人员', false, ICON_PLUS), btn('Excel 导入', false, ICON_UPLOAD), btn('Excel 导出', false, ICON_DOWNLOAD),
    btn('JSON 备份', false, ICON_DOWNLOAD), btn('JSON 恢复', false, ICON_UPLOAD),
  );
  actions.children[0].onclick = () => editStaffDialog();
  actions.children[1].onclick = () => fileDialog(importStaffs, '人员 Excel');
  actions.children[2].onclick = () => exportStaffs();
  actions.children[3].onclick = async () => { const blob = new Blob([await exportJSON()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '排班备份.json'; a.click(); URL.revokeObjectURL(url); };
  actions.children[4].onclick = () => jsonRestore();
  body.appendChild(actions);

  const card = document.createElement('div');
  card.className = 'card';
  const table = document.createElement('table');
  table.className = 'table';
  const head = ['姓名', '状态', '可胜任项目', '擅长项目', '不合适项目', '周疲劳上限', '高强度上限', '操作'];
  table.innerHTML = '<thead><tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  for (const s of staffs) {
    const tr = document.createElement('tr');
    const pref = s.preferredProjects.map(p => `<span class="tag" title="${esc(p.reason ?? '')}">${esc(projName.get(p.projectId) ?? p.projectId)}</span>`).join(' ') || '-';
    const banned = s.bannedProjects.map(b => `<span class="tag tag-danger" title="${esc(b.reason ?? '')}">${esc(projName.get(b.projectId) ?? b.projectId)}</span>`).join(' ') || '-';
    tr.innerHTML = `
      <td><strong>${s.name}</strong></td>
      <td>${statusBadge(s.status)}</td>
      <td>${s.allowedProjects.map(id => projName.get(id) ?? id).join(', ') || '-'}</td>
      <td>${pref}</td>
      <td>${banned}</td>
      <td>${s.maxWeeklyFatigue}</td>
      <td>${s.maxHeavyTaskCount}</td>
      <td><button type="button" data-edit class="btn btn-default btn-sm">${ICON_EDIT}编辑</button></td>`;
    tr.querySelector('[data-edit]').onclick = () => editStaffDialog(s);
    tbody.appendChild(tr);
  }
  card.appendChild(table);
  body.appendChild(card);
}

async function editStaffDialog(staff) {
  const target = staff ?? createStaff({});
  const { projects } = getCache();
  const projectOptions = projects.map(p => ({ value: p.id, label: p.name }));
  const body = document.createElement('div');

  const nameInput = document.createElement('input');
  nameInput.className = 'input';
  nameInput.value = target.name;
  nameInput.placeholder = '请输入姓名';
  const nameF = field({ label: '姓名', required: true, control: nameInput });

  const STATUS_META = {
    new: { label: '新入', desc: '新入保护：不参与高强度' },
    active: { label: '活跃', desc: '正常参与排班' },
    left: { label: '已退出', desc: '保留历史，不再参与' },
  };
  const statusSel = createSelect({
    options: STAFF_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, desc: STATUS_META[s].desc })),
    value: target.status,
  });
  const statusF = field({ label: '状态', control: statusSel });

  const allowedSel = createSelect({
    multiple: true,
    placeholder: '请选择可胜任项目',
    options: projects.map((p) => ({ value: p.id, label: p.name })),
    value: target.allowedProjects,
  });
  const allowedF = field({ label: '可胜任项目', control: allowedSel, hint: '可多选' });

  const preferredEditor = rowsEditor({
    label: '擅长项目（加分）', addLabel: '＋ 添加擅长项目',
    cols: [
      { key: 'projectId', type: 'select', options: projectOptions },
      { key: 'reason', type: 'text', placeholder: '如：体力好，搬运熟练' },
    ],
    initial: target.preferredProjects,
  });

  const bannedEditor = rowsEditor({
    label: '不合适项目（硬性过滤）', addLabel: '＋ 添加不合适项目',
    cols: [
      { key: 'projectId', type: 'select', options: projectOptions },
      { key: 'reason', type: 'text', placeholder: '如：腰伤，不宜搬重物' },
    ],
    initial: target.bannedProjects,
  });

  const fatigueInput = document.createElement('input');
  fatigueInput.className = 'input';
  fatigueInput.type = 'number';
  fatigueInput.min = 1;
  fatigueInput.value = target.maxWeeklyFatigue;
  const fatigueF = field({ label: '周疲劳上限', control: fatigueInput });

  const heavyInput = document.createElement('input');
  heavyInput.className = 'input';
  heavyInput.type = 'number';
  heavyInput.min = 0;
  heavyInput.value = target.maxHeavyTaskCount;
  const heavyF = field({ label: '高强度次数上限', control: heavyInput });

  body.append(nameF.wrap, statusF.wrap, allowedF.wrap, preferredEditor.el, bannedEditor.el, fatigueF.wrap, heavyF.wrap);
  const footer = document.createElement('div');
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = '保存';
  footer.appendChild(saveBtn);
  const modal = openModal({ title: staff ? '编辑人员' : '新增人员', body, footer });

  saveBtn.onclick = async () => {
    const draft = createStaff({
      id: target.id,
      name: nameInput.value,
      status: statusSel.value,
      allowedProjects: allowedSel.value,
      preferredProjects: preferredEditor.collect(),
      bannedProjects: bannedEditor.collect(),
      maxWeeklyFatigue: Number(fatigueInput.value),
      maxHeavyTaskCount: Number(heavyInput.value),
    });
    const v = validateStaff(draft);
    if (!v.valid) {
      const byField = {};
      v.errors.forEach(e => { (byField[e.field] ??= []).push(e.msg); });
      setError(nameF, byField.name?.join('；') || '');
      setError(fatigueF, byField.maxWeeklyFatigue?.join('；') || '');
      setError(heavyF, byField.maxHeavyTaskCount?.join('；') || '');
      if (byField.bannedProjects) showToast(byField.bannedProjects.join('；'), 'error');
      if (byField.preferredProjects) showToast(byField.preferredProjects.join('；'), 'error');
      return;
    }
    await saveStaff(draft);
    modal.close();
    showToast('已保存', 'success');
    renderConfig(document.querySelector('#view'));
  };
}

async function renderProjects(body) {
  body.innerHTML = '';
  const { projects } = getCache();
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;';
  actions.append(btn('新增任务', false, ICON_PLUS), btn('Excel 导入', false, ICON_UPLOAD), btn('Excel 导出', false, ICON_DOWNLOAD));
  actions.children[0].onclick = () => editProjectDialog();
  actions.children[1].onclick = () => fileDialog(importProjects, '任务 Excel');
  actions.children[2].onclick = () => exportProjects();
  body.appendChild(actions);

  const card = document.createElement('div');
  card.className = 'card';
  const table = document.createElement('table');
  table.className = 'table';
  const head = ['名称', '劳累指数', '所需人数', '重复星期', '时段', '启用', '操作'];
  table.innerHTML = '<thead><tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  for (const p of projects) {
    const tr = document.createElement('tr');
    const week = p.weekDays.length ? p.weekDays.map(d => ['日','一','二','三','四','五','六'][d]).join('、') : '一次性';
    const slots = p.slots.map(s => `${s.label} ${s.startTime}-${s.endTime}`).join('；') || '-';
    tr.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td>${'🔥'.repeat(p.fatigueScore)}</td>
      <td>${p.requiredCapacity}</td>
      <td>${week}</td>
      <td>${slots}</td>
      <td>${activeBadge(p.active)}</td>
      <td><button type="button" data-edit class="btn btn-default btn-sm">${ICON_EDIT}编辑</button></td>`;
    tr.querySelector('[data-edit]').onclick = () => editProjectDialog(p);
    tbody.appendChild(tr);
  }
  card.appendChild(table);
  body.appendChild(card);
}

async function editProjectDialog(project) {
  const target = project ?? createProject({});
  const body = document.createElement('div');

  const nameInput = document.createElement('input');
  nameInput.className = 'input';
  nameInput.value = target.name;
  nameInput.placeholder = '请输入任务名';
  const nameF = field({ label: '名称', required: true, control: nameInput });

  const fatigueSel = createSelect({
    options: Array.from({ length: FATIGUE_MAX }, (_, i) => {
      const n = i + 1;
      return { value: String(n), label: `${n}（${n === 1 ? '轻松' : n === 2 ? '中等' : '高强度'}）` };
    }),
    value: String(target.fatigueScore),
  });
  const fatigueF = field({ label: '劳累指数', control: fatigueSel });

  const capInput = document.createElement('input');
  capInput.className = 'input';
  capInput.type = 'number';
  capInput.min = 1;
  capInput.value = target.requiredCapacity;
  const capF = field({ label: '所需人数', control: capInput });

  const daysWrap = document.createElement('div');
  daysWrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  const dayChecks = [];
  const DAYS = ['日', '一', '二', '三', '四', '五', '六'];
  for (let d = 0; d < 7; d++) {
    const lab = document.createElement('label');
    lab.className = 'day-chip';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = d;
    cb.checked = target.weekDays.includes(d);
    lab.classList.toggle('on', cb.checked);
    cb.onchange = () => lab.classList.toggle('on', cb.checked);
    dayChecks.push(cb);
    lab.append(cb, document.createTextNode(`周${DAYS[d]}`));
    daysWrap.appendChild(lab);
  }
  const daysF = field({ label: '重复星期（全不勾 = 一次性任务）', control: daysWrap });

  const slotDefaults = Object.fromEntries(SLOT_LABELS.map(l => {
    const [start, end] = (DEFAULT_TIMES[l] ?? '08:00-12:00').split('-');
    return [l, { start, end }];
  }));
  const slotEditor = rowsEditor({
    label: '时段', addLabel: '＋ 添加时段',
    cols: [
      { key: 'slot', type: 'timeRange', options: SLOT_LABELS, defaults: slotDefaults },
    ],
    initial: target.slots.map(s => ({ slot: { label: s.label, startTime: s.startTime, endTime: s.endTime } })),
  });

  const activeSel = createSelect({
    options: [{ value: 'true', label: '启用' }, { value: 'false', label: '停用' }],
    value: String(target.active),
  });
  const activeF = field({ label: '启用状态', control: activeSel });

  body.append(nameF.wrap, fatigueF.wrap, capF.wrap, daysF.wrap, slotEditor.el, activeF.wrap);
  const footer = document.createElement('div');
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = '保存';
  footer.appendChild(saveBtn);
  const modal = openModal({ title: project ? '编辑任务' : '新增任务', body, footer });

  saveBtn.onclick = async () => {
    const draft = createProject({
      id: target.id,
      name: nameInput.value,
      fatigueScore: Number(fatigueSel.value),
      requiredCapacity: Number(capInput.value),
      weekDays: dayChecks.filter(c => c.checked).map(c => Number(c.value)),
      slots: fillSlotTimes(slotEditor.collect()),
      active: activeSel.value === 'true',
    });
    const v = validateProject(draft);
    if (!v.valid) {
      const byField = {};
      v.errors.forEach(e => { (byField[e.field] ??= []).push(e.msg); });
      setError(nameF, byField.name?.join('；') || '');
      setError(fatigueF, byField.fatigueScore?.join('；') || '');
      setError(capF, byField.requiredCapacity?.join('；') || '');
      if (byField.slots) showToast(byField.slots.join('；'), 'error');
      if (byField.weekDays) showToast(byField.weekDays.join('；'), 'error');
      return;
    }
    await saveProject(draft);
    modal.close();
    showToast('已保存', 'success');
    renderConfig(document.querySelector('#view'));
  };
}

function fileDialog(handler, label) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = async () => {
    if (!input.files[0]) return;
    const r = await handler(input.files[0]);
    showToast(r.message, r.ok ? 'success' : 'error');
    renderConfig(document.querySelector('#view'));
  };
  input.click();
}

function jsonRestore() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    if (!input.files[0]) return;
    const text = await input.files[0].text();
    const r = await importJSON(text);
    showToast(r.message, r.ok ? 'success' : 'error');
    renderConfig(document.querySelector('#view'));
  };
  input.click();
}
