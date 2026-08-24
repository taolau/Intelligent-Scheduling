import test from 'node:test';
import assert from 'node:assert/strict';
import { expandProjectForWeek, expandWeek } from '../src/core/expand.js';
import { createSchedule, createProject } from '../src/data/model.js';

test('expandProjectForWeek: 每周日且两时段 → 本周日展开 2 班次', () => {
  const p = createProject({
    name: '做饭', weekDays: [0], // 周日
    slots: [
      { label: '中午', startTime: '11:30', endTime: '13:00' },
      { label: '晚上', startTime: '17:00', endTime: '19:00' },
    ],
  });
  const rows = expandProjectForWeek(p, '2026-08-24'); // 本周日 08-30
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.date), ['2026-08-30', '2026-08-30']);
  assert.deepEqual(rows.map(r => r.slotLabel), ['中午', '晚上']);
});

test('expandProjectForWeek: 周一任务命中本周一', () => {
  const p = createProject({ name: '浇花', weekDays: [1], slots: [{ label: '上午', startTime: '08:00', endTime: '09:00' }] });
  const rows = expandProjectForWeek(p, '2026-08-24');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, '2026-08-24');
});

test('expandProjectForWeek: 不命中的星期不展开', () => {
  const p = createProject({ name: '周三任务', weekDays: [3], slots: [{ label: '晚上', startTime: '17:00', endTime: '18:00' }] });
  const rows = expandProjectForWeek(p, '2026-08-24');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, '2026-08-26');
});

test('expandWeek: 一次性任务(weekDays=[]) 不展开', () => {
  const p = createProject({ name: '临时', weekDays: [], slots: [{ label: '上午', startTime: '08:00', endTime: '09:00' }] });
  const scheds = expandWeek([p], '2026-08-24', createSchedule);
  assert.equal(scheds.length, 0);
});

test('expandWeek: inactive 项目不展开', () => {
  const p = createProject({ name: '停用', active: false, weekDays: [1], slots: [{ label: '上午', startTime: '08:00', endTime: '09:00' }] });
  const scheds = expandWeek([p], '2026-08-24', createSchedule);
  assert.equal(scheds.length, 0);
});

test('expandWeek: 多项目多天展开成完整班次', () => {
  const p1 = createProject({ name: '浇花', weekDays: [1, 3, 5], slots: [{ label: '上午', startTime: '08:00', endTime: '09:00' }] });
  const scheds = expandWeek([p1], '2026-08-24', createSchedule);
  assert.equal(scheds.length, 3);
  assert.ok(scheds.every(s => Array.isArray(s.staffIds) && s.staffIds.length === 0));
  assert.ok(scheds.every(s => typeof s.id === 'string' && s.id));
});
