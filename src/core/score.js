import { DEFAULT_SETTINGS } from '../data/model.js';

export function computeTeamAvg(staffs, weeklyFatigue) {
  const active = staffs.filter(s => s.status === 'active');
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, s) => acc + (weeklyFatigue.get(s.id) ?? 0), 0);
  return sum / active.length;
}

export function scoreCandidate(staff, schedule, projectById, ctx) {
  const breakdown = [];
  const currentFatigue = ctx.weeklyFatigue.get(staff.id) ?? 0;
  const preferredBonus = ctx.settings?.preferredBonus ?? DEFAULT_SETTINGS.preferredBonus;
  const balanceFactor = ctx.settings?.balanceFactor ?? DEFAULT_SETTINGS.balanceFactor;

  // 擅长加分
  const pref = staff.preferredProjects.find(p => p.projectId === schedule.projectId);
  if (pref) {
    breakdown.push({ label: '擅长加分', points: preferredBonus, reason: pref.reason || '' });
  }

  // 均衡加分
  let balancePoints;
  if (staff.status === 'new') {
    balancePoints = 0; // 新入按团队平均计
  } else {
    balancePoints = (ctx.teamAvg - currentFatigue) * balanceFactor;
  }
  breakdown.push({ label: '均衡加分', points: balancePoints, reason: `团队平均 ${Math.round(ctx.teamAvg * 10) / 10}，本人 ${currentFatigue}` });

  const score = breakdown.reduce((acc, b) => acc + b.points, 0);
  return { score, breakdown };
}
