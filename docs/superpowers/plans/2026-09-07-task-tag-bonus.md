# 任务加分标签 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 任务可从全库已有人员标签池中挑选「加分标签」，凡带命中标签的人员按命中标签数累加打分（每命中一个 +`tagBonus`），并贯通配置卡片、推荐理由副行与任务 Excel。

**Architecture:** 纯加分、不碰硬性过滤。数据落点 = `Project.bonusTags`（文本数组）+ 系统设置 `tagBonus`；打分在 `scoreCandidate`（score.js）按 `staff.tags ∩ project.bonusTags` 逐标签 push `标签加分` breakdown；人话理由在 `narrateReasons`（substitute.js）把多个命中标签合并成一行。`tagsInput` 增加 `allowCreate:false` 只选不建模式，供任务编辑弹窗使用。

**Tech Stack:** 无框架原生 ES Modules；node:test 单测（core/ 纯函数）；localStorage；SheetJS 任务 Excel。

## Global Constraints

- 触发语义：每命中一个加分标签加一次分（交集 K 个 → K×tagBonus），多个标签累加。
- 分值：独立系统设置参数 `tagBonus`（默认 15，min 1），不复用 `preferredBonus`。
- 来源：任务加分标签**只选已有人员标签池**、禁止回车自创（`tagsInput({ allowCreate:false })`）。
- Excel：任务模板/导出/导入加「加分标签(选填;分号隔开,可多个)」列，位于 `任务说明(选填)` 与 `启用(选填…)` 之间；导入只保留「导入时全库人员标签池」中的文本，其余丢弃并在消息里报丢弃数。人员 Excel 不动。
- 可见：任务配置卡片始终显示「加分标签」行（空显 `—`）；分配/替换弹窗推荐理由副行展示命中标签。不加任务视图/说明导出图。
- 理由排布：擅长命中与标签命中并存时由调用方既有 `join('；')` 一行拼接；标签理由本身多条合并为 `带标签「A、B」，适合本项目`。
- 状态：`new` 状态命中标签照常加分（仅均衡恒 0）。
- 消费端逐键兜底 `ctx.settings?.tagBonus ?? DEFAULT_SETTINGS.tagBonus`（防 pitfalls #28 NaN）。
- `project.bonusTags ?? []` / `staff.tags ?? []` 全程防御（旧数据可能缺字段）。
- **提交纪律**：工作树当前含 09-07 批次 1-3 未提交改动（src/ui/modal.js、theme.js、views/calendar.js、.ai/* 均已脏）。每步 `git add` 只能加**本任务列出的文件**，禁止 `git add -A` / `.`。本功能不碰上述脏文件；.ai 知识库与 design/plan 文档的提交由 Tao 收口决定，见「收尾」节。
- 测试命令：单文件 `node --test test/<file>.test.js`；全量 `npm test`。

---

### Task 1: model 层加 `Project.bonusTags` 默认值 + 系统设置 `tagBonus` 默认值

**Files:**
- Modify: `src/data/model.js`（`DEFAULT_SETTINGS` 第 5-8 行区域；`createProject` 第 10-22 行）
- Test: `test/model.test.js`（文件末尾追加）

**Interfaces:**
- Produces: `createProject({ bonusTags })` → 对象含 `bonusTags: []` 默认；`DEFAULT_SETTINGS.tagBonus === 15`。
- Consumes: 无。

- [ ] **Step 1: 写失败测试**（`test/model.test.js` 末尾追加）

```js
test('createProject 默认 bonusTags 为空数组', () => {
  const p = createProject({ name: 'X' });
  assert.deepEqual(p.bonusTags, []);
});

test('createProject 保留传入 bonusTags', () => {
  const p = createProject({ name: 'X', bonusTags: ['组长'] });
  assert.deepEqual(p.bonusTags, ['组长']);
});

test('DEFAULT_SETTINGS 含 tagBonus 默认 15', () => {
  assert.equal(DEFAULT_SETTINGS.tagBonus, 15);
});
```

确认文件顶部已 `import { createProject, DEFAULT_SETTINGS } from '../src/data/model.js';`（若缺少补 import；`assert`/`test` 按该文件既有顶部引入方式，通常 `import test from 'node:test'; import assert from 'node:assert/strict';`）。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/model.test.js`
Expected: 三个用例 FAIL（`p.bonusTags` undefined / `DEFAULT_SETTINGS.tagBonus` undefined）。

- [ ] **Step 3: 实现**

在 `src/data/model.js` 的 `DEFAULT_SETTINGS` 中 `preferredBonus: 15` 后加一项：

```js
export const DEFAULT_SETTINGS = {
  dailyTaskLimit: 2, slotTaskLimit: 1, warnDailyCount: 1, preferredBonus: 15, tagBonus: 15, balanceFactor: 5,
  balanceWindowDays: 30, defaultWeeklyFatigue: 10, defaultHeavyTaskCount: 2,
};
```

在 `createProject` 返回值 `timeRange: fields.timeRange ?? null,` 之后加一行：

```js
    bonusTags: fields.bonusTags ?? [],   // 加分标签（引用人员标签池文本，命中即加分）
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/model.test.js`
Expected: 三个新用例 + 既有用例全 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/data/model.js test/model.test.js
git commit -m "feat(model): Project.bonusTags 字段与 tagBonus 设置默认值"
```

---

### Task 2: score 层加分标签打分

**Files:**
- Modify: `src/core/score.js:10-33`（`scoreCandidate`）
- Test: `test/score.test.js`（末尾追加）

**Interfaces:**
- Consumes: Task 1 的 `Project.bonusTags`、`DEFAULT_SETTINGS.tagBonus`。
- Produces: `scoreCandidate` 返回 breakdown 含多个 `{ label:'标签加分', points:tagBonus, reason:'<标签名>' }` 条目（每命中一个标签一条）；无命中不产生该 label。签名不变。

- [ ] **Step 1: 写失败测试**（`test/score.test.js` 末尾追加）

```js
test('标签加分：命中 1 个加分标签 +tagBonus', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '张三', tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  const tags = r.breakdown.filter(b => b.label === '标签加分');
  assert.equal(tags.length, 1);
  assert.equal(tags[0].points, 15);
  assert.equal(tags[0].reason, '组长');
});

test('标签加分：命中多个标签累加（每命中一个加一次）', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长', '值班'] });
  const s = createStaff({ id: 'S1', name: '张三', tags: ['组长', '值班'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  const tags = r.breakdown.filter(b => b.label === '标签加分');
  assert.equal(tags.length, 2);
  assert.equal(r.score, 30);
});

test('标签加分：擅长与标签同时命中，两项都加', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '张三', preferredProjects: [{ projectId: 'PT', reason: '熟手' }], tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  const labels = r.breakdown.map(b => b.label);
  assert.ok(labels.includes('擅长加分') && labels.includes('标签加分'));
  assert.equal(r.score, 30);
});

test('标签加分：new 状态命中照常加分', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '新人', status: 'new', tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  const tags = r.breakdown.filter(b => b.label === '标签加分');
  assert.equal(tags.length, 1);
  assert.ok(r.score >= 15);
});

test('标签加分：无命中不产生该 label', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '张三', tags: ['搬运'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  assert.ok(!r.breakdown.some(b => b.label === '标签加分'));
});

test('标签加分：project 无 bonusTags 字段（旧数据/裸对象）不崩、不命中', () => {
  const s = createStaff({ id: 'S1', name: '张三', tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: { id: 'PT', name: '值班' } }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0 });
  assert.ok(!r.breakdown.some(b => b.label === '标签加分'));
});

test('标签加分：settings 部分缺 tagBonus → 兜底默认 15（防 #28）', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '张三', tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0, settings: { preferredBonus: 20 } });
  const tags = r.breakdown.filter(b => b.label === '标签加分');
  assert.equal(tags[0].points, 15);
});

test('标签加分：读取 settings.tagBonus（默认 15 可配）', () => {
  const P = createProject({ id: 'PT', name: '值班', bonusTags: ['组长'] });
  const s = createStaff({ id: 'S1', name: '张三', tags: ['组长'] });
  const r = scoreCandidate(s, { date: '2026-08-24', projectId: 'PT', slotLabel: '早' }, { PT: P }, { fatigueWindow: new Map([['S1', 0]]), teamAvg: 0, settings: { tagBonus: 25 } });
  const tags = r.breakdown.filter(b => b.label === '标签加分');
  assert.equal(tags[0].points, 25);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/score.test.js`
Expected: 新增用例 FAIL（无「标签加分」breakdown）。

- [ ] **Step 3: 实现**（`src/core/score.js` `scoreCandidate`，在「擅长加分」块之后、「均衡加分」块之前插入）

```js
  // 标签加分：任务加分标签 ∩ 人员标签，每命中一个标签加 tagBonus（可多个累加；纯加分，不进硬性过滤）
  const tagBonus = ctx.settings?.tagBonus ?? DEFAULT_SETTINGS.tagBonus;
  const bonusTags = projectById?.[schedule.projectId]?.bonusTags ?? [];
  if (bonusTags.length) {
    for (const t of staff.tags ?? []) {
      if (bonusTags.includes(t)) {
        breakdown.push({ label: '标签加分', points: tagBonus, reason: t });
      }
    }
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/score.test.js`
Expected: 新增 8 用例 + 既有用例全 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/core/score.js test/score.test.js
git commit -m "feat(score): 任务加分标签打分（标签交集逐项累加）"
```

---

### Task 3: substitute 层人话理由合并标签命中

**Files:**
- Modify: `src/core/substitute.js:57-73`（`narrateReasons`）
- Test: `test/substitute.test.js`（末尾追加，复用顶部既有夹具或自建）

**Interfaces:**
- Consumes: Task 2 产生的 `{ label:'标签加分', reason:'<标签名>' }` 条目。
- Produces: `narrateReasons` 返回值（String[]）多标签合并为一行 `带标签「A、B」，适合本项目`；单标签 `带标签「A」，适合本项目`。位置在「擅长」行后、「均衡」驱动句前。

- [ ] **Step 1: 写失败测试**（`test/substitute.test.js` 末尾追加）

```js
test('narrateReasons: 多个标签命中合并为一行「带标签…」', () => {
  const staff = { id: 'S9', status: 'active' };
  const lines = narrateReasons(staff, schNarrate, P101Narrate, [
    { label: '标签加分', points: 15, reason: '组长' },
    { label: '标签加分', points: 15, reason: '值班' },
    { label: '均衡加分', points: 0, reason: '旧黑话' },
  ], { fatigueWindow: new Map([['S9', 5]]), teamAvg: 5 });
  assert.deepEqual(lines, ['带标签「组长、值班」，适合本项目']);
});

test('narrateReasons: 擅长 + 单标签命中 → 一行拼接（擅长在前、标签在中、均衡句在后）', () => {
  const staff = { id: 'S9', status: 'active' };
  const lines = narrateReasons(staff, schNarrate, P101Narrate, [
    { label: '擅长加分', points: 15, reason: '体力好' },
    { label: '标签加分', points: 15, reason: '组长' },
    { label: '均衡加分', points: 25, reason: '旧黑话' },
  ], { fatigueWindow: new Map([['S9', 0]]), teamAvg: 5 });
  assert.deepEqual(lines, ['擅长搬运：体力好', '带标签「组长」，适合本项目', '近 30 天排班较少，建议优先']);
});

test('narrateReasons: 标签命中 reason 为空不产生「带标签」空行', () => {
  const staff = { id: 'S9', status: 'active' };
  const lines = narrateReasons(staff, schNarrate, P101Narrate,
    [{ label: '标签加分', points: 15, reason: '' }, { label: '均衡加分', points: 0, reason: '旧黑话' }],
    { fatigueWindow: new Map([['S9', 5]]), teamAvg: 5 });
  assert.deepEqual(lines, []);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/substitute.test.js`
Expected: 三个新用例 FAIL（现循环把 `标签加分` 当非均衡项 `continue`，不产生任何行）。

- [ ] **Step 3: 实现**——整段替换 `src/core/substitute.js` 的 `narrateReasons` 函数体（58-73 行区域，保留函数签名与上方注释），改为「先收集命中标签、遇均衡加分时 flush」的保序写法：

```js
export function narrateReasons(staff, schedule, projectById, breakdown, ctx) {
  const windowDays = ctx.settings?.balanceWindowDays ?? DEFAULT_SETTINGS.balanceWindowDays;
  const lines = [];
  let hitTags = [];
  const flushTags = () => {
    if (hitTags.length) {
      lines.push(`带标签「${hitTags.join('、')}」，适合本项目`);
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/substitute.test.js`
Expected: 新增 3 用例 + 既有 14 用例全 PASS（既有「新入不产生均衡驱动句」等不受影响——new 无标签时 flushTags 空操作）。

- [ ] **Step 5: Commit**

```bash
git add src/core/substitute.js test/substitute.test.js
git commit -m "feat(substitute): 人话理由合并命中标签为一行「带标签…」"
```

---

### Task 4: `tagsInput` 增加「只选不建」模式（`allowCreate:false`）

**Files:**
- Modify: `src/ui/fields.js:37-210`（`tagsInput`）

**Interfaces:**
- Consumes: 无（纯 DOM 组件）。
- Produces: `tagsInput({ initial, options, allowCreate = true, placeholder })`——`allowCreate:false` 时输入无匹配候选**回车不自创**、`暂无可选` 空态不显示「回车创建新标签」hint。默认 `true` 保持人员编辑现状。
- Consumes by: Task 5（任务编辑弹窗）、不回归人员编辑弹窗（不传该参 = 默认 true）。

- [ ] **Step 1: 无 node 单测（DOM 组件）**——手改实现；浏览器烟测见 Task 5/7。

- [ ] **Step 2: 实现**，四处小改：

(a) 函数签名加参数（37 行）：

```js
export function tagsInput({ initial = [], options = [], allowCreate = true, placeholder = '输入后回车添加' } = {}) {
```

(b) `renderPanel` 空态分支：把「回车创建新标签」hint 包在 `allowCreate` 守卫内（130-135 行区域）：

```js
    if (q && allowCreate && !pool.some(t => !chips.has(t) && t.toLowerCase().includes(q))) {
      const hint = document.createElement('div');
      hint.className = 'tag-pick-hint';
      hint.textContent = `回车创建新标签「${query}」`;
      panel.appendChild(hint);
    }
```

(c) 输入框 keydown 的 Enter 无匹配自创分支（174-190 行区域）——`if (q)` 拆成：有候选高亮仍选择；否则仅当 `allowCreate` 才 `addText(q)`：

```js
      if (q) {
        if (!allowCreate) return; // 只选模式：无可选候选时回车不创建新标签
        addText(q);
        input.value = '';
        query = '';
        if (open) renderPanel();
        return;
      }
```

（保留原有的 `if (open && view.length && activeIndex >= 0) { chooseOpt(view[activeIndex]); return; }` 在 `if (q)` 之前，键盘/悬停选择不受影响。）

(d) `openPanel` 与 `input` 的 `click`/`focus` 逻辑不变——池为空时 `openPanel` 早已 `if (!pool.length || open) return` 直接返回，天然符合「无可选项不弹面板」。

- [ ] **Step 3: 手验**——暂不打开浏览器，靠 Task 5 实测 `allowCreate:false` 行为（回车不自创、点选可加）。

- [ ] **Step 4: Commit**

```bash
git add src/ui/fields.js
git commit -m "feat(fields): tagsInput 支持 allowCreate:false 只选不建模式"
```

---

### Task 5: config 层——任务编辑弹窗加分标签字段 + 任务卡片行

**Files:**
- Modify: `src/views/config.js`
  - `editProjectDialog`：~795 行起；取 staffs 计算标签池、插入 tagsInput 字段、保存时带 `bonusTags`。
  - `renderProjects`：~644-666 行卡片 rows 加「加分标签」行。
- Depends on: Task 4（`tagsInput allowCreate:false`）。

**Interfaces:**
- Consumes: `tagsInput({ initial, options, allowCreate })`（Task 4）；`staffs` 经 `getCache()`。
- Produces: 任务对象保存后含 `bonusTags: String[]`；卡片空显 `—`。

- [ ] **Step 1: 任务编辑弹窗加字段**（`editProjectDialog`）

(a) 函数体顶部（`const { projects } = getCache();` 之前）确保能取到 staffs——现状该函数**未取 staffs**，改为取：

找到 `async function editProjectDialog(project) {`（795 行）函数体内（如 799 行 `const nameInput...` 之前）加入：

```js
  const { staffs } = getCache();
  const tagPool = [...new Set(staffs.flatMap(s => s.tags ?? []))].sort((a, b) => a.localeCompare(b, 'zh'));
```

(b) 构造控件 + field，插到 `descF.wrap` 之前。定位 `const descF = field({ label: '任务说明', ... })`（891-896 行）之后、`body.append`（903 行）之前加：

```js
  const bonusTagsCtrl = tagsInput({
    initial: target.bonusTags ?? [],
    options: tagPool,
    allowCreate: false,
    placeholder: tagPool.length ? '点击选择已有标签（可多个）' : '暂无可选人员标签',
  });
  const bonusTagsF = field({
    label: '加分标签（命中即加分）',
    control: bonusTagsCtrl,
    hint: tagPool.length
      ? '从人员已有标签中选择；带这些标签的人员排此任务时每个标签加分（分值见「系统设置」）'
      : '先在「人员管理」给人员添加标签，才可在此选择',
  });
```

(c) `body.append` 行（903 行）在 `timeF.wrap` 后、`descF.wrap` 前插入 `bonusTagsF.wrap`：

```js
  body.append(nameF.wrap, activeF.wrap, fatigueCapRow, daysF.wrap, slotsF.wrap, timeF.wrap, bonusTagsF.wrap, descF.wrap);
```

(d) 保存处 `createProject`（921-931 行）加 `bonusTags`：

```js
      timeRange: start && end ? { start, end } : null,
      description: descInput.value.trim(),
      bonusTags: bonusTagsCtrl.value,
```

（该弹窗顶部 import 已含 `tagsInput`（config.js:3）与 `field`；无需新增 import。）

- [ ] **Step 2: 任务卡片加「加分标签」行**（`renderProjects`）

(a) 卡片 rows（660-666 行）——在「时段」行 `<div class="cfg-row"><span class="k">时段</span>...` 之后插入一行：

```js
        <div class="cfg-row"><span class="k">加分标签</span><span class="v">${(p.bonusTags ?? []).length ? p.bonusTags.map(t => `<span class="tag">${esc(t)}</span>`).join('') : '<span class="empty">—</span>'}</span></div>
```

（`esc` 为该模块既有转义函数；卡片渲染 `foldTags`/`observeGridFold` 已对该 `.v` 内 tag chip 生效，无需额外处理。）

- [ ] **Step 3: 浏览器烟测**——启动 dev server 逐项验证（Playwright 或手测）：
  1. 给某人员加标签（如「组长」）→ 保存。
  2. 新增任务，加分标签字段：聚焦浮出候选含「组长」；**点选可加** chip；手动输入不存在的词 + 回车**不创建**、无「回车创建」hint。
  3. 保存任务 → 任务卡片出现「加分标签 组长」行；未配的任务显示 `加分标签 —`。
  4. 重开该任务编辑弹窗 → 已选标签回填。
  5. 人员编辑弹窗标签仍可回车自创（`allowCreate` 默认 true 未回归）。

- [ ] **Step 4: Commit**

```bash
git add src/views/config.js
git commit -m "feat(config): 任务编辑加分标签字段 + 卡片加分标签行"
```

---

### Task 6: config 层——系统设置「标签加分」参数 + 规则区文案

**Files:**
- Modify: `src/views/config.js`（`SET_GROUPS` ~991-1026；`RULE_SECS` 推荐打分节 ~1040-1049；`renderSettings` 保存逻辑自动覆盖新增 key——因 `SET_GROUPS` 驱动循环已通用，无需额外改）。

**Interfaces:**
- Consumes: `DEFAULT_SETTINGS.tagBonus`（Task 1）；`getSettings`/`saveSettings` merge 层自动带新键。
- Produces: 系统设置「推荐打分」组新增可调参数「标签加分」（默认 15）；规则公式含标签加分。

- [ ] **Step 1: 加参数行**——`SET_GROUPS` 里「推荐打分」组（1004-1015 行）items，插在 `preferredBonus` 之后：

```js
      { key: 'tagBonus', name: '标签加分', min: 1,
        hint: '命中任务加分标签时每个标签加的分（命中多个标签累加）。加分标签在任务编辑弹窗维护，只能选人员已有标签。分值越大越优先用带标签的人。' },
```

- [ ] **Step 2: 规则公式与说明更新**——`RULE_SECS` 「推荐给谁：打分排序」（1040-1049 行）：

formula 改为：

```js
    formula: '总分 = 擅长加分 + 标签加分 + (团队窗口平均 − 本人窗口疲劳) × 均衡系数',
```

items 数组（`低于平均得正分…` 前）插一条：

```js
      '任务配了加分标签时，凡带命中标签的人员每个标签各加分（可多个累加）；加分标签取自全库人员已有标签',
```

- [ ] **Step 3: 浏览器烟测**——「数据配置 → 系统设置」：看到「标签加分」参数行默认 15；改动保存后打分变化（配合 Task 5 造一个带标签人员 + 配加分标签任务，分配弹窗里该人分数比无标签者高）；恢复默认回填 15。

- [ ] **Step 4: Commit**

```bash
git add src/views/config.js
git commit -m "feat(config): 系统设置新增标签加分参数 + 规则文案"
```

---

### Task 7: Excel 任务模板/导出/导入加「加分标签」列

**Files:**
- Modify: `src/ui/excel.js`
  - `PROJECT_BASE_COLS`（6-16 行）
  - `PROJECT_SAMPLE`（31 行）
  - `exportProjects`（114-129 行）
  - `importProjects`（176-210 行）

**Interfaces:**
- Consumes: `getCache().staffs`（人员标签池）、`parseTags`（已 import excel.js:2）。
- Produces: 模板/导出列 `加分标签(选填;分号隔开,可多个)` 位于 `任务说明(选填)` 与 `启用(选填…)` 之间；导入字段 `bonusTags` 仅含池内标签。

- [ ] **Step 1: 列定义 + 示例行**

`PROJECT_BASE_COLS`（6-16 行）在 `'任务说明(选填)',` 与 `'启用(选填;1=启用,0=禁用,默认1)',` 之间插入：

```js
  '加分标签(选填;分号隔开,可多个)',
```

`PROJECT_SAMPLE`（31 行）同步补一列（description 之后、active 之前），值参考既有人员示例的标签风格：

```js
const PROJECT_SAMPLE = ['【示例】场地搬运', '3', '2', '7;1', '早;中', '08:00', '18:00', '搬运物资到三楼，注意轻拿轻放', '组长', '1'];
```

- [ ] **Step 2: 导出**——`exportProjects` 每行数组（116-123 行）在 `active` 值前插 `(p.bonusTags ?? []).join(';')`：

```js
    p.description ?? '',
    (p.bonusTags ?? []).join(';'),
    p.active === false ? 0 : 1,
```

- [ ] **Step 3: 导入**——`importProjects`：

(a) 取 staffs 建标签池（181 行 `const { projects } = getCache();` 改为）：

```js
    const { projects, staffs } = getCache();
    const tagPool = new Set(staffs.flatMap(s => s.tags ?? []));
```

(b) 声明丢弃计数（184 行 `let added = 0, updated = 0, skipped = 0;` 加）：

```js
    let added = 0, updated = 0, skipped = 0, droppedTags = 0;
```

(c) `fields` 对象（189-198 行）加 `bonusTags` 解析（description 之后）：

```js
        bonusTags: parseTags(r['加分标签(选填;分号隔开,可多个)']).filter(t => {
          const known = tagPool.has(t);
          if (!known) droppedTags++;
          return known;
        }),
```

(d) 返回消息（206 行）在结尾追加丢弃提示：

```js
    return { ok: true, message: `导入 ${added + updated} 个任务${skipped ? `（跳过 ${skipped} 条空名称）` : ''}：新增 ${added}、更新 ${updated}${droppedTags ? `，丢弃 ${droppedTags} 个不存在的加分标签` : ''}` };
```

- [ ] **Step 4: 浏览器烟测**
  1. 下载任务模板：表头含「加分标签」列、示例行带该值。
  2. 导出现有任务：有 `bonusTags` 的任务列有分号分隔文本，无的在列内空。
  3. 构造一列含「已存在标签 + 不存在标签（如 组长;不存在甲）」的任务表导入：导入成功；消息提示「丢弃 1 个不存在的加分标签」；该任务 `bonusTags` 只含「组长」。

- [ ] **Step 5: Commit**

```bash
git add src/ui/excel.js
git commit -m "feat(excel): 任务模板/导出/导入支持加分标签列（导入仅留已知标签）"
```

---

### Task 8: 回归与收尾

**Files:**（只读验证；不新增代码）
- Read-only: `src/core/substitute.js`、`src/views/calendar.js`（候选行/替换弹窗副行消费 `narrateReasons` 处）、`src/core/auto.js`（simulateAutoFill 经 `scoreCandidate`）。

**Interfaces:** 无新产出。确认「分配弹窗候选行副行」「替换弹窗候选卡副行」不经改动即自动显示标签命中理由（两者已消费 `narrateReasons`），智能排班预览自动含标签加分。

- [ ] **Step 1: 确认消费端自动生效（无需改代码）**
  - calendar.js `scheduleDialog` 候选行：`const reco = narrateReasons(...)` + `reco.join('；')`（已核实 calendar.js ~846-852）。
  - 替换弹窗 `recommendSubstitutes` 已返回 `reasons`（substitute.js:94）。
  - `auto.js` `simulateAutoFill` 调 `scoreCandidate`（auto.js:46）。
  - 结论：`narrateReasons` 增加 `标签加分` 分支后，上述入口自动带出，本功能无需触碰这些文件。用 Playwright 冒烟：分配弹窗候选副行出现「带标签「…」」、替换弹窗候选卡理由含该句。

- [ ] **Step 2: 全量单测**

Run: `npm test`
Expected: 全部 PASS（含既有 ~117 + 本功能新增）。若某既有用例因 narrateReasons 结构变化失败，检查是否属合理回归——本计划新增夹具未改既有夹具，预期不回归。

- [ ] **Step 3: 知识库同步（暂不自动 commit，供 Tao 收口）**

更新 `.ai/spec.md`（§3.1 Project 字段表加 `bonusTags`；§4.3 打分公式含标签加分；§5.1 任务编辑/卡片/系统设置；§5.5 Excel 列；§6 参数表加 `tagBonus`）、`.ai/memory.md`（核心决策 + 本功能待办）、`.ai/project_map.md`（如需）、`.ai/pitfalls.md`（如需）。此同步在 Tao 决定提交策略后并入（见 Global Constraints 提交纪律）。

- [ ] **Step 4: 提交策略交 Tao 决定**

本计划各任务已分步提交代码。design/plan 文档（`docs/superpowers/specs/2026-09-07-task-tag-bonus-design.md`、`docs/superpowers/plans/2026-09-07-task-tag-bonus.md`）与 `.ai/*` 知识库暂**未提交**——因工作树含 09-07 批次 1-3 未提交改动，由 Tao 决定一次性 `/commit` 归并或先提交旧批次再单独收口。
