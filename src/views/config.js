import { openModal, confirmDialog } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { field, setError, rowsEditor, tagsInput } from '../ui/fields.js';
import { createSelect } from '../ui/select.js';
import { createTimePicker } from '../ui/timepicker.js';
import { getCache, saveProject, saveStaff, getSettings, saveSettings, removeStaff, removeProject } from '../data/store.js';
import { KEYS } from '../data/keys.js';
import { importProjects, importStaffs, exportProjects, exportStaffs, downloadProjectTemplate, downloadStaffTemplate } from '../ui/excel.js';
import { exportTaskViewImage } from '../ui/exportImage.js';
import { toDateStr } from '../core/week.js';
import { createProject, createStaff, validateProject, validateStaff, SLOT_LABELS, STAFF_STATUSES, FATIGUE_MAX, DEFAULT_SETTINGS, monthlyFatigueLimitOf, monthlyHeavyLimitOf } from '../data/model.js';
import { ICON_FIRE, ICON_CLOCK } from '../ui/icons.js';

function esc(v) {
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_UPLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 15V3m0 0L7 8m5-5l5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>';
const ICON_GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
const ICON_QUESTION = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.3 9a2.7 2.7 0 0 1 5.4.6c0 1.8-2.7 2.3-2.7 3.9"/><path d="M12 17h.01"/></svg>';
const ICON_VIEW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M19 12H5m0 0l6 6m-6-6l6-6"/></svg>';
const SLOT_ORDER = new Map(SLOT_LABELS.map((l, i) => [l, i]));

const TAB_DEFS = [
  { key: 'staff', label: '人员管理', render: renderStaffs },
  { key: 'project', label: '任务管理', render: renderProjects },
  { key: 'settings', label: '系统设置', render: renderSettings },
];

export function renderConfig(container) {
  const keepTab = document.querySelector('.seg button.active')?.textContent
    ?? (TAB_DEFS.find(t => t.key === localStorage.getItem(KEYS.configTab))?.label ?? '人员管理');
  container.innerHTML = '';
  const frame = document.createElement('div');
  frame.className = 'cfg-frame';
  const bar = document.createElement('div');
  bar.className = 'seg';
  const btns = TAB_DEFS.map(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.label;
    return b;
  });
  bar.append(...btns);
  const head = document.createElement('div');
  head.className = 'cfg-head';
  const scroll = document.createElement('div');
  scroll.className = 'cfg-scroll';
  frame.append(bar, head, scroll);
  container.appendChild(frame);
  const activate = (i) => {
    btns.forEach((b, j) => b.classList.toggle('active', j === i));
    localStorage.setItem(KEYS.configTab, TAB_DEFS[i].key);
    head.style.display = TAB_DEFS[i].key === 'settings' ? 'none' : '';
    TAB_DEFS[i].render(head, scroll);
  };
  btns.forEach((b, i) => { b.onclick = () => activate(i); });
  activate(Math.max(0, TAB_DEFS.findIndex(t => t.label === keepTab)));
}

function btn(text, active = false, icon = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `${icon}<span>${text}</span>`;
  b.className = `btn btn-${active ? 'primary' : 'default'}`;
  return b;
}

// 全库人员标签去重排序；无人有标签返回 null（不提供过滤）
function tagFilterSel(staffs) {
  const tags = [...new Set(staffs.flatMap(s => s.tags ?? []))].sort((a, b) => a.localeCompare(b, 'zh'));
  if (!tags.length) return null;
  const sel = createSelect({ multiple: true, placeholder: '按标签筛选', options: tags.map(t => ({ value: t, label: t })) });
  sel.classList.add('cfg-tag-sel');
  return sel;
}

// 实时筛选：名称关键字 + 标签多选叠加（与关系：须同时带所选全部标签）；隐藏不匹配卡片；数据为空时保持原生空态
function setupNameFilter(input, tagSel, grid, noun) {
  const apply = () => {
    const kw = input.value.trim().toLowerCase();
    const sel = tagSel?.value ?? [];
    const cards = [...grid.querySelectorAll('.cfg-card')];
    let visible = 0;
    for (const card of cards) {
      const title = card.querySelector('.cfg-card-title');
      let tags = [];
      try { tags = JSON.parse(card.dataset.tagsJson ?? '[]'); } catch { /* 标签数据损坏则视为无标签 */ }
      const hit = (!kw || (title && title.textContent.toLowerCase().includes(kw)))
        && (sel.length === 0 || sel.every(t => tags.includes(t)));
      card.style.display = hit ? '' : 'none';
      if (hit) visible++;
    }
    const kwText = input.value.trim();
    let empty = grid.querySelector('.grid-empty');
    if ((!kw && !sel.length) || !cards.length || visible) {
      if (empty && cards.length) empty.remove();
      return;
    }
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'grid-empty';
      empty.style.gridColumn = '1 / -1';
      grid.appendChild(empty);
    }
    const conds = [];
    if (kwText) conds.push(`名称含「${kwText}」`);
    if (sel.length) conds.push(`带标签 ${sel.join('、')}`);
    empty.textContent = `未找到${conds.join('且')}的${noun}`;
  };
  input.addEventListener('input', apply);
  return apply;
}

function searchControl(placeholder) {
  const input = document.createElement('input');
  input.className = 'input cfg-search';
  input.type = 'text';
  input.placeholder = placeholder;
  input.title = '按名称实时筛选';
  return input;
}

// 卡片装入白底圆角面板，滚动条收在 .cfg-pane-body 内
function wrapPanel(grid) {
  const body = document.createElement('div');
  body.className = 'cfg-pane-body';
  body.appendChild(grid);
  const pane = document.createElement('div');
  pane.className = 'cfg-pane';
  pane.appendChild(body);
  return pane;
}

// 删除弹窗化入口：guard（引用保护）放行后弹 confirmDialog 二次确认，确认才执行 doDelete
function askDelete({ guard, message, doDelete }) {
  return () => {
    if (guard && !guard()) return;
    confirmDialog({ message, onConfirm: doDelete });
  };
}

// 引用保护：人员出现在任何班次中禁止删除（历史须靠「退出」保留）
function delStaffGuard(s) {
  const { schedules } = getCache();
  const n = schedules.filter(sch => sch.staffIds.includes(s.id)).length;
  if (n) showToast(`「${s.name}」已排 ${n} 个班次，删除会破坏历史记录——请改为状态「退出」`, 'error');
  return !n;
}

async function delStaffDo(s) {
  await removeStaff(s.id);
  showToast(`已删除「${s.name}」`, 'success');
  renderConfig(document.querySelector('#view'));
}

// 引用保护：任务被排班记录或人员配置引用时禁止删除
function delProjectGuard(p) {
  const { schedules, staffs } = getCache();
  const nSch = schedules.filter(s => s.projectId === p.id).length;
  const nRef = staffs.filter(s =>
    s.allowedProjects.includes(p.id)
    || s.preferredProjects.some(x => x.projectId === p.id)
    || s.bannedProjects.some(x => x.projectId === p.id)).length;
  if (nSch || nRef) {
    const parts = [nSch ? `${nSch} 条排班记录` : '', nRef ? `${nRef} 名人员的配置` : ''].filter(Boolean).join('、');
    showToast(`「${p.name}」正被 ${parts} 引用，删除会破坏数据——可改为「停用」`, 'error');
    return false;
  }
  return true;
}

