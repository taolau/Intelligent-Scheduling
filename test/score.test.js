import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidate, computeTeamAvg } from '../src/core/score.js';
import { createStaff, createProject } from '../src/data/model.js';

const P101 = createProject({ id: 'P101', name: '搬运', fatigueScore: 2, slots: [{ label: '早' }] });
const P102 = createProject({ id: 'P102', name: '浇花', fatigueScore: 1, slots: [{ label: '中' }] });
const projectById = { P101, P102 };

const slot = { date: '2026-08-24', projectId: 'P101', slotLabel: '早' };

test('擅长加分 +15', () => {
  const s = createStaff({ id: 'S1', name: '张三', preferredProjects: [{ projectId: 'P101', reason: '体力好' }] });
  const r = scoreCandidate(s, slot, projectById, { weeklyFatigue: new Map(), teamAvg: 0 });
  const pref = r.breakdown.find(b => b.label.includes('擅长'));
  assert.equal(pref.points, 15);
  assert.ok(pref.reason.includes('体力好'));
});

test('均衡加分: 积分低于平均得正分', () => {
  const s = createStaff({ id: 'S1', name: '张三' });
  const ctx = { weeklyFatigue: new Map([['S1', 2]]), teamAvg: 4 };
  const r = scoreCandidate(s, slot, projectById, ctx);
  const bal = r.breakdown.find(b => b.label.includes('均衡'));
  assert.equal(bal.points, (4 - 2) * 5);
});

test('新入均衡加分按平均计 → 0', () => {
  const s = createStaff({ id: 'S1', name: '新人', status: 'new' });
  const ctx = { weeklyFatigue: new Map([['S1', 0]]), teamAvg: 4 };
  const r = scoreCandidate(s, slot, projectById, ctx);
  const bal = r.breakdown.find(b => b.label.includes('均衡'));
  assert.equal(bal.points, 0);
});

test('computeTeamAvg: 排除 left, new 不计入, 只算 active', () => {
  const s1 = createStaff({ id: 'S1', name: 'A', status: 'active' });
  const s2 = createStaff({ id: 'S2', name: 'B', status: 'active' });
  const s3 = createStaff({ id: 'S3', name: 'C', status: 'left' });
  const s4 = createStaff({ id: 'S4', name: 'D', status: 'new' });
  const wf = new Map([['S1', 2], ['S2', 6], ['S3', 9], ['S4', 0]]);
  assert.equal(computeTeamAvg([s1, s2, s3, s4], wf), 4);
});

test('computeTeamAvg: 排除 rest 休假人员', () => {
  const s1 = createStaff({ id: 'S1', name: 'A', status: 'active' });
  const s2 = createStaff({ id: 'S2', name: 'B', status: 'rest', restFrom: 'active' });
  const wf = new Map([['S1', 2], ['S2', 10]]);
  assert.equal(computeTeamAvg([s1, s2], wf), 2);
});

test('擅长加分读取 settings.preferredBonus（默认 15 可配）', () => {
  const s = createStaff({ id: 'S1', name: '张三', preferredProjects: [{ projectId: 'P101', reason: '体力好' }] });
  const r = scoreCandidate(s, slot, projectById, { weeklyFatigue: new Map(), teamAvg: 0, settings: { preferredBonus: 20 } });
  const pref = r.breakdown.find(b => b.label.includes('擅长'));
  assert.equal(pref.points, 20);
  assert.equal(r.score, 20);
});

test('均衡加分读取 settings.balanceFactor（默认 5 可配）', () => {
  const s = createStaff({ id: 'S1', name: '张三' });
  const ctx = { weeklyFatigue: new Map([['S1', 2]]), teamAvg: 4, settings: { balanceFactor: 3 } };
  const r = scoreCandidate(s, slot, projectById, ctx);
  const bal = r.breakdown.find(b => b.label.includes('均衡'));
  assert.equal(bal.points, (4 - 2) * 3);
});
