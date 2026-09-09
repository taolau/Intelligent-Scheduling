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

test('黑名单未录原因 → 文案回退「无原因」', () => {
  const s = createStaff({ id: 'S1', name: '张三', bannedProjects: [{ projectId: 'P101' }] });
  const r = filterCandidate(s, slot, projectById, base());
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('黑名单'));
  assert.ok(r.reasons[0].includes('无原因'));
});

// —— settings 部分缺键兜底（G1 修复回归钉）：daily/slotTaskLimit 逐键 ?? 默认，缺键不得静默失效 ——

test('settings 部分缺键（缺 daily/slotTaskLimit）→ 日/时段上限仍生效（逐键兜底防 #28 族）', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102', 'P103'] });
  // 只带 tenureLimit 一个键的局部 settings（模拟测试/新调用方传局部对象）
  const ctx = base();
  ctx.settings = { tenureLimit: 3 };

  ctx.dailyCounts.set('S1|2026-08-24', 3); // 当日已达 3（默认上限 3）
  const r1 = filterCandidate(s, slot, projectById, ctx);
  assert.equal(r1.ok, false, '缺 dailyTaskLimit 键时当日上限仍须拦截');
  assert.ok(r1.reasons.some(x => x.includes('当日')));

  const ctx2 = base();
  ctx2.settings = { tenureLimit: 3 };
  ctx2.slotCounts.set('S1|2026-08-24|早', 1); // 「早」时段已达 1（默认上限）
  const r2 = filterCandidate(s, slot, projectById, ctx2);
  assert.equal(r2.ok, false, '缺 slotTaskLimit 键时段上限仍须拦截');
  assert.ok(r2.reasons.some(x => x.includes('时段')));
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

test('日数量超限: 当天已有 2 个班次拒绝第 3 个（显式上限 2）', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101', 'P102', 'P103'] });
  const ctx = base();
  ctx.settings = { ...DEFAULT_SETTINGS, dailyTaskLimit: 2 }; // 显式钉场景，不随系统默认漂移
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
  ctx1.settings = { ...DEFAULT_SETTINGS, dailyTaskLimit: 2 }; // 显式钉场景，不随系统默认漂移
  ctx1.dailyCounts.set('S1|2026-08-24', 3);
  const r1 = filterCandidate(s1, slot, projectById, ctx1);
  assert.ok(r1.reasons.some(x => x.includes('当日') && x.includes('已超限')));

  const s2 = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P101', 'P102', 'P103'] });
  const ctx2 = base();
  ctx2.settings = { ...DEFAULT_SETTINGS, dailyTaskLimit: 2 };
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

// —— 每周时间安排（availability）硬过滤 ——
// P104 带 timeRange 的任务；slotAv 固定 2026-08-24（周一）。weekDays 内部口径 0=周日…6=周六 → 周一=1
const P104 = createProject({ id: 'P104', name: '接待', fatigueScore: 1, slots: [{ label: '早' }], timeRange: { start: '10:00', end: '12:00' } });
const P105NoTime = createProject({ id: 'P105', name: '杂活', fatigueScore: 1, slots: [{ label: '早' }], timeRange: null });
const projectByIdAv = { ...projectById, P104, [P105NoTime.id]: P105NoTime };
const slotAv = { date: '2026-08-24', projectId: 'P104', slotLabel: '早' };

test('availability: 未配置人员放行；任务无 timeRange 仅局部不可用段不拦截', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P104'] }); // 无 availability
  assert.equal(filterCandidate(s, slotAv, projectByIdAv, base()).ok, true);

  // 任务无具体时间 + 当天仅「某几小时不可用」：无法判断班次落在哪 → 不拦
  const s2 = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P105'], availability: { mode: 'unavailable', entries: [{ weekDays: [1], start: '12:00', end: '13:00' }] } });
  const slotNoTime = { date: '2026-08-24', projectId: 'P105', slotLabel: '早' };
  assert.equal(filterCandidate(s2, slotNoTime, projectByIdAv, base()).ok, true);
});

test('availability 全天（只选星期不写时间）: 与有/无时间任务都判定', () => {
  const slotNoTimeMon = { date: '2026-08-24', projectId: 'P105', slotLabel: '早' }; // 周一，无具体时间
  const slotTimedMon = { date: '2026-08-24', projectId: 'P104', slotLabel: '早' };   // 周一，10:00-12:00
  const slotTimedTue = { date: '2026-08-25', projectId: 'P104', slotLabel: '早' };   // 周二

  // 不可用全天周一：无时间任务必撞；有时间任务（任意时段）也拦
  const block = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P105', 'P104'], availability: { mode: 'unavailable', entries: [{ weekDays: [1] }] } });
  assert.equal(filterCandidate(block, slotNoTimeMon, projectByIdAv, base()).ok, false);
  assert.ok(filterCandidate(block, slotNoTimeMon, projectByIdAv, base()).reasons.some(x => x.includes('整天')));
  assert.equal(filterCandidate(block, slotTimedMon, projectByIdAv, base()).ok, false);
  assert.equal(filterCandidate(block, slotTimedTue, projectByIdAv, base()).ok, true);

  // 可用全天周一：无时间任务放行（整周一天可用时才算必排日）
  const availMon = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P105', 'P104'], availability: { mode: 'available', entries: [{ weekDays: [1] }] } });
  assert.equal(filterCandidate(availMon, slotNoTimeMon, projectByIdAv, base()).ok, true);
  assert.equal(filterCandidate(availMon, slotTimedMon, projectByIdAv, base()).ok, true); // 全天覆盖 10-12
  assert.equal(filterCandidate(availMon, slotTimedTue, projectByIdAv, base()).ok, false); // 周二无可用

  // 可用 = 仅局部时段 + 无时间任务：放行 + 黄字提醒（不拦，但提示可能落不到时段内）
  const partialOnly = createStaff({ id: 'S3', name: '王五', allowedProjects: ['P105'], availability: { mode: 'available', entries: [{ weekDays: [1], start: '09:00', end: '12:00' }] } });
  const rw = filterCandidate(partialOnly, slotNoTimeMon, projectByIdAv, base());
  assert.equal(rw.ok, true);
  assert.ok((rw.warnings ?? []).some(x => x.includes('可排') && x.includes('09:00'))); // 提醒带出当天可排时段

  // 可用白名单当天完全没配（如只配周二）→ 周一无时间任务仍拦
  const onlyTue = createStaff({ id: 'S4', name: '赵六', allowedProjects: ['P105'], availability: { mode: 'available', entries: [{ weekDays: [2], start: '09:00', end: '12:00' }] } });
  const rb = filterCandidate(onlyTue, slotNoTimeMon, projectByIdAv, base());
  assert.equal(rb.ok, false);
  assert.ok(rb.reasons.some(x => x.includes('未设可用时间')));
});

test('availability available: 完整落在可用段内放行；不完整/无当日段拒绝', () => {
  const ok = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P104'], availability: { mode: 'available', entries: [{ weekDays: [1], start: '09:00', end: '12:00' }] } });
  assert.equal(filterCandidate(ok, slotAv, projectByIdAv, base()).ok, true);

  const partial = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P104'], availability: { mode: 'available', entries: [{ weekDays: [1], start: '08:00', end: '11:00' }] } });
  const rp = filterCandidate(partial, slotAv, projectByIdAv, base());
  assert.equal(rp.ok, false);
  assert.ok(rp.reasons.some(x => x.includes('时间安排') && x.includes('周一')));

  const otherDay = createStaff({ id: 'S3', name: '王五', allowedProjects: ['P104'], availability: { mode: 'available', entries: [{ weekDays: [2], start: '09:00', end: '12:00' }] } });
  assert.equal(filterCandidate(otherDay, slotAv, projectByIdAv, base()).ok, false);
});

test('availability available: 相邻/重叠可用段合并后可覆盖长任务', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P104'], availability: { mode: 'available', entries: [
    { weekDays: [1], start: '09:00', end: '11:00' },
    { weekDays: [1], start: '11:00', end: '12:00' },
  ] } });
  assert.equal(filterCandidate(s, slotAv, projectByIdAv, base()).ok, true);
});

