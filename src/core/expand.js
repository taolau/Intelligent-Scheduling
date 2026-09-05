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

// 批量铺排预览：统计 weekStarts 覆盖范围内各任务将新建 / 已存在跳过的班次数（纯函数，不写库）
export function previewExpand(projects, weekStarts, existingKeySet) {
  let totalNew = 0;
  let totalSkip = 0;
  const perTask = [];
  for (const p of projects) {
    let created = 0;
    let skipped = 0;
    for (const ws of weekStarts) {
      for (const row of expandProjectForWeek(p, ws)) {
        if (existingKeySet.has(`${row.date}|${row.projectId}|${row.slotLabel}`)) skipped += 1;
        else created += 1;
      }
    }
    if (created > 0 || skipped > 0) {
      perTask.push({ projectId: p.id, weekDays: p.weekDays, created, skipped });
      totalNew += created;
      totalSkip += skipped;
    }
  }
  return { totalNew, totalSkip, perTask };
}
