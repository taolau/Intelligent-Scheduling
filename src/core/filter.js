import { DEFAULT_SETTINGS, monthlyFatigueLimitOf, monthlyHeavyLimitOf, isValidTimeRange } from '../data/model.js';
import { getWeekStart, parseDate, timeToMinutes, weekdayLabel } from './week.js';
import { tenureRunAfterAdd } from './tenure.js';

// 合并分钟区间（重叠/相邻并为一段），供 available 完整覆盖 / unavailable 相交判定
function mergeMinutes(list) {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push(range);
  }
  return merged;
}

const isFullDay = entry => !entry.start && !entry.end; // 只选星期不写时间 = 整天

// 分钟区间 → 展示文本（如 "09:00–12:00、14:00–17:00"）
const pad2 = n => String(n).padStart(2, '0');
const rangeText = ranges => ranges
  .map(r => `${pad2(Math.floor(r.start / 60))}:${pad2(r.start % 60)}–${pad2(Math.floor(r.end / 60))}:${pad2(r.end % 60)}`)
  .join('、');

// 人员每周时间安排的可用性判定：返回 { block, warn }。
// block = 硬性拒绝原因；warn = 放行但需黄字提醒的情形（无具体时间的任务撞上「只设了时段」的可用日）
export function checkAvailability(staff, schedule, project) {
  const availability = staff.availability;
  const out = { block: '', warn: '' };
  if (!availability) return out;
  const day = parseDate(schedule.date).getDay();
  const label = weekdayLabel(schedule.date);
  const dayEntries = (availability.entries ?? []).filter(entry => entry.weekDays?.includes(day));
  const fullDays = dayEntries.filter(isFullDay);
  const timedMin = dayEntries.filter(entry => isValidTimeRange(entry))
    .map(entry => ({ start: timeToMinutes(entry.start), end: timeToMinutes(entry.end) }));
  const fullMin = fullDays.map(() => ({ start: 0, end: 1440 })); // 整天 = [00:00,24:00)
  const hasTaskTime = !!project?.timeRange && isValidTimeRange(project.timeRange);
  const task = hasTaskTime
    ? { start: timeToMinutes(project.timeRange.start), end: timeToMinutes(project.timeRange.end) }
    : null;

  if (availability.mode === 'available') {
    if (hasTaskTime) {
      // 任务有具体时间：当天可用段（含整天）合并后须完整覆盖任务
      const ranges = mergeMinutes([...timedMin, ...fullMin]);
      if (!ranges.some(range => range.start <= task.start && task.end <= range.end)) {
        out.block = `时间安排：任务 ${project.timeRange.start}–${project.timeRange.end} 不在${label}可用时间内`;
      }
    } else if (!fullDays.length && timedMin.length) {
      // 当天设了时段但非整天：无法确证无时间任务落点 → 放行 + 黄字提醒（把当天可排时段写清楚）
      const windows = rangeText(mergeMinutes(timedMin));
      out.warn = `时间安排：此人${label}只在 ${windows} 可排，而班次没写几点`;
    } else if (!fullDays.length) {
      // 当天完全不在可用白名单里
      out.block = `时间安排：${label}未设可用时间，无法排未填具体时间的任务`;
    }
  }
  if (availability.mode === 'unavailable') {
    if (hasTaskTime) {
      // 任务有具体时间：与任一天内不可用段（含整天）相交即拒（半开区间，端点相接不算）
      const blocked = mergeMinutes([...timedMin, ...fullMin]);
      if (blocked.some(range => range.start < task.end && task.start < range.end)) {
        out.block = `时间安排：任务 ${project.timeRange.start}–${project.timeRange.end} 与${label}不可用时间重叠`;
      }
    } else if (fullDays.length) {
      // 任务未填具体时间：当天整天不可用则必撞
      out.block = `时间安排：${label}为整天不可用`;
    }
  }
  return out;
}

export function filterCandidate(staff, schedule, projectById, ctx) {
  const reasons = [];
  const project = projectById[schedule.projectId];
  // 逐键兜底（防 #28 族：settings 存在但缺个别键时整体 ?? 不生效 → undefined 参与比较静默失效）
  const dailyTaskLimit = ctx.settings?.dailyTaskLimit ?? DEFAULT_SETTINGS.dailyTaskLimit;
  const slotTaskLimit = ctx.settings?.slotTaskLimit ?? DEFAULT_SETTINGS.slotTaskLimit;

  if (staff.status === 'left') reasons.push('已退出，不可排班');
  if (staff.status === 'rest') reasons.push('休假中，不可排班');
  if (staff.status === 'new' && project.fatigueScore === 3) reasons.push('新入保护：不参与高强度任务');

  const banned = staff.bannedProjects.find(b => b.projectId === schedule.projectId);
  if (banned) reasons.push(`黑名单：${banned.reason || '无原因'}`);

  if (!staff.allowedProjects.includes(schedule.projectId)) reasons.push('无该任务权限');

  const avail = checkAvailability(staff, schedule, project);
  if (avail.block) reasons.push(avail.block);
  const warnings = avail.warn ? [avail.warn] : [];

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

  return { ok: reasons.length === 0, reasons, warnings, tenureOnly };
}
