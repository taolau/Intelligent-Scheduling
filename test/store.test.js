import test from 'node:test';
import assert from 'node:assert/strict';

// file:// 下 Chromium 的 localStorage 是同步 key/value 存储，用 Map 模拟
const backing = new Map();
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
};

const store = await import('../src/data/store.js');

test.beforeEach(async () => {
  await store.resetAll();
});

test('loadAll 初始为空', () => {
  const c = store.getCache();
  assert.deepEqual(c.projects, []);
  assert.deepEqual(c.staffs, []);
  assert.deepEqual(c.schedules, []);
});

test('saveProject 后 getCache 反映且 localStorage 已落盘', async () => {
  await store.saveProject({ id: 'P101', name: '搬运', fatigueScore: 2, requiredCapacity: 2, weekDays: [], slots: [], active: true });
  assert.equal(store.getCache().projects.length, 1);
  assert.equal(store.getCache().projects[0].name, '搬运');
  const raw = JSON.parse(backing.get('is_sched:projects'));
  assert.equal(raw.length, 1);
  assert.equal(raw[0].id, 'P101');
});

test('save 同 id 覆盖不重复', async () => {
  await store.saveProject({ id: 'P101', name: '搬运', fatigueScore: 2, requiredCapacity: 2, weekDays: [], slots: [], active: true });
  await store.saveProject({ id: 'P101', name: '搬运改', fatigueScore: 3, requiredCapacity: 2, weekDays: [], slots: [], active: true });
  assert.equal(store.getCache().projects.length, 1);
  assert.equal(store.getCache().projects[0].name, '搬运改');
});

test('removeSchedule 从 cache 移除并落盘', async () => {
  await store.saveSchedule({ id: 'SCH1', date: '2026-08-24', projectId: 'P101', slotLabel: '上午', staffIds: [] });
  await store.saveSchedule({ id: 'SCH2', date: '2026-08-24', projectId: 'P101', slotLabel: '中午', staffIds: [] });
  await store.removeSchedule('SCH1');
  const schedules = store.getCache().schedules;
  assert.equal(schedules.length, 1);
  assert.equal(schedules[0].id, 'SCH2');
  const raw = JSON.parse(backing.get('is_sched:schedules'));
  assert.equal(raw.length, 1);
});

test('importJSON 批量替换并同步 cache', async () => {
  await store.saveProject({ id: 'P101', name: '旧任务', fatigueScore: 1, requiredCapacity: 1, weekDays: [], slots: [], active: true });
  const text = JSON.stringify({
    projects: [{ id: 'P1', name: '新任务', fatigueScore: 2, requiredCapacity: 2, weekDays: [], slots: [], active: true }],
    staffs: [{ id: 'S1', name: '张三', allowedProjects: ['P1'], preferredProjects: [], bannedProjects: [], maxWeeklyFatigue: 6, maxHeavyTaskCount: 1, status: 'active' }],
    schedules: [],
    leaves: [], // 旧备份遗留字段：废弃后导入应忽略，不写入 cache
  });
  const r = await store.importJSON(text);
  assert.equal(r.ok, true);
  const c = store.getCache();
  assert.equal(c.projects.length, 1);
  assert.equal(c.projects[0].name, '新任务');
  assert.equal(c.staffs.length, 1);
  assert.equal(c.staffs[0].name, '张三');
  assert.ok(!('leaves' in c));
});

test('importJSON 缺字段返回失败', async () => {
  const r = await store.importJSON('{"projects":[]}');
  assert.equal(r.ok, false);
});

test('exportJSON 输出当前全量数据', async () => {
  await store.saveProject({ id: 'P1', name: '任务', fatigueScore: 1, requiredCapacity: 1, weekDays: [], slots: [], active: true });
  const json = JSON.parse(await store.exportJSON());
  assert.equal(json.projects.length, 1);
  assert.equal(json.staffs.length, 0);
});

test('resetAll 清空全部', async () => {
  await store.saveStaff({ id: 'S1', name: '张三', allowedProjects: [], preferredProjects: [], bannedProjects: [], maxWeeklyFatigue: 6, maxHeavyTaskCount: 1, status: 'active' });
  await store.resetAll();
  assert.equal(store.getCache().staffs.length, 0);
});