async function delProjectDo(p) {
  await removeProject(p.id);
  showToast(`已删除「${p.name}」`, 'success');
  renderConfig(document.querySelector('#view'));
}

// 值区 tag 超过 2 行时折叠：第 3 行起隐藏，追加「+N」chip；点击展开/收起
function foldTags(vEl) {
  const old = vEl.querySelector('.tag-more');
  if (old) old.remove();
  const textEl = vEl.querySelector('.v-text');
  if (textEl) return foldText(vEl, textEl);
  const tags = [...vEl.children].filter(el => el.classList.contains('tag'));
  if (!tags.length) return;
  tags.forEach(t => { t.style.display = ''; });
  const open = vEl.dataset.fold === 'open';
  if (open) return appendMore(vEl, tags, [], '收起', true);
  const tops = tags.map(t => t.offsetTop);
  const rows = [...new Set(tops)].sort((a, b) => a - b);
  if (rows.length <= 2) return;
  const visible = tops.slice().map(y => Math.abs(y - rows[0]) < 4 || Math.abs(y - rows[1]) < 4);
  const hiddenIdx = [];
  tags.forEach((t, i) => { if (!visible[i]) { t.style.display = 'none'; hiddenIdx.push(i); } });
  // 「+N」chip 自身被挤到第 3 行时，继续收起第 2 行末尾的 tag
  const chip = appendMore(vEl, tags, hiddenIdx, `+${hiddenIdx.length}`);
  let guard = tags.length;
  while (chip.offsetTop >= rows[2] - 2 && guard--) {
    const last = hiddenIdx.length ? hiddenIdx[hiddenIdx.length - 1] : tags.length;
    let i = last - 1;
    while (i >= 0 && tags[i].style.display === 'none') i--;
    if (i < 0) break;
    tags[i].style.display = 'none';
    hiddenIdx.push(i);
    chip.textContent = `+${hiddenIdx.length}`;
  }
}

// 说明文本超 2 行时折叠：末尾省略号「…」提示，点击展开/收起全文，hover title 看全
function foldText(vEl, textEl) {
  textEl.style.display = '';
  textEl.style.webkitLineClamp = '';
  textEl.style.webkitBoxOrient = '';
  textEl.style.overflow = '';
  const lh = parseFloat(getComputedStyle(textEl).lineHeight) || 20;
  const rows = Math.round(textEl.offsetHeight / lh);
  if (rows <= 2) {
    textEl.style.cursor = '';
    return;
  }
  textEl.style.cursor = 'pointer';
  textEl.onclick = () => {
    vEl.dataset.fold = vEl.dataset.fold === 'open' ? 'folded' : 'open';
    foldText(vEl, textEl);
  };
  if (vEl.dataset.fold === 'open') return;
  textEl.style.display = '-webkit-box';
  textEl.style.webkitLineClamp = '2';
  textEl.style.webkitBoxOrient = 'vertical';
  textEl.style.overflow = 'hidden';
}

function appendMore(vEl, tags, hiddenIdx, text, isOpen = false) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'tag tag-more';
  chip.textContent = text;
  chip.title = isOpen ? '点击收起' : '点击展开';
  chip.onclick = () => {
    vEl.dataset.fold = isOpen ? 'folded' : 'open';
    foldTags(vEl);
  };
  vEl.appendChild(chip);
  return chip;
}

let gridRO = null;
// 列宽变化（窗口缩放/列数增减）后重新折叠；高度变化跳过，避免 RO 反复触发
function observeGridFold(grid) {
  gridRO?.disconnect();
  let lastW = 0;
  gridRO = new ResizeObserver(() => {
    if (Math.abs(grid.clientWidth - lastW) < 1) return;
    lastW = grid.clientWidth;
    grid.querySelectorAll('.cfg-row .v').forEach(foldTags);
  });
  gridRO.observe(grid);
}

