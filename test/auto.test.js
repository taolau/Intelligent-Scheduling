import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateAutoFill, accumulateDelta } from '../src/core/auto.js';
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
  const ctx = mkCtx(staffs);
  ctx.settings = { ...DEFAULT_SETTINGS, warnDailyCount: 1 }; // 显式钉阈值场景，不随系统默认漂移
  const empty = sch('S1');
  const [r] = simulateAutoFill([empty], staffs, pj, ctx);
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

// —— accumulateDelta 直接单测：视图层所有写库路径（替换±/拖拽/闪电/批量删除回退）的簿记唯一实现 ——

function mkDeltaCtx() {
  return {
    fatigueWindow: new Map(), fatigueByWeek: new Map(), heavyByWeek: new Map(),
    fatigueByMonth: new Map(), heavyByMonth: new Map(), dailyCounts: new Map(),
    slotCounts: new Map(), tenure: new Map(),
    fatigueCutoff: '2026-08-01', // 窗口起点（含今天回看 N-1 天）
  };
}

test('accumulateDelta: +1 六轨全增（窗口内班次计入均衡轨）', () => {
  const project = createProject({ id: 'P1', name: '值守', fatigueScore: 1 });
  const sch = { date: '2026-09-08', projectId: 'P1', slotLabel: '早' }; // 9/8 周二 → 周键 9/7
  const ctx = mkDeltaCtx();
  accumulateDelta(ctx, project, sch, 'S1', 1);
  assert.equal(ctx.fatigueWindow.get('S1'), 1);
  assert.equal(ctx.fatigueByWeek.get('S1|2026-09-07'), 1);
  assert.equal(ctx.fatigueByMonth.get('S1|2026-09'), 1);
  assert.equal(ctx.dailyCounts.get('S1|2026-09-08'), 1);
  assert.equal(ctx.slotCounts.get('S1|2026-09-08|早'), 1);
  assert.equal(ctx.tenure.get('S1|P1').get('2026-09-07'), 1);
});

test('accumulateDelta: -1 对称回退全轨归零、不出现负数（替换/删除路径）', () => {
  const project = createProject({ id: 'P1', name: '值守', fatigueScore: 1 });
  const sch = { date: '2026-09-08', projectId: 'P1', slotLabel: '早' };
  const ctx = mkDeltaCtx();
  accumulateDelta(ctx, project, sch, 'S1', 1);
  accumulateDelta(ctx, project, sch, 'S1', -1);
  assert.equal(ctx.fatigueWindow.get('S1'), 0);
  assert.equal(ctx.fatigueByWeek.get('S1|2026-09-07'), 0);
  assert.equal(ctx.fatigueByMonth.get('S1|2026-09'), 0);
  assert.equal(ctx.dailyCounts.get('S1|2026-09-08'), 0);
  assert.equal(ctx.slotCounts.get('S1|2026-09-08|早'), 0);
  assert.equal(ctx.tenure.get('S1|P1').get('2026-09-07'), 0); // 计数归零 → 该周不再占有
});

test('accumulateDelta: 对无记录做 -1 钳制为 0 不穿底', () => {
  const project = createProject({ id: 'P1', name: '值守', fatigueScore: 1 });
  const sch = { date: '2026-09-08', projectId: 'P1', slotLabel: '早' };
  const ctx = mkDeltaCtx();
  accumulateDelta(ctx, project, sch, 'S1', -1); // 从未加过直接减
  assert.equal(ctx.fatigueWindow.get('S1'), 0);
  assert.equal(ctx.fatigueByWeek.get('S1|2026-09-07'), 0);
  assert.equal(ctx.fatigueByMonth.get('S1|2026-09'), 0);
  assert.equal(ctx.dailyCounts.get('S1|2026-09-08'), 0);
  assert.equal(ctx.slotCounts.get('S1|2026-09-08|早'), 0);
  assert.equal(ctx.tenure.get('S1|P1').get('2026-09-07'), 0);
});

test('accumulateDelta: 高强度(3)项目 ±heavy 轨；非高强度不写 heavy 轨', () => {
  const H3 = createProject({ id: 'H1', name: '搬重', fatigueScore: 3 });
  const L1 = createProject({ id: 'L1', name: '轻活', fatigueScore: 1 });
  const schH = { date: '2026-09-08', projectId: 'H1', slotLabel: '早' };
  const schL = { date: '2026-09-08', projectId: 'L1', slotLabel: '早' };
  const ctx = mkDeltaCtx();
  accumulateDelta(ctx, H3, schH, 'S1', 1);
  assert.equal(ctx.heavyByWeek.get('S1|2026-09-07'), 1);
  assert.equal(ctx.heavyByMonth.get('S1|2026-09'), 1);
  assert.equal(ctx.fatigueByWeek.get('S1|2026-09-07'), 3);
  accumulateDelta(ctx, H3, schH, 'S1', -1);
  assert.equal(ctx.heavyByWeek.get('S1|2026-09-07'), 0);
  assert.equal(ctx.heavyByMonth.get('S1|2026-09'), 0);

  const ctx2 = mkDeltaCtx();
  accumulateDelta(ctx2, L1, schL, 'S2', 1);
  assert.equal(ctx2.heavyByWeek.has('S2|2026-09-07'), false); // 轻活只走疲劳轨
  assert.equal(ctx2.heavyByMonth.has('S2|2026-09'), false);
});

