import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createStaff, createSchedule, createLeave,
         validateProject, validateStaff, SLOT_LABELS, DEFAULT_SETTINGS } from '../src/data/model.js';

test('createProject 带默认值', () => {
  const p = createProject({ name: '场地搬运' });
  assert.equal(p.fatigueScore, 1);
  assert.equal(p.requiredCapacity, 1);
  assert.deepEqual(p.weekDays, []);
  assert.deepEqual(p.slots, []);
  assert.equal(p.active, true);
});

test('validateProject: 非法劳累指数', () => {
  const p = createProject({ name: 'X', fatigueScore: 5 });
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.msg.includes('劳累')));
});

test('validateProject: 空 slot 标签非法', () => {
  const p = createProject({ name: 'X', slots: [{ label: '午夜', startTime: '00:00', endTime: '01:00' }] });
  const r = validateProject(p);
  assert.equal(r.valid, false);
});

test('validateProject: 至少配置一个时段', () => {
  const p = createProject({ name: 'X', weekDays: [1], slots: [] });
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.field === 'slots'));
});

test('validateProject: 自主安排时段（无时间）合法', () => {
  const p = createProject({ name: '浇花', slots: [{ label: '自主安排' }] });
  const r = validateProject(p);
  assert.equal(r.valid, true);
});

test('createStaff 带默认值', () => {
  const s = createStaff({ name: '张三' });
  assert.equal(s.status, 'active');
  assert.deepEqual(s.allowedProjects, []);
  assert.deepEqual(s.preferredProjects, []);
  assert.deepEqual(s.bannedProjects, []);
  assert.equal(s.maxWeeklyFatigue, 6);
  assert.equal(s.maxHeavyTaskCount, 1);
  assert.equal(typeof s.joinedAt, 'number');
  assert.equal(s.restFrom, null);
});

test('createStaff rest 状态记录休假前状态', () => {
  const s = createStaff({ name: '李四', status: 'rest', restFrom: 'new' });
  assert.equal(s.status, 'rest');
  assert.equal(s.restFrom, 'new');
});

test('validateStaff: rest 必须记录 restFrom', () => {
  const s = createStaff({ name: '张三', status: 'rest' });
  const r = validateStaff(s);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.field === 'status'));
});

test('SLOT_LABELS 预置四时段标签', () => {
  assert.deepEqual(SLOT_LABELS, ['自主安排', '早', '中', '晚']);
});

test('DEFAULT_SETTINGS 数量上限默认值', () => {
  assert.deepEqual(DEFAULT_SETTINGS, { dailyTaskLimit: 2, slotTaskLimit: 1, warnDailyCount: 2 });
});

test('createSchedule 默认空人员', () => {
  const sch = createSchedule({ date: '2026-08-24', projectId: 'P1', slotLabel: '上午' });
  assert.deepEqual(sch.staffIds, []);
});

test('createLeave 默认空原因', () => {
  const l = createLeave({ staffId: 'S1', date: '2026-08-24' });
  assert.equal(l.reason, '');
});
