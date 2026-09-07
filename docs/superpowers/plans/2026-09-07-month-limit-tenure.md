# 系统设置补充：月疲劳上限 + 同任务连任上限 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增两条排班硬约束——每人月疲劳积分上限（`maxMonthlyFatigue`，设置给默认 `defaultMonthlyFatigue`）与同任务连任轮换上限（全局 `tenureLimit`，0=关闭），并配套月 chip 红黄、设置 UI、Excel 列、连任豁免。

**Architecture:** 数据面扩展 `Staff`/`DEFAULT_SETTINGS`；算法面全部落在 core 纯函数——复用 `fatigueByMonth` 轨道做月上限（filter），新增 `ctx.tenure`+`ctx.projectWeeks` 两表预聚合连任占有周、抽 `core/tenure.js` 纯函数判"加入后连续段长"、filter 拦第 N+1 期；连任豁免（无他人可选保运转）经新 helper `splitEligible` 统一收口，替换/分配弹窗/智能排班共用。视图层只做展示与设置录入。ctx 聚合 `buildContext`、克隆 `cloneCtx`、计数增减 `accumulateDelta` 三处是唯一数据通道，改动收敛于此。

**Tech Stack:** 原生 ES Modules、node:test + assert/strict、无新依赖。

## Global Constraints

- core/ 纯函数、无 DOM；仅 `node --test` 可测，views/ui 手测（本仓库 CLAUDE.md 验证分级：小 UI 改动可直接交 Tao 自查）。
- 周上限语义不动：仍按班次所在自然周滚动窗口；月上限 = 固定自然月 `YYYY-MM`（`date.slice(0,7)`，与 `monthKey` 同构）；连任"期" = 该任务**有发生周**（任务有排班即该周有发生），空窗不中断、他人接手中断。
- ctx 聚合返回字段 = 下游算法消费字段的并集（pitfalls #1：`recommendSubstitutes`/任何手工构造喂 filter 的 ctx 都必须带新表，缺表 = 约束静默失效）。
- 数值兜底：settings 消费一律逐键 `ctx.settings?.X ?? DEFAULT_SETTINGS.X`（pitfalls #28）；数值输入空/非法回默认用 `isFinite` + 非空判定，禁 `||`（#30）。
- 文案三分现状/预测态：已超限 / 已达上限 / 将超限（pitfalls #27）。
- 数据源常量：`DEFAULT_SETTINGS` 现含 `dailyTaskLimit:2, slotTaskLimit:1, warnDailyCount:1, preferredBonus:15, tagBonus:15, balanceFactor:5, balanceWindowDays:30, defaultWeeklyFatigue:10, defaultHeavyTaskCount:2`；新增键默认 `defaultMonthlyFatigue:40`、`tenureLimit:3`。
- 单测命令：`node --test test/<file>.test.js`；全量：`npm test`。

---

### Task 1: model——新字段、新设置默认、月上限取值 helper

**Files:**
- Modify: `src/data/model.js`（DEFAULT_SETTINGS、createStaff、validateStaff、新增 helper）
- Test: `test/model.test.js`

**Interfaces:**
- Produces: `DEFAULT_SETTINGS.defaultMonthlyFatigue = 40`、`DEFAULT_SETTINGS.tenureLimit = 3`
- Produces: `Staff.maxMonthlyFatigue`（createStaff 默认链 `fields.maxMonthlyFatigue ?? defaults.maxMonthlyFatigue ?? DEFAULT_SETTINGS.defaultMonthlyFatigue`）
- Produces: `monthlyFatigueLimitOf(staff, settings)` → `staff.maxMonthlyFatigue ?? settings?.defaultMonthlyFatigue ?? DEFAULT_SETTINGS.defaultMonthlyFatigue`（filter/config/excel 统一消费，存量无字段 = 跟随当前默认）

- [ ] **Step 1: 写失败测试**（append `test/model.test.js`）

```js
test('DEFAULT_SETTINGS 含新键：defaultMonthlyFatigue=40、tenureLimit=3', () => {
  assert.equal(DEFAULT_SETTINGS.defaultMonthlyFatigue, 40);
  assert.equal(DEFAULT_SETTINGS.tenureLimit, 3);
});

test('createStaff 默认月疲劳上限取自 defaultMonthlyFatigue；defaults/fields 依次覆盖', () => {
  assert.equal(createStaff({ id: 'S1', name: '张三' }).maxMonthlyFatigue, 40);
  const d = createStaff({ id: 'S2', name: '李四' }, { maxMonthlyFatigue: 30 });
  assert.equal(d.maxMonthlyFatigue, 30);
  const f = createStaff({ id: 'S3', name: '王五', maxMonthlyFatigue: 25 });
  assert.equal(f.maxMonthlyFatigue, 25);
});

test('validateStaff：月疲劳上限 < 1 报错', () => {
  const s = createStaff({ id: 'S1', name: '张三', maxMonthlyFatigue: 0 });
  const r = validateStaff(s);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.field === 'maxMonthlyFatigue'));
});

test('monthlyFatigueLimitOf：显式字段优先，缺省回设置默认', () => {
  assert.equal(monthlyFatigueLimitOf({ maxMonthlyFatigue: 22 }), 22);
  assert.equal(monthlyFatigueLimitOf({}), 40);
  assert.equal(monthlyFatigueLimitOf({}, { defaultMonthlyFatigue: 50 }), 50);
});
```

- [ ] **Step 2: 跑失败**：`node --test test/model.test.js` → 前两测失败（无键/无字段）。

- [ ] **Step 3: 最小实现**（`src/data/model.js`）

