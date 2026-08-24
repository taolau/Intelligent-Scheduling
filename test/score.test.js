import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidate, computeTeamAvg } from '../src/core/score.js';
import { createStaff, createProject } from '../src/data/model.js';

const P101 = createProject({ id: 'P101', name: '搬运', fatigueScore: 2, slots: [{ label: '上午', startTime: '08:00', endTime: '12:00' }] });
const P102 = createProject({ id: 'P102', name: '浇花', fatigueScore: 1, slots: [{ label: '下午', startTime: '14:00', endTime: '15:00' }] });
const projectById = { P101, P102 };

const slot = { date: '2026-08-24', projectId: 'P101', slotLabel: '上午' };

test('擅长加分 +15', () => {
  const s = createStaff({ id: 'S1', name: '张三', preferredProjects: [{ projectId: 'P101', reason: '体力好' }] });
  const r = scoreCandidate(s, slot, projectById, { schedules: [], weeklyFatigue: new Map(), teamAvg: 0, restHours: 12 });
  const pref = r.breakdown.find(b => b.label.includes('擅长'));
  assert.equal(pref.points, 15);
  assert.ok(pref.reason.includes('体力好'));
});

test('均衡加分: 积分低于平均得正分', () => {
  const s = createStaff({ id: 'S1', name: '张三' });
  const ctx = { schedules: [], weeklyFatigue: new Map([['S1', 2]]), teamAvg: 4, restHours: 12 };
  const r = scoreCandidate(s, slot, projectById, ctx);
  const bal = r.breakdown.find(b => b.label.includes('均衡'));
  assert.equal(bal.points, (4 - 2) * 5);
});

test('新入均衡加分按平均计 → 0', () => {
  const s = createStaff({ id: 'S1', name: '新人', status: 'new' });
  const ctx = { schedules: [], weeklyFatigue: new Map([['S1', 0]]), teamAvg: 4, restHours: 12 };
  const r = scoreCandidate(s, slot, projectById, ctx);
  const bal = r.breakdown.find(b => b.label.includes('均衡'));
  assert.equal(bal.points, 0);
});

test('间隔保护: 距上次结束不足 restHours 扣 10 分', () => {
  const s = createStaff({ id: 'S1', name: '张三' });
  // 前一天 P102 下午 14:00-15:00 结束，本班次 P101 上午 08:00 开始 → 间隔 17h > 12h，不扣
  const prevDay = { date: '2026-08-23', projectId: 'P102', slotLabel: '下午', staffIds: ['S1'] };
  const r1 = scoreCandidate(s, slot, projectById, { schedules: [prevDay], weeklyFatigue: new Map(), teamAvg: 0, restHours: 12 });
  const gap1 = r1.breakdown.find(b => b.label.includes('间隔'));
  assert.equal(gap1, undefined);

  // 同一天 P101 上午 08:00-12:00 结束，P102 下午 14:00 开始 → 间隔 2h < 12h，扣 10
  const sameDayPrev = { date: '2026-08-24', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] };
  const slot2 = { date: '2026-08-24', projectId: 'P102', slotLabel: '下午' };
  const r2 = scoreCandidate(s, slot2, projectById, { schedules: [sameDayPrev], weeklyFatigue: new Map(), teamAvg: 0, restHours: 12 });
  const gap2 = r2.breakdown.find(b => b.label.includes('间隔'));
  assert.equal(gap2.points, -10);
});

test('computeTeamAvg: 排除 left, new 不计入, 只算 active', () => {
  const s1 = createStaff({ id: 'S1', name: 'A', status: 'active' });
  const s2 = createStaff({ id: 'S2', name: 'B', status: 'active' });
  const s3 = createStaff({ id: 'S3', name: 'C', status: 'left' });
  const s4 = createStaff({ id: 'S4', name: 'D', status: 'new' });
  const wf = new Map([['S1', 2], ['S2', 6], ['S3', 9], ['S4', 0]]);
  assert.equal(computeTeamAvg([s1, s2, s3, s4], wf), 4);
});
