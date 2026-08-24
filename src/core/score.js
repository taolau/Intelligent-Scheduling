import { timeToMinutes } from './week.js';

export function computeTeamAvg(staffs, weeklyFatigue) {
  const active = staffs.filter(s => s.status === 'active');
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, s) => acc + (weeklyFatigue.get(s.id) ?? 0), 0);
  return sum / active.length;
}

// 把 日期+时间 转成绝对分钟（自纪元起），用于跨日间隔计算
function toAbsMinutes(dateStr, timeStr) {
  const days = Math.floor(Date.parse(dateStr + 'T00:00:00') / 86400000);
  return days * 1440 + timeToMinutes(timeStr);
}

export function scoreCandidate(staff, schedule, projectById, ctx) {
  const breakdown = [];
  const project = projectById[schedule.projectId];
  const { restHours = 12 } = ctx;
  const currentFatigue = ctx.weeklyFatigue.get(staff.id) ?? 0;

  // 擅长加分
  const pref = staff.preferredProjects.find(p => p.projectId === schedule.projectId);
  if (pref) {
    breakdown.push({ label: '擅长加分', points: 15, reason: pref.reason || '' });
  }

  // 均衡加分
  let balancePoints;
  if (staff.status === 'new') {
    balancePoints = 0; // 新入按团队平均计
  } else {
    balancePoints = (ctx.teamAvg - currentFatigue) * 5;
  }
  breakdown.push({ label: '均衡加分', points: balancePoints, reason: `团队平均 ${ctx.teamAvg}，本人 ${currentFatigue}` });

  // 间隔保护扣分：只考虑在本班次开始之前结束的排班，取最近一次
  const curSlot = project.slots.find(s => s.label === schedule.slotLabel);
  let lastEndAbs = -Infinity;
  if (curSlot) {
    const curStartAbs = toAbsMinutes(schedule.date, curSlot.startTime);
    for (const sch of ctx.schedules) {
      if (!sch.staffIds.includes(staff.id)) continue;
      const pj = projectById[sch.projectId];
      const sl = pj?.slots.find(s => s.label === sch.slotLabel);
      if (!sl) continue;
      const endAbs = toAbsMinutes(sch.date, sl.endTime);
      if (endAbs < curStartAbs && endAbs > lastEndAbs) lastEndAbs = endAbs;
    }
    if (lastEndAbs !== -Infinity) {
      const gapMin = curStartAbs - lastEndAbs;
      if (gapMin < restHours * 60) {
        breakdown.push({ label: '间隔保护', points: -10, reason: `距上次排班结束不足 ${restHours} 小时` });
      }
    }
  }

  const score = breakdown.reduce((acc, b) => acc + b.points, 0);
  return { score, breakdown };
}