DEFAULT_SETTINGS 行改为：
```js
export const DEFAULT_SETTINGS = {
  dailyTaskLimit: 2, slotTaskLimit: 1, warnDailyCount: 1, preferredBonus: 15, tagBonus: 15, balanceFactor: 5,
  balanceWindowDays: 30, defaultWeeklyFatigue: 10, defaultHeavyTaskCount: 2,
  defaultMonthlyFatigue: 40, tenureLimit: 3,
};
```
createStaff 在 `maxHeavyTaskCount` 行后加：
```js
    maxMonthlyFatigue: fields.maxMonthlyFatigue ?? defaults.maxMonthlyFatigue ?? DEFAULT_SETTINGS.defaultMonthlyFatigue,
```
validateStaff 在 `maxHeavyTaskCount` 校验行后加：
```js
    { cond: s.maxMonthlyFatigue < 1, field: 'maxMonthlyFatigue', msg: '月疲劳上限必须 >= 1' },
```
文件内（createStaff 之前或 DEFAULT_SETTINGS 之后）新增：
```js
// 月疲劳上限取值：已显式配置用逐人值；未配置（存量/Excel 缺省）跟随当前系统默认
export function monthlyFatigueLimitOf(staff, settings = DEFAULT_SETTINGS) {
  return staff.maxMonthlyFatigue ?? settings?.defaultMonthlyFatigue ?? DEFAULT_SETTINGS.defaultMonthlyFatigue;
}
```

- [ ] **Step 4: 跑过**：`node --test test/model.test.js` → 全绿。

- [ ] **Step 5: Commit**
```bash
git add src/data/model.js test/model.test.js
git commit -m "[规则上限/数据模型] Staff 加月疲劳上限字段 + 系统设置补 defaultMonthlyFatigue/tenureLimit + monthlyFatigueLimitOf helper"
```

---

### Task 2: core/tenure.js——连任"加入后连续段长"纯函数

**Files:**
- Create: `src/core/tenure.js`
- Test: `test/tenure.test.js`

**Interfaces:**
- Consumes: `ctx.projectWeeks`（Map<projectId, weekStart[] 升序>）、`ctx.tenure`（Map<`sid|projectId`, Map<weekStart, count>>）
- Produces: `tenureRunAfterAdd(projectId, staffId, weekStart, ctx) → number`（把该人加入该任务该自然周后，含该周的极大连续占有段长；段以 `projectWeeks` 为"有发生周"轴——空窗周不在轴 = 不断链，非 held 的有发生周 = 断链）

判定语义：`axis = sort(projectWeeks ∪ {weekStart})`（held 周 ⊆ axis）。从 `weekStart` 在 axis 的位置向左右扩展，只要相邻轴点 ∈ held 就累加（left+1+right）。**示例**：projectWeeks=['08-17','08-24']、held={'08-17'}、weekStart='08-24' → axis 相邻 → left=1 → 返 2。

- [ ] **Step 1: 写失败测试**（新建 `test/tenure.test.js`）

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { tenureRunAfterAdd } from '../src/core/tenure.js';

const run = (projectWeeks, occ, weekStart, pid = 'P1', sid = 'S1') => {
  const ctx = {
    projectWeeks: new Map([[pid, projectWeeks]]),
    tenure: new Map(occ ? [[`${sid}|${pid}`, new Map(Object.entries(occ))]] : []),
  };
  return tenureRunAfterAdd(pid, sid, weekStart, ctx);
};

test('无任何历史占用 → 返回 1', () => {
  assert.equal(run(['2026-08-24'], null, '2026-08-24'), 1);
});

test('上周已占同任务且周相邻 → 连续 2 期', () => {
  assert.equal(run(['2026-08-17', '2026-08-24'], { '2026-08-17': 1 }, '2026-08-24'), 2);
});

test('空窗不中断：中间周该任务无排班（不在 projectWeeks）仍延续', () => {
  // 8/31 那周该任务无任何排班（空窗），8-24 与 9-07 在有发生周序中相邻 → 仍同段
  assert.equal(run(['2026-08-24', '2026-09-07'], { '2026-08-24': 1 }, '2026-09-07'), 2);
});

test('他人接手中断：中间有发生周被他人占（非 held）→ 重新起算', () => {
  // 8/31 该任务有排班但不是本人 → held 只有 8-24；9-07 加入后与其不相邻 → 段长 1
  assert.equal(run(['2026-08-24', '2026-08-31', '2026-09-07'], { '2026-08-24': 1 }, '2026-09-07'), 1);
});

test('未来已排定（含未来段）计入：加入本周把左右两段接成 3 期', () => {
  assert.equal(run(
    ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'],
    { '2026-09-07': 1, '2026-09-14': 1, '2026-09-21': 1 },
    '2026-08-31'
  ), 4);
});

test('同一周已持有（同周另一班）幂等：返回当前段长不额外 +1', () => {
  // held 已有 9-07（本周同任务另一班）；再加入同周另一班 → 段长仍为含 8-31+9-07 的 2
  assert.equal(run(['2026-08-31', '2026-09-07'], { '2026-08-31': 1, '2026-09-07': 1 }, '2026-09-07'), 2);
});

test('count>0 才计为占有；减到 0 的周（已移除）断链', () => {
  assert.equal(run(['2026-08-24', '2026-08-31'], { '2026-08-24': 1, '2026-08-31': 0 }, '2026-08-31'), 1);
});