test('accumulateDelta: 窗口外班次（早于 cutoff）不改均衡轨、周/月/日/时段照常', () => {
  const project = createProject({ id: 'P1', name: '值守', fatigueScore: 2 });
  const oldSch = { date: '2026-06-01', projectId: 'P1', slotLabel: '早' }; // cutoff 2026-08-01 之前
  const ctx = mkDeltaCtx();
  ctx.fatigueWindow.set('S1', 5); // 已有窗口内积分
  accumulateDelta(ctx, project, oldSch, 'S1', 1);
  assert.equal(ctx.fatigueWindow.get('S1'), 5); // 均衡轨不动（历史滑出）
  assert.equal(ctx.fatigueByWeek.get('S1|2026-06-01'), 2); // 周/月轨照常留档
  assert.equal(ctx.fatigueByMonth.get('S1|2026-06'), 2);
  assert.equal(ctx.dailyCounts.get('S1|2026-06-01'), 1);
  assert.equal(ctx.tenure.get('S1|P1').get('2026-06-01'), 1); // 连任轨照常
  accumulateDelta(ctx, project, oldSch, 'S1', -1); // 移除同样不进窗口轨
  assert.equal(ctx.fatigueWindow.get('S1'), 5);
  assert.equal(ctx.fatigueByWeek.get('S1|2026-06-01'), 0);
});

test('accumulateDelta: ctx 缺 tenure 表（旧构造）不崩、其余轨正常', () => {
  const project = createProject({ id: 'P1', name: '值守', fatigueScore: 1 });
  const sch = { date: '2026-09-08', projectId: 'P1', slotLabel: '早' };
  const ctx = mkDeltaCtx();
  delete ctx.tenure;
  accumulateDelta(ctx, project, sch, 'S1', 1);
  assert.equal(ctx.fatigueWindow.get('S1'), 1);
  assert.equal(ctx.fatigueByWeek.get('S1|2026-09-07'), 1);
});

// —— warned 阈值可配：warnDailyCount 决定「当日计数达几才收集预警」——

test('simulateAutoFill: warned 阈值可配 — warnDailyCount=2 当日计数达 2 才收集', () => {
  const staffs = [mkStaff('A')];
  const byId = { P1: proj1(1) };
  // A 当日已有「中」时段 1 班（schedules 计入 ctx），再补「早」班 → 当日 2 ≥ 2 → 收集
  const prev = createSchedule({ id: 'SP', date: '2026-09-08', projectId: 'P1', slotLabel: '中', staffIds: ['A'] });
  const ctx = mkCtx(staffs, [prev], byId);
  ctx.settings = { ...DEFAULT_SETTINGS, warnDailyCount: 2 };
  const [r] = simulateAutoFill([sch('S1', '2026-09-08', '早')], staffs, byId, ctx);
  assert.deepEqual(r.added, ['A']);
  assert.deepEqual(r.warned, ['A']);

  // 对照：无前置班次 → 当日仅 1 < 2 → 不收集
  const ctx2 = mkCtx(staffs, [], byId);
  ctx2.settings = { ...DEFAULT_SETTINGS, warnDailyCount: 2 };
  const [r2] = simulateAutoFill([sch('S2', '2026-09-08', '早')], staffs, byId, ctx2);
  assert.deepEqual(r2.added, ['A']);
  assert.deepEqual(r2.warned, []);
});

test('simulateAutoFill: warnDailyCount=0 关闭预警收集', () => {
  const staffs = [mkStaff('A')];
  const ctx = mkCtx(staffs);
  ctx.settings = { ...DEFAULT_SETTINGS, warnDailyCount: 0 };
  const [r] = simulateAutoFill([sch('S1', '2026-09-08')], staffs, pj, ctx);
  assert.deepEqual(r.added, ['A']);
  assert.deepEqual(r.warned, []); // 预警关闭
});

// —— new 状态在自动填充中的贯通：3 分任务一票否决、非 3 分可选 ——

test('simulateAutoFill: new 人员不被选入高强度(3)任务；非 3 分任务可选', () => {
  const H3 = createProject({ id: 'P3', name: '搬重', fatigueScore: 3, requiredCapacity: 1, slots: [{ label: '自主安排' }] });
  const L1 = createProject({ id: 'P2', name: '轻活', fatigueScore: 1, requiredCapacity: 1, slots: [{ label: '自主安排' }] });

  // 高强度任务：new 一票否决，只剩 new 也填不满
  const staffsN = [createStaff({ id: 'N', name: '新人', allowedProjects: ['P3'], status: 'new' })];
  const byIdN = { P3: H3 };
  const [rH] = simulateAutoFill([sch('S1', '2026-09-08', '自主安排', 'P3')], staffsN, byIdN, mkCtx(staffsN, [], byIdN));
  assert.equal(rH.added.length, 0);
  assert.equal(rH.full, false);

  // 非 3 分任务：new 可被选入
  const staffsL = [createStaff({ id: 'N', name: '新人', allowedProjects: ['P2'], status: 'new' })];
  const byIdL = { P2: L1 };
  const [rL] = simulateAutoFill([sch('S2', '2026-09-08', '自主安排', 'P2')], staffsL, byIdL, mkCtx(staffsL, [], byIdL));
  assert.deepEqual(rL.sch.staffIds, ['N']);
  assert.equal(rL.full, true);
});
