import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createStaff, createSchedule, createLeave,
         validateProject, validateStaff, SLOT_LABELS, fillSlotTimes } from '../src/data/model.js';

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

test('fillSlotTimes: 空时间回填该时段默认时间', () => {
  const filled = fillSlotTimes([
    { label: '上午' },
    { label: '晚上', startTime: '18:00', endTime: '' },
    { label: '下午', startTime: '', endTime: '15:00' },
  ]);
  assert.deepEqual(filled, [
    { label: '上午', startTime: '08:00', endTime: '12:00' },
    { label: '晚上', startTime: '18:00', endTime: '21:00' },
    { label: '下午', startTime: '13:00', endTime: '15:00' },
  ]);
});

test('createStaff 带默认值', () => {
  const s = createStaff({ name: '张三' });
  assert.equal(s.status, 'active');
  assert.deepEqual(s.allowedProjects, []);
  assert.deepEqual(s.preferredProjects, []);
  assert.deepEqual(s.bannedProjects, []);
  assert.equal(s.maxWeeklyFatigue, 6);
  assert.equal(s.maxHeavyTaskCount, 1);
});

test('SLOT_LABELS 预置四时段', () => {
  assert.deepEqual(SLOT_LABELS, ['上午', '中午', '下午', '晚上']);
});

test('createSchedule 默认空人员', () => {
  const sch = createSchedule({ date: '2026-08-24', projectId: 'P1', slotLabel: '上午' });
  assert.deepEqual(sch.staffIds, []);
});

test('createLeave 默认空原因', () => {
  const l = createLeave({ staffId: 'S1', date: '2026-08-24' });
  assert.equal(l.reason, '');
});
