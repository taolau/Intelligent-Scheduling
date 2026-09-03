import { filterCandidate } from './filter.js';
import { computeTeamAvg, scoreCandidate } from './score.js';
import { getWeekStart, monthKey, todayStr, parseDate, toDateStr } from './week.js';
import { DEFAULT_SETTINGS } from '../data/model.js';

// ctx 三轨聚合：窗口（均衡）/ 自然周（filter 上限）/ 自然月（月粒度 chip 展示）
export function buildContext(staffs, schedules, projectById, settings = DEFAULT_SETTINGS, today = todayStr()) {
  const windowDays = settings?.balanceWindowDays ?? DEFAULT_SETTINGS.balanceWindowDays;
  const cutoffDate = parseDate(today);
  cutoffDate.setDate(cutoffDate.getDate() - (windowDays - 1));
  const cutoff = toDateStr(cutoffDate); // 含今天共 windowDays 天；未来已分配班次 date >= cutoff 自然计入
  const fatigueWindow = new Map();
  const fatigueByWeek = new Map();
  const heavyByWeek = new Map();
  const fatigueByMonth = new Map();
  const dailyCounts = new Map();
  const slotCounts = new Map();
  for (const sch of schedules) {
    const project = projectById[sch.projectId];
    if (!project) continue;
    const inWindow = sch.date >= cutoff;
    const weekKeyBase = getWeekStart(sch.date);
    const monthKeyBase = monthKey(sch.date);
    for (const sid of sch.staffIds) {
      if (inWindow) fatigueWindow.set(sid, (fatigueWindow.get(sid) ?? 0) + project.fatigueScore);
      const wk = `${sid}|${weekKeyBase}`;
      fatigueByWeek.set(wk, (fatigueByWeek.get(wk) ?? 0) + project.fatigueScore);
      if (project.fatigueScore === 3) heavyByWeek.set(wk, (heavyByWeek.get(wk) ?? 0) + 1);
      const mk = `${sid}|${monthKeyBase}`;
      fatigueByMonth.set(mk, (fatigueByMonth.get(mk) ?? 0) + project.fatigueScore);
      dailyCounts.set(`${sid}|${sch.date}`, (dailyCounts.get(`${sid}|${sch.date}`) ?? 0) + 1);
      slotCounts.set(`${sid}|${sch.date}|${sch.slotLabel}`, (slotCounts.get(`${sid}|${sch.date}|${sch.slotLabel}`) ?? 0) + 1);
    }
  }
  const teamAvg = computeTeamAvg(staffs, fatigueWindow);
  return { fatigueWindow, fatigueByWeek, heavyByWeek, fatigueByMonth, teamAvg, fatigueCutoff: cutoff, schedules, dailyCounts, slotCounts, settings };
}

export function recommendSubstitutes(staffs, schedule, projectById, ctx, excludeStaffId, topN = 3) {
  const candidates = staffs
    .filter(s => s.id !== excludeStaffId && !schedule.staffIds.includes(s.id));
  const scored = [];
  for (const staff of candidates) {
    const res = filterCandidate(staff, schedule, projectById, {
      fatigueByWeek: ctx.fatigueByWeek,
      heavyByWeek: ctx.heavyByWeek,
      dailyCounts: ctx.dailyCounts,
      slotCounts: ctx.slotCounts,
      settings: ctx.settings,
    });
    if (!res.ok) continue;
    const { score, breakdown } = scoreCandidate(staff, schedule, projectById, {
      fatigueWindow: ctx.fatigueWindow,
      teamAvg: ctx.teamAvg,
      settings: ctx.settings,
    });
    const reasons = breakdown.map(b => b.reason ? `${b.label}(${Math.round(b.points)})：${b.reason}` : `${b.label}(${Math.round(b.points)})`);
    scored.push({ staff, score, reasons, breakdown });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