function statusBadge(status) {
  const map = {
    active: ['badge-success', '活跃'],
    new: ['badge-primary', '新入'],
    rest: ['badge-warn', '休假'],
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

async function renderStaffs(head, scroll) {
  head.innerHTML = '';
  scroll.innerHTML = '';
  const { staffs, projects } = getCache();
  const projName = new Map(projects.map(p => [p.id, p.name]));
  const actions = document.createElement('div');
  actions.className = 'cfg-actions';
  const search = searchControl('筛选人员名称');
  const tagSel = tagFilterSel(staffs);
  const addBtn = btn('新增人员', false, ICON_PLUS);
  const importBtn = btn('Excel 导入', false, ICON_UPLOAD);
  const exportBtn = btn('Excel 导出', false, ICON_DOWNLOAD);
  addBtn.onclick = () => editStaffDialog();
  importBtn.onclick = () => importDialog({ title: '导入人员', handler: importStaffs, template: downloadStaffTemplate });
  exportBtn.onclick = () => exportStaffs();
  if (tagSel) actions.append(search, tagSel);
  else actions.append(search);
  actions.append(addBtn, importBtn, exportBtn);
  head.appendChild(actions);

  const grid = document.createElement('div');
  grid.className = 'card-grid';
  if (!staffs.length) {
    grid.innerHTML = '<div class="grid-empty">暂无人员，点击「新增人员」添加</div>';
    grid.firstChild.style.gridColumn = '1 / -1';
  }
  const sorted = [...staffs].sort((a, b) => {
    const la = a.status === 'left' ? 1 : 0;
    const lb = b.status === 'left' ? 1 : 0;
    if (la !== lb) return la - lb;
    return (b.joinedAt ?? 0) - (a.joinedAt ?? 0);
  });
  for (const s of sorted) {
    const pref = s.preferredProjects.map(p => `<span class="tag" title="${esc(p.reason ?? '')}">${esc(projName.get(p.projectId) ?? p.projectId)}</span>`).join('') || '<span class="empty">—</span>';
    const banned = s.bannedProjects.map(b => `<span class="tag tag-danger" title="${esc(b.reason ?? '')}">${esc(projName.get(b.projectId) ?? b.projectId)}</span>`).join('') || '<span class="empty">—</span>';
    const allowed = s.allowedProjects.length
      ? s.allowedProjects.map(id => `<span class="tag">${esc(projName.get(id) ?? id)}</span>`).join('')
      : '<span class="empty">—</span>';
    const card = document.createElement('div');
    card.className = 'card cfg-card';
    card.dataset.tagsJson = JSON.stringify(s.tags ?? []);
    const tagsHtml = (s.tags ?? []).length
      ? s.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')
      : '<span class="empty">—</span>';
    card.innerHTML = `
      <div class="cfg-card-head">
        <span class="cfg-card-title">${esc(s.name)}</span>
        ${statusBadge(s.status)}
      </div>
      <div class="cfg-card-rows">
        <div class="cfg-row"><span class="k">可胜任</span><span class="v">${allowed}</span></div>
        <div class="cfg-row"><span class="k">擅长</span><span class="v">${pref}</span></div>
        <div class="cfg-row"><span class="k">不合适</span><span class="v">${banned}</span></div>
        <div class="cfg-row"><span class="k">标签</span><span class="v">${tagsHtml}</span></div>
        <div class="cfg-row cfg-duo"><span class="duo-pair"><span class="k">周疲劳上限</span><span class="v">${s.maxWeeklyFatigue}</span></span><span class="duo-pair"><span class="k">月疲劳上限</span><span class="v">${monthlyFatigueLimitOf(s, getSettings())}</span></span></div>
        <div class="cfg-row cfg-duo"><span class="duo-pair"><span class="k">周高强度上限</span><span class="v">${s.maxHeavyTaskCount}</span></span><span class="duo-pair"><span class="k">月高强度上限</span><span class="v">${monthlyHeavyLimitOf(s, getSettings())}</span></span></div>
      </div>
      <div class="cfg-card-ops">
        <label class="switch-wrap">
          <span class="switch-label">${s.status === 'rest' ? '休假中' : '参与排班'}</span>
          <span class="switch">
            <input type="checkbox" data-toggle ${s.status !== 'rest' ? 'checked' : ''} ${s.status === 'left' ? 'disabled' : ''}>
            <span class="track"><span class="thumb"></span></span>
          </span>
        </label>
        <div class="cfg-op-btns">
          <button type="button" data-del class="btn btn-del btn-sm">${ICON_TRASH}删除</button>
          <button type="button" data-edit class="btn btn-ghost btn-sm">${ICON_EDIT}编辑</button>
        </div>
      </div>`;
    card.querySelector('[data-toggle]').onchange = async (e) => {
      if (s.status === 'left') return;
      const on = e.target.checked;
      const status = on ? (s.restFrom ?? 'active') : 'rest';
      const restFrom = on ? null : (s.status === 'rest' ? s.restFrom : s.status);
      await saveStaff({ ...s, status, restFrom });
      const badgeEl = card.querySelector('.cfg-card-head .badge');
      const labelEl = card.querySelector('.switch-label');
      if (badgeEl) badgeEl.outerHTML = statusBadge(status);
      if (labelEl) labelEl.textContent = on ? '参与排班' : '休假中';
      showToast(on ? '已恢复参与' : '已标记休假', 'success');
    };
    card.querySelector('[data-edit]').onclick = () => editStaffDialog(s);
    card.querySelector('[data-del]').onclick = askDelete({
      guard: () => delStaffGuard(s),
      message: `确认删除人员「${s.name}」？删除后不可恢复。`,
      doDelete: () => delStaffDo(s),
    });
    grid.appendChild(card);
  }
  scroll.appendChild(wrapPanel(grid));
  grid.querySelectorAll('.cfg-row .v').forEach(foldTags);
  observeGridFold(grid);
  const applyFilter = setupNameFilter(search, tagSel, grid, '人员');
  if (tagSel) tagSel.addEventListener('change', applyFilter);
}

async function editStaffDialog(staff) {
  // 新建人员带入「设置」里的系统默认上限（仅默认值，编辑既有人员不受影响）
  const target = staff ?? createStaff({}, getSettings());
  const { projects, staffs } = getCache();
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
    rest: { label: '休假', desc: '休假中：不参与排班，可随时恢复' },
    left: { label: '已退出', desc: '保留历史，不再参与' },
  };
  const statusSel = createSelect({
    options: STAFF_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, desc: STATUS_META[s].desc })),
    value: target.status,
  });
  const statusF = field({ label: '状态', control: statusSel });

  // 三列表关系：可胜任 ∩ 不合适 = ∅、擅长 ⊆ 可胜任。
  // 冲突不代改：操作冲突即时提示并回滚，由用户按顺序手动化解
  // （先勾可胜任再设擅长/不合适；先删擅长再取消可胜任）。存量矛盾数据原样展示，保存时统一提示。
  const pName = id => projects.find(p => p.id === id)?.name ?? id;

  const allowedSel = createSelect({
    multiple: true,
    placeholder: '请选择可胜任项目',
    options: projects.map((p) => ({ value: p.id, label: p.name })),
    value: target.allowedProjects,
  });
  let lastAllowed = [...allowedSel.value];
  const allowedF = field({ label: '可胜任项目', control: allowedSel, hint: '可多选', help: '只给他排勾选的任务，没勾的不会排给他' });

  const preferredEditor = rowsEditor({
    label: '擅长项目（加分）', addLabel: '＋ 添加擅长项目',
    help: '排班优先考虑他擅长的任务，推荐理由会写明你录的原因',
    cols: [
      { key: 'projectId', type: 'select', options: projectOptions },
      { key: 'reason', type: 'text', placeholder: '如：体力好，搬运熟练' },
    ],
    initial: target.preferredProjects,
    onCell: (colKey, el) => {
      if (colKey !== 'projectId') return;
      el.addEventListener('change', () => {
        const P = el.value;
        if (!P) return;
        if (bannedEditor.collect().some(r => r.projectId === P)) {
          el.value = '';
          showToast(`「${pName(P)}」在不合适项目中，请先删除该行再设为擅长`, 'error');
          return;
        }
        if (!lastAllowed.includes(P)) {
          el.value = '';
          showToast(`「${pName(P)}」还没设为可胜任，请先勾选可胜任再设为擅长`, 'error');
        }
      });
    },
  });

  const bannedEditor = rowsEditor({
    label: '不合适项目', addLabel: '＋ 添加不合适项目',
    help: '不适合他的任务（如腰伤别排搬重活），这类任务一定不会排给他',
    cols: [
      { key: 'projectId', type: 'select', options: projectOptions },
      { key: 'reason', type: 'text', placeholder: '如：腰伤，不宜搬重物' },
    ],
    initial: target.bannedProjects,
    onCell: (colKey, el) => {
      if (colKey !== 'projectId') return;
      el.addEventListener('change', () => {
        const P = el.value;
        if (!P) return;
        if (preferredEditor.collect().some(r => r.projectId === P)) {
          el.value = '';
          showToast(`「${pName(P)}」是擅长项目，请先删除其擅长配置再设为不合适`, 'error');
          return;
        }
        if (lastAllowed.includes(P)) {
          el.value = '';
          showToast(`「${pName(P)}」已在可胜任中，请先取消勾选再设为不合适`, 'error');
        }
      });
    },
  });

  // 多选增删拦截：不能勾入不合适行中已有的项目、不能取消擅长项目
  allowedSel.addEventListener('change', () => {
    const nv = allowedSel.value;
    const added = nv.filter(id => !lastAllowed.includes(id));
    const removed = lastAllowed.filter(id => !nv.includes(id));
    const bannedNow = new Set(bannedEditor.collect().map(r => r.projectId));
    const prefNow = new Set(preferredEditor.collect().map(r => r.projectId));
    const clashAdded = added.find(id => bannedNow.has(id));
    const clashRemoved = removed.find(id => prefNow.has(id));
    if (clashAdded || clashRemoved) {
      allowedSel.value = lastAllowed;
      if (clashAdded) showToast(`「${pName(clashAdded)}」在不合适项目中，请先删除该行再设为可胜任`, 'error');
      else showToast(`「${pName(clashRemoved)}」是擅长项目，请先删除其擅长配置再取消可胜任`, 'error');
      return;
    }
    lastAllowed = nv;
  });

  const fatigueInput = document.createElement('input');
  fatigueInput.className = 'input';
  fatigueInput.type = 'number';
  fatigueInput.min = 1;
  fatigueInput.value = target.maxWeeklyFatigue;
  const fatigueF = field({ label: '周疲劳上限', help: '一周最多累计的劳累分，满了这周就不给他排新班', control: fatigueInput });

  const heavyInput = document.createElement('input');
  heavyInput.className = 'input';
  heavyInput.type = 'number';
  heavyInput.min = 0;
  heavyInput.value = target.maxHeavyTaskCount;
  const heavyF = field({ label: '周高强度上限', help: '最累的活（劳累指数 3）一周最多排几个', control: heavyInput });

  const monthFatigueInput = document.createElement('input');
  monthFatigueInput.className = 'input';
  monthFatigueInput.type = 'number';
  monthFatigueInput.min = 1;
  monthFatigueInput.value = target.maxMonthlyFatigue ?? getSettings().defaultMonthlyFatigue;
  const monthF = field({ label: '月疲劳上限', help: '一个月（1 号~月底）最多累计的劳累分，满了当月不排新班', control: monthFatigueInput });

  const monthHeavyInput = document.createElement('input');
  monthHeavyInput.className = 'input';
  monthHeavyInput.type = 'number';
  monthHeavyInput.min = 0;
  monthHeavyInput.value = target.maxMonthlyHeavyCount ?? getSettings().defaultMonthlyHeavyCount;
  const monthHeavyF = field({ label: '月高强度上限', help: '最累的活（劳累指数 3）一个月最多排几个', control: monthHeavyInput });

  const limitRow = document.createElement('div');
  limitRow.className = 'field-pair';
  limitRow.append(fatigueF.wrap, heavyF.wrap);

  const monthRow = document.createElement('div');
  monthRow.className = 'field-pair';
  monthRow.append(monthF.wrap, monthHeavyF.wrap);

  // 标签：同一输入框可输可选——聚焦弹出已有标签候选，回车或无匹配回车即自创新标签（共享标签库，同一标签每人至多一个）
  const tagPool = [...new Set(staffs.flatMap(s => s.tags ?? []))].sort((a, b) => a.localeCompare(b, 'zh'));
  const tagsCtrl = tagsInput({ initial: target.tags ?? [], options: tagPool });
  const tagsF = field({ label: '标签', control: tagsCtrl, hint: '聚焦可选已有标签；输入无匹配时回车即新建，可多个' });
  const allowedLab = allowedF.wrap.querySelector('label');
  const fillBannedBtn = makeFillBtn('可胜任之外全部设为不合适', () => {
    const allowed = new Set(allowedSel.value);
    const existing = new Set(bannedEditor.collect().map(b => b.projectId));
    const missing = projects.map(p => p.id).filter(id => !allowed.has(id) && !existing.has(id));
    if (!missing.length) {
      showToast('不合适项目已是最全状态', 'info');
      return;
    }
    missing.forEach(id => bannedEditor.add({ projectId: id, reason: '' }));
    showToast(`已追加 ${missing.length} 个不合适项目，可逐行补充原因`, 'success');
  });
  const allowedLabRow = document.createElement('div');
  allowedLabRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
  allowedLab.replaceWith(allowedLabRow);
  allowedLabRow.append(allowedLab, fillBannedBtn);

  const bannedLab = bannedEditor.el.querySelector('label');
  const fillAllowedBtn = makeFillBtn('不合适之外全部设为可胜任', () => {
    const banned = new Set(bannedEditor.collect().map(b => b.projectId));
    const ids = projects.map(p => p.id).filter(id => !banned.has(id));
    allowedSel.value = ids;
    lastAllowed = ids;
    showToast(`已设 ${ids.length} 个项目为可胜任`, 'success');
  });
  const bannedLabRow = document.createElement('div');
  bannedLabRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
  bannedLab.replaceWith(bannedLabRow);
  bannedLabRow.append(bannedLab, fillAllowedBtn);

  if (!projects.length) {
    fillAllowedBtn.disabled = true;
    fillBannedBtn.disabled = true;
  }
  const headPair = document.createElement('div');
  headPair.className = 'field-pair';
  headPair.append(nameF.wrap, statusF.wrap);
  body.append(headPair, limitRow, monthRow, allowedF.wrap, bannedEditor.el, preferredEditor.el, tagsF.wrap);
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
      name: nameInput.value.trim(),
      status: statusSel.value,
      restFrom: statusSel.value === 'rest' ? (target.restFrom ?? 'active') : null,
      joinedAt: target.joinedAt,
      allowedProjects: allowedSel.value,
      preferredProjects: preferredEditor.collect(),
      bannedProjects: bannedEditor.collect(),
      maxWeeklyFatigue: Number(fatigueInput.value),
      maxHeavyTaskCount: Number(heavyInput.value),
      maxMonthlyFatigue: Number(monthFatigueInput.value),
      maxMonthlyHeavyCount: Number(monthHeavyInput.value),
      tags: tagsCtrl.value,
    });
    // 三列表关系预检（名称级提示）：矛盾不代改，列出后由用户按顺序化解
    const relIssues = [];
    for (const b of draft.bannedProjects) {
      if (b.projectId && draft.allowedProjects.includes(b.projectId)) {
        relIssues.push(`「${pName(b.projectId)}」同时在不合适与可胜任中，请取消其一`);
      }
    }
    for (const p of draft.preferredProjects) {
      if (p.projectId && !draft.allowedProjects.includes(p.projectId)) {
        relIssues.push(`「${pName(p.projectId)}」设为擅长但不在可胜任中，请勾选可胜任或删除擅长`);
      }
    }
    if (relIssues.length) {
      showToast(`存在矛盾配置：${relIssues.join('；')}`, 'error');
      return;
    }
    const v = validateStaff(draft);
    if (!v.valid) {
      const byField = {};
      v.errors.forEach(e => { (byField[e.field] ??= []).push(e.msg); });
      setError(nameF, byField.name?.join('；') || '');
      setError(fatigueF, byField.maxWeeklyFatigue?.join('；') || '');
      setError(heavyF, byField.maxHeavyTaskCount?.join('；') || '');
      setError(monthF, byField.maxMonthlyFatigue?.join('；') || '');
      setError(monthHeavyF, byField.maxMonthlyHeavyCount?.join('；') || '');
      setError(allowedF, byField.allowedProjects?.join('；') || '');
      if (byField.bannedProjects) showToast(byField.bannedProjects.join('；'), 'error');
      if (byField.preferredProjects) showToast(byField.preferredProjects.join('；'), 'error');
      return;
    }
    const { staffs } = getCache();
    if (staffs.some(s => s.id !== target.id && s.name.trim() === draft.name.trim())) {
      setError(nameF, '已存在同名人员');
      return;
    }
    await saveStaff(draft);
    modal.close();
    showToast('已保存', 'success');
    renderConfig(document.querySelector('#view'));
  };
}

