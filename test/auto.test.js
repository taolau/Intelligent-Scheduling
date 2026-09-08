import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateAutoFill } from '../src/core/auto.js';
import { createProject, createSchedule, createStaff, DEFAULT_SETTINGS } from '../src/data/model.js';
import { buildContext } from '../src/core/substitute.js';

// simulateAutoFill 契约：
//   输入 = 已按执行顺序排好的未满员班次列表 + staffs + projectById + ctx（buildContext 产物）
//   输出 = results[]：{ sch（拷贝，含最终 staffIds）, added（本次新增 id）, full（是否填满）, warned（当日达预警阈值 id）}
//   不改任何输入对象；不写库。

const TODAY = '2026-09-07';
const P1 = createProject({ id: 'P1', name: '场地搬运', fatigueScore: 1, requiredCapacity: 2, slots: [{ label: '自主安排' }] });
const pj = { P1 };

function mkStaff(id, allowed = ['P1']) {
  return createStaff({ id, name: id, allowedProjects: allowed, status: 'active' });
}

const proj1 = cap => createProject({ id: 'P1', name: '值守', fatigueScore: 1, requiredCapacity: cap, slots: [{ label: '自主安排' }] });

function mkCtx(staffs, schedules = [], byId = pj) {
  return buildContext(staffs, schedules, byId, DEFAULT_SETTINGS, TODAY);
}

const sch = (id, date = '2026-09-08', slotLabel = '自主安排', projectId = 'P1') =>
  createSchedule({ id, date, projectId, slotLabel });

test('simulateAutoFill: 空班次按容量补满，added 全录、warned 收集达阈值者', () => {
  const staffs = [mkStaff('A'), mkStaff('B')];
  const empty = sch('S1');
  const [r] = simulateAutoFill([empty], staffs, pj, mkCtx(staffs));
  assert.equal(r.full, true);
  assert.deepEqual(r.sch.staffIds, ['A', 'B']); // 同分先到先得按 staffs 序
  assert.deepEqual(r.added, ['A', 'B']);
  assert.deepEqual(r.warned, ['A', 'B']); // warnDailyCount=1，两人补入后当日计数均达 1
});

test('simulateAutoFill: 已入班次者不重补，输入对象与 staffIds 数组不被改动', () => {
  const staffs = [mkStaff('A'), mkStaff('B')];
  const oneFilled = sch('S1');
  oneFilled.staffIds = ['B'];
  const [r] = simulateAutoFill([oneFilled], staffs, pj, mkCtx(staffs));
  assert.deepEqual(r.sch.staffIds, ['B', 'A']);
  assert.deepEqual(r.added, ['A']);
  // 输入不可变：原对象、原数组均未被触碰
  assert.deepEqual(oneFilled.staffIds, ['B']);
});

test('simulateAutoFill: 候选不足填不满 → 返回已补名单且 full=false', () => {
  const staffs = [mkStaff('A')];
  const half = sch('S1');
  const [r] = simulateAutoFill([half], staffs, pj, mkCtx(staffs));
  assert.equal(r.full, false);
  assert.deepEqual(r.sch.staffIds, ['A']);
  assert.deepEqual(r.added, ['A']);
});

test('simulateAutoFill: 同时段先后班次 — 前班占位后，后班同人因时段上限被拦转他人（顺序依赖）', () => {
  const staffs = [mkStaff('A'), mkStaff('B')];
  const byId = { P1: proj1(1) };
  // 同一日期同一时段两个容量 1 的班次（手动「再建一个」场景）；A 数组序靠前，先到先得
  const s1 = sch('S1', '2026-09-08', '早');
  const s2 = sch('S2', '2026-09-08', '早');
  const [r1, r2] = simulateAutoFill([s1, s2], staffs, byId, mkCtx(staffs, [], byId));
  assert.deepEqual(r1.sch.staffIds, ['A']);
  assert.deepEqual(r2.sch.staffIds, ['B']); // A 时段数已 1/1，slotTaskLimit 拦截
});

test('simulateAutoFill: 跨时段当日上限 + 动态均衡 — 同分人依次占位后，后班次换人选（快照式会错误全塞 A）', () => {
  const staffs = [mkStaff('A'), mkStaff('B')];
  const byId = { P1: proj1(1) };
  // 早/中/晚三班各容量 1：A 先手赢早班后窗口积分 +1，中班均衡分输给 B；晚班 A/B 各 1 分打平 → A（序前）
  const morning = sch('S1', '2026-09-08', '早');
  const noon = sch('S2', '2026-09-08', '中');
  const night = sch('S3', '2026-09-08', '晚');
  const [r1, r2, r3] = simulateAutoFill([morning, noon, night], staffs, byId, mkCtx(staffs, [], byId));
  assert.deepEqual(r1.sch.staffIds, ['A']);
  assert.deepEqual(r2.sch.staffIds, ['B']);
  assert.deepEqual(r3.sch.staffIds, ['A']); // 双方各 1 分均衡分打平，A 序前
});

