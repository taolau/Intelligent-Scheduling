import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCandidate } from '../src/core/filter.js';
import { createStaff, createProject, DEFAULT_SETTINGS } from '../src/data/model.js';

const P101 = createProject({ id: 'P101', name: '搬运', fatigueScore: 3, slots: [{ label: '早' }] });
const P102 = createProject({ id: 'P102', name: '浇花', fatigueScore: 1, slots: [{ label: '早' }] });
const P103 = createProject({ id: 'P103', name: '巡逻', fatigueScore: 1, slots: [{ label: '晚' }] });
const projectById = { P101, P102, P103 };

function base() {
  return { schedules: [], leaves: [], weeklyFatigue: new Map(), heavyCounts: new Map(),
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

test('当日请假拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三' });
  const ctx = base();
  ctx.leaves = [{ staffId: 'S1', date: '2026-08-24' }];
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
});

test('周疲劳超限拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.weeklyFatigue.set('S1', 3);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
});

test('高强度次数超限拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxHeavyTaskCount: 1 });
  const ctx = base();
  ctx.heavyCounts.set('S1', 1);
  const r = filterCandidate(s, slot, projectById, ctx);
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
