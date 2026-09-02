import * as XLSX from 'xlsx';
import { createProject, createStaff, isValidTimeRange, reconcileStaff, SLOT_LABELS } from '../data/model.js';
import { getCache, saveProject, saveStaff, getSettings } from '../data/store.js';
import { getWeekDates } from '../core/week.js';

// 表头列顺序 = 编辑弹窗字段顺序。模板（下载填写）无 ID 列；导出（存档/迁移）保留 ID 保证引用关系，导入两种均兼容。
const PROJECT_BASE_COLS = [
  '名称(必填)',
  '劳累指数(必填;1=轻松,2=中等,3=高强度)',
  '所需人数(必填)',
  '重复星期(选填;1-7;分号隔开;1=周一…7=周日;空=一次性任务)',
  '时段(必填;自主安排/早/中/晚,分号隔开)',
  '时间段开始(HH:mm;选填)',
  '时间段结束(HH:mm;选填)',
  '任务说明(选填)',
  '启用(选填;1=启用,0=禁用,默认1)',
];
const STAFF_BASE_COLS = [
  '姓名(必填)',
  '状态(选填;新入/活跃/休假/已退出,默认活跃)',
  '可胜任项目(必填;分号隔开)',
  '擅长项目(选填;项目(原因),分号隔开)',
  '不合适项目(选填;项目(原因),分号隔开)',
  '周疲劳上限(选填)',
  '高强度次数上限(选填)',
];
const PROJECT_EXPORT_COLS = ['ID', ...PROJECT_BASE_COLS];
const STAFF_EXPORT_COLS = ['ID', ...STAFF_BASE_COLS];

// 模板示例行：带「【示例】」前缀，导入时自动跳过
const PROJECT_SAMPLE = ['【示例】场地搬运', '3', '2', '7;1', '早;中', '08:00', '18:00', '搬运物资到三楼，注意轻拿轻放', '1'];
const STAFF_SAMPLE = ['【示例】张三', '新入', 'P101;P102', 'P101(体力好,搬运熟练);P102(力气大)', 'P103(腰伤,不搬重物)', '10', '2'];

const STATUS_ALIAS = { '新入': 'new', '活跃': 'active', '休假': 'rest', '已退出': 'left' };
const STATUS_REV = { new: '新入', active: '活跃', rest: '休假', left: '已退出' };

function normalizeStatus(v) {
  const s = String(v ?? '').trim();
  if (STATUS_ALIAS[s]) return STATUS_ALIAS[s];
  return s || 'active';
}

// 全角 → 半角，兼容用户输入的中文标点
function toHalf(v) {
  return String(v ?? '').replace(/[，、]/g, ',').replace(/[；]/g, ';').replace(/[：]/g, ':').replace(/[（]/g, '(').replace(/[）]/g, ')');
}

// 分号/逗号（含全角）分隔的列表
function parseList(v) {
  return toHalf(v).split(/[;,]/).map(s => s.trim()).filter(Boolean);
}

// "P101(原因);P102" → [{projectId, reason}]，兼容中英文括号/分号；原因内可含逗号，故仅按分号分隔条目
function parsePref(v) {
  return toHalf(v).split(';').map(s => s.trim()).filter(Boolean).map(seg => {
    const m = seg.match(/^([^()]+)\(([\s\S]*)\)$/);
    return m ? { projectId: m[1].trim(), reason: m[2].trim() } : { projectId: seg, reason: '' };
  }).filter(e => e.projectId);
}

function parseSlots(v) {
  return parseList(v).filter(t => SLOT_LABELS.includes(t)).map(label => ({ label }));
}

// 模板/导出用 1-7（1=周一…7=周日），内部存储 0-6（0=周日）；7→0，兼容旧 0-6 文件
function parseWeekDays(v) {
  return parseList(v).map(Number).filter(n => !Number.isNaN(n) && n >= 0 && n <= 7).map(n => n === 7 ? 0 : n);
}

