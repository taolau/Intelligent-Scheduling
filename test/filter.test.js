import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCandidate } from '../src/core/filter.js';
import { createStaff, createProject, DEFAULT_SETTINGS } from '../src/data/model.js';

const P101 = createProject({ id: 'P101', name: '搬运', fatigueScore: 3, slots: [{ label: '早' }] });
const P102 = createProject({ id: 'P102', name: '浇花', fatigueScore: 1, slots: [{ label: '早' }] });
const P103 = createProject({ id: 'P103', name: '巡逻', fatigueScore: 1, slots: [{ label: '晚' }] });
const projectById = { P101, P102, P103 };

// slot 日期 2026-08-24 恰为周一 → 周键 = 'S1|2026-08-24'
function base() {
  return { schedules: [], fatigueByWeek: new Map(), heavyByWeek: new Map(), fatigueByMonth: new Map(), heavyByMonth: new Map(),
           dailyCounts: new Map(), slotCounts: new Map(), projectWeeks: new Map(), tenure: new Map(),
           settings: { ...DEFAULT_SETTINGS } };
}

const slot = { date: '2026-08-24', projectId: 'P101', slotLabel: '早' };

test('黑名单拒绝并带原因', () => {
  const s = createStaff({ id: 'S1', name: '张三', bannedProjects: [{ projectId: 'P101', reason: '腰伤' }] });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('黑名单'));
  assert.ok(r.reasons[0].includes('腰伤'));
});

test('无权限拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P102'] });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('权限'));
});

test('已退出拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', status: 'left' });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
});

test('休假拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', status: 'rest', restFrom: 'active' });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('休假'));
});

test('新入保护: new 且高强度拒绝', () => {
  const s = createStaff({ id: 'S1', name: '新人', status: 'new' });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('新入'));
});

test('新入可排非高强度', () => {
  const s = createStaff({ id: 'S1', name: '新人', status: 'new', allowedProjects: ['P102'] });
  const slot2 = { date: '2026-08-24', projectId: 'P102', slotLabel: '早' };
  const r = filterCandidate(s, slot2, projectById, base());
  assert.equal(r.ok, true);
});

test('周疲劳超限拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-24', 3);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
});

test('高强度次数超限拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxHeavyTaskCount: 1 });
  const ctx = base();
  ctx.heavyByWeek.set('S1|2026-08-24', 1);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
});

test('滚动周窗口：上周已超限不影响本周判定（旧全量聚合 bug 回归）', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3, allowedProjects: ['P101'] });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-17', 4); // 上周累计 4 > 上限，但属于过去周窗口
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, true);
});

test('滚动周窗口：本周累计触发上限', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-24', 2); // 本周已 2，P101 疲劳 3 → 加入后 5 > 3
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some(x => x.includes('将超限')));
});

test('滚动周窗口：跨月自然周按周首日归属同键', () => {
  // 班次在 2026-09-01（周二，属 8/31 起的自然周）→ 查 8/31 周键
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-31', 3); // 8/31~9/6 周累计已 3
  const slotSep = { date: '2026-09-01', projectId: 'P101', slotLabel: '早' };
  const r = filterCandidate(s, slotSep, projectById, ctx);
  assert.equal(r.ok, false);
});

test('时段数量超限: 同一时段已有班次拒绝', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102'] });
  const ctx = base();
  ctx.slotCounts.set('S1|2026-08-24|早', 1); // 已在「早」排过 1 个
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('时段'));
});

test('日数量超限: 当天已有 2 个班次拒绝第 3 个', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102', 'P103'] });
  const ctx = base();
  ctx.dailyCounts.set('S1|2026-08-24', 2); // 当天已排 2 个（上限 2）
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('当日'));
});

test('跨时段可排: 已有早班次可排晚班次', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P103'] });
  const ctx = base();
  ctx.slotCounts.set('S1|2026-08-24|早', 1);
  ctx.dailyCounts.set('S1|2026-08-24', 1);
  const slotLate = { date: '2026-08-24', projectId: 'P103', slotLabel: '晚' };
  const r = filterCandidate(s, slotLate, projectById, ctx);
  assert.equal(r.ok, true);
});

test('自主安排不阻塞同日固定时段', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P103'] });
  const ctx = base();
  ctx.slotCounts.set('S1|2026-08-24|自主安排', 1);
  ctx.dailyCounts.set('S1|2026-08-24', 1);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, true);
});

test('全部通过', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'] });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, true);
});

// —— 超限文案三态：当前已超=「已超限」；恰满上限=「已达上限」；未超但加入后超=「将超限」 ——

test('疲劳文案：当前已超上限（4/3）说「已超限」不说「将超限」', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-24', 4);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.ok(r.reasons.some(x => x.includes('已超限')));
  assert.ok(!r.reasons.some(x => x.includes('将超限')));
});

