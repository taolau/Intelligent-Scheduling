import { filterCandidate } from './filter.js';
import { computeTeamAvg, scoreCandidate } from './score.js';
import { getWeekStart, todayStr } from './week.js';
import { DEFAULT_SETTINGS } from '../data/model.js';

export function buildContext(staffs, schedules, projectById, settings = DEFAULT_SETTINGS) {
  const weekStart = getWeekStart(schedules[0]?.date ?? todayStr());
  const weeklyFatigue = new Map();
  const heavyCounts = new Map();
  const dailyCounts = new Map();
  const slotCounts = new Map();
  for (const sch of schedules) {
    if (sch.date < weekStart) continue;
    const project = projectById[sch.projectId];
    if (!project) continue;
    for (const sid of sch.staffIds) {
      weeklyFatigue.set(sid, (weeklyFatigue.get(sid) ?? 0) + project.fatigueScore);
      heavyCounts.set(sid, (heavyCounts.get(sid) ?? 0) + (project.fatigueScore === 3 ? 1 : 0));
      dailyCounts.set(`${sid}|${sch.date}`, (dailyCounts.get(`${sid}|${sch.date}`) ?? 0) + 1);
      slotCounts.set(`${sid}|${sch.date}|${sch.slotLabel}`, (slotCounts.get(`${sid}|${sch.date}|${sch.slotLabel}`) ?? 0) + 1);
    }
  }
  const teamAvg = computeTeamAvg(staffs, weeklyFatigue);
  return { weeklyFatigue, heavyCounts, teamAvg, weekStart, schedules, dailyCounts, slotCounts, settings };
}

export function recommendSubstitutes(staffs, schedule, projectById, ctx, excludeStaffId, topN = 3) {
  const candidates = staffs
    .filter(s => s.id !== excludeStaffId && !schedule.staffIds.includes(s.id));
  const scored = [];
  for (const staff of candidates) {
    const res = filterCandidate(staff, schedule, projectById, {
      schedules: ctx.schedules ?? [],
      weeklyFatigue: ctx.weeklyFatigue,
      heavyCounts: ctx.heavyCounts,
      dailyCounts: ctx.dailyCounts,
      slotCounts: ctx.slotCounts,
      settings: ctx.settings,
    });
    if (!res.ok) continue;
    const { score, breakdown } = scoreCandidate(staff, schedule, projectById, {
      weeklyFatigue: ctx.weeklyFatigue,
      teamAvg: ctx.teamAvg,
    });
    const reasons = breakdown.map(b => b.reason ? `${b.label}(${b.points})：${b.reason}` : `${b.label}(${b.points})`);
    scored.push({ staff, score, reasons, breakdown });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