function makeFillBtn(title, onclick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'lbl-icon-btn';
  b.title = title;
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M8 7h12M16 3l4 4-4 4M16 17H4M8 13l-4 4 4 4"/></svg>';
  b.onclick = onclick;
  return b;
}

async function renderProjects(head, scroll) {
  head.innerHTML = '';
  scroll.innerHTML = '';
  const { projects } = getCache();
  const actions = document.createElement('div');
  actions.className = 'cfg-actions';
  const search = searchControl('筛选任务名称');
  const addBtn = btn('新增任务', false, ICON_PLUS);
  const importBtn = btn('Excel 导入', false, ICON_UPLOAD);
  const exportBtn = btn('Excel 导出', false, ICON_DOWNLOAD);
  const viewBtn = btn('任务视图', false, ICON_VIEW);
  addBtn.onclick = () => editProjectDialog();
  importBtn.onclick = () => importDialog({ title: '导入任务', handler: importProjects, template: downloadProjectTemplate });
  exportBtn.onclick = () => exportProjects();
  viewBtn.onclick = () => renderProjectView(head, scroll, projects);
  actions.append(search, addBtn, importBtn, exportBtn, viewBtn);
  head.appendChild(actions);

  const grid = document.createElement('div');
  grid.className = 'card-grid';
  if (!projects.length) {
    grid.innerHTML = '<div class="grid-empty">暂无任务，点击「新增任务」添加</div>';
    grid.firstChild.style.gridColumn = '1 / -1';
  }
  for (const p of projects) {
    const week = p.weekDays.length ? p.weekDays.map(d => ['日','一','二','三','四','五','六'][d]).join('、') : '一次性';
    const slots = [...p.slots]
      .sort((a, b) => SLOT_ORDER.get(a.label) - SLOT_ORDER.get(b.label))
      .map(s => `<span class="tag">${esc(s.label)}</span>`).join('') || '<span class="empty">—</span>';
    const timeRange = p.timeRange
      ? `${ICON_CLOCK} ${esc(p.timeRange.start)}–${esc(p.timeRange.end)}`
      : '<span class="empty">—</span>';
    const card = document.createElement('div');
    card.className = 'card cfg-card';
    card.innerHTML = `
      <div class="cfg-card-head">
        <span class="cfg-card-title">${esc(p.name)}</span>
        ${activeBadge(p.active)}
      </div>
      <div class="cfg-card-rows">
        <div class="cfg-row"><span class="k">劳累指数</span><span class="v">${ICON_FIRE.repeat(p.fatigueScore)}</span></div>
        <div class="cfg-row"><span class="k">所需人数</span><span class="v">${p.requiredCapacity} 人</span></div>
        <div class="cfg-row"><span class="k">重复星期</span><span class="v">${week}</span></div>
        <div class="cfg-row"><span class="k">时段</span><span class="v">${slots}</span></div>
        <div class="cfg-row"><span class="k">时间段</span><span class="v">${timeRange}</span></div>
        <div class="cfg-row"><span class="k">加分标签</span><span class="v">${(p.bonusTags ?? []).length ? p.bonusTags.map(t => `<span class="tag">${esc(t)}</span>`).join('') : '<span class="empty">—</span>'}</span></div>
        <div class="cfg-row"><span class="k">任务说明</span><span class="v">${p.description ? `<span class="v-text" title="${esc(p.description)}">${esc(p.description)}</span>` : '<span class="empty">—</span>'}</span></div>
      </div>
      <div class="cfg-card-ops">
        <label class="switch-wrap">
          <span class="switch-label">${p.active ? '启用' : '停用'}</span>
          <span class="switch">
            <input type="checkbox" data-toggle ${p.active ? 'checked' : ''}>
            <span class="track"><span class="thumb"></span></span>
          </span>
        </label>
        <div class="cfg-op-btns">
          <button type="button" data-del class="btn btn-del btn-sm">${ICON_TRASH}删除</button>
          <button type="button" data-edit class="btn btn-ghost btn-sm">${ICON_EDIT}编辑</button>
        </div>
      </div>`;
    card.querySelector('[data-toggle]').onchange = async (e) => {
      const on = e.target.checked;
      await saveProject({ ...p, active: on });
      const badgeEl = card.querySelector('.cfg-card-head .badge');
      const labelEl = card.querySelector('.switch-label');
      if (badgeEl) badgeEl.outerHTML = activeBadge(on);
      if (labelEl) labelEl.textContent = on ? '启用' : '停用';
      showToast(on ? '任务已启用' : '任务已停用', 'success');
    };
    card.querySelector('[data-edit]').onclick = () => editProjectDialog(p);
    card.querySelector('[data-del]').onclick = askDelete({
      guard: () => delProjectGuard(p),
      message: `确认删除任务「${p.name}」？删除后不可恢复。`,
      doDelete: () => delProjectDo(p),
    });
    grid.appendChild(card);
  }
  scroll.appendChild(wrapPanel(grid));
  grid.querySelectorAll('.cfg-row .v').forEach(foldTags);
  observeGridFold(grid);
  setupNameFilter(search, null, grid, '任务');
}

