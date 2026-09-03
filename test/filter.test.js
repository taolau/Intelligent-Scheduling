import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCandidate } from '../src/core/filter.js';
import { createStaff, createProject, DEFAULT_SETTINGS } from '../src/data/model.js';

const P101 = createProject({ id: 'P101', name: '搬运', fatigueScore: 3, slots: [{ label: '早' }] });
const P102 = createProject({ id: 'P102', name: '浇花', fatigueScore: 1, slots: [{ label: '早' }] });
const P103 = createProject({ id: 'P103', name: '巡逻', fatigueScore: 1, slots: [{ label: '晚' }] });
const projectById = { P101, P102, P103 };

// slot 日期 2026-08-24 恰为周一 → 周键 = 'S1|2026-08-24'
function base() {
  return { schedules: [], fatigueByWeek: new Map(), heavyByWeek: new Map(),
           dailyCounts: new Map(), slotCounts: new Map(), settings: { ...DEFAULT_SETTINGS } };
}

const slot = { date: '2026-08-24', projectId: 'P101', slotLabel: '早' };

test('黑名单拒绝并带原因', () => {
  const s = createStaff({ id: 'S1', name: '张三', bannedProjects: [{ projectId: 'P101', reason: '腰伤' }] });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('黑名单'));
  assert.ok(r.reasons[0].includes('腰伤'));
});

test('无权限拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P102'] });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('权限'));
});

test('已退出拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', status: 'left' });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
});

test('休假拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', status: 'rest', restFrom: 'active' });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('休假'));
});

test('新入保护: new 且高强度拒绝', () => {
  const s = createStaff({ id: 'S1', name: '新人', status: 'new' });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('新入'));
});

test('新入可排非高强度', () => {
  const s = createStaff({ id: 'S1', name: '新人', status: 'new', allowedProjects: ['P102'] });
  const slot2 = { date: '2026-08-24', projectId: 'P102', slotLabel: '早' };
  const r = filterCandidate(s, slot2, projectById, base());
  assert.equal(r.ok, true);
});

test('周疲劳超限拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-24', 3);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
});

test('高强度次数超限拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxHeavyTaskCount: 1 });
  const ctx = base();
  ctx.heavyByWeek.set('S1|2026-08-24', 1);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
});

test('滚动周窗口：上周已超限不影响本周判定（旧全量聚合 bug 回归）', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3, allowedProjects: ['P101'] });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-17', 4); // 上周累计 4 > 上限，但属于过去周窗口
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, true);
});

test('滚动周窗口：本周累计触发上限', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-24', 2); // 本周已 2，P101 疲劳 3 → 加入后 5 > 3
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some(x => x.includes('将超限')));
});

test('滚动周窗口：跨月自然周按周首日归属同键', () => {
  // 班次在 2026-09-01（周二，属 8/31 起的自然周）→ 查 8/31 周键
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-31', 3); // 8/31~9/6 周累计已 3
  const slotSep = { date: '2026-09-01', projectId: 'P101', slotLabel: '早' };
  const r = filterCandidate(s, slotSep, projectById, ctx);
  assert.equal(r.ok, false);
});

test('时段数量超限: 同一时段已有班次拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102'] });
  const ctx = base();
  ctx.slotCounts.set('S1|2026-08-24|早', 1); // 已在「早」排过 1 个
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('时段'));
});

test('日数量超限: 当天已有 2 个班次拒绝第 3 个', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102', 'P103'] });
  const ctx = base();
  ctx.dailyCounts.set('S1|2026-08-24', 2); // 当天已排 2 个（上限 2）
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('当日'));
});

test('跨时段可排: 已有早班次可排晚班次', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P103'] });
  const ctx = base();
  ctx.slotCounts.set('S1|2026-08-24|早', 1);
  ctx.dailyCounts.set('S1|2026-08-24', 1);
  const slotLate = { date: '2026-08-24', projectId: 'P103', slotLabel: '晚' };
  const r = filterCandidate(s, slotLate, projectById, ctx);
  assert.equal(r.ok, true);
});

test('自主安排不阻塞同日固定时段', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P103'] });
  const ctx = base();
  ctx.slotCounts.set('S1|2026-08-24|自主安排', 1);
  ctx.dailyCounts.set('S1|2026-08-24', 1);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, true);
});

test('全部通过', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'] });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, true);
});

// —— 超限文案三态：当前已超=「已超限」；恰满上限=「已达上限」；未超但加入后超=「将超限」 ——

test('疲劳文案：当前已超上限（4/3）说「已超限」不说「将超限」', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-24', 4);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.ok(r.reasons.some(x => x.includes('已超限')));
  assert.ok(!r.reasons.some(x => x.includes('将超限')));
});

test('疲劳文案：恰满上限（3/3）说「已达上限」', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-24', 3);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.ok(r.reasons.some(x => x.includes('已达上限')));
  assert.ok(!r.reasons.some(x => x.includes('超限')));
});

test('疲劳文案：未超但加入后超（2/3 + 高强度3）说「将超限」', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-24', 2);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.ok(r.reasons.some(x => x.includes('将超限')));
  assert.ok(!r.reasons.some(x => x.includes('已超限')));
});

test('高强度次数文案：已超（2/1）与恰满（1/1）区分', () => {
  const s1 = createStaff({ id: 'S1', name: '张三', maxHeavyTaskCount: 1 });
  const ctx1 = base();
  ctx1.heavyByWeek.set('S1|2026-08-24', 2);
  const r1 = filterCandidate(s1, slot, projectById, ctx1);
  assert.ok(r1.reasons.some(x => x.includes('已超限')));

  const s2 = createStaff({ id: 'S2', name: '李四', maxHeavyTaskCount: 1 });
  const ctx2 = base();
  ctx2.heavyByWeek.set('S2|2026-08-24', 1);
  const r2 = filterCandidate(s2, slot, projectById, ctx2);
  assert.ok(r2.reasons.some(x => x.includes('已达上限')));
  assert.ok(!r2.reasons.some(x => x.includes('已超限')));
});

test('当日任务数文案：已超（3/2）与恰满（2/2）区分', () => {
  const s1 = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102', 'P103'] });
  const ctx1 = base();
  ctx1.dailyCounts.set('S1|2026-08-24', 3);
  const r1 = filterCandidate(s1, slot, projectById, ctx1);
  assert.ok(r1.reasons.some(x => x.includes('当日') && x.includes('已超限')));

  const s2 = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P101', 'P102', 'P103'] });
  const ctx2 = base();
  ctx2.dailyCounts.set('S2|2026-08-24', 2);
  const r2 = filterCandidate(s2, slot, projectById, ctx2);
  assert.ok(r2.reasons.some(x => x.includes('当日') && x.includes('已达上限')));
  assert.ok(!r2.reasons.some(x => x.includes('将超限')));
});

test('时段任务数文案：已超与恰满区分', () => {
  const s1 = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102'] });
  const ctx1 = base();
  ctx1.slotCounts.set('S1|2026-08-24|早', 2); // slotTaskLimit 默认 1
  const r1 = filterCandidate(s1, slot, projectById, ctx1);
  assert.ok(r1.reasons.some(x => x.includes('时段') && x.includes('已超限')));

  const s2 = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P101', 'P102'] });
  const ctx2 = base();
  ctx2.slotCounts.set('S2|2026-08-24|早', 1);
  const r2 = filterCandidate(s2, slot, projectById, ctx2);
  assert.ok(r2.reasons.some(x => x.includes('时段') && x.includes('已达上限')));
});
