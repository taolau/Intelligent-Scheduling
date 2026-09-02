import * as db from './db.js';
import { KEYS } from './keys.js';
import { DEFAULT_SETTINGS } from './model.js';

const cache = { projects: [], staffs: [], schedules: [] };

// cache 是唯一真源，视图层通过 getCache() 读。loadAll 仅在初始化/导入/重置后调用（从持久层重建 cache）。
export async function loadAll() {
  const [projects, staffs, schedules] = await Promise.all([
    db.getAll('projects'), db.getAll('staffs'), db.getAll('schedules'),
  ]);
  cache.projects = projects;
  cache.staffs = staffs;
  cache.schedules = schedules;
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
export async function removeSchedule(id) { await db.remove('schedules', id); removeCache('schedules', id); }
export async function removeStaff(id) { await db.remove('staffs', id); removeCache('staffs', id); }
export async function removeProject(id) { await db.remove('projects', id); removeCache('projects', id); }
export async function resetAll() { await db.clearAll(); await loadAll(); }

export async function exportJSON() {
  return JSON.stringify(cache, null, 2);
}

export async function importJSON(text) {
  try {
    const data = JSON.parse(text);
    // 只要求核心三表；旧备份文件中的 leaves 字段（请假记录）已废弃，导入时忽略
    for (const key of ['projects', 'staffs', 'schedules']) {
      if (!Array.isArray(data[key])) return { ok: false, message: `缺少 ${key} 数组` };
    }
    await Promise.all(Object.keys(cache).map(name => db.writeAll(name, data[name])));
    await loadAll();
    return { ok: true, message: '导入成功' };
  } catch (e) {
    return { ok: false, message: `导入失败：${e.message}` };
  }
}

export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEYS.settings) || '{}');
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEYS.settings, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
}
