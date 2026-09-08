import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAvailability, parseAvailability } from '../src/ui/excel.js';

test('formatAvailability: null/空 entries → 两列皆空', () => {
  assert.deepEqual(formatAvailability(null), { mode: '', entries: '' });
  assert.deepEqual(formatAvailability(undefined), { mode: '', entries: '' });
  assert.deepEqual(formatAvailability({ mode: 'available', entries: [] }), { mode: '', entries: '' });
});

test('formatAvailability: 输出全称星期 + 中文模式，可回读', () => {
  const av = { mode: 'unavailable', entries: [
    { weekDays: [1, 3], start: '09:00', end: '12:00' },
    { weekDays: [0], start: '14:00', end: '18:00' },
  ] };
  const { mode, entries } = formatAvailability(av);
  assert.equal(mode, '不可用');
  assert.equal(entries, '周一、周三 09:00-12:00;周日 14:00-18:00');
  const back = parseAvailability(mode, entries);
  assert.equal(back.error, undefined);
  assert.deepEqual(back.value, av);
});

test('formatAvailability/parseAvailability: 全天（无起止）往返', () => {
  const av = { mode: 'unavailable', entries: [
    { weekDays: [1] },
    { weekDays: [0], start: '09:00', end: '12:00' },
  ] };
  const { mode, entries } = formatAvailability(av);
  assert.equal(mode, '不可用');
  assert.equal(entries, '周一 全天;周日 09:00-12:00');
  assert.deepEqual(parseAvailability(mode, entries).value, av);
  assert.equal(parseAvailability('不可用', '周一 全天').value.entries[0].start, undefined);
});

test('parseAvailability: 两列均空 → value null（未配置）', () => {
  assert.deepEqual(parseAvailability('', ''), { value: null });
  assert.deepEqual(parseAvailability(undefined, undefined), { value: null });
});

test('parseAvailability: 仅模式或仅时段 → error', () => {
  assert.ok(parseAvailability('可用', '').error);
  assert.ok(parseAvailability('', '周一 09:00-12:00').error);
  assert.ok(parseAvailability('限制', '周一 09:00-12:00').error);
});

test('parseAvailability: 非法星期 / 缺时分隔 / 倒挂跨日 → error', () => {
  assert.ok(parseAvailability('可用', '周一和周三 09:00-12:00').error); // 含不识别字符
  assert.ok(parseAvailability('可用', '周一 0900-12:00').error);
  assert.ok(parseAvailability('可用', '周一 22:00-02:00').error); // 跨日
  assert.ok(parseAvailability('可用', '周一 12:00-09:00').error); // 倒挂
  assert.ok(parseAvailability('可用', '周八 09:00-12:00').error);
});

test('parseAvailability: 兼容全角冒号，多时间段以分号分隔', () => {
  const r = parseAvailability('可用', '周一、周三 09：00-12：00;周五 08:00-10:00');
  assert.equal(r.error, undefined);
  assert.deepEqual(r.value.entries[0].weekDays, [1, 3]);
  assert.deepEqual(r.value.entries[1].weekDays, [5]);
  assert.equal(r.value.entries[1].start, '08:00');
});