test('跨自然月边界周按周首日自然衔接', () => {
  // 8/31 起周与 9/7 起周跨月但相邻 → 连续
  assert.equal(run(['2026-08-31', '2026-09-07'], { '2026-08-31': 1 }, '2026-09-07'), 2);
});
```

- [ ] **Step 2: 跑失败**：`node --test test/tenure.test.js` → 全 FAIL（模块不存在）。

- [ ] **Step 3: 最小实现**（新建 `src/core/tenure.js`）

```js
// 同任务连任判定：把 staff 加入 project 的 weekStart 自然周后，含该周的极大连续占有段长。
// 段轴 = projectWeeks（该任务"有发生周"升序）：空窗周不在轴故不中断，他人接手的周在轴但非 held 故中断。
export function tenureRunAfterAdd(projectId, staffId, weekStart, ctx) {
  const occ = ctx?.tenure?.get(`${staffId}|${projectId}`);
  const ws = ctx?.projectWeeks?.get(projectId) ?? [];
  const held = new Set();
  if (occ) for (const [w, c] of occ) if (c > 0) held.add(w);
  held.add(weekStart);
  const axis = [...new Set([...ws, weekStart])].sort();
  const i = axis.indexOf(weekStart);
  if (i === -1) return 1; // 理论不可达（weekStart 已并入 axis）
  let left = 0;
  for (let k = i - 1; k >= 0 && held.has(axis[k]); k--) left++;
  let right = 0;
  for (let k = i + 1; k < axis.length && held.has(axis[k]); k++) right++;
  return left + 1 + right;
}
```

- [ ] **Step 4: 跑过**：`node --test test/tenure.test.js` → 全绿。

- [ ] **Step 5: Commit**
```bash
git add src/core/tenure.js test/tenure.test.js
git commit -m "[规则上限/连任] 新增 core/tenure.js：加入后连续占有段长纯函数（空窗不中断/他人中断/未来计入）"
```

---

### Task 3: filter——月疲劳上限 R1 + 连任上限 R2 + tenureOnly 标记

**Files:**
- Modify: `src/core/filter.js`
- Test: `test/filter.test.js`

**Interfaces:**
- Consumes: `ctx.fatigueByMonth`（键 `sid|YYYY-MM`）、`ctx.tenure`、`ctx.projectWeeks`（Task 4 才由 buildContext 产出；本 Task 测试手工构造）、`Staff.maxMonthlyFatigue`/`settings.defaultMonthlyFatigue`（经 `monthlyFatigueLimitOf`）、`settings.tenureLimit`
- Consumes: `tenureRunAfterAdd`（tenure.js）、`monthlyFatigueLimitOf`（model）
- Produces: `filterCandidate` 返回值新增第三字段 `tenureOnly`（boolean：本轮拒绝**仅因**连任——豁免探测用）

- [ ] **Step 1: 写失败测试**（append `test/filter.test.js`；文件顶部 import 行需加 `monthlyFatigueLimitOf` 不必，只加用例）

```js
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