test('availability unavailable: 相交拒绝、端点相接放行', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P104'], availability: { mode: 'unavailable', entries: [{ weekDays: [1], start: '10:30', end: '11:30' }] } });
  const r = filterCandidate(s, slotAv, projectByIdAv, base()); // 任务 10:00-12:00 与 10:30-11:30 相交
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some(x => x.includes('重叠')));

  // 不可用 12:00-13:00：端点相接（任务 12:00 结束）→ 不冲突
  const edge = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P104'], availability: { mode: 'unavailable', entries: [{ weekDays: [1], start: '12:00', end: '13:00' }] } });
  assert.equal(filterCandidate(edge, slotAv, projectByIdAv, base()).ok, true);

  // 当日无不可用段 → 放行
  const otherDay = createStaff({ id: 'S3', name: '王五', allowedProjects: ['P104'], availability: { mode: 'unavailable', entries: [{ weekDays: [2], start: '09:00', end: '10:00' }] } });
  assert.equal(filterCandidate(otherDay, slotAv, projectByIdAv, base()).ok, true);
});

test('availability: 与连任并存时 tenureOnly=false（时间冲突不可豁免）', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P104'], availability: { mode: 'available', entries: [{ weekDays: [2], start: '09:00', end: '12:00' }] } });
  const c = base();
  c.projectWeeks = new Map([['P104', ['2026-08-17', '2026-08-24']]]);
  c.tenure = new Map([['S1|P104', new Map([['2026-08-17', 1]])]]);
  c.settings = { ...DEFAULT_SETTINGS, tenureLimit: 1 };
  const r = filterCandidate(s, slotAv, projectByIdAv, c);
  assert.equal(r.ok, false);
  assert.equal(r.tenureOnly, false);
  assert.ok(r.reasons.some(x => x.includes('时间安排')));
});
