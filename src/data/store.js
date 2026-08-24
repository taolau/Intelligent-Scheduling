import * as db from './db.js';

const cache = { projects: [], staffs: [], schedules: [], leaves: [] };

export async function loadAll() {
  const [projects, staffs, schedules, leaves] = await Promise.all([
    db.getAll('projects'), db.getAll('staffs'), db.getAll('schedules'), db.getAll('leaves'),
  ]);
  cache.projects = projects;
  cache.staffs = staffs;
  cache.schedules = schedules;
  cache.leaves = leaves;
  return { projects, staffs, schedules, leaves };
}

export function getCache() { return cache; }

export async function saveProject(p) { await db.put('projects', p); await loadAll(); }
export async function saveStaff(s) { await db.put('staffs', s); await loadAll(); }
export async function saveSchedule(sch) { await db.put('schedules', sch); await loadAll(); }
export async function saveLeave(l) { await db.put('leaves', l); await loadAll(); }
export async function removeSchedule(id) { await db.remove('schedules', id); await loadAll(); }
export async function removeLeave(id) { await db.remove('leaves', id); await loadAll(); }
export async function resetAll() { await db.clearAll(); await loadAll(); }

export async function exportJSON() {
  return JSON.stringify(await loadAll(), null, 2);
}

export async function importJSON(text) {
  try {
    const data = JSON.parse(text);
    for (const key of ['projects', 'staffs', 'schedules', 'leaves']) {
      if (!Array.isArray(data[key])) return { ok: false, message: `缺少 ${key} 数组` };
    }
    await db.clearAll();
    for (const name of Object.keys(cache)) {
      for (const rec of data[name]) await db.put(name, rec);
    }
    await loadAll();
    return { ok: true, message: '导入成功' };
  } catch (e) {
    return { ok: false, message: `导入失败：${e.message}` };
  }
}
