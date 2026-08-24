import test from 'node:test';
import assert from 'node:assert/strict';

// file:// 下 Chromium 的 localStorage 是同步 key/value 存储，用 Map 模拟
const backing = new Map();
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
};

const db = await import('../src/data/db.js');

test('put/getAll 写入与读取往返', async () => {
  await db.put('staffs', { id: 'S001', name: '张三' });
  await db.put('staffs', { id: 'S002', name: '李四' });
  const all = await db.getAll('staffs');
  assert.equal(all.length, 2);
});

test('put 同 id 覆盖不重复', async () => {
  await db.put('staffs', { id: 'S001', name: '张三改' });
  const again = await db.getAll('staffs');
  assert.equal(again.length, 2);
  assert.equal(again.find(s => s.id === 'S001').name, '张三改');
});

test('remove 按 id 删除', async () => {
  await db.remove('staffs', 'S001');
  const left = await db.getAll('staffs');
  assert.equal(left.length, 1);
  assert.equal(left[0].id, 'S002');
});

test('clearAll 清空全部 store', async () => {
  await db.put('projects', { id: 'P101', name: '搬运' });
  await db.clearAll();
  assert.equal((await db.getAll('staffs')).length, 0);
  assert.equal((await db.getAll('projects')).length, 0);
});
