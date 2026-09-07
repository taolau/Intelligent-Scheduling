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
  const r = scoreCandidate(s, slot, projectById, { fatigueWindow: new Map(), teamAvg: 0 });
  const pref = r.breakdown.find(b => b.label.includes('擅长'));
  assert.equal(pref.points, 15);
  assert.ok(pref.reason.includes('体力好'));
});

test('均衡加分: 积分低于平均得正分', () => {
  const s = createStaff({ id: 'S1', name: '张三' });
  const ctx = { fatigueWindow: new Map([['S1', 2]]), teamAvg: 4 };
  const r = scoreCandidate(s, slot, projectById, ctx);
  const bal = r.breakdown.find(b => b.label.includes('均衡'));
  assert.equal(bal.points, (4 - 2) * 5);
});

test('新入均衡加分按平均计 → 0', () => {
  const s = createStaff({ id: 'S1', name: '新人', status: 'new' });
  const ctx = { fatigueWindow: new Map([['S1', 0]]), teamAvg: 4 };
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
  const r = scoreCandidate(s, slot, projectById, { fatigueWindow: new Map(), teamAvg: 0, settings: { preferredBonus: 20 } });
  const pref = r.breakdown.find(b => b.label.includes('擅长'));
  assert.equal(pref.points, 20);
  assert.equal(r.score, 20);
});

test('均衡加分读取 settings.balanceFactor（默认 5 可配）', () => {
  const s = createStaff({ id: 'S1', name: '张三' });
  const ctx = { fatigueWindow: new Map([['S1', 2]]), teamAvg: 4, settings: { balanceFactor: 3 } };
  const r = scoreCandidate(s, slot, projectById, ctx);
  const bal = r.breakdown.find(b => b.label.includes('均衡'));
  assert.equal(bal.points, (4 - 2) * 3);
});

// —— 标签加分 ——
test('标签加分：命中 1 个加分标签 +tagBonus', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '张三', tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  const tags = r.breakdown.filter(b => b.label === '标签加分');
  assert.equal(tags.length, 1);
  assert.equal(tags[0].points, 15);
  assert.equal(tags[0].reason, '组长');
});

test('标签加分：命中多个标签累加（每命中一个加一次）', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长', '值班'] });
  const s = createStaff({ id: 'S1', name: '张三', tags: ['组长', '值班'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  const tags = r.breakdown.filter(b => b.label === '标签加分');
  assert.equal(tags.length, 2);
  assert.equal(r.score, 30);
});

test('标签加分：擅长与标签同时命中，两项都加', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '张三', preferredProjects: [{ projectId: 'PT', reason: '熟手' }], tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  const labels = r.breakdown.map(b => b.label);
  assert.ok(labels.includes('擅长加分') && labels.includes('标签加分'));
  assert.equal(r.score, 30);
});

test('标签加分：new 状态命中照常加分', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '新人', status: 'new', tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  const tags = r.breakdown.filter(b => b.label === '标签加分');
  assert.equal(tags.length, 1);
  assert.ok(r.score >= 15);
});

test('标签加分：无命中不产生该 label', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '张三', tags: ['搬运'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  assert.ok(!r.breakdown.some(b => b.label === '标签加分'));
});

test('标签加分：project 无 bonusTags 字段（旧数据/裸对象）不崩、不命中', () => {
  const s = createStaff({ id: 'S1', name: '张三', tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: { id: 'PT', name: '值班' } }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  assert.ok(!r.breakdown.some(b => b.label === '标签加分'));
});

test('标签加分：settings 部分缺 tagBonus → 兜底默认 15（防 #28）', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '张三', tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0, settings: { preferredBonus: 20 } });
  const tags = r.breakdown.filter(b => b.label === '标签加分');
  assert.equal(tags[0].points, 15);
});

test('标签加分：读取 settings.tagBonus（默认 15 可配）', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '张三', tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0, settings: { tagBonus: 25 } });
  const tags = r.breakdown.filter(b => b.label === '标签加分');
  assert.equal(tags[0].points, 25);
});
