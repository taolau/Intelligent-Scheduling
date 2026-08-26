import * as db from './db.js';

const cache = { projects: [], staffs: [], schedules: [], leaves: [] };

// cache 是唯一真源，视图层通过 getCache() 读。loadAll 仅在初始化/导入/重置后调用（从持久层重建 cache）。
export async function loadAll() {
  const [projects, staffs, schedules, leaves] = await Promise.all([
    db.getAll('projects'), db.getAll('staffs'), db.getAll('schedules'), db.getAll('leaves'),
  ]);
  cache.projects = projects;
  cache.staffs = staffs;
  cache.schedules = schedules;
  cache.leaves = leaves;
  return cache;
}

export function getCache() { return cache; }

function upsertCache(storeName, record) {
  const list = cache[storeName];
  const idx = list.findIndex(r => r.id === record.id);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
}

function removeCache(storeName, id) {
  const list = cache[storeName];
  const idx = list.findIndex(r => r.id === id);
  if (idx >= 0) list.splice(idx, 1);
}

export async function saveProject(p) { await db.put('projects', p); upsertCache('projects', p); }
export async function saveStaff(s) { await db.put('staffs', s); upsertCache('staffs', s); }
export async function saveSchedule(sch) { await db.put('schedules', sch); upsertCache('schedules', sch); }
export async function saveLeave(l) { await db.put('leaves', l); upsertCache('leaves', l); }
export async function removeSchedule(id) { await db.remove('schedules', id); removeCache('schedules', id); }
export async function removeLeave(id) { await db.remove('leaves', id); removeCache('leaves', id); }
export async function resetAll() { await db.clearAll(); await loadAll(); }

export async function exportJSON() {
  return JSON.stringify(cache, null, 2);
}

export async function importJSON(text) {
  try {
    const data = JSON.parse(text);
    for (const key of ['projects', 'staffs', 'schedules', 'leaves']) {
      if (!Array.isArray(data[key])) return { ok: false, message: `缺少 ${key} 数组` };
    }
    await Promise.all(Object.keys(cache).map(name => db.writeAll(name, data[name])));
    await loadAll();
    return { ok: true, message: '导入成功' };
  } catch (e) {
    return { ok: false, message: `导入失败：${e.message}` };
  }
}
