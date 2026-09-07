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
  const heavyByMonth = new Map();
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
      const mk = `${sid}|${monthKeyBase}`;
      fatigueByMonth.set(mk, (fatigueByMonth.get(mk) ?? 0) + project.fatigueScore);
      if (project.fatigueScore === 3) {
        heavyByWeek.set(wk, (heavyByWeek.get(wk) ?? 0) + 1);
        heavyByMonth.set(mk, (heavyByMonth.get(mk) ?? 0) + 1);
      }
      dailyCounts.set(`${sid}|${sch.date}`, (dailyCounts.get(`${sid}|${sch.date}`) ?? 0) + 1);
      slotCounts.set(`${sid}|${sch.date}|${sch.slotLabel}`, (slotCounts.get(`${sid}|${sch.date}|${sch.slotLabel}`) ?? 0) + 1);
    }
  }
  // 连任辅助表：projectWeeks = 各任务"有发生周"升序；tenure = 各人各任务每周占有计数
  const projectWeeks = new Map();
  const tenure = new Map();
  for (const sch of schedules) {
    const project = projectById[sch.projectId];
    if (!project) continue;
    const wsKey = getWeekStart(sch.date);
    if (!projectWeeks.has(project.id)) projectWeeks.set(project.id, new Set());
    projectWeeks.get(project.id).add(wsKey);
    for (const sid of sch.staffIds) {
      const key = `${sid}|${project.id}`;
      if (!tenure.has(key)) tenure.set(key, new Map());
      const m = tenure.get(key);
      m.set(wsKey, (m.get(wsKey) ?? 0) + 1);
    }
  }
  for (const [pid, set] of projectWeeks) projectWeeks.set(pid, [...set].sort());

  const teamAvg = computeTeamAvg(staffs, fatigueWindow);
  return { fatigueWindow, fatigueByWeek, heavyByWeek, fatigueByMonth, heavyByMonth, teamAvg, fatigueCutoff: cutoff, schedules, dailyCounts, slotCounts, settings, projectWeeks, tenure };
}

// 深拷贝 ctx 的全部计数 Map（值均为数字，逐 Map new 即可）；视图层模拟操作（拖拽预演/自动填充预览）共用
export function cloneCtx(c) {
  return {
    ...c,
    fatigueWindow: new Map(c.fatigueWindow ?? []),
    fatigueByWeek: new Map(c.fatigueByWeek ?? []),
    heavyByWeek: new Map(c.heavyByWeek ?? []),
    fatigueByMonth: new Map(c.fatigueByMonth ?? []),
    heavyByMonth: new Map(c.heavyByMonth ?? []),
    dailyCounts: new Map(c.dailyCounts ?? []),
    slotCounts: new Map(c.slotCounts ?? []),
    projectWeeks: new Map([...(c.projectWeeks ?? [])].map(([k, arr]) => [k, [...arr]])),
    tenure: new Map([...(c.tenure ?? [])].map(([k, m]) => [k, new Map(m)])),
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
  let hitTags = [];
  const flushTags = () => {
    if (hitTags.length) {
      lines.push(`加分标签[${hitTags.join(';')}]`);
      hitTags = [];
    }
  };
  for (const b of breakdown) {
    if (b.label === '擅长加分' && b.points > 0) {
      const name = projectById[schedule.projectId]?.name ?? schedule.projectId;
      lines.push(b.reason ? `擅长${name}：${b.reason}` : `擅长${name}`);
      continue;
    }
    if (b.label === '标签加分' && b.points > 0) {
      if (b.reason) hitTags.push(b.reason); // 多个标签先攒着，遇均衡或结束再合并成一行
      continue;
    }
    if (b.label !== '均衡加分' || staff.status === 'new') continue;
    flushTags(); // 标签行置于擅长之后、均衡句之前
    const mine = ctx.fatigueWindow?.get(staff.id) ?? 0;
    const avg = ctx.teamAvg ?? 0;
    if (mine < avg) lines.push(`近 ${windowDays} 天排班较少，建议优先`);
    else if (mine > avg) lines.push(`近 ${windowDays} 天排班较多`);
  }
  flushTags(); // new 状态无均衡加分时也会在此收尾
  return lines;
}

// 候选硬性过滤分池：base = 通过全部规则；tenured = 仅因连任被拒（无其他原因）。
// 豁免语义由调用方决定：base 为空时允许 tenured 保运转（轮换上限是软轮换纪律，无人手时空班更糟）。
export function splitEligible(staffs, schedule, projectById, ctx, excludeIds = []) {
  const base = [];
  const tenured = [];
  for (const s of staffs) {
    if (excludeIds.includes(s.id)) continue;
    const res = filterCandidate(s, schedule, projectById, ctx);
    if (res.ok) base.push(s);
    else if (res.tenureOnly) tenured.push(s);
  }
  return { base, tenured };
}

// 返回全部通过者可替补候选（按分降序，不截断）——「推荐前 3 / 其他可选」分档是弹窗界面职责，算法层给全量。
// 连任豁免：无其他可排人选时，仅因连任被拦者也上榜（保运转）。
export function recommendSubstitutes(staffs, schedule, projectById, ctx, excludeStaffId) {
  const { base, tenured } = splitEligible(staffs, schedule, projectById, ctx, [excludeStaffId]);
  const selectable = base.length ? base : tenured; // 豁免：无其他人选时连任者保运转
  const scored = [];
  for (const staff of selectable) {
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