// —— 任务视图（任务说明清单）：任务 tab 就地切换的纯展示态，供导出图片给执行人员看每个任务要做什么 ——
function renderProjectView(head, scroll, projects) {
  head.innerHTML = '';
  scroll.innerHTML = '';
  const actives = projects.filter(p => p.active);
  const hidden = projects.length - actives.length;

  const backBtn = btn('返回卡片', false, ICON_BACK);
  backBtn.onclick = () => renderProjects(head, scroll);
  const meta = document.createElement('span');
  meta.className = 'cfg-view-meta';
  meta.textContent = `任务说明 · 共 ${actives.length} 项${hidden ? `，已隐藏停用 ${hidden} 项` : ''}`;
  head.append(backBtn, meta);

  if (actives.length) {
    const imgBtn = btn('导出图片', false, ICON_DOWNLOAD);
    imgBtn.style.marginLeft = 'auto';
    imgBtn.onclick = async () => {
      imgBtn.disabled = true;
      showToast('正在生成图片…');
      const date = toDateStr(new Date());
      try {
        await exportTaskViewImage({
          list: buildTaskViewList(actives),
          title: '任务说明',
          metaText: `共 ${actives.length} 项`,
          filename: `Tasks-任务说明图-${date}.png`,
        });
        showToast('任务说明图已导出', 'success');
      } catch (e) {
        showToast(`导出失败：${e.message}`, 'error');
      } finally {
        imgBtn.disabled = false;
      }
    };
    head.appendChild(imgBtn);
  }

  const content = actives.length
    ? buildTaskViewList(actives)
    : (() => {
        const empty = document.createElement('div');
        empty.className = 'grid-empty';
        empty.textContent = projects.length ? '没有启用中的任务，停用任务不进入视图' : '暂无任务，点击「新增任务」添加';
        return empty;
      })();
  scroll.appendChild(wrapPanel(content));
}

function buildTaskViewList(projects) {
  const list = document.createElement('div');
  list.className = 'tview-list';
  for (const p of projects) list.appendChild(buildTaskViewItem(p));
  return list;
}

