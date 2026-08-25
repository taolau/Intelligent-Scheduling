import * as XLSX from 'xlsx';
import { createProject, createStaff } from '../data/model.js';
import { loadAll, saveProject, saveStaff } from '../data/store.js';
import { getWeekDates } from '../core/week.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsToAoa(rows) {
  return rows.map(r => [
    r.id ?? '', r.name ?? '',
    r.fatigueScore ?? '', r.requiredCapacity ?? '',
    (r.weekDays ?? []).join(','),
    JSON.stringify(r.slots ?? []),
    r.active === false ? 0 : 1,
  ]);
}

export async function exportProjects() {
  const { projects } = await loadAll();
  const aoa = [['id', 'name', '劳累指数', '所需人数', '重复星期(0-6逗号)', '时段JSON', '启用(1/0)'], ...rowsToAoa(projects)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '任务');
  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
  downloadBlob(blob, '任务表.xlsx');
}

export async function exportStaffs() {
  const { staffs } = await loadAll();
  const aoa = [['id', 'name', '可胜任项目(逗号)', '擅长JSON', '不合适JSON', '周疲劳上限', '高强度次数上限', '状态'], ...staffs.map(s => [
    s.id, s.name, (s.allowedProjects ?? []).join(','),
    JSON.stringify(s.preferredProjects ?? []),
    JSON.stringify(s.bannedProjects ?? []),
    s.maxWeeklyFatigue, s.maxHeavyTaskCount, s.status,
  ])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '人员');
  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
  downloadBlob(blob, '人员表.xlsx');
}

function parseJsonCell(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return fallback;
}

export async function importProjects(file) {
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    for (const r of rows) {
      const p = createProject({
        id: r.id || undefined,
        name: String(r.name ?? ''),
        fatigueScore: Number(r['劳累指数']) || 1,
        requiredCapacity: Number(r['所需人数']) || 1,
        weekDays: String(r['重复星期(0-6逗号)'] ?? '').split(',').map(Number).filter(n => !Number.isNaN(n)),
        slots: parseJsonCell(r['时段JSON'], []),
        active: String(r['启用(1/0)'] ?? '1') !== '0',
      });
      await saveProject(p);
    }
    return { ok: true, message: `导入 ${rows.length} 个任务` };
  } catch (e) {
    return { ok: false, message: `任务导入失败：${e.message}` };
  }
}

export async function importStaffs(file) {
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    for (const r of rows) {
      const s = createStaff({
        id: r.id || undefined,
        name: String(r.name ?? ''),
        allowedProjects: String(r['可胜任项目(逗号)'] ?? '').split(',').filter(Boolean),
        preferredProjects: parseJsonCell(r['擅长JSON'], []),
        bannedProjects: parseJsonCell(r['不合适JSON'], []),
        maxWeeklyFatigue: Number(r['周疲劳上限']) || 6,
        maxHeavyTaskCount: Number(r['高强度次数上限']) || 1,
        status: r['状态'] || 'active',
      });
      await saveStaff(s);
    }
    return { ok: true, message: `导入 ${rows.length} 名人员` };
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
  XLSX.utils.book_append_sheet(wb, ws, '考勤');
  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
  downloadBlob(blob, '考勤表.xlsx');
}
