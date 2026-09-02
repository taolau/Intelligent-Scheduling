import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createStaff, createSchedule,
         validateProject, validateStaff, reconcileStaff, SLOT_LABELS, DEFAULT_SETTINGS } from '../src/data/model.js';

test('createProject 带默认值', () => {
  const p = createProject({ name: '场地搬运' });
  assert.equal(p.fatigueScore, 1);
  assert.equal(p.requiredCapacity, 1);
  assert.deepEqual(p.weekDays, []);
  assert.deepEqual(p.slots, [{ label: '自主安排' }]);
  assert.equal(p.description, '');
  assert.equal(p.active, true);
  assert.equal(p.timeRange, null);
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

test('validateProject: timeRange 选填，不填合法', () => {
  const p = createProject({ name: 'X', slots: [{ label: '早' }], timeRange: null });
  const r = validateProject(p);
  assert.equal(r.valid, true);
});

test('validateProject: timeRange 起止合法（start < end）通过', () => {
  const p = createProject({ name: 'X', slots: [{ label: '早' }], timeRange: { start: '08:00', end: '18:00' } });
  const r = validateProject(p);
  assert.equal(r.valid, true);
});

test('validateProject: timeRange 起止相等或倒挂拒绝', () => {
  const bad = [
    { start: '08:00', end: '08:00' },
    { start: '18:00', end: '08:00' },
  ];
  for (const tr of bad) {
    const p = createProject({ name: 'X', slots: [{ label: '早' }], timeRange: tr });
    const r = validateProject(p);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.field === 'timeRange'), `应报 timeRange 错误: ${JSON.stringify(tr)}`);
  }
});

test('validateProject: timeRange 非法格式拒绝', () => {
  const bad = [
    { start: '8:00', end: '18:00' },
    { start: '25:00', end: '18:00' },
    { start: '08:60', end: '18:00' },
    { start: '08:00', end: '18:00:00' },
  ];
  for (const tr of bad) {
    const p = createProject({ name: 'X', slots: [{ label: '早' }], timeRange: tr });
    const r = validateProject(p);
    assert.equal(r.valid, false, `应拒绝: ${JSON.stringify(tr)}`);
  }
});

test('createStaff 带默认值', () => {
  const s = createStaff({ name: '张三' });
  assert.equal(s.status, 'active');
  assert.deepEqual(s.allowedProjects, []);
  assert.deepEqual(s.preferredProjects, []);
  assert.deepEqual(s.bannedProjects, []);
  assert.equal(s.maxWeeklyFatigue, 10);
  assert.equal(s.maxHeavyTaskCount, 2);
  assert.equal(typeof s.joinedAt, 'number');
  assert.equal(s.restFrom, null);
});

test('createStaff 可注入系统默认上限（设置里可改）', () => {
  const s = createStaff({ name: '张三' }, { maxWeeklyFatigue: 8, maxHeavyTaskCount: 3 });
  assert.equal(s.maxWeeklyFatigue, 8);
  assert.equal(s.maxHeavyTaskCount, 3);
  // 显式字段优先于注入默认
  const t = createStaff({ name: '李四', maxWeeklyFatigue: 6 }, { maxWeeklyFatigue: 8 });
  assert.equal(t.maxWeeklyFatigue, 6);
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

test('validateStaff: 同一项目不能同时在可胜任与不合适中', () => {
  const s = createStaff({
    name: '张三',
    allowedProjects: ['P1', 'P2'],
    bannedProjects: [{ projectId: 'P2', reason: '腰伤' }],
  });
  const r = validateStaff(s);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.field === 'allowedProjects'));
});

test('validateStaff: 擅长项目必须同时是可胜任项目', () => {
  const s = createStaff({
    name: '张三',
    allowedProjects: ['P1'],
    preferredProjects: [{ projectId: 'P9', reason: '体力好' }],
  });
  const r = validateStaff(s);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.field === 'preferredProjects'));
});

test('reconcileStaff: 与不合适重叠的可胜任剔除、其余保留', () => {
  const s = createStaff({
    name: '张三',
    allowedProjects: ['P1', 'P2', 'P3'],
    bannedProjects: [{ projectId: 'P2', reason: '腰伤' }],
  });
  const fix = reconcileStaff(s);
  assert.deepEqual(fix.allowedProjects, ['P1', 'P3']);
  assert.equal(fix.changed, true);
});

test('reconcileStaff: 擅长不在可胜任时自动并入（擅长必可做）', () => {
  const s = createStaff({
    name: '张三',
    allowedProjects: ['P1'],
    preferredProjects: [{ projectId: 'P7', reason: '体力好' }],
  });
  const fix = reconcileStaff(s);
  assert.deepEqual(fix.allowedProjects, ['P1', 'P7']);
  assert.deepEqual(fix.preferredProjects, [{ projectId: 'P7', reason: '体力好' }]);
  assert.equal(fix.changed, true);
});

test('reconcileStaff: 与不合适重叠的擅长条目剔除（黑名单优先）', () => {
  const s = createStaff({
    name: '张三',
    allowedProjects: ['P1'],
    bannedProjects: [{ projectId: 'P8', reason: '高空作业不行' }],
    preferredProjects: [
      { projectId: 'P8', reason: '曾是高空能手' },
      { projectId: 'P1', reason: '搬运熟手' },
    ],
  });
  const fix = reconcileStaff(s);
  assert.deepEqual(fix.preferredProjects, [{ projectId: 'P1', reason: '搬运熟手' }]);
  assert.deepEqual(fix.allowedProjects, ['P1']);
  assert.equal(fix.changed, true);
});

test('reconcileStaff: 干净数据 changed=false 原样保留', () => {
  const s = createStaff({
    name: '张三',
    allowedProjects: ['P1', 'P2'],
    preferredProjects: [{ projectId: 'P2', reason: '搬运熟手' }],
    bannedProjects: [{ projectId: 'P9', reason: '腰伤' }],
  });
  const fix = reconcileStaff(s);
  assert.deepEqual(fix.allowedProjects, ['P1', 'P2']);
  assert.deepEqual(fix.preferredProjects, [{ projectId: 'P2', reason: '搬运熟手' }]);
  assert.equal(fix.changed, false);
});

test('SLOT_LABELS 预置四时段标签', () => {
  assert.deepEqual(SLOT_LABELS, ['自主安排', '早', '中', '晚']);
});

test('DEFAULT_SETTINGS 默认值', () => {
  assert.deepEqual(DEFAULT_SETTINGS, {
    dailyTaskLimit: 2, slotTaskLimit: 1, warnDailyCount: 1,
    preferredBonus: 15, balanceFactor: 5,
    defaultWeeklyFatigue: 10, defaultHeavyTaskCount: 2,
  });
});

test('createSchedule 默认空人员', () => {
  const sch = createSchedule({ date: '2026-08-24', projectId: 'P1', slotLabel: '上午' });
  assert.deepEqual(sch.staffIds, []);
});