function buildTaskViewItem(p) {
  const item = document.createElement('div');
  item.className = 'tview-item';
  const top = document.createElement('div');
  top.className = 'tview-top';
  const name = document.createElement('div');
  name.className = 'tview-name';
  name.textContent = p.name;
  const side = document.createElement('div');
  side.className = 'tview-side';
  side.innerHTML = `${ICON_FIRE.repeat(p.fatigueScore)}<span>${p.requiredCapacity} 人</span>`;
  top.append(name, side);
  const time = document.createElement('div');
  time.className = 'tview-time';
  time.innerHTML = taskViewTimeHTML(p);
  const desc = document.createElement('div');
  desc.className = 'tview-desc';
  if (p.description && p.description.trim()) {
    desc.textContent = p.description.trim();
  } else {
    desc.classList.add('empty');
    desc.textContent = '未填写说明';
  }
  item.append(top, time, desc);
  return item;
}

// 时间安排行：时段 chip 段 +（· 频率 · 时间段）文本段，flex 并排（无文本段时纯时段 chips）
function taskViewTimeHTML(p) {
  const chips = [...p.slots]
    .sort((a, b) => SLOT_ORDER.get(a.label) - SLOT_ORDER.get(b.label))
    .map(s => `<span class="tag">${esc(s.label)}</span>`)
    .join('');
  const parts = [];
  const days = [...p.weekDays].sort((a, b) => a - b);
  if (days.length === 7) parts.push('每天');
  else if (days.length) parts.push(`每周${days.map(d => '日一二三四五六'[d]).join('、')}`);
  if (p.timeRange) parts.push(`${esc(p.timeRange.start)}–${esc(p.timeRange.end)}`);
  const text = parts.map(t => `<span>${t}</span>`).join('<span class="tview-ddot"> · </span>');
  const body = chips + (chips && text ? '<span class="tview-ddot"> · </span>' : '') + text;
  if (!body) return '';
  return body;
}

async function editProjectDialog(project) {
  const target = project ?? createProject({});
  const body = document.createElement('div');
  const { staffs } = getCache();
  const tagPool = [...new Set(staffs.flatMap(s => s.tags ?? []))].sort((a, b) => a.localeCompare(b, 'zh'));

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
  const fatigueF = field({ label: '劳累指数', help: '活累不累：1 轻松 / 2 中等 / 3 高强度。每排一次班，干活的人就累加对应分值', control: fatigueSel });

  const capInput = document.createElement('input');
  capInput.className = 'input';
  capInput.type = 'number';
  capInput.min = 1;
  capInput.value = target.requiredCapacity;
  const capF = field({ label: '所需人数', help: '一个班次安排几个人', control: capInput });

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

  const slotWrap = document.createElement('div');
  slotWrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  const slotChips = [];
  for (const label of SLOT_LABELS) {
    const lab = document.createElement('label');
    lab.className = 'day-chip';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = label;
    cb.checked = target.slots.some(s => s.label === label);
    lab.classList.toggle('on', cb.checked);
    cb.onchange = () => {
      if (!cb.checked && !slotChips.some(c => c.checked)) {
        cb.checked = true;
        lab.classList.add('on');
        showToast('至少保留一个时段', 'error');
        return;
      }
      lab.classList.toggle('on', cb.checked);
    };
    slotChips.push(cb);
    lab.append(cb, document.createTextNode(label));
    slotWrap.appendChild(lab);
  }
  const slotsF = field({ label: '时段（至少一个）', control: slotWrap });

  const timeStart = createTimePicker({ value: target.timeRange?.start ?? '' });
  const timeEnd = createTimePicker({ value: target.timeRange?.end ?? '' });
  const timeRow = document.createElement('div');
  timeRow.style.cssText = 'display:flex;gap:10px;align-items:center;';
  timeStart.style.flex = '1';
  timeEnd.style.flex = '1';
  const timeArrow = document.createElement('span');
  timeArrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#9b91a7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M5 12h14m0 0l-5-5m5 5l-5 5"/></svg>';
  timeRow.append(timeStart, timeArrow, timeEnd);
  const timeF = field({ label: '时间段范围（选填，仅展示）', control: timeRow });
  function syncTimeError() {
    const s = timeStart.value;
    const e = timeEnd.value;
    if (s && e && s >= e) setError(timeF, '结束时间需晚于开始时间');
    else setError(timeF, '');
  }
  timeStart.addEventListener('change', syncTimeError);
  timeEnd.addEventListener('change', syncTimeError);

  const activeSel = createSelect({
    options: [{ value: 'true', label: '启用' }, { value: 'false', label: '停用' }],
    value: String(target.active),
  });
  const activeF = field({ label: '启用状态', control: activeSel });

  const descInput = document.createElement('textarea');
  descInput.className = 'input';
  descInput.rows = 3;
  descInput.value = target.description ?? '';
  descInput.placeholder = '任务情况、注意事项等（选填）';
  const descF = field({ label: '任务说明', control: descInput });

  const bonusTagsCtrl = tagsInput({
    initial: target.bonusTags ?? [],
    options: tagPool,
    allowCreate: false,
    placeholder: tagPool.length ? '点击选择已有标签（可多个）' : '暂无可选人员标签',
  });
  const bonusTagsF = field({
    label: '加分标签（命中即加分）',
    control: bonusTagsCtrl,
    hint: tagPool.length
      ? '从人员已有标签中选择；带这些标签的人员排此任务时每个标签加分（分值见「系统设置」）'
      : '先在「人员管理」给人员添加标签，才可在此选择',
  });

  const fatigueCapRow = document.createElement('div');
  fatigueCapRow.style.cssText = 'display:flex;gap:10px;';
  fatigueF.wrap.style.flex = '1';
  capF.wrap.style.flex = '1';
  fatigueCapRow.append(fatigueF.wrap, capF.wrap);
  const headPair = document.createElement('div');
  headPair.className = 'field-pair';
  headPair.append(nameF.wrap, activeF.wrap);
  body.append(headPair, fatigueCapRow, daysF.wrap, slotsF.wrap, timeF.wrap, bonusTagsF.wrap, descF.wrap);
  const footer = document.createElement('div');
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = '保存';
  footer.appendChild(saveBtn);
  const modal = openModal({ title: project ? '编辑任务' : '新增任务', body, footer });

  saveBtn.onclick = async () => {
    const start = timeStart.value;
    const end = timeEnd.value;
    if (start || end) {
      if (!start || !end) {
        setError(timeF, '开始与结束时间需同时填写');
        return;
      }
    }
    const draft = createProject({
      id: target.id,
      name: nameInput.value.trim(),
      fatigueScore: Number(fatigueSel.value),
      requiredCapacity: Number(capInput.value),
      weekDays: dayChecks.filter(c => c.checked).map(c => Number(c.value)),
      slots: slotChips.filter(c => c.checked).map(c => ({ label: c.value })),
      active: activeSel.value === 'true',
      timeRange: start && end ? { start, end } : null,
      description: descInput.value.trim(),
      bonusTags: bonusTagsCtrl.value,
    });
    const v = validateProject(draft);
    if (!v.valid) {
      const byField = {};
      v.errors.forEach(e => { (byField[e.field] ??= []).push(e.msg); });
      setError(nameF, byField.name?.join('；') || '');
      setError(fatigueF, byField.fatigueScore?.join('；') || '');
      setError(capF, byField.requiredCapacity?.join('；') || '');
      setError(timeF, byField.timeRange?.join('；') || '');
      if (byField.slots) showToast(byField.slots.join('；'), 'error');
      if (byField.weekDays) showToast(byField.weekDays.join('；'), 'error');
      return;
    }
    const { projects } = getCache();
    if (projects.some(p => p.id !== target.id && p.name.trim() === draft.name.trim())) {
      setError(nameF, '已存在同名任务');
      return;
    }
    await saveProject(draft);
    modal.close();
    showToast('已保存', 'success');
    renderConfig(document.querySelector('#view'));
  };
}

