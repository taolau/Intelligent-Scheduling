// IndexedDB 在 file:// 协议下 open 永不回调（Chromium 安全策略），导致双击 html 时数据层挂起、页面空白。
// 改用 localStorage：file:// 下可读写且持久，实现"双击即用"。接口签名不变，上层无感知。
const PREFIX = 'is_sched:';
const STORES = ['projects', 'staffs', 'schedules', 'leaves'];

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

export async function getAll(storeName) {
  return readStore(storeName);
}

export async function put(storeName, record) {
  const records = readStore(storeName);
  const idx = records.findIndex(r => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  writeStore(storeName, records);
}

export async function remove(storeName, id) {
  writeStore(storeName, readStore(storeName).filter(r => r.id !== id));
}

export async function clearAll() {
  for (const name of STORES) localStorage.removeItem(PREFIX + name);
}
