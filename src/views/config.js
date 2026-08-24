import { openModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { loadAll, saveProject, saveStaff, exportJSON, importJSON } from '../data/store.js';
import { importProjects, importStaffs, exportProjects, exportStaffs } from '../ui/excel.js';
import { createProject, createStaff, validateProject, validateStaff, SLOT_LABELS, STAFF_STATUSES } from '../data/model.js';

export function renderConfig(container) {
  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;';
  const tabStaff = btn('人员管理', true);
  const tabProject = btn('任务管理');
  bar.append(tabStaff, tabProject);
  container.appendChild(bar);
  const body = document.createElement('div');
  container.appendChild(body);
  renderStaffs(body);
  tabStaff.onclick = () => { setActive(tabStaff, tabProject); renderStaffs(body); };
  tabProject.onclick = () => { setActive(tabProject, tabStaff); renderProjects(body); };
}

function btn(text, active = false) {
  const b = document.createElement('button');
  b.textContent = text;
  b.style.cssText = 'padding:8px 14px;border:1px solid #ccc;border-radius:6px;background:' + (active ? '#2563eb' : '#fff') + ';color:' + (active ? '#fff' : '#222') + ';cursor:pointer;';
  return b;
}

function setActive(on, ...offs) {
  on.style.background = '#2563eb'; on.style.color = '#fff';
  offs.forEach(o => { o.style.background = '#fff'; o.style.color = '#222'; });
}

async function renderStaffs(body) {
  body.innerHTML = '';
  const { staffs } = await loadAll();
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;';
  actions.append(
    btn('新增人员', false), btn('Excel 导入', false), btn('Excel 导出', false),
    btn('JSON 备份', false), btn('JSON 恢复', false),
  );
  actions.children[0].onclick = () => editStaffDialog();
  actions.children[1].onclick = () => fileDialog(importStaffs, '人员 Excel');
  actions.children[2].onclick = () => exportStaffs();
  actions.children[3].onclick = async () => { const blob = new Blob([await exportJSON()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '排班备份.json'; a.click(); URL.revokeObjectURL(url); };
  actions.children[4].onclick = () => jsonRestore();
  body.appendChild(actions);

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:14px;';
  const head = ['姓名', '状态', '可胜任项目', '擅长(原因)', '禁忌(原因)', '周疲劳上限', '高强度上限', '操作'];
  table.innerHTML = '<thead><tr>' + head.map(h => `<th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;white-space:nowrap;">${h}</th>`).join('') + '</tr></thead>';
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  for (const s of staffs) {
    const tr = document.createElement('tr');
    const pref = s.preferredProjects.map(p => `${p.projectId}${p.reason ? `(${p.reason})` : ''}`).join(', ') || '-';
    const banned = s.bannedProjects.map(b => `${b.projectId}${b.reason ? `(${b.reason})` : ''}`).join(', ') || '-';
    tr.innerHTML = `
      <td style="padding:8px;border-bottom:1px solid #eee;">${s.name}</td>
      <td style="padding:8px;">${s.status}</td>
      <td style="padding:8px;">${s.allowedProjects.join(', ') || '-'}</td>
      <td style="padding:8px;">${pref}</td>
      <td style="padding:8px;">${banned}</td>
      <td style="padding:8px;">${s.maxWeeklyFatigue}</td>
      <td style="padding:8px;">${s.maxHeavyTaskCount}</td>
      <td style="padding:8px;"><button data-edit>编辑</button></td>`;
    tr.querySelector('[data-edit]').onclick = () => editStaffDialog(s);
    tbody.appendChild(tr);
  }
  body.appendChild(table);
}

function editStaffDialog(staff) {
  const target = staff ?? createStaff({});
  const body = document.createElement('div');
  body.innerHTML = `
    <div style="margin-bottom:8px;">姓名 <input data-k="name" value="${target.name}"></div>
    <div style="margin-bottom:8px;">状态
      <select data-k="status">${STAFF_STATUSES.map(s => `<option ${s === target.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
    </div>
    <div style="margin-bottom:8px;">可胜任项目ID(逗号分隔) <input data-k="allowed" value="${target.allowedProjects.join(',')}"></div>
    <div style="margin-bottom:8px;">擅长项目JSON <input data-k="preferred" value="${JSON.stringify(target.preferredProjects)}"></div>
    <div style="margin-bottom:8px;">禁忌项目JSON <input data-k="banned" value="${JSON.stringify(target.bannedProjects)}"></div>
    <div style="margin-bottom:8px;">周疲劳上限 <input data-k="maxWeeklyFatigue" type="number" value="${target.maxWeeklyFatigue}"></div>
    <div style="margin-bottom:8px;">高强度次数上限 <input data-k="maxHeavyTaskCount" type="number" value="${target.maxHeavyTaskCount}"></div>`;
  const footer = document.createElement('div');
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.style.cssText = 'padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;';
  footer.appendChild(saveBtn);
  const modal = openModal({ title: staff ? '编辑人员' : '新增人员', body, footer });
  saveBtn.onclick = async () => {
    const draft = createStaff({
      id: target.id,
      name: body.querySelector('[data-k="name"]').value,
      status: body.querySelector('[data-k="status"]').value,
      allowedProjects: body.querySelector('[data-k="allowed"]').value.split(',').filter(Boolean),
      preferredProjects: safeJson(body.querySelector('[data-k="preferred"]').value, []),
      bannedProjects: safeJson(body.querySelector('[data-k="banned"]').value, []),
      maxWeeklyFatigue: Number(body.querySelector('[data-k="maxWeeklyFatigue"]').value),
      maxHeavyTaskCount: Number(body.querySelector('[data-k="maxHeavyTaskCount"]').value),
    });
    const v = validateStaff(draft);
    if (!v.valid) { showToast(v.errors.join('；'), 'error'); return; }
    await saveStaff(draft);
    modal.close();
    showToast('已保存', 'success');
    renderConfig(document.querySelector('#view'));
  };
}

function safeJson(text, fallback) {
  try { return JSON.parse(text || '[]'); } catch { return fallback; }
}

async function renderProjects(body) {
  body.innerHTML = '';
  const { projects } = await loadAll();
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;';
  actions.append(btn('新增任务', false), btn('Excel 导入', false), btn('Excel 导出', false));
  actions.children[0].onclick = () => editProjectDialog();
  actions.children[1].onclick = () => fileDialog(importProjects, '任务 Excel');
  actions.children[2].onclick = () => exportProjects();
  body.appendChild(actions);

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:14px;';
  const head = ['名称', '劳累指数', '所需人数', '重复星期', '时段', '启用', '操作'];
  table.innerHTML = '<thead><tr>' + head.map(h => `<th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;white-space:nowrap;">${h}</th>`).join('') + '</tr></thead>';
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  for (const p of projects) {
    const tr = document.createElement('tr');
    const week = p.weekDays.length ? p.weekDays.map(d => ['日','一','二','三','四','五','六'][d]).join('、') : '一次性';
    const slots = p.slots.map(s => `${s.label} ${s.startTime}-${s.endTime}`).join('；') || '-';
    tr.innerHTML = `
      <td style="padding:8px;border-bottom:1px solid #eee;">${p.name}</td>
      <td style="padding:8px;">${p.fatigueScore}</td>
      <td style="padding:8px;">${p.requiredCapacity}</td>
      <td style="padding:8px;">${week}</td>
      <td style="padding:8px;">${slots}</td>
      <td style="padding:8px;">${p.active ? '启用' : '停用'}</td>
      <td style="padding:8px;"><button data-edit>编辑</button></td>`;
    tr.querySelector('[data-edit]').onclick = () => editProjectDialog(p);
    tbody.appendChild(tr);
  }
  body.appendChild(table);
}

function editProjectDialog(project) {
  const target = project ?? createProject({});
  const body = document.createElement('div');
  body.innerHTML = `
    <div style="margin-bottom:8px;">名称 <input data-k="name" value="${target.name}"></div>
    <div style="margin-bottom:8px;">劳累指数(1-3) <input data-k="fatigueScore" type="number" value="${target.fatigueScore}"></div>
    <div style="margin-bottom:8px;">所需人数 <input data-k="requiredCapacity" type="number" value="${target.requiredCapacity}"></div>
    <div style="margin-bottom:8px;">重复星期(0-6,逗号;空=一次性) <input data-k="weekDays" value="${target.weekDays.join(',')}"></div>
    <div style="margin-bottom:8px;">时段JSON <input data-k="slots" style="width:90%" value='${JSON.stringify(target.slots)}'></div>
    <div style="margin-bottom:8px;">启用 <select data-k="active"><option ${target.active ? 'selected' : ''}>1</option><option ${!target.active ? 'selected' : ''}>0</option></select></div>`;
  const footer = document.createElement('div');
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.style.cssText = 'padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;';
  footer.appendChild(saveBtn);
  const modal = openModal({ title: project ? '编辑任务' : '新增任务', body, footer });
  saveBtn.onclick = async () => {
    const draft = createProject({
      id: target.id,
      name: body.querySelector('[data-k="name"]').value,
      fatigueScore: Number(body.querySelector('[data-k="fatigueScore"]').value),
      requiredCapacity: Number(body.querySelector('[data-k="requiredCapacity"]').value),
      weekDays: body.querySelector('[data-k="weekDays"]').value.split(',').map(Number).filter(n => !Number.isNaN(n)),
      slots: safeJson(body.querySelector('[data-k="slots"]').value, []),
      active: body.querySelector('[data-k="active"]').value === '1',
    });
    const v = validateProject(draft);
    if (!v.valid) { showToast(v.errors.join('；'), 'error'); return; }
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