function importDialog({ title, handler, template }) {
  const body = document.createElement('div');
  const tip = document.createElement('div');
  tip.className = 'bk-tip';
  tip.innerHTML = '支持 <b>.xlsx / .xls</b> 文件。可先下载模板，参照示例填写（示例行不会导入）。';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;';
  const tplBtn = document.createElement('button');
  tplBtn.type = 'button';
  tplBtn.className = 'btn btn-default';
  tplBtn.innerHTML = `${ICON_DOWNLOAD}<span>下载模板</span>`;
  tplBtn.onclick = () => { template(); showToast('模板已下载', 'success'); };
  const fileBtn = document.createElement('button');
  fileBtn.type = 'button';
  fileBtn.className = 'btn btn-primary';
  fileBtn.innerHTML = `${ICON_UPLOAD}<span>选择文件导入</span>`;
  row.append(tplBtn, fileBtn);
  body.append(tip, row);
  const modal = openModal({ title, body });
  fileBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async () => {
      if (!input.files[0]) return;
      const r = await handler(input.files[0]);
      showToast(r.message, r.ok ? 'success' : 'error');
      modal.close();
      renderConfig(document.querySelector('#view'));
    };
    input.click();
  };
}

// ===== 系统设置 tab =====
const SET_GROUPS = [
  {
    title: '班次数量上限',
    desc: '防止一人一天或同一时段被排太多班、连轴转。属硬性限制：达到上限后系统拒绝再排，并给出原因。',
    items: [
      { key: 'dailyTaskLimit', name: '一人一天最多任务数', min: 1,
        hint: '一个人一天最多参与几个班次。当天已达上限时，再排会被拒绝并提示原因。' },
      { key: 'slotTaskLimit', name: '一人一时段最多任务数', min: 1,
        hint: '早 / 中 / 晚 / 自主安排四个时段各自计数：同一时段最多排 N 个任务，不同时段互不挤占（如可同时接 1 个早班 + 1 个自主安排，再接 1 个自主安排就会超限）。' },
      { key: 'warnDailyCount', name: '当天任务数预警阈值', min: 1,
        hint: '当天班次数达到该值时：再安排此人会提示「已达预警阈值」、人员 chip 变黄。只提醒，不阻止。' },
    ],
  },
  {
    title: '推荐打分',
    desc: '「智能排班」「一键替补」选人时按分数推荐，谁得分高谁优先。',
    items: [
      { key: 'preferredBonus', name: '擅长加分', min: 1,
        hint: '命中此人所擅长项目时加的分（擅长名单带原因，在人员编辑弹窗维护）。分值越大，越优先用熟练的人。' },
      { key: 'tagBonus', name: '标签加分', min: 1,
        hint: '命中任务加分标签时每个标签加的分（命中多个标签累加）。加分标签在任务编辑弹窗维护，只能选人员已有标签。分值越大越优先用带标签的人。' },
      { key: 'balanceFactor', name: '均衡系数', min: 1,
        hint: '均衡加分 = (团队窗口平均 − 本人窗口疲劳) × 系数，可为负。窗口见「公平参考窗口」。系数越大越优先排窗口内干得少的人；越小越偏向熟手优先。' },
      { key: 'balanceWindowDays', name: '公平参考窗口（天）', min: 7, max: 365,
        hint: '均衡加分只参考「今天回看 N 天」内已排班次（未来已排定的也算）。默认 30 ≈ 一个月：谁近一个月干得少谁优先轮上；窗口滑出后旧账自动淡出，不会让「某月被集中排班」变成永久负债。' },
    ],
  },
  {
    title: '默认人员上限',
    desc: '各项上限的默认值，供未单独设置的人参考取值。',
    items: [
      { key: 'defaultWeeklyFatigue', name: '周疲劳上限', min: 1,
        hint: '单周劳累积分上限：本周已排班次的劳累指数之和超过即拦截。' },
      { key: 'defaultHeavyTaskCount', name: '周高强度次数上限', min: 0,
        hint: '一周内最多可接的劳累指数 3（高强度）班次数。' },
      { key: 'defaultMonthlyFatigue', name: '月疲劳上限', min: 1,
        hint: '单月（自然月）劳累积分上限：本月已排班次的劳累指数之和超过即拦截。' },
      { key: 'defaultMonthlyHeavyCount', name: '月高强度次数上限', min: 0,
        hint: '一个月内（自然月）最多可接的劳累指数 3（高强度）班次数。' },
    ],
  },
  {
    title: '排班轮换',
    desc: '防止同一任务被同一个人连续霸占，到上限强制轮换他人。属硬性限制，但无人手可选时系统会破例放行保运转。',
    items: [
      { key: 'tenureLimit', name: '同一任务连任上限', min: 0, max: 26,
        hint: '同一任务连续 N 期（该任务有排班的自然周计数）排到同一人后，第 N+1 期强制轮换他人；填 0 = 关闭该约束。某周任务空窗不算、他人接手即重新计数；仅当该班次无其他可排人选时才允许连任保运转。' },
    ],
  },
];

