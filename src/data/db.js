// IndexedDB 在 file:// 协议下 open 永不回调（Chromium 安全策略），导致双击 html 时数据层挂起、页面空白。
// 改用 localStorage：file:// 下可读写且持久，实现"双击即用"。
// 本层维护内存 Map（id→record）作索引：读写走 O(1) Map 操作，首次访问某 store 时从 localStorage 加载一次，
// 每次变更同步序列化整表写回 localStorage。视图层高频读（getAll）不再反复 JSON.parse。
const PREFIX = 'is_sched:';
const STORES = ['projects', 'staffs', 'schedules'];

const maps = new Map();

function readStore(storeName) {
  try {
    const raw = localStorage.getItem(PREFIX + storeName);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore(storeName, records) {
  localStorage.setItem(PREFIX + storeName, JSON.stringify(records));
}

function storeMap(storeName) {
  let m = maps.get(storeName);
  if (!m) {
    m = new Map(readStore(storeName).map(r => [r.id, r]));
    maps.set(storeName, m);
  }
  return m;
}

function persist(storeName) {
  writeStore(storeName, [...storeMap(storeName).values()]);
}

export async function getAll(storeName) {
  return [...storeMap(storeName).values()];
}

export async function put(storeName, record) {
  storeMap(storeName).set(record.id, record);
  persist(storeName);
}

export async function remove(storeName, id) {
  storeMap(storeName).delete(id);
  persist(storeName);
}

export async function writeAll(storeName, records) {
  maps.set(storeName, new Map(records.map(r => [r.id, r])));
  writeStore(storeName, records);
}

export async function clearAll() {
  for (const name of STORES) {
    maps.delete(name);
    localStorage.removeItem(PREFIX + name);
  }
}
