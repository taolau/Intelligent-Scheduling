// 智能排班自动填充：纯函数模拟（不写库、不改输入、无 DOM）
// 预览与执行共用同一决策通道，杜绝「预览说一套、执行做一套」的计数漂移
import { filterCandidate } from './filter.js';
import { scoreCandidate } from './score.js';
import { getWeekStart, monthKey } from './week.js';
import { cloneCtx } from './substitute.js';

// ctx 六轨计数增减规则（唯一实现：窗口/自然周/自然月 + daily/slot；视图层 applyDelta 薄壳与此同源）
export function accumulateDelta(ctxObj, project, sch, sid, sign) {
  const d = sign * project.fatigueScore;
  if (sch.date >= (ctxObj.fatigueCutoff ?? '')) { // 未来与窗口内班次自然计入均衡轨
    ctxObj.fatigueWindow.set(sid, Math.max(0, (ctxObj.fatigueWindow.get(sid) ?? 0) + d));
  }
  const wk = `${sid}|${getWeekStart(sch.date)}`;
  const mk = `${sid}|${monthKey(sch.date)}`;
  ctxObj.fatigueByWeek.set(wk, Math.max(0, (ctxObj.fatigueByWeek.get(wk) ?? 0) + d));
  ctxObj.fatigueByMonth.set(mk, Math.max(0, (ctxObj.fatigueByMonth.get(mk) ?? 0) + d));
  if (project.fatigueScore === 3) {
    ctxObj.heavyByWeek.set(wk, Math.max(0, (ctxObj.heavyByWeek.get(wk) ?? 0) + sign));
  }
  ctxObj.dailyCounts.set(`${sid}|${sch.date}`, Math.max(0, (ctxObj.dailyCounts.get(`${sid}|${sch.date}`) ?? 0) + sign));
  ctxObj.slotCounts.set(`${sid}|${sch.date}|${sch.slotLabel}`, Math.max(0, (ctxObj.slotCounts.get(`${sid}|${sch.date}|${sch.slotLabel}`) ?? 0) + sign));
}

// 按传入顺序（调用方已排好：日期→时段序）对未满员班次逐名额决策：
// 过滤 → 打分 → 取最高 → 记入 ctx 克隆（后续班次感知前面分配），全部在内存副本上完成。
// 返回 results[] = { sch, added, warned, full }；孤儿班次（任务缺失）跳过不填。
export function simulateAutoFill(empties, staffs, projectById, ctx) {
  const simCtx = cloneCtx(ctx);
  const warnDaily = simCtx.settings?.warnDailyCount ?? 0;
  const results = [];
  for (const src of empties) {
    const project = projectById[src.projectId];
    const sch = { ...src, staffIds: [...src.staffIds] };
    const added = [];
    const warned = [];
    if (project) {
      while (sch.staffIds.length < project.requiredCapacity) {
        const candidates = staffs
          .filter(s => !sch.staffIds.includes(s.id))
          .map(s => ({ s, res: filterCandidate(s, sch, projectById, simCtx) }))
          .filter(x => x.res.ok);
        if (candidates.length === 0) break;
        let best = null;
        for (const c of candidates) {
          const { score } = scoreCandidate(c.s, sch, projectById, simCtx);
          if (!best || score > best.score) best = { s: c.s, score };
        }
        sch.staffIds.push(best.s.id);
        added.push(best.s.id);
        accumulateDelta(simCtx, project, sch, best.s.id, 1);
        if (warnDaily > 0 && (simCtx.dailyCounts.get(`${best.s.id}|${sch.date}`) ?? 0) >= warnDaily) warned.push(best.s.id);
      }
    }
    results.push({ sch, added, warned, full: project ? sch.staffIds.length >= project.requiredCapacity : false });
  }
  return results;
}
