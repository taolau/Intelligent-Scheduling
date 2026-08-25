import { getWeekDates, parseDate, toDateStr } from './week.js';

export function expandProjectForWeek(project, weekStartStr) {
  if (!project.active) return [];
  if (project.weekDays.length === 0) return []; // 一次性任务不自动展开
  const rows = [];
  const dates = getWeekDates(weekStartStr);
  for (let i = 0; i < 7; i++) {
    const weekday = new Date(dates[i] + 'T00:00:00').getDay(); // 0=周日
    if (project.weekDays.includes(weekday)) {
      for (const slot of project.slots) {
        rows.push({ date: dates[i], projectId: project.id, slotLabel: slot.label });
      }
    }
  }
  return rows;
}

export function expandWeek(projects, weekStartStr, createScheduleFn) {
  const out = [];
  for (const p of projects) {
    for (const row of expandProjectForWeek(p, weekStartStr)) {
      out.push(createScheduleFn({ ...row }));
    }
  }
  return out;
}

export function expandWeeks(projects, fromWeekStart, nWeeks, createScheduleFn) {
  const out = [];
  for (let i = 0; i < nWeeks; i++) {
    const d = parseDate(fromWeekStart);
    d.setDate(d.getDate() + i * 7);
    out.push(...expandWeek(projects, toDateStr(d), createScheduleFn));
  }
  return out;
}
