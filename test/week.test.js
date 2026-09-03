import test from 'node:test';
import assert from 'node:assert/strict';
import { getWeekStart, getWeekDates, isSameDate, timeToMinutes, minutesBetween, todayStr, weekdayLabel, monthKey, shiftMonth, weeksCovering, inMonth } from '../src/core/week.js';

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

test('monthKey: 从日期取 YYYY-MM（本地时区）', () => {
  assert.equal(monthKey('2026-09-05'), '2026-09');
  assert.equal(monthKey('2026-09-30'), '2026-09');
  assert.equal(monthKey('2026-12-31'), '2026-12');
  assert.equal(monthKey('2026-01-01'), '2026-01');
});

test('shiftMonth: 月份 ±n 进位退位', () => {
  assert.equal(shiftMonth('2026-09', 1), '2026-10');
  assert.equal(shiftMonth('2026-09', -1), '2026-08');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-09', 3), '2026-12');
});

test('weeksCovering: 覆盖整月的完整自然周首日序列', () => {
  // 2026-09：9/1 周二 → 首周 8/31 起；9/30 周三 → 末周 9/28 起（共 5 个面板）
  assert.deepEqual(weeksCovering('2026-09'), ['2026-08-31','2026-09-07','2026-09-14','2026-09-21','2026-09-28']);
});

test('weeksCovering: 首尾不齐的月份含上/下月日期（6 面板）', () => {
  // 2026-08：8/1 周六 → 首周 7/27 起；8/31 周一 → 末周 8/31 起（共 6 个面板）
  assert.deepEqual(weeksCovering('2026-08'), ['2026-07-27','2026-08-03','2026-08-10','2026-08-17','2026-08-24','2026-08-31']);
});

test('weeksCovering: 跨年 2 月首周含 1 月末', () => {
  // 2026-02：2/1 周日 → 首周 1/26 起；2/28 周六 → 末周 2/23 起
  assert.deepEqual(weeksCovering('2026-02'), ['2026-01-26','2026-02-02','2026-02-09','2026-02-16','2026-02-23']);
});

test('inMonth: 日期是否属于该自然月', () => {
  assert.equal(inMonth('2026-09-30', '2026-09'), true);
  assert.equal(inMonth('2026-09-01', '2026-09'), true);
  assert.equal(inMonth('2026-10-01', '2026-09'), false);
  assert.equal(inMonth('2026-08-31', '2026-09'), false);
});