test('simulateAutoFill: 无任何可用候选 → 班次保持原样', () => {
  const staffs = [mkStaff('C', ['P2'])]; // 无 P1 权限
  const empty = sch('S1');
  const [r] = simulateAutoFill([empty], staffs, pj, mkCtx(staffs));
  assert.deepEqual(r.sch.staffIds, []);
  assert.equal(r.added.length, 0);
  assert.equal(r.full, false);
});

test('simulateAutoFill: 孤儿班次（任务已被删/缺失）不抛错、跳过不填', () => {
  const staffs = [mkStaff('A')];
  const orphan = sch('S1', '2026-09-08', '早', 'PX');
  const [r] = simulateAutoFill([orphan], staffs, pj, mkCtx(staffs));
  assert.equal(r.added.length, 0);
  assert.deepEqual(r.sch.staffIds, []);
});

// —— 连任（R2）在自动填充中的感知与豁免：ctx.schedules 需含已铺好的空壳班（projectWeeks 才有发生周）——

test('simulateAutoFill: 连任触发换人（与均衡解耦对照）— tenureLimit=1 第 2 周换 B、=0 时仍 A', () => {
  const staffs = [mkStaff('A'), mkStaff('B')];
  // P0 无关项目让 B 在公平窗口先有 1 分（9-13），使第 2 班决策时 A/B 窗口同分→ 无连任时平局按序取 A
  const byId = {
    P1: { ...P1, requiredCapacity: 1 },
    P0: createProject({ id: 'P0', name: '杂活', fatigueScore: 1, slots: [{ label: '自主安排' }] }),
  };
  const mk = (id, date) => createSchedule({ id, date, projectId: 'P1', slotLabel: '自主安排' });
  const s1 = mk('S1', '2026-09-07'); // 周1
  const s2 = mk('S2', '2026-09-14'); // 周2（两空壳都在 schedules，形成两"有发生周"）
  const prevB = createSchedule({ id: 'SB', date: '2026-09-13', projectId: 'P0', slotLabel: '自主安排', staffIds: ['B'] });
  const mkC = lim => {
    const c = mkCtx(staffs, [s1, s2, prevB], byId);
    c.settings = { ...DEFAULT_SETTINGS, tenureLimit: lim };
    return c;
  };
  const [a1, a2] = simulateAutoFill([s1, s2], staffs, byId, mkC(1)); // 连任开：A 已连任 1 期达上限
  assert.deepEqual(a1.sch.staffIds, ['A']);
  assert.deepEqual(a2.sch.staffIds, ['B']);

  const [b1, b2] = simulateAutoFill([s1, s2], staffs, byId, mkC(0)); // 连任关：均衡平局按序仍 A
  assert.deepEqual(b1.sch.staffIds, ['A']);
  assert.deepEqual(b2.sch.staffIds, ['A']);
});

test('simulateAutoFill: 连任豁免 — 无他人可选时允许同一人连任保运转', () => {
  const staffs = [mkStaff('A')]; // 只有 A 会 P1
  const byId = { P1: { ...P1, requiredCapacity: 1 } };
  const mk = (id, date) => createSchedule({ id, date, projectId: 'P1', slotLabel: '自主安排' });
  const s1 = mk('S1', '2026-09-07');
  const s2 = mk('S2', '2026-09-14');
  const ctx = mkCtx(staffs, [s1, s2], byId);
  ctx.settings = { ...DEFAULT_SETTINGS, tenureLimit: 1 };
  const [r1, r2] = simulateAutoFill([s1, s2], staffs, byId, ctx);
  assert.deepEqual(r1.sch.staffIds, ['A']);
  assert.deepEqual(r2.sch.staffIds, ['A']); // base 空（无人会 P1）→ 豁免 A 连任
});

test('simulateAutoFill: 时间安排不可用 → 跳过高分/靠前者选他人（硬过滤贯通）', () => {
  const staffs = [mkStaff('A'), mkStaff('B')];
  const byId = { P1: createProject({ id: 'P1', name: '值守', fatigueScore: 1, requiredCapacity: 1, slots: [{ label: '早' }], timeRange: { start: '10:00', end: '12:00' } }) };
  staffs[0].availability = { mode: 'available', entries: [{ weekDays: [1], start: '09:00', end: '12:00' }] }; // A 仅周一可用
  const tue = sch('S1', '2026-09-08', '早'); // 2026-09-08 为周二
  const ctx = mkCtx(staffs, [], byId);
  const [r] = simulateAutoFill([tue], staffs, byId, ctx);
  assert.deepEqual(r.sch.staffIds, ['B']);
  assert.deepEqual(r.added, ['B']);
  assert.equal(r.full, true);
});
