import { DEFAULT_SETTINGS } from '../data/model.js';

function isOnLeave(staffId, date, leaves) {
  return leaves.some(l => l.staffId === staffId && l.date === date);
}

export function filterCandidate(staff, schedule, projectById, ctx) {
  const reasons = [];
  const project = projectById[schedule.projectId];
  const { dailyTaskLimit, slotTaskLimit } = ctx.settings ?? DEFAULT_SETTINGS;

  if (staff.status === 'left') reasons.push('已退出，不可排班');
  if (staff.status === 'new' && project.fatigueScore === 3) reasons.push('新入保护：不参与高强度任务');

  const banned = staff.bannedProjects.find(b => b.projectId === schedule.projectId);
  if (banned) reasons.push(`黑名单：${banned.reason || '无原因'}`);

  if (!staff.allowedProjects.includes(schedule.projectId)) reasons.push('无该任务权限');

  if (isOnLeave(staff.id, schedule.date, ctx.leaves)) reasons.push('当日请假');

  const dailyAfter = (ctx.dailyCounts?.get(`${staff.id}|${schedule.date}`) ?? 0) + 1;
  if (dailyAfter > dailyTaskLimit) reasons.push(`当日任务数将超限（最多 ${dailyTaskLimit} 个）`);

  const slotAfter = (ctx.slotCounts?.get(`${staff.id}|${schedule.date}|${schedule.slotLabel}`) ?? 0) + 1;
  if (slotAfter > slotTaskLimit) reasons.push(`时段任务数将超限（最多 ${slotTaskLimit} 个）`);

  const fatigueAfter = (ctx.weeklyFatigue.get(staff.id) ?? 0) + project.fatigueScore;
  if (fatigueAfter > staff.maxWeeklyFatigue) reasons.push('本周劳累积分将超限');

  if (project.fatigueScore === 3) {
    const heavyAfter = (ctx.heavyCounts.get(staff.id) ?? 0) + 1;
    if (heavyAfter > staff.maxHeavyTaskCount) reasons.push('本周高强度次数将超限');
  }

  return { ok: reasons.length === 0, reasons };
}