test('月上限未显式字段 → 回落设置默认（40），40 分内不拦', () => {
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
  c.tenure = new Map(occ ? [[`${'S1'}|P101`, new Map(Object.entries(occ))]] : []);
  return c;
};

test('连任：超过 tenureLimit 期拦截（允许 N 期，第 N+1 期拦）', () => {
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

test('连任拒绝为唯一原因时 tenureOnly=true；与其他拒绝并存时 false', () => {
  const s = createStaff({ id: 'S1', name: '张三', allowedProjects: ['P101'] });
  const c = ctxWithTenure(1, [['P101', ['2026-08-17', '2026-08-24']]], { '2026-08-17': 1 });
  const r = filterCandidate(s, slot, projectById, c);
  assert.equal(r.ok, false);
  assert.equal(r.tenureOnly, true);

  const s2 = createStaff({ id: 'S2', name: '李四', allowedProjects: ['P102'], bannedProjects: [{ projectId: 'P101' }] });
  const c2 = ctxWithTenure(1, [['P101', ['2026-08-17', '2026-08-24']]], { 'S2': { '2026-08-17': 1 } });
  // ctxWithTenure 固定 S1 键，此处手工造双因 ctx：黑名单 + 连任
  c2.tenure = new Map([['S2|P101', new Map([['2026-08-17', 1]])]]);
  const r2 = filterCandidate(s2, slot, projectById, c2);
  assert.equal(r2.ok, false);
  assert.equal(r2.tenureOnly, false);
});
```

- [ ] **Step 2: 跑失败**：`node --test test/filter.test.js` → 新用例全 FAIL（filter 未实现新规则，`r.tenureOnly` undefined）。

- [ ] **Step 3: 最小实现**（`src/core/filter.js`）

顶部 import 加：
```js
import { DEFAULT_SETTINGS, monthlyFatigueLimitOf } from '../data/model.js';
import { tenureRunAfterAdd } from './tenure.js';
```

`filterCandidate` 内、现有周上限块（`heavyByWeek` 高强度块）之后新增两段；return 改带回 tenureOnly：

```js
  // 月疲劳上限：自然月累计（YYYY-MM，同月粒度 chip 口径），防整月无度堆积
  const monthFatigue = ctx.fatigueByMonth?.get(`${staff.id}|${schedule.date.slice(0, 7)}`) ?? 0;
  const monthLimit = monthlyFatigueLimitOf(staff, ctx.settings);
  if (monthFatigue + project.fatigueScore > monthLimit) {
    if (monthFatigue > monthLimit) reasons.push(`本月劳累积分已超限（上限 ${monthLimit}）`);
    else if (monthFatigue === monthLimit) reasons.push(`本月劳累积分已达上限（${monthLimit}）`);
    else reasons.push(`本月劳累积分将超限（上限 ${monthLimit}）`);
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
```

> 位置注意：原函数末行为 `return { ok: reasons.length === 0, reasons };`，改为上面三字段 return。新规则插在高强度块之后、return 之前。

- [ ] **Step 4: 跑过**：`node --test test/filter.test.js` → 旧用例 + 新用例全绿。

- [ ] **Step 5: Commit**
```bash
git add src/core/filter.js test/filter.test.js
git commit -m "[规则上限/filter] 月疲劳上限 + 同任务连任上限两条硬规则 + tenureOnly 豁免标记"
```

---

### Task 4: ctx 聚合/克隆——buildContext 两表 + cloneCtx 深拷贝

**Files:**
- Modify: `src/core/substitute.js`
- Test: `test/substitute.test.js`

**Interfaces:**
- Consumes: `getWeekStart`（week.js，已 import）
- Produces: `buildContext` 返回新增 `projectWeeks`（Map<projectId, weekStart[] 升序>）、`tenure`（Map<`sid|projectId`, Map<weekStart,count>>）
- Produces: `cloneCtx` 深拷贝上述两表（内层 Map 与数组均复制，模拟操作不得污染源 ctx）

- [ ] **Step 1: 写失败测试**（append `test/substitute.test.js`；该文件 buildContext 用法：`buildContext(staffs, schedules, projectById, settings, today)`）

```js
test('buildContext 聚合 projectWeeks：同任务多周去重升序、跨 slot 归同周、孤儿跳过', () => {
  const staffs = [createStaff({ id: 'S1', name: '张三', allowedProjects: ['P1'] })];
  const mk = (date, pid, staffIds) => createSchedule({ id: 'x' + date + pid, date, projectId: pid, slotLabel: '早', staffIds });
  const byId = { P1: createProject({ id: 'P1', name: '搬运', fatigueScore: 1 }) };
  const scheds = [
    mk('2026-08-24', 'P1', ['S1']), // 周一 → 周 8/24
    mk('2026-08-28', 'P1', ['S1']), // 周五，同周 → 不新增周
    mk('2026-08-31', 'P1', []),     // 下周一空壳班，也算有发生周
    mk('2026-09-01', 'PX', ['S1']), // 孤儿任务 → 跳过
  ];
  const ctx = buildContext(staffs, scheds, byId, DEFAULT_SETTINGS, '2026-08-30');
  assert.deepEqual(ctx.projectWeeks.get('P1'), ['2026-08-24', '2026-08-31']);
  assert.equal(ctx.projectWeeks.has('PX'), false);
});

test('buildContext 聚合 tenure：按 staff×project 周计 count（同周多班累加）', () => {
  const staffs = [createStaff({ id: 'S1', name: '张三' }), createStaff({ id: 'S2', name: '李四' })];
  const byId = { P1: createProject({ id: 'P1', name: '搬运', fatigueScore: 1 }) };
  const mk = (date, pid, staffIds) => createSchedule({ id: 'y' + date, date, projectId: pid, slotLabel: '早', staffIds });
  const scheds = [
    mk('2026-08-24', 'P1', ['S1']),
    mk('2026-08-24', 'P1', ['S1']), // 同周第二班 → count 2
    mk('2026-08-31', 'P1', ['S2']),
  ];
  const ctx = buildContext(staffs, scheds, byId, DEFAULT_SETTINGS, '2026-08-30');
  assert.equal(ctx.tenure.get('S1|P1').get('2026-08-24'), 2);
  assert.equal(ctx.tenure.get('S2|P1').get('2026-08-31'), 1);
});

test('cloneCtx 深拷贝 projectWeeks/tenure：改克隆不影响源 ctx', () => {
  const staffs = [createStaff({ id: 'S1', name: '张三' })];
  const byId = { P1: createProject({ id: 'P1', name: '搬运', fatigueScore: 1 }) };
  const sch = createSchedule({ id: 'z', date: '2026-08-24', projectId: 'P1', slotLabel: '早', staffIds: ['S1'] });
  const ctx = buildContext(staffs, [sch], byId, DEFAULT_SETTINGS, '2026-08-30');
  const cl = cloneCtx(ctx);
  cl.projectWeeks.get('P1').push('2026-09-07');
  cl.tenure.get('S1|P1').set('2026-09-07', 1);
  assert.equal(ctx.projectWeeks.get('P1').length, 1);
  assert.equal(ctx.tenure.get('S1|P1').has('2026-09-07'), false);
});
```

- [ ] **Step 2: 跑失败**：`node --test test/substitute.test.js` → 三测 FAIL（无 `projectWeeks`/`tenure` 字段）。

- [ ] **Step 3: 最小实现**（`src/core/substitute.js`）

`buildContext` 中、for 循环之后（`teamAvg` 计算前或 return 前）加聚合；注意现有 for 循环已 `const project = projectById[sch.projectId]; if (!project) continue;`，本段可独立再遍历一次 schedules（复用孤儿过滤）：

```js
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
```
return 对象加 `projectWeeks, tenure`。

`cloneCtx` 复制对象中加（并深拷内层）：
```js
    projectWeeks: new Map([...(c.projectWeeks ?? [])].map(([k, arr]) => [k, [...arr]])),
    tenure: new Map([...(c.tenure ?? [])].map(([k, m]) => [k, new Map(m)])),
```

> 该文件测试若未 import `createStaff/createProject/createSchedule/DEFAULT_SETTINGS`，按需补顶部 import（来自 `../data/model.js`）。

- [ ] **Step 4: 跑过**：`node --test test/substitute.test.js` → 全绿。

- [ ] **Step 5: Commit**
```bash
git add src/core/substitute.js test/substitute.test.js
git commit -m "[ctx/聚合] buildContext 增 projectWeeks/tenure 两表 + cloneCtx 深拷贝（连任判定数据源）"
```

---

### Task 5: 豁免收口——accumulateDelta 同步 tenure、auto/recommend 走 splitEligible

**Files:**
- Modify: `src/core/auto.js`（accumulateDelta + simulateAutoFill）
- Modify: `src/core/substitute.js`（新增 `splitEligible`；`recommendSubstitutes` 改造）
- Test: `test/auto.test.js`、`test/substitute.test.js`

**Interfaces:**
- Consumes: `filterCandidate`（读 `ok`/`tenureOnly`）
- Produces: `splitEligible(staffs, schedule, projectById, ctx, excludeIds = []) → { base, tenured }`（base = 通过全部硬规则者；tenured = 仅因连任被拒者。调用方在 base 为空时允许 tenured 保运转 = 豁免）
- Produces: `accumulateDelta` 同步维护 `ctxObj.tenure`（周 count ±sign，移除到 0 不残留占用）——视图 applyDelta/替换/批量删除全部经此入口自动获得

- [ ] **Step 1: 写失败测试**

`test/auto.test.js` append（沿用其 TODAY='2026-09-07'、P1、proj1/mkStaff/mkCtx 构造；需两空壳跨周同任务）：
```js
test('simulateAutoFill: 连任感知 — 同一任务跨两周，有他人可选时第 2 周换人（豁免不触发）', () => {
  const staffs = [mkStaff('A'), mkStaff('B')];
  const byId = { P1: { ...P1, requiredCapacity: 1, slots: [{ label: '自主安排' }] } };
  const mk = (id, date) => createSchedule({ id, date, projectId: 'P1', slotLabel: '自主安排' });
  const s1 = mk('S1', '2026-09-07'); // 周1（本周起）
  const s2 = mk('S2', '2026-09-14'); // 周2
  const ctx = mkCtx(staffs, [], byId); ctx.settings = { ...DEFAULT_SETTINGS, tenureLimit: 1 };
  const [r1, r2] = simulateAutoFill([s1, s2], staffs, byId, ctx);
  assert.deepEqual(r1.sch.staffIds, ['A']); // 第 1 期
  assert.deepEqual(r2.sch.staffIds, ['B']); // A 已连任 1 期达上限 → 第 2 期换 B
});

test('simulateAutoFill: 连任豁免 — 无他人可选时允许同一人连任保运转', () => {
  const staffs = [mkStaff('A')]; // 只有 A 会 P1
  const byId = { P1: { ...P1, requiredCapacity: 1, slots: [{ label: '自主安排' }] } };
  const mk = (id, date) => createSchedule({ id, date, projectId: 'P1', slotLabel: '自主安排' });
  const s1 = mk('S1', '2026-09-07');
  const s2 = mk('S2', '2026-09-14');
  const ctx = mkCtx(staffs, [], byId); ctx.settings = { ...DEFAULT_SETTINGS, tenureLimit: 1 };
  const [r1, r2] = simulateAutoFill([s1, s2], staffs, byId, ctx);
  assert.deepEqual(r1.sch.staffIds, ['A']);
  assert.deepEqual(r2.sch.staffIds, ['A']); // base 空（无人会 P1）→ 豁免 A
});
```

`test/substitute.test.js` append（recommendSubstitutes 签名 `(staffs, schedule, projectById, ctx, excludeStaffId)`；检查豁免与换人）：
```js
test('recommendSubstitutes: base 空时连任者豁免上榜', () => {
  const a = createStaff({ id: 'A', name: 'A', allowedProjects: ['P1'] });
  const b = createStaff({ id: 'B', name: 'B', allowedProjects: ['P1'] });
  const byId = { P1: createProject({ id: 'P1', name: '搬运', fatigueScore: 1, requiredCapacity: 1 }) };
  // 该班次 8-24 周一 P1；A 上周已连任 1 期且 B 也仅因连任被拒？构造：B 无历史连任但被黑名单？——
  // 简化断言：excludeStaffId 生效 + 只返回可候选者
  const sch = createSchedule({ id: 's', date: '2026-08-24', projectId: 'P1', slotLabel: '早' });
  const ctx = buildContext([a, b], [], byId, { ...DEFAULT_SETTINGS, tenureLimit: 1 }, '2026-08-24');
  const out = recommendSubstitutes([a, b], sch, byId, ctx, 'A');
  assert.equal(out.length, 1);
  assert.equal(out[0].staff.id, 'B'); // A 被排除
});
```
> 若此例与既有 recommend 测试语义重叠可精简；核心要覆盖"无他人、仅连任者被拦 → 仍返回该人"（豁免）。

- [ ] **Step 2: 跑失败**：`node --test test/auto.test.js` + `node --test test/substitute.test.js`。连任换人/豁免两例应 FAIL（accumulateDelta 未同步 tenure、候选收集未豁免）。

- [ ] **Step 3: 实现**（三处小改）

**`src/core/substitute.js`**：文件内新增并导出（放在 recommendSubstitutes 之前）：
```js
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
```
`recommendSubstitutes` 主体替换（原 `filter(...) → if (!res.ok) continue` 与候选收集）：
```js
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
```

**`src/core/auto.js`**：
`accumulateDelta` 函数体末尾追加 tenure 同步（`project` 已为参，`wk` 变量已含 `getWeekStart(sch.date)`——注意其名为 `wk`，格式 `sid|weekStart`，tenure 需独立键）：
```js
  if (ctxObj.tenure) {
    const tkey = `${sid}|${project.id}`;
    const wkStart = getWeekStart(sch.date);
    if (!ctxObj.tenure.has(tkey)) ctxObj.tenure.set(tkey, new Map());
    const m = ctxObj.tenure.get(tkey);
    m.set(wkStart, Math.max(0, (m.get(wkStart) ?? 0) + sign));
  }
```
`simulateAutoFill` 的 while 候选段（原 `staffs.filter(!includes).map(filter).filter(ok)`）替换为：
```js
      while (sch.staffIds.length < project.requiredCapacity) {
        const { base, tenured } = splitEligible(staffs, sch, projectById, simCtx, sch.staffIds);
        const pool = base.length ? base : tenured; // 豁免
        if (pool.length === 0) break;
        let best = null;
        for (const s of pool) {
          const { score } = scoreCandidate(s, sch, projectById, simCtx);
          if (!best || score > best.score) best = { s, score };
        }
        sch.staffIds.push(best.s.id);
        added.push(best.s.id);
        accumulateDelta(simCtx, project, sch, best.s.id, 1);
        if (warnDaily > 0 && (simCtx.dailyCounts.get(`${best.s.id}|${sch.date}`) ?? 0) >= warnDaily) warned.push(best.s.id);
      }
```
顶部 import 加 `splitEligible`（`import { cloneCtx, splitEligible } from './substitute.js';`）。

- [ ] **Step 4: 跑过**：`node --test test/auto.test.js` `node --test test/substitute.test.js` → 新旧用例全绿（原 auto 断言同分先到先得不受影响——无 tenure 历史时 run=1 ≤默认 3，不拦）。

- [ ] **Step 5: Commit**
```bash
git add src/core/auto.js src/core/substitute.js test/auto.test.js test/substitute.test.js
git commit -m "[连任/豁免] splitEligible 分池 + accumulateDelta 同步 tenure + auto/recommend 接豁免"
```

---

### Task 6: 分配弹窗 scheduleDialog——候选分池 + 豁免上浮

**Files:**
- Modify: `src/views/calendar.js`（scheduleDialog 候选区，现 819-865 行一带）
- 依赖：`splitEligible` 已 export；本 Task 为 UI，手测

**Interfaces:**
- Consumes: `splitEligible(data.staffs, draft, projectById, dctx, draft.staffIds)`
- Behavior: 常规 base 非空 → 照旧只显 base（连任者留在"暂不可添加"带原因）；base 空且 tenured 非空 → tenured 上浮为可添加 + 候选区顶部插一条豁免说明

- [ ] **Step 1: 改造候选收集段**（calendar.js 819-865；`const pickedRows = ...` 保留）

在 for 循环**之前**插入：
```js
      const { base, tenured } = splitEligible(data.staffs, draft, projectById, dctx, draft.staffIds);
      const tenureExempt = base.length === 0 && tenured.length > 0; // 豁免态：无其他可排人选，连任者破例放行
      const exemptSet = new Set(tenureExempt ? tenured.map(s => s.id) : []);
```
for 循环体顶部 `const res = filterCandidate(...)` 之后加一行映射可用性：
```js
        const res = filterCandidate(s, draft, projectById, dctx);
        const isAvail = res.ok || exemptSet.has(s.id); // 豁免：本无 base，仅连任被拦者也可点选
```
把 `row.className = 'assign-row' + (res.ok ? ' pickable' : ' blocked');` 改为基于 `isAvail`；`if (res.ok) {` 分支条件改为 `if (isAvail) {`；`else {` 里 reasons 若 `res.tenureOnly`（豁免上浮但循环仍走到 else? 不会——exemptSet.has 使 isAvail true 走 if 分支）。注意：豁免上浮者走 if 分支打分渲染进 `availEntries`，故 else 分支只收真正 blocked（含非豁免场景下 res.tenureOnly 若 base 非空 → isAvail false → else 显示连任原因，正确）。
reco 副行在豁免态加前缀（if 分支内、`narrateReasons` 之后）：
```js
          if (tenureExempt && res.tenureOnly) reco.unshift('（仅因无其他可排人选，破例连任）');
```
豁免说明条：在 `for` 之后、`availEntries.sort` 之前：
```js
      if (tenureExempt) {
        const note = document.createElement('div');
        note.className = 'asg-exempt-note';
        note.textContent = '当前无可其他可排人选，以下连任人员破例放行';
        listAvail.appendChild(note);
      }
```

- [ ] **Step 2: 顶部 import**：calendar.js import 行 4 的 substitute 解构加 `splitEligible`。

- [ ] **Step 3: 手测**（Playwright 冒烟或请 Tao 自查）：
  1. 任务 P1（周复现）+ 人员 A、B 均会 P1，`tenureLimit=1`；A 已连任本周/上周 → 开分配弹窗（本周另一空班）：B 在"可添加"、A 在"暂不可添加"（原因含"连任"）。
  2. 仅 A 会 P1 时：开弹窗 → A 在"可添加"（豁免），顶部见破例说明条。
  3. 点豁免行 A → 正常暂存/确认保存；toast 正常。

- [ ] **Step 4: Commit**
```bash
git add src/views/calendar.js
git commit -m "[连任/分配弹窗] scheduleDialog 候选 splitEligible 分池 + 无他人时连任豁免上浮（破例说明条）"
```

---

### Task 7: 月粒度 chip/hover/摘要带上限

**Files:**
- Modify: `src/views/calendar.js`（`staffChipClass`、hover 文案、人员维度月摘要行）

**Interfaces:**
- Consumes: `monthlyFatigueLimitOf`（model）、`ctx.fatigueByMonth`、`ctx.settings`
- Behavior: 月粒度 chip：超 `limit` over 红、≥ `0.8×limit` warn 黄（对称周粒度 0.8）；hover 显示 `本月累计 X/上限`；月摘要 `疲劳 X/上限`

- [ ] **Step 1: 改 `staffChipClass`**（现 955-957 月分支直接 return）
```js
  if (timeScale === 'month') {
    const mkey = monthKey(date);
    const mf = ctx.fatigueByMonth.get(`${staff.id}|${mkey}`) ?? 0;
    const limit = monthlyFatigueLimitOf(staff, ctx.settings);
    if (mf > limit) return 'staff-chip over';
    if (mf >= limit * 0.8) return 'staff-chip warn';
    return 'staff-chip';
  }
```
原注释行"周上限红黄语义仅周粒度成立（月粒度不判超限）"删/改——月红黄改绑月上限。

- [ ] **Step 2: 改 hover 月分支**（现 ~971-975 返回串）
```js
    return `本月累计 ${mf}/${monthlyFatigueLimitOf(staff, ctx.settings)} · 本周 ${wk}/${staff.maxWeeklyFatigue} · 当日 ${daily} 个任务`;
```

- [ ] **Step 3: 改人员维度月摘要行**（现 ~436-437 分支，`st` 为当前人员）
```js
      ? `本月 ${visible.length} 个班次 · 疲劳 ${fatigue}/${monthlyFatigueLimitOf(st, ctx.settings)} · 高强度 ${heavy}`
```

- [ ] **Step 4: import**：calendar.js model import 行加 `monthlyFatigueLimitOf`（现有 `createSchedule, SLOT_LABELS` 来自 `../data/model.js`）。

- [ ] **Step 5: 手测**（自查）：月粒度下 A 月积分超上限 → chip 红、hover `本月累计 X/上限`；接近上限黄。

- [ ] **Step 6: Commit**
```bash
git add src/views/calendar.js
git commit -m "[月视图/chip] 月粒度 chip 红黄/hover/摘要换绑月疲劳上限"
```

---

### Task 8: 人员配置——卡片行 + 编辑弹窗月上限字段

**Files:**
- Modify: `src/views/config.js`

**Interfaces:**
- Consumes: `monthlyFatigueLimitOf(s, getSettings())`（存量无字段显示当前默认；编辑保存即固化）

- [ ] **Step 1: 人员卡片行**：现 338 行 `<div class="cfg-row"><span class="k">周疲劳上限</span>…` 之后加：
```js
        <div class="cfg-row"><span class="k">月疲劳上限</span><span class="v">${monthlyFatigueLimitOf(s, getSettings())}</span></div>
```

- [ ] **Step 2: 编辑弹窗加字段**（现 `fatigueInput` 周疲劳字段 ~490-493 一带）：新增月疲劳输入：
```js
  const monthFatigueInput = document.createElement('input');
  monthFatigueInput.type = 'number';
  monthFatigueInput.min = 1;
  monthFatigueInput.value = target.maxMonthlyFatigue ?? getSettings().defaultMonthlyFatigue;
  const monthF = field({ label: '月疲劳上限', control: monthFatigueInput });
```
  `field` 行紧随周疲劳字段 append；保存 collect 对象（~566）加 `maxMonthlyFatigue: Number(monthFatigueInput.value)`；错误展示区（~591）`byField.maxMonthlyFatigue` 映射加一行（对齐 `fatigueF` 写法）。
- [ ] **Step 3: import**：config.js model import 加 `monthlyFatigueLimitOf`；`getSettings` 已 import。
- [ ] **Step 4: 手测**：人员卡片见月疲劳上限行；编辑可改、保存后卡片与后续分配生效。
- [ ] **Step 5: Commit**
```bash
git add src/views/config.js
git commit -m "[人员配置] 卡片行 + 编辑弹窗加月疲劳上限字段"
```

---

### Task 9: 系统设置——SET_GROUPS 新增第四组「排班轮换」+ 新建默认组加行 + RULE_SECS 人话

**Files:**
- Modify: `src/views/config.js`（SET_GROUPS、RULE_SECS）

- [ ] **Step 1: 「新建人员默认」组加行**（现 1043-1046 两行之后）
```js
      { key: 'defaultMonthlyFatigue', name: '月疲劳上限', min: 1,
        hint: '新人的单月劳累积分上限（防整月无度堆积）。本月劳累积分 = 该自然月已排班次的劳累指数之和；与周上限各自独立（周看单周、月看整月）。' },
```

- [ ] **Step 2: 新增第四组**（SET_GROUPS 数组尾）
```js
  {
    title: '排班轮换',
    desc: '防止同一任务被同一个人连续霸占，到上限强制轮换他人。属硬性限制，但无人手可选时系统会破例放行保运转。',
    items: [
      { key: 'tenureLimit', name: '同一任务连任上限', min: 0, max: 26,
        hint: '同一任务连续 N 期（该任务有排班的自然周计数）排到同一人后，第 N+1 期强制轮换他人；填 0 = 关闭该约束。某周任务空窗不算、他人接手即重新计数；仅当该班次无其他可排人选时才允许连任保运转。' },
    ],
  },
```

- [ ] **Step 3: RULE_SECS 人话同步**：
「谁能被排：一票否决」items（现 1056-1060 末项后）加：
```js
      '超限（月）：当月（自然月）劳累积分超过该人「月疲劳上限」不可再排——与周上限分工：周防单周透支、月防整月堆积',
      '连任：同一任务连续 N 期（N = 系统设置「同一任务连任上限」，0 = 关闭）排到同一人后须轮换；仅当该班次无其他可排人选时允许连任保运转',
```
「疲劳与高强度怎么累计」items（现 1077-1080）加：
```js
      '月疲劳积分 = 该班次所在自然月（YYYY-MM，非滚动窗口）已排班次的劳累指数之和，超过个人「月疲劳上限」即超限——月初/月末相邻两天分属两月，会有月底卡死、月初重置的边界表现',
      '连任按"期"计：同一任务在有排班的自然周里连续排到同一人的期数；任务某周没排（空窗）不算中断，换人接手才清零',
```

- [ ] **Step 4: 手测**：设置页见新组与两行，填值保存、恢复默认正确；「系统怎么算」文案在。

- [ ] **Step 5: Commit**
```bash
git add src/views/config.js
git commit -m "[系统设置] 新增「排班轮换」组(tenureLimit) + 新建默认组加月疲劳上限 + 规则人话同步"
```

---

### Task 10: Excel 人员列——月疲劳上限

**Files:**
- Modify: `src/ui/excel.js`（STAFF_BASE_COLS、STAFF_SAMPLE、exportStaffs、importStaffs 字段解析）

**Interfaces:**
- Consumes: `DEFAULT_SETTINGS`/`monthlyFatigueLimitOf`（model）；导入空串 → `settings.defaultMonthlyFatigue`（isFinite 判空，禁 `||`）

- [ ] **Step 1: 模板列**（STAFF_BASE_COLS，`'高强度次数上限(选填)'` 后加）
```js
  '月疲劳上限(选填)',
```
- [ ] **Step 2: 示例行**（STAFF_SAMPLE，在 `'2'` 与 `'组长;值班'` 之间插 `'40'`）
```js
const STAFF_SAMPLE = ['【示例】张三', '新入', 'P101;P102', 'P101(体力好,搬运熟练);P102(力气大)', 'P103(腰伤,不搬重物)', '10', '2', '40', '组长;值班'];
```
- [ ] **Step 3: 导出**（exportStaffs 行数组 140：`s.maxWeeklyFatigue, s.maxHeavyTaskCount,` 之后加）
```js
    monthlyFatigueLimitOf(s, DEFAULT_SETTINGS),
```
  （导出统一给生效上限；若 excel 无 settings 对象则用 DEFAULT——显式配置者可 import 更精确，可简化取 `monthlyFatigueLimitOf(s, {})` 亦显式优先。取 `monthlyFatigueLimitOf(s, DEFAULT_SETTINGS)` 即可。）
- [ ] **Step 4: 导入**（importStaffs fields ~239-248，`maxHeavyTaskCount` 行后加；其 `const monthlyN = Number(r['月疲劳上限(选填)']);` 计算行加在上方 weeklyN 附近）
```js
      const monthlyN = Number(r['月疲劳上限(选填)']);
```
```js
        maxMonthlyFatigue: Number.isFinite(monthlyN) ? monthlyN : settings.defaultMonthlyFatigue,
```
- [ ] **Step 5: import**：excel.js model import 若缺 `monthlyFatigueLimitOf`/`DEFAULT_SETTINGS` 则补。
- [ ] **Step 6: 手测**：导出人员表含新列；导入空该列 → 取当前默认；模板示例行带 `40`。
- [ ] **Step 7: Commit**
```bash
git add src/ui/excel.js
git commit -m "[Excel] 人员列加月疲劳上限（模板/示例/导出/导入缺省回落默认）"
```

---

### Task 11: 收口——全量测试 + 冒烟 + 知识库同步 + 批次提交

**Files:**
- Run: `npm test`（须全绿，130+新增全过）
- Modify: `.ai/spec.md`、`docs/score-rules.md`、`.ai/memory.md`、`.ai/project_map.md`、`.ai/pitfalls.md`

- [ ] **Step 1: 全量单测**：`npm test` → 全绿；若回归先修（重点：filter.test 旧 9 类规则不破、auto 既有先到先得序不变）。
- [ ] **Step 2: Playwright/自查冒烟**（跨组件联调，值得实测）：造 A/B 双人会 P1 + tenureLimit=1，逐场景走：分配弹窗豁免上浮、替换弹窗自动豁免、智能排班预览（结果含豁免）、拖拽仍拦连任（非豁免单点）、月 chip 红/黄、批量删除对 tenure 计数回退无报错。
- [ ] **Step 3: 知识库同步**
  - `.ai/spec.md`：§3.2 Staff 表加 `maxMonthlyFatigue` 行；§4.2 硬性过滤加第 8 条（月上限，自然月口径+文案三分）与第 9 条（连任，全局 `tenureLimit`、0=关闭、豁免语义、ctx 两表）；§5.2 月粒度 chip 红黄改绑月上限（原"不套周上限红黄"表述更新）+ hover 上限；§6 参数表加 `defaultMonthlyFatigue`/`tenureLimit` 两行；§3.2 存量未配置跟随默认的表述。
  - `docs/score-rules.md`：人话补月上限与连任（口径/豁免，措辞同 config RULE_SECS）。
  - `.ai/memory.md`：当前状态加本批次实现完成待提交；核心决策补月上限/连任语义定稿。
  - `.ai/project_map.md`：`core/tenure.js` 一行（含 tenure.js 职责）+ substitute buildContext 描述补两表。
  - `.ai/pitfalls.md`：若冒烟撞坑（如 ctx 缺表静默失效/豁免漏入口）按现有体例补条。
- [ ] **Step 4: 批次提交**（含本 design doc `docs/superpowers/specs/2026-09-07-month-limit-tenure-design.md`——Tao 已确认随实现批次一起 commit）：
```bash
git add -A
git commit -m "[系统设置/轮换与月上限] 09-07 批次：月疲劳上限 + 同任务连任上限（详见 design doc）"
```
  若 Tao 希望与仍在工作区的加分标签批次分开，本批次只 add 上述改动文件，分开提交。
