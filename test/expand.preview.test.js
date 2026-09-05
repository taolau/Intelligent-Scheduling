import test from 'node:test';
import assert from 'node:assert/strict';
import { expandWeeks, previewExpand } from '../src/core/expand.js';
import { createProject, createSchedule } from '../src/data/model.js';
import { weeksCovering } from '../src/core/week.js';

const key = s => `${s.date}|${s.projectId}|${s.slotLabel}`;

test('previewExpand: 无已存在 → totalNew 等于 expandWeeks 行数、perTask 覆盖各任务', () => {
  const p1 = createProject({ name: '浇花', weekDays: [1, 3, 5], slots: [{ label: '自主安排' }] });
  const p2 = createProject({ name: '做饭', weekDays: [0], slots: [{ label: '早' }, { label: '晚' }] });
  const weekStarts = ['2026-08-24', '2026-08-31'];
  const rows = expandWeeks([p1, p2], weekStarts[0], weekStarts.length, createSchedule);
  const pv = previewExpand([p1, p2], weekStarts, new Set());
  assert.equal(pv.totalNew, rows.length);
  assert.equal(pv.totalSkip, 0);
  assert.equal(pv.perTask.length, 2);
  const byId = Object.fromEntries(pv.perTask.map(t => [t.projectId, t]));
  assert.equal(byId[p1.id].created, 6); // 一/三/五 × 2 周
  assert.equal(byId[p2.id].created, 4); // 周日 × 2 时段 × 2 周
});

test('previewExpand: 部分已存在 → created/skipped 按 key 去重正确', () => {
  const p = createProject({ name: '浇花', weekDays: [1, 3, 5], slots: [{ label: '自主安排' }] });
  const weekStarts = ['2026-08-24'];
  const rows = expandWeeks([p], weekStarts[0], 1, createSchedule); // 一/三/五 → 3 行
  const existing = new Set(rows.slice(0, 2).map(key)); // 前 2 条视为已存在
  const pv = previewExpand([p], weekStarts, existing);
  assert.equal(pv.totalNew, 1);
  assert.equal(pv.totalSkip, 2);
  assert.equal(pv.perTask.length, 1);
  assert.equal(pv.perTask[0].created, 1);
  assert.equal(pv.perTask[0].skipped, 2);
});

test('previewExpand: 一次性任务与停用任务不进 perTask 且不计', () => {
  const oneOff = createProject({ name: '临时', weekDays: [], slots: [{ label: '早' }] });
  const disabled = createProject({ name: '停用', active: false, weekDays: [1], slots: [{ label: '早' }] });
  const pv = previewExpand([oneOff, disabled], ['2026-08-24'], new Set());
  assert.equal(pv.totalNew, 0);
  assert.equal(pv.totalSkip, 0);
  assert.equal(pv.perTask.length, 0);
});

test('previewExpand: 月覆盖周（跨自然月边界）→ 与 expandWeeks 行数一致', () => {
  const p = createProject({ name: '值班', weekDays: [1, 4], slots: [{ label: '晚' }] });
  const monthStarts = weeksCovering('2026-09');
  assert.ok(monthStarts.length >= 5); // 覆盖整月需 ≥5 个自然周
  const rows = expandWeeks([p], monthStarts[0], monthStarts.length, createSchedule);
  const pv = previewExpand([p], monthStarts, new Set());
  assert.equal(pv.totalNew, rows.length);
  assert.ok(pv.totalNew > 0);
});