test('疲劳文案：恰满上限（3/3）说「已达上限」', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-24', 3);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.ok(r.reasons.some(x => x.includes('已达上限')));
  assert.ok(!r.reasons.some(x => x.includes('超限')));
});

test('疲劳文案：未超但加入后超（2/3 + 高强度3）说「将超限」', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxWeeklyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByWeek.set('S1|2026-08-24', 2);
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.ok(r.reasons.some(x => x.includes('将超限')));
  assert.ok(!r.reasons.some(x => x.includes('已超限')));
});

test('高强度次数文案：已超（2/1）与恰满（1/1）区分', () => {
  const s1 = createStaff({ id: 'S1', name: '张三', maxHeavyTaskCount: 1 });
  const ctx1 = base();
  ctx1.heavyByWeek.set('S1|2026-08-24', 2);
  const r1 = filterCandidate(s1, slot, projectById, ctx1);
  assert.ok(r1.reasons.some(x => x.includes('已超限')));

  const s2 = createStaff({ id: 'S2', name: '李四', maxHeavyTaskCount: 1 });
  const ctx2 = base();
  ctx2.heavyByWeek.set('S2|2026-08-24', 1);
  const r2 = filterCandidate(s2, slot, projectById, ctx2);
  assert.ok(r2.reasons.some(x => x.includes('已达上限')));
  assert.ok(!r2.reasons.some(x => x.includes('已超限')));
});

test('当日任务数文案：已超（3/2）与恰满（2/2）区分', () => {
  const s1 = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102', 'P103'] });
  const ctx1 = base();
  ctx1.dailyCounts.set('S1|2026-08-24', 3);
  const r1 = filterCandidate(s1, slot, projectById, ctx1);
  assert.ok(r1.reasons.some(x => x.includes('当日') && x.includes('已超限')));

  const s2 = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P101', 'P102', 'P103'] });
  const ctx2 = base();
  ctx2.dailyCounts.set('S2|2026-08-24', 2);
  const r2 = filterCandidate(s2, slot, projectById, ctx2);
  assert.ok(r2.reasons.some(x => x.includes('当日') && x.includes('已达上限')));
  assert.ok(!r2.reasons.some(x => x.includes('将超限')));
});

test('时段任务数文案：已超与恰满区分', () => {
  const s1 = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102'] });
  const ctx1 = base();
  ctx1.slotCounts.set('S1|2026-08-24|早', 2); // slotTaskLimit 默认 1
  const r1 = filterCandidate(s1, slot, projectById, ctx1);
  assert.ok(r1.reasons.some(x => x.includes('时段') && x.includes('已超限')));

  const s2 = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P101', 'P102'] });
  const ctx2 = base();
  ctx2.slotCounts.set('S2|2026-08-24|早', 1);
  const r2 = filterCandidate(s2, slot, projectById, ctx2);
  assert.ok(r2.reasons.some(x => x.includes('时段') && x.includes('已达上限')));
});

// —— 月疲劳上限（R1）：自然月累计（YYYY-MM），三分文案 ——

test('月疲劳超限拒绝（当前未超、加入后超 → 将超限）', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'], maxMonthlyFatigue: 4 });
  const ctx = base();
  ctx.fatigueByMonth.set('S1|2026-08', 2); // 8 月已 2，P101 疲劳 3 → 加入后 5 > 4
  const r = filterCandidate(s, slot, projectById, ctx); // slot date=2026-08-24 → 2026-08
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some(x => x.includes('月') && x.includes('将超限')));
});

test('月疲劳文案：已超（5/4）说已超限、恰满（4/4）说已达上限', () => {
  const over = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'], maxMonthlyFatigue: 4 });
  const c1 = base();
  c1.fatigueByMonth.set('S1|2026-08', 5);
  const r1 = filterCandidate(over, slot, projectById, c1);
  assert.ok(r1.reasons.some(x => x.includes('月') && x.includes('已超限')));
  assert.ok(!r1.reasons.some(x => x.includes('将超限')));

  const full = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P101'], maxMonthlyFatigue: 4 });
  const c2 = base();
  c2.fatigueByMonth.set('S2|2026-08', 4);
  const r2 = filterCandidate(full, slot, projectById, c2);
  assert.ok(r2.reasons.some(x => x.includes('月') && x.includes('已达上限')));
});

test('月上限跨月隔离：上月已超不影响本月', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'], maxMonthlyFatigue: 3 });
  const ctx = base();
  ctx.fatigueByMonth.set('S1|2026-07', 9); // 7 月堆满，8 月照常可排
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, true);
});

test('月上限未显式字段 → 回落设置默认（40），超默认则拦', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'] }); // 无 maxMonthlyFatigue
  const ctx = base();
  ctx.fatigueByMonth.set('S1|2026-08', 39);
  const r = filterCandidate(s, slot, projectById, ctx); // 39+3 = 42 > 40 → 拦
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some(x => x.includes('将超限')));
});

