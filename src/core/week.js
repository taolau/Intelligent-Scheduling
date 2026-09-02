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