// 规整为 HH:mm（两位小时）：兼容文本 "08:00"/"8:00"（含全角冒号）与 Excel 时间序列号（数字，如 0.3333=08:00、带日期 46023.33 取时间部分）
function toHHmm(v) {
  if (typeof v === 'number') {
    const frac = v - Math.floor(v);
    if (frac === 0 && v > 0) return ''; // 整数天数值，非时间
    const totalMin = Math.round(frac * 1440);
    if (totalMin < 0 || totalMin >= 1440) return '';
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  }
  const m = toHalf(v).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

function parseTimeRange(start, end) {
  const s = toHHmm(start);
  const e = toHHmm(end);
  if (!s || !e) return null;
  return isValidTimeRange({ start: s, end: e }) ? { start: s, end: e } : null;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTemplate(cols, filename, sample) {
  const aoa = [cols, ...(sample ? [sample] : [])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '模板');
  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
  downloadBlob(blob, filename);
}

export function downloadProjectTemplate() { downloadTemplate(PROJECT_BASE_COLS, 'Numbers-任务模板.xlsx', PROJECT_SAMPLE); }
export function downloadStaffTemplate() { downloadTemplate(STAFF_BASE_COLS, 'Numbers-人员模板.xlsx', STAFF_SAMPLE); }

export async function exportProjects() {
  const { projects } = getCache();
  const aoa = [PROJECT_EXPORT_COLS, ...projects.map(p => [
    p.id, p.name, p.fatigueScore, p.requiredCapacity,
    (p.weekDays ?? []).map(d => d === 0 ? 7 : d).join(';'),
    (p.slots ?? []).map(s => s.label).join(';'),
    p.timeRange?.start ?? '', p.timeRange?.end ?? '',
    p.description ?? '',
    p.active === false ? 0 : 1,
  ])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '任务');
  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
  downloadBlob(blob, 'Numbers-任务表.xlsx');
}

export async function exportStaffs() {
  const { staffs } = getCache();
  const aoa = [STAFF_EXPORT_COLS, ...staffs.map(s => [
    s.id, s.name, STATUS_REV[s.status] ?? s.status,
    (s.allowedProjects ?? []).join(';'),
    (s.preferredProjects ?? []).map(p => p.reason ? `${p.projectId}(${p.reason})` : p.projectId).join(';'),
    (s.bannedProjects ?? []).map(b => b.reason ? `${b.projectId}(${b.reason})` : b.projectId).join(';'),
    s.maxWeeklyFatigue, s.maxHeavyTaskCount,
  ])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '人员');
  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
  downloadBlob(blob, 'Numbers-人员表.xlsx');
}

// 旧表头（改版前已发布文件）键名 → 新表头键名，保证旧导出文件可重导入
const PROJECT_KEY_ALIAS = {
  '名称': '名称(必填)',
  '劳累指数(1-3)': '劳累指数(必填;1=轻松,2=中等,3=高强度)',
  '所需人数': '所需人数(必填)',
  '重复星期(0-6)': '重复星期(选填;1-7;分号隔开;1=周一…7=周日;空=一次性任务)',
  '时段(分号隔开)': '时段(必填;自主安排/早/中/晚,分号隔开)',
  '时间段开始(HH:mm)': '时间段开始(HH:mm;选填)',
  '时间段结束(HH:mm)': '时间段结束(HH:mm;选填)',
  '启用(1/0)': '启用(选填;1=启用,0=禁用,默认1)',
};
const STAFF_KEY_ALIAS = {
  '姓名': '姓名(必填)',
  '状态(新入/活跃/休假/已退出)': '状态(选填;新入/活跃/休假/已退出,默认活跃)',
  '可胜任项目(分号隔开)': '可胜任项目(必填;分号隔开)',
  '擅长项目(项目(原因);分号隔开)': '擅长项目(选填;项目(原因),分号隔开)',
  '不合适项目(项目(原因);分号隔开)': '不合适项目(选填;项目(原因),分号隔开)',
  '周疲劳上限(默认6)': '周疲劳上限(选填)',
  '周疲劳上限(选填;默认6)': '周疲劳上限(选填)',
  '高强度次数上限(默认1)': '高强度次数上限(选填)',
  '高强度次数上限(选填;默认1)': '高强度次数上限(选填)',
};
const normalizeKeys = alias => raw => {
  const r = {};
  for (const [k, v] of Object.entries(raw)) r[alias[k] ?? k] = v;
  return r;
};

export async function importProjects(file) {
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false }).map(normalizeKeys(PROJECT_KEY_ALIAS));
    const { projects } = getCache();
    const byName = new Map(projects.map(p => [p.name.trim(), p]));
    const byId = new Map(projects.map(p => [p.id, p]));
    let added = 0, updated = 0, skipped = 0;
    for (const r of rows) {
      if (String(r['名称(必填)'] ?? '').startsWith('【示例】')) continue;
      const name = String(r['名称(必填)'] ?? '').trim();
      if (!name) { skipped++; continue; }
      const fields = {
        name,
        fatigueScore: Number(r['劳累指数(必填;1=轻松,2=中等,3=高强度)']) || 1,
        requiredCapacity: Number(r['所需人数(必填)']) || 1,
        weekDays: parseWeekDays(r['重复星期(选填;1-7;分号隔开;1=周一…7=周日;空=一次性任务)']),
        slots: parseSlots(r['时段(必填;自主安排/早/中/晚,分号隔开)']),
        timeRange: parseTimeRange(r['时间段开始(HH:mm;选填)'], r['时间段结束(HH:mm;选填)']),
        description: String(r['任务说明(选填)'] ?? '').trim(),
        active: String(r['启用(选填;1=启用,0=禁用,默认1)'] ?? '1') !== '0',
      };
      // 同名或同 ID 覆盖（保留原 ID 保引用），否则新增；文件内多行同名后者覆盖前者
      const existing = (r['ID'] && byId.get(r['ID'])) || byName.get(name);
      const rec = existing ? createProject({ ...fields, id: existing.id }) : createProject(fields);
      await saveProject(rec);
      byName.set(name, rec);
      existing ? updated++ : added++;
    }
    return { ok: true, message: `导入 ${added + updated} 个任务${skipped ? `（跳过 ${skipped} 条空名称）` : ''}：新增 ${added}、更新 ${updated}` };
  } catch (e) {
    return { ok: false, message: `任务导入失败：${e.message}` };
  }
}