// —— 同任务连任上限（R2）：tenureLimit>0 生效；ctx.tenure + ctx.projectWeeks ——

const ctxWithTenure = (tenureLimit, projectWeeks, occ) => {
  const c = base();
  c.settings = { ...DEFAULT_SETTINGS, tenureLimit };
  c.projectWeeks = new Map(projectWeeks);
  c.tenure = new Map(occ ? [[`S1|P101`, new Map(Object.entries(occ))]] : []);
  return c;
};

test('连任：允许 N 期，第 N+1 期拦截', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'] });
  const ctx = ctxWithTenure(2, [['P101', ['2026-08-17', '2026-08-24']]], { '2026-08-17': 1 });
  // 已连任 1 期，加入本周（8-24 周一）后连续 2 期 = 2 → 恰在上限内，放行
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, true);

  const c2 = ctxWithTenure(1, [['P101', ['2026-08-17', '2026-08-24']]], { '2026-08-17': 1 });
  const r2 = filterCandidate(s, slot, projectById, c2); // 上限 1，加入后 2 期 → 拦
  assert.equal(r2.ok, false);
  assert.ok(r2.reasons.some(x => x.includes('连任')));
});

test('连任：tenureLimit=0 关闭该约束', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'] });
  const ctx = ctxWithTenure(0, [['P101', ['2026-08-17', '2026-08-24']]], { '2026-08-17': 1 });
  const r = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r.ok, true);
});

// —— 月高强度次数上限（R1b）：自然月累计，仅劳累 3；0 = 禁排高强度整个自然月 ——

test('月高强度：cur 达上限（8/8）拒、超上限（10/8）拒、未达放行', () => {
  const at = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'], maxMonthlyHeavyCount: 8 });
  const c1 = base();
  c1.heavyByMonth.set('S1|2026-08', 8); // 已 8，再来高强度 → 超
  const r1 = filterCandidate(at, slot, projectById, c1); // slot 为 P101（3 分）
  assert.equal(r1.ok, false);
  assert.ok(r1.reasons.some(x => x.includes('高强度') && x.includes('已达上限')));

  const over = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P101'], maxMonthlyHeavyCount: 8 });
  const c2 = base();
  c2.heavyByMonth.set('S2|2026-08', 10);
  const r2 = filterCandidate(over, slot, projectById, c2);
  assert.equal(r2.ok, false);
  assert.ok(r2.reasons.some(x => x.includes('高强度') && x.includes('已超限')));

  const ok = createStaff({ id: 'S3', name: '王五', allowedProjects: ['P101'], maxMonthlyHeavyCount: 8 });
  const c3 = base();
  c3.heavyByMonth.set('S3|2026-08', 7);
  const r3 = filterCandidate(ok, slot, projectById, c3); // 7+1=8 = 上限 → 放行
  assert.equal(r3.ok, true);
});

test('月高强度：0 = 禁排高强度整个自然月', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'], maxMonthlyHeavyCount: 0 });
  const r = filterCandidate(s, slot, projectById, base()); // P101 3 分，任何一单都超 0
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some(x => x.includes('高强度')));
});

test('月高强度：非高强度任务（疲劳 1/2）不受月高强度上限约束', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P102'], maxMonthlyHeavyCount: 0 });
  const slotLight = { date: '2026-08-24', projectId: 'P102', slotLabel: '早' }; // P102 疲劳 1
  const r = filterCandidate(s, slotLight, projectById, base());
  assert.equal(r.ok, true);
});

test('月高强度：未显式字段回落设置默认（8），本月 9+ 则拦', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'] }); // 无 maxMonthlyHeavyCount
  const ctx = base();
  ctx.heavyByMonth.set('S1|2026-08', 9);
  const r = filterCandidate(s, slot, projectById, ctx); // 9+1>8 → 拦
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some(x => x.includes('高强度') && x.includes('超限')));
});

test('连任拒绝为唯一原因时 tenureOnly=true；与其他拒绝并存时 false', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'] });
  const c = ctxWithTenure(1, [['P101', ['2026-08-17', '2026-08-24']]], { '2026-08-17': 1 });
  const r = filterCandidate(s, slot, projectById, c);
  assert.equal(r.ok, false);
  assert.equal(r.tenureOnly, true);

  const s2 = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P102'], bannedProjects: [{ projectId: 'P101' }] });
  const c2 = ctxWithTenure(1, [['P101', ['2026-08-17', '2026-08-24']]], { 'S2': { '2026-08-17': 1 } });
  c2.tenure = new Map([['S2|P101', new Map([['2026-08-17', 1]])]]);
  const r2 = filterCandidate(s2, slot, projectById, c2); // 黑名单 + 连任双因
  assert.equal(r2.ok, false);
  assert.equal(r2.tenureOnly, false);
});
