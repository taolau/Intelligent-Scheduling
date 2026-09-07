import { DEFAULT_SETTINGS, monthlyFatigueLimitOf, monthlyHeavyLimitOf } from '../data/model.js';
import { getWeekStart } from './week.js';
import { tenureRunAfterAdd } from './tenure.js';

export function filterCandidate(staff, schedule, projectById, ctx) {
  const reasons = [];
  const project = projectById[schedule.projectId];
  const { dailyTaskLimit, slotTaskLimit } = ctx.settings ?? DEFAULT_SETTINGS;

  if (staff.status === 'left') reasons.push('已退出，不可排班');
  if (staff.status === 'rest') reasons.push('休假中，不可排班');
  if (staff.status === 'new' && project.fatigueScore === 3) reasons.push('新入保护：不参与高强度任务');

  const banned = staff.bannedProjects.find(b => b.projectId === schedule.projectId);
  if (banned) reasons.push(`黑名单：${banned.reason || '无原因'}`);

  if (!staff.allowedProjects.includes(schedule.projectId)) reasons.push('无该任务权限');

  // 超限三态文案：当前已超上限=「已超限」；恰满上限=「已达上限」；未超但加入后超=「将超限」
  const daily = ctx.dailyCounts?.get(`${staff.id}|${schedule.date}`) ?? 0;
  if (daily + 1 > dailyTaskLimit) {
    if (daily > dailyTaskLimit) reasons.push(`当日任务数已超限（上限 ${dailyTaskLimit} 个）`);
    else reasons.push(`当日任务数已达上限（${dailyTaskLimit} 个）`);
  }

  const slot = ctx.slotCounts?.get(`${staff.id}|${schedule.date}|${schedule.slotLabel}`) ?? 0;
  if (slot + 1 > slotTaskLimit) {
    if (slot > slotTaskLimit) reasons.push(`时段任务数已超限（上限 ${slotTaskLimit} 个）`);
    else reasons.push(`时段任务数已达上限（${slotTaskLimit} 个）`);
  }

  // 周上限：按「该班次所在自然周」滚动窗口累计判定（过去周的累计不影响本周）
  const weekKey = `${staff.id}|${getWeekStart(schedule.date)}`;
  const fatigue = ctx.fatigueByWeek?.get(weekKey) ?? 0;
  if (fatigue + project.fatigueScore > staff.maxWeeklyFatigue) {
    if (fatigue > staff.maxWeeklyFatigue) reasons.push(`本周劳累积分已超限（上限 ${staff.maxWeeklyFatigue}）`);
    else if (fatigue === staff.maxWeeklyFatigue) reasons.push(`本周劳累积分已达上限（${staff.maxWeeklyFatigue}）`);
    else reasons.push(`本周劳累积分将超限（上限 ${staff.maxWeeklyFatigue}）`);
  }

  if (project.fatigueScore === 3) {
    const heavy = ctx.heavyByWeek?.get(weekKey) ?? 0;
    if (heavy + 1 > staff.maxHeavyTaskCount) {
      if (heavy > staff.maxHeavyTaskCount) reasons.push(`本周高强度次数已超限（上限 ${staff.maxHeavyTaskCount} 次）`);
      else reasons.push(`本周高强度次数已达上限（${staff.maxHeavyTaskCount} 次）`);
    }
  }

  // 月疲劳上限：自然月累计（YYYY-MM，同月粒度 chip 口径），防整月无度堆积
  const monthFatigue = ctx.fatigueByMonth?.get(`${staff.id}|${schedule.date.slice(0, 7)}`) ?? 0;
  const monthLimit = monthlyFatigueLimitOf(staff, ctx.settings);
  if (monthFatigue + project.fatigueScore > monthLimit) {
    if (monthFatigue > monthLimit) reasons.push(`本月劳累积分已超限（上限 ${monthLimit}）`);
    else if (monthFatigue === monthLimit) reasons.push(`本月劳累积分已达上限（${monthLimit}）`);
    else reasons.push(`本月劳累积分将超限（上限 ${monthLimit}）`);
  }

  // 月高强度次数上限：自然月累计（YYYY-MM）；0 = 禁排高强度整个自然月（对齐周字段 0 语义）
  if (project.fatigueScore === 3) {
    const monthHeavy = ctx.heavyByMonth?.get(`${staff.id}|${schedule.date.slice(0, 7)}`) ?? 0;
    const monthHeavyLimit = monthlyHeavyLimitOf(staff, ctx.settings);
    if (monthHeavy + 1 > monthHeavyLimit) {
      if (monthHeavy > monthHeavyLimit) reasons.push(`本月高强度次数已超限（上限 ${monthHeavyLimit} 次）`);
      else if (monthHeavy === monthHeavyLimit) reasons.push(`本月高强度次数已达上限（${monthHeavyLimit} 次）`);
      else reasons.push(`本月高强度次数将超限（上限 ${monthHeavyLimit} 次）`);
    }
  }

  // 同任务连任上限：tenureLimit>0 生效；允许连任 N 期，第 N+1 期强制轮换（0 = 关闭）
  const tenureLimit = ctx.settings?.tenureLimit ?? DEFAULT_SETTINGS.tenureLimit;
  let tenureOnly = false;
  if (tenureLimit > 0) {
    const run = tenureRunAfterAdd(schedule.projectId, staff.id, getWeekStart(schedule.date), ctx);
    if (run > tenureLimit) {
      reasons.push(`同一任务将连任 ${run} 期，超过连任上限 ${tenureLimit} 期，需轮换`);
      tenureOnly = reasons.length === 1; // 仅因连任被拒（无其他硬规则原因）→ 供豁免探测
    }
  }

  return { ok: reasons.length === 0, reasons, tenureOnly };
}