export async function importStaffs(file) {
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false }).map(normalizeKeys(STAFF_KEY_ALIAS));
    const { staffs, projects } = getCache();
    const projectIds = new Set(projects.map(p => p.id));
    const byName = new Map(staffs.map(s => [s.name.trim(), s]));
    const byId = new Map(staffs.map(s => [s.id, s]));
    let added = 0, updated = 0, skipped = 0, reconciled = 0;
    const settings = getSettings();
    for (const r of rows) {
      if (String(r['姓名(必填)'] ?? '').startsWith('【示例】')) continue;
      const name = String(r['姓名(必填)'] ?? '').trim();
      if (!name) { skipped++; continue; }
      const status = normalizeStatus(r['状态(选填;新入/活跃/休假/已退出,默认活跃)']);
      // 上限列留空 → 取「设置」里的人员默认上限；高强度次数上限允许填 0（禁用高强度），不能 || 兜底
      const weeklyN = Number(r['周疲劳上限(选填)']);
      const heavyN = Number(r['高强度次数上限(选填)']);
      const fields = {
        name,
        status,
        restFrom: status === 'rest' ? 'active' : null,
        allowedProjects: parseList(r['可胜任项目(必填;分号隔开)']).filter(id => projectIds.has(id)),
        preferredProjects: parsePref(r['擅长项目(选填;项目(原因),分号隔开)']).filter(e => projectIds.has(e.projectId)),
        bannedProjects: parsePref(r['不合适项目(选填;项目(原因),分号隔开)']).filter(e => projectIds.has(e.projectId)),
        maxWeeklyFatigue: Number.isFinite(weeklyN) ? weeklyN : settings.defaultWeeklyFatigue,
        maxHeavyTaskCount: Number.isFinite(heavyN) ? heavyN : settings.defaultHeavyTaskCount,
      };
      // 三列表关系收敛：可胜任剔除与不合适重叠项、擅长自动并入可胜任、与不合适重叠的擅长剔除（不合适优先）
      const fix = reconcileStaff(fields);
      if (fix.changed) reconciled++;
      fields.allowedProjects = fix.allowedProjects;
      fields.preferredProjects = fix.preferredProjects;
      // 同名或同 ID 覆盖（保留原 ID 与 joinedAt），否则新增；文件内多行同名后者覆盖前者
      const existing = (r['ID'] && byId.get(r['ID'])) || byName.get(name);
      const rec = existing
        ? createStaff({ ...fields, id: existing.id, joinedAt: existing.joinedAt })
        : createStaff(fields);
      await saveStaff(rec);
      byName.set(name, rec);
      existing ? updated++ : added++;
    }
    const fixNote = reconciled ? `（${reconciled} 名含矛盾配置，已按不合适优先自动修正）` : '';
    return { ok: true, message: `导入 ${added + updated} 名人员${skipped ? `（跳过 ${skipped} 条空姓名）` : ''}：新增 ${added}、更新 ${updated}${fixNote}` };
  } catch (e) {
    return { ok: false, message: `人员导入失败：${e.message}` };
  }
}

export async function exportAttendance(schedules, projects, staffs, weekStart) {
  const projectById = Object.fromEntries(projects.map(p => [p.id, p]));
  const staffById = Object.fromEntries(staffs.map(s => [s.id, s]));
  let rows = schedules.map(sch => {
    const p = projectById[sch.projectId];
    const names = (sch.staffIds ?? []).map(id => staffById[id]?.name ?? id).join('、');
    return { 日期: sch.date, 任务: p?.name ?? sch.projectId, 时段: sch.slotLabel, 人员: names };
  });
  if (weekStart) {
    const [start, end] = [weekStart, getWeekDates(weekStart)[6]];
    rows = rows.filter(r => r.日期 >= start && r.日期 <= end);
  }
  rows.sort((a, b) => String(a.日期).localeCompare(String(b.日期)));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '排班');
  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
  downloadBlob(blob, 'Numbers-排班表.xlsx');
}
