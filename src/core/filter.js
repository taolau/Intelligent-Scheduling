import { timeToMinutes } from './week.js';

export function hasTimeOverlap(slotA, slotB, projectById) {
  if (slotA.date !== slotB.date) return false;
  const pa = projectById[slotA.projectId];
  const pb = projectById[slotB.projectId];
  if (!pa || !pb) return false;
  const sa = pa.slots.find(s => s.label === slotA.slotLabel);
  const sb = pb.slots.find(s => s.label === slotB.slotLabel);
  if (!sa || !sb) return false;
  return timeToMinutes(sa.startTime) < timeToMinutes(sb.endTime)
      && timeToMinutes(sb.startTime) < timeToMinutes(sa.endTime);
}

function isOnLeave(staffId, date, leaves) {
  return leaves.some(l => l.staffId === staffId && l.date === date);
}

export function filterCandidate(staff, schedule, projectById, ctx) {
  const reasons = [];
  const project = projectById[schedule.projectId];

  if (staff.status === 'left') reasons.push('已退出，不可排班');
  if (staff.status === 'new' && project.fatigueScore === 3) reasons.push('新入保护：不参与高强度任务');

  const banned = staff.bannedProjects.find(b => b.projectId === schedule.projectId);
  if (banned) reasons.push(`黑名单：${banned.reason || '无原因'}`);

  if (!staff.allowedProjects.includes(schedule.projectId)) reasons.push('无该任务权限');

  if (isOnLeave(staff.id, schedule.date, ctx.leaves)) reasons.push('当日请假');

  const clash = (ctx.schedules ?? []).find(sch =>
    sch.staffIds.includes(staff.id) && hasTimeOverlap(sch, schedule, projectById)
  );
  if (clash) reasons.push(`时段冲突：${projectById[clash.projectId]?.name || '其他任务'}`);

  const fatigueAfter = (ctx.weeklyFatigue.get(staff.id) ?? 0) + project.fatigueScore;
  if (fatigueAfter > staff.maxWeeklyFatigue) reasons.push('本周劳累积分将超限');

  if (project.fatigueScore === 3) {
    const heavyAfter = (ctx.heavyCounts.get(staff.id) ?? 0) + 1;
    if (heavyAfter > staff.maxHeavyTaskCount) reasons.push('本周高强度次数将超限');
  }

  return { ok: reasons.length === 0, reasons };
}
