import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCandidate } from '../src/core/filter.js';
import { createStaff, createProject } from '../src/data/model.js';

const P101 = createProject({ id: 'P101', name: '搬运', fatigueScore: 3, slots: [{ label: '上午', startTime: '08:00', endTime: '12:00' }] });
const P102 = createProject({ id: 'P102', name: '浇花', fatigueScore: 1, slots: [{ label: '上午', startTime: '08:00', endTime: '12:00' }] });
const projectById = { P101, P102 };

function base() {
  return { schedules: [], leaves: [], weeklyFatigue: new Map(), heavyCounts: new Map() };
}

const slot = { date: '2026-08-24', projectId: 'P101', slotLabel: '上午' };

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

test('新入保护: new 且高强度拒绝', () => {
  const s = createStaff({ id: 'S1', name: '新人', status: 'new' });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('新入'));
});

test('新入可排非高强度', () => {
  const s = createStaff({ id: 'S1', name: '新人', status: 'new', allowedProjects: ['P102'] });
  const slot2 = { date: '2026-08-24', projectId: 'P102', slotLabel: '上午' };
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
  ctx.weeklyFatigue.set('S1', 3); // 已 3 分，加入后 6 > 3
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

test('时间重叠: 同一时段已有班次拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102'] });
  const ctx = base();
  ctx.schedules = [{ date: '2026-08-24', projectId: 'P102', slotLabel: '上午', staffIds: ['S1'] }];
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('冲突'));
});

test('全部通过', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'] });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, true);
});
