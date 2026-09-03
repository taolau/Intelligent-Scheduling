// 本系统使用本地时区、固定自然周（周一~周日）。

export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function getWeekStart(dateStr) {
  const date = parseDate(dateStr);
  const dow = date.getDay(); // 0=周日
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + diff);
  return toDateStr(date);
}

export function getWeekDates(weekStartStr) {
  const start = parseDate(weekStartStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateStr(d);
  });
}

export function getWeekLabel(weekStartStr) {
  const dates = getWeekDates(weekStartStr);
  return `${dates[0]} ~ ${dates[6]}`;
}

export function weekdayLabel(dateStr) {
  return '周' + '日一二三四五六'[parseDate(dateStr).getDay()];
}

export function isSameDate(a, b) { return a === b; }

export function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesBetween(startT, endT) {
  return timeToMinutes(endT) - timeToMinutes(startT);
}

// ===== 月工具（自然月窗口）=====

export function monthKey(dateStr) {
  return dateStr.slice(0, 7); // 'YYYY-MM'
}

export function shiftMonth(monthKeyStr, n) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1); // 月份溢出自动进位/退位
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function weeksCovering(monthKeyStr) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const first = getWeekStart(`${monthKeyStr}-01`);
  const last = getWeekStart(toDateStr(new Date(y, m, 0))); // m 月 0 号 = 月末日所在周周首
  const result = [];
  for (let d = parseDate(first); d <= parseDate(last); d.setDate(d.getDate() + 7)) {
    result.push(toDateStr(d));
  }
  return result;
}

export function inMonth(dateStr, monthKeyStr) {
  return dateStr.slice(0, 7) === monthKeyStr;
}
