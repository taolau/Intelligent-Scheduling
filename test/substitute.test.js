import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, recommendSubstitutes } from '../src/core/substitute.js';
import { createStaff, createProject } from '../src/data/model.js';

const P101 = createProject({ id: 'P101', name: '搬运', fatigueScore: 2, slots: [{ label: '上午', startTime: '08:00', endTime: '12:00' }] });
const projectById = { P101 };

const schedule = { date: '2026-08-24', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] };

test('buildContext 计算周积分/高强度次数/团队平均', () => {
  const staffs = [
    createStaff({ id: 'S1', name: '张三' }),
    createStaff({ id: 'S2', name: '李四' }),
  ];
  const schedules = [
    { date: '2026-08-24', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] }, // S1 +2
    { date: '2026-08-25', projectId: 'P101', slotLabel: '上午', staffIds: ['S1', 'S2'] }, // S1+2 S2+2
  ];
  const ctx = buildContext(staffs, schedules, [], projectById);
  assert.equal(ctx.weeklyFatigue.get('S1'), 4);
  assert.equal(ctx.weeklyFatigue.get('S2'), 2);
  assert.equal(ctx.heavyCounts.get('S1'), 0); // P101 疲劳 2 非高强度
  assert.equal(ctx.teamAvg, 3);
});

test('recommendSubstitutes: 返回 Top3 降序, 排除请假人与当前人员', () => {
  const staffs = [
    createStaff({ id: 'S1', name: '请假人' }),
    createStaff({ id: 'S2', name: '张三', allowedProjects: ['P101'], preferredProjects: [{ projectId: 'P101', reason: '熟练' }] }),
    createStaff({ id: 'S3', name: '李四', allowedProjects: ['P101'] }),
    createStaff({ id: 'S4', name: '王五', allowedProjects: ['P101'] }),
  ];
  const ctx = buildContext(staffs, [schedule], [], projectById);
  const result = recommendSubstitutes(staffs, schedule, projectById, ctx, 'S1');
  assert.equal(result.length, 3);
  // 张三擅长加分最高，应排第一
  assert.equal(result[0].staff.id, 'S2');
  assert.ok(result.every(r => r.staff.id !== 'S1'));
  assert.ok(result.every(r => r.reasons.length > 0));
});

test('recommendSubstitutes: 无人可用时返回空', () => {
  const staffs = [createStaff({ id: 'S1', name: '请假人' })];
  const ctx = buildContext(staffs, [schedule], [], projectById);
  const result = recommendSubstitutes(staffs, schedule, projectById, ctx, 'S1');
  assert.equal(result.length, 0);
});
