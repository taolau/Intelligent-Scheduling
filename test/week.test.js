import test from 'node:test';
import assert from 'node:assert/strict';
import { getWeekStart, getWeekDates, isSameDate, timeToMinutes, minutesBetween, todayStr, weekdayLabel } from '../src/core/week.js';

test('getWeekStart: 周三返回当周周一', () => {
  assert.equal(getWeekStart('2026-08-26'), '2026-08-24'); // 2026-08-24 是周一
});

test('getWeekStart: 周日本身返回其周一', () => {
  assert.equal(getWeekStart('2026-08-30'), '2026-08-24');
});

test('getWeekDates: 返回周一至周日 7 天', () => {
  const dates = getWeekDates('2026-08-24');
  assert.deepEqual(dates, ['2026-08-24','2026-08-25','2026-08-26','2026-08-27','2026-08-28','2026-08-29','2026-08-30']);
});

test('isSameDate', () => {
  assert.equal(isSameDate('2026-08-24', '2026-08-24'), true);
  assert.equal(isSameDate('2026-08-24', '2026-08-25'), false);
});

test('timeToMinutes', () => {
  assert.equal(timeToMinutes('08:30'), 8 * 60 + 30);
  assert.equal(timeToMinutes('12:00'), 720);
});

test('minutesBetween', () => {
  assert.equal(minutesBetween('11:30', '13:00'), 90);
});

test('todayStr: 返回本地时区今天的 YYYY-MM-DD（非 UTC 偏移）', () => {
  const d = new Date();
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.equal(todayStr(), local);
  assert.match(todayStr(), /^\d{4}-\d{2}-\d{2}$/);
});

test('weekdayLabel: 返回中文星期', () => {
  assert.equal(weekdayLabel('2026-08-24'), '周一');
  assert.equal(weekdayLabel('2026-08-26'), '周三');
  assert.equal(weekdayLabel('2026-08-30'), '周日');
});