const RULE_SECS = [
  {
    h: '谁能被排：一票否决',
    note: '被拒提示区分现状措辞：已超限 / 已达上限 / 将超限。',
    items: [
      '不合适名单：任务在该人「不合适」中（录入带原因，如「腰伤，不宜搬重物」）',
      '权限不足：任务不在该人「可胜任」名单中',
      '状态不符：休假中 / 已退出永不参与（退出仅保留历史）',
      '新入保护：新加入者不排高强度（劳累指数 3），转正后解除',
      '超限：当天班次数、同一时段、本周劳累积分或高强度次数将超过个人上限',
      '超限（月）：当月（自然月）劳累积分超过该人「月疲劳上限」不可再排——与周上限分工：周防单周透支、月防整月堆积',
      '超限（月高强）：当月高强度（劳累 3）次数超过该人「月高强度上限」不可再排；填 0 = 整月不安排高强度',
      '连任：同一任务连续 N 期（N = 系统设置「同一任务连任上限」，0 = 关闭）排到同一人后须轮换；仅当该班次无其他可排人选时允许连任保运转',
    ],
  },
  {
    h: '推荐给谁：打分排序',
    formula: '总分 = 擅长加分 + 标签加分 + (团队窗口平均 − 本人窗口疲劳) × 均衡系数',
    items: [
      '任务配了加分标签时，凡带命中标签的人员每个标签各加分（可多个累加）；加分标签取自全库人员已有标签',
      '低于平均得正分 → 优先排（近期干得少的先上）；高于平均得负分 → 往后排（干得多的先歇）',
      '窗口 = 今天回看 N 天内的已排班次（未来已排定的也算），N 即左侧「公平参考窗口」；窗口外旧账不进均衡',
      '团队平均只统计参与状态人员；新入按平均计（不加不减），休假 / 已退出不计入',
      '每分配一人立即刷新其窗口疲劳，后续班次实时感知——避免同一人反复填坑',
    ],
  },
  {
    h: '疲劳与高强度怎么累计',
    items: [
      '劳累指数 = 任务自带的辛苦分：1 轻松 / 2 中等 / 3 高强度',
      '本周劳累积分 = 该班次所在自然周（周一 ~ 周日，滚动窗口）已排班次的劳累指数之和，超过个人「周疲劳上限」即超限——上周干得多不影响本周判定',
      '月疲劳积分 = 该班次所在自然月（YYYY-MM，非滚动窗口）已排班次的劳累指数之和，超过个人「月疲劳上限」即超限——月初/月末相邻两天分属两月，会有月底卡死、月初重置的边界表现',
      '高强度次数 = 该班次所在周内排过的 3 分班次数，受个人「周高强度次数上限」约束（同滚动周）；月高强度次数 = 该自然月内排过的 3 分班次数，受个人「月高强度次数上限」约束（同自然月）',
      '连任按"期"计：同一任务在有排班的自然周里连续排到同一人的期数；任务某周没排（空窗）不算中断，换人接手才清零',
      '「周/月上限」是透支保护（周滚动、月固定自然月）；「公平参考窗口」是长期轮换标尺；「连任上限」是同任务轮换纪律——三者分工互不干扰',
    ],
  },
  {
    h: '预警亮灯时机',
    items: [
      '当天班次数达到「当天任务数预警阈值」时：再安排此人会弹出提示、人员 chip 变黄——只提醒，不阻止',
    ],
  },
];

function renderSettings(head, scroll) {
  const s = getSettings();
  head.innerHTML = '';
  scroll.innerHTML = '';
  const split = document.createElement('div');
  split.className = 'cfg-split';

  // —— 左面板：系统参数（配置 + 按钮 + 自带滚动） ——
  const paneL = document.createElement('section');
  paneL.className = 'card set-pane';
  const headL = document.createElement('header');
  headL.className = 'set-pane-head';
  const topL = document.createElement('div');
  topL.className = 'set-pane-top';
  const icoL = document.createElement('span');
  icoL.className = 'set-pane-ico';
  icoL.innerHTML = ICON_GEAR;
  const titleL = document.createElement('div');
  titleL.className = 'set-pane-title';
  titleL.textContent = '系统参数';
  topL.append(icoL, titleL);
  const subL = document.createElement('div');
  subL.className = 'set-pane-sub';
  subL.textContent = '改动点击「保存」后统一生效；各项默认值仅用于未单独设置上限的人。';
  headL.append(topL, subL);
  const bodyL = document.createElement('div');
  bodyL.className = 'set-pane-body set-groups';
  const inputs = {};
  for (const g of SET_GROUPS) {
    const group = document.createElement('div');
    group.className = 'set-group';
    const hd = document.createElement('div');
    hd.className = 'set-group-head';
    const h = document.createElement('div');
    h.className = 'set-group-title';
    h.textContent = g.title;
    const d = document.createElement('div');
    d.className = 'set-group-desc';
    d.textContent = g.desc;
    hd.append(h, d);
    const ps = document.createElement('div');
    ps.className = 'set-params';
    g.items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'set-param';
      const main = document.createElement('div');
      main.className = 'set-param-main';
      const nm = document.createElement('span');
      nm.className = 'set-param-name';
      nm.textContent = it.name;
      const input = document.createElement('input');
      input.className = 'input set-num';
      input.type = 'number';
      input.min = it.min;
      if (it.max !== undefined) input.max = it.max;
      input.value = s[it.key];
      inputs[it.key] = input;
      main.append(nm, input);
      const hint = document.createElement('div');
      hint.className = 'set-param-hint';
      hint.textContent = it.hint;
      row.append(main, hint);
      ps.appendChild(row);
    });
    group.append(hd, ps);
    bodyL.appendChild(group);
  }
  const opsL = document.createElement('div');
  opsL.className = 'set-pane-ops';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn btn-default btn-sm';
  resetBtn.textContent = '恢复默认';
  resetBtn.onclick = () => {
    SET_GROUPS.flatMap(g => g.items).forEach(it => { inputs[it.key].value = DEFAULT_SETTINGS[it.key]; });
    showToast('已填入系统默认值，点击「保存」后生效', 'info');
  };
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-soft btn-sm';
  saveBtn.textContent = '保存';
  saveBtn.onclick = () => {
    const draft = {};
    SET_GROUPS.flatMap(g => g.items).forEach(it => {
      const n = Number(inputs[it.key].value);
      draft[it.key] = inputs[it.key].value.trim() !== '' && Number.isFinite(n)
        ? Math.min(it.max ?? Infinity, Math.max(it.min, n))
        : DEFAULT_SETTINGS[it.key];
    });
    saveSettings(draft);
    showToast('设置已保存', 'success');
    renderSettings(head, scroll);
  };
  opsL.append(resetBtn, saveBtn);
  topL.appendChild(opsL);
  paneL.append(headL, bodyL);

  // —— 右面板：系统怎么算（说明展示 + 自带滚动） ——
  const paneR = document.createElement('section');
  paneR.className = 'card set-pane';
  const headR = document.createElement('header');
  headR.className = 'set-pane-head';
  const topR = document.createElement('div');
  topR.className = 'set-pane-top';
  const icoR = document.createElement('span');
  icoR.className = 'set-pane-ico';
  icoR.innerHTML = ICON_QUESTION;
  const titleR = document.createElement('div');
  titleR.className = 'set-pane-title';
  titleR.textContent = '系统怎么算';
  topR.append(icoR, titleR);
  const subR = document.createElement('div');
  subR.className = 'set-pane-sub';
  subR.textContent = '以下规则作用于所有排班入口：智能排班、一键替补、拖拽换人、手动分配。';
  headR.append(topR, subR);
  const bodyR = document.createElement('div');
  bodyR.className = 'set-pane-body';
  RULE_SECS.forEach((sec, i) => {
    const box = document.createElement('div');
    box.className = 'set-rule-sec';
    const hh = document.createElement('h4');
    const idx = document.createElement('span');
    idx.className = 'set-rule-idx';
    idx.textContent = i + 1;
    hh.append(idx, document.createTextNode(sec.h));
    box.appendChild(hh);
    if (sec.formula) {
      const fm = document.createElement('div');
      fm.className = 'set-rule-formula';
      fm.textContent = sec.formula;
      box.appendChild(fm);
    }
    const ul = document.createElement('ul');
    sec.items.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
    box.appendChild(ul);
    if (sec.note) {
      const nt = document.createElement('div');
      nt.className = 'set-rule-note';
      nt.textContent = sec.note;
      box.appendChild(nt);
    }
    bodyR.appendChild(box);
  });
  paneR.append(headR, bodyR);

  split.append(paneL, paneR);
  scroll.appendChild(split);
}
