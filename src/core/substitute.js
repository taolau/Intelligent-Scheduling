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

// 深拷贝 ctx 的全部计数 Map（值均为数字，逐 Map new 即可）；视图层模拟操作（拖拽预演/自动填充预览）共用
export function cloneCtx(c) {
  return {
    ...c,
    fatigueWindow: new Map(c.fatigueWindow ?? []),
    fatigueByWeek: new Map(c.fatigueByWeek ?? []),
    heavyByWeek: new Map(c.heavyByWeek ?? []),
    fatigueByMonth: new Map(c.fatigueByMonth ?? []),
    dailyCounts: new Map(c.dailyCounts ?? []),
    slotCounts: new Map(c.slotCounts ?? []),
  };
}

// 推荐理由人话化：界面可读判断句，不显示算法算式与无单位裸数字。语义与算法一致（score.js breakdown）：
// 擅长命中 → 带录入原因一句；均衡按「本人窗口积分 vs 团队平均」给方向——本人偏少 = 建议优先、
// 偏多 = 中性提示、齐平不给行（旧「均衡加分(0)：平均X本人X」黑话即此）；新入均衡恒 0 也不给驱动句。
// 时间范围用公平窗口实际天数（ctx.settings.balanceWindowDays 默认 30，含今天）点明——不写「近期」虚词、
// 不甩「本人 0/平均 0.4」这类读不懂的无单位原始值（可深究者看 docs/score-rules.md 算例）。
export function narrateReasons(staff, schedule, projectById, breakdown, ctx) {
  const windowDays = ctx.settings?.balanceWindowDays ?? DEFAULT_SETTINGS.balanceWindowDays;
  const lines = [];
  for (const b of breakdown) {
    if (b.label === '擅长加分' && b.points > 0) {
      const name = projectById[schedule.projectId]?.name ?? schedule.projectId;
      lines.push(b.reason ? `擅长${name}：${b.reason}` : `擅长${name}`);
      continue;
    }
    if (b.label !== '均衡加分' || staff.status === 'new') continue;
    const mine = ctx.fatigueWindow?.get(staff.id) ?? 0;
    const avg = ctx.teamAvg ?? 0;
    if (mine < avg) lines.push(`近 ${windowDays} 天排班较少，建议优先`);
    else if (mine > avg) lines.push(`近 ${windowDays} 天排班较多`);
  }
  return lines;
}

// 返回全部通过者可替补候选（按分降序，不截断）——「推荐前 3 / 其他可选」分档是弹窗界面职责，算法层给全量
export function recommendSubstitutes(staffs, schedule, projectById, ctx, excludeStaffId) {
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
    const reasons = narrateReasons(staff, schedule, projectById, breakdown, ctx);
    scored.push({ staff, score, reasons, breakdown });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
