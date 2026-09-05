# 批量铺排弹窗改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 批量铺排从「向后铺 N 周」改为「铺满当前浏览范围（周=当前浏览周 / 月=浏览月覆盖自然周）」，弹窗升级为「预览 + 确认」单层确认，预览逻辑抽成 core 纯函数。

**Architecture:** 新增 core 纯函数 `previewExpand`（无 DOM、可单测）产出将新建/已存在跳过计数；`calendar.js` 重写 `bulkPlanDialog` 只做范围推导 + 渲染预览 + 收口执行；`theme.js` 补 `.bulk-*` 样式段。

**Tech Stack:** 原生 ES Modules；node:test 单测；无新依赖。

## Global Constraints

- 本批次**不做中间提交**（项目惯例 = Tao 拍板单批提交）。任务全部完成后，由 commit 技能统一提交（含本计划同批的设计文档 `docs/superpowers/specs/2026-09-05-bulk-plan-dialog-design.md`）。
- 文案全部简体中文；不用「本周/本月」指代浏览范围——统一「当前周/月」语义 + 精确日期范围。
- 无新增 localStorage key；不改 build.js、不产 dist。
- core/ 为纯函数（无 DOM/浏览器 API）；视图层不写算法。
- 月粒度「覆盖自然周集合」唯一来源 = `weeksCovering(monthAnchor)`（`src/core/week.js:68`），预览与执行共用同一数组。

---

### Task 1: core 纯函数 `previewExpand` + 单测

**Files:**
- Modify: `src/core/expand.js`（追加导出）
- Create: `test/expand.preview.test.js`

**Interfaces:**
- Consumes: `expandProjectForWeek(project, weekStartStr)`（已在 `expand.js`，返回 `{date, projectId, slotLabel}[]`；内部已拦停用/一次性任务）
- Produces: `previewExpand(projects, weekStarts, existingKeySet) → { totalNew, totalSkip, perTask: [{projectId, weekDays, created, skipped}] }`
  - `existingKeySet`: `Set<string>`，元素 = `${date}|${projectId}|${slotLabel}`
  - `perTask` 只含 created/skipped 至少一个 > 0 的任务

- [ ] **Step 1: 追加核心实现到 `src/core/expand.js` 末尾**

```js
// 批量铺排预览：统计在 weekStarts 覆盖范围内各任务将新建/已存在跳过的班次数（纯函数，不写库）
export function previewExpand(projects, weekStarts, existingKeySet) {
  let totalNew = 0;
  let totalSkip = 0;
  const perTask = [];
  for (const p of projects) {
    let created = 0;
    let skipped = 0;
    for (const ws of weekStarts) {
      for (const row of expandProjectForWeek(p, ws)) {
        if (existingKeySet.has(`${row.date}|${row.projectId}|${row.slotLabel}`)) skipped += 1;
        else created += 1;
      }
    }
    if (created > 0 || skipped > 0) {
      perTask.push({ projectId: p.id, weekDays: p.weekDays, created, skipped });
      totalNew += created;
      totalSkip += skipped;
    }
  }
  return { totalNew, totalSkip, perTask };
}
```

- [ ] **Step 2: 新增测试文件 `test/expand.preview.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { expandWeeks, previewExpand } from '../src/core/expand.js';
import { createProject, createSchedule } from '../src/data/model.js';
import { weeksCovering } from '../src/core/week.js';

const key = s => `${s.date}|${s.projectId}|${s.slotLabel}`;

test('previewExpand: 无已存在 → totalNew 等于 expandWeeks 行数、perTask 覆盖各任务', () => {
  const p1 = createProject({ name: '浇花', weekDays: [1, 3, 5], slots: [{ label: '自主安排' }] });
  const p2 = createProject({ name: '做饭', weekDays: [0], slots: [{ label: '早' }, { label: '晚' }] });
  const weekStarts = ['2026-08-24', '2026-08-31'];
  const rows = expandWeeks([p1, p2], weekStarts[0], weekStarts.length, createSchedule);
  const pv = previewExpand([p1, p2], weekStarts, new Set());
  assert.equal(pv.totalNew, rows.length);
  assert.equal(pv.totalSkip, 0);
  assert.equal(pv.perTask.length, 2);
  const byId = Object.fromEntries(pv.perTask.map(t => [t.projectId, t]));
  assert.equal(byId[p1.id].created, 6); // 一/三/五 × 2 周
  assert.equal(byId[p2.id].created, 4); // 周日 × 2 时段 × 2 周
});

test('previewExpand: 部分已存在 → created/skipped 按 key 去重正确', () => {
  const p = createProject({ name: '浇花', weekDays: [1, 3, 5], slots: [{ label: '自主安排' }] });
  const weekStarts = ['2026-08-24'];
  const rows = expandWeeks([p], weekStarts[0], 1, createSchedule); // 一/三/五 → 3 行
  const existing = new Set(rows.slice(0, 2).map(key)); // 前 2 条视为已存在
  const pv = previewExpand([p], weekStarts, existing);
  assert.equal(pv.totalNew, 1);
  assert.equal(pv.totalSkip, 2);
  assert.equal(pv.perTask.length, 1);
  assert.equal(pv.perTask[0].created, 1);
  assert.equal(pv.perTask[0].skipped, 2);
});

test('previewExpand: 一次性任务与停用任务不进 perTask 且不计', () => {
  const oneOff = createProject({ name: '临时', weekDays: [], slots: [{ label: '早' }] });
  const disabled = createProject({ name: '停用', active: false, weekDays: [1], slots: [{ label: '早' }] });
  const pv = previewExpand([oneOff, disabled], ['2026-08-24'], new Set());
  assert.equal(pv.totalNew, 0);
  assert.equal(pv.totalSkip, 0);
  assert.equal(pv.perTask.length, 0);
});

test('previewExpand: 月覆盖周（跨自然月边界）→ 与 expandWeeks 行数一致', () => {
  const p = createProject({ name: '值班', weekDays: [1, 4], slots: [{ label: '晚' }] });
  const monthStarts = weeksCovering('2026-09');
  assert.ok(monthStarts.length >= 5); // 覆盖整月需 ≥5 个自然周
  const rows = expandWeeks([p], monthStarts[0], monthStarts.length, createSchedule);
  const pv = previewExpand([p], monthStarts, new Set());
  assert.equal(pv.totalNew, rows.length);
  assert.ok(pv.totalNew > 0);
});
```

- [ ] **Step 3: 跑新增测试**

Run: `node --test test/expand.preview.test.js`
Expected: 4 个 test PASS。

- [ ] **Step 4: 跑全量测试确认无回归**

Run: `npm test`
Expected: 现有 + 新增全部 PASS（当前基线 94 测试，新增 4）。

---

### Task 2: theme.js 追加 `.bulk-*` 样式段

**Files:**
- Modify: `src/ui/theme.js`（CSS 模板字符串结尾，锚点 = `.chart-empty` 规则之后、闭合反引号 `585` 之前）

**Interfaces:**
- Consumes: 无（纯 CSS 追加）
- Produces: 类 `.bulk-scope / .bulk-tag / .bulk-range / .bulk-count(.none) / .bulk-list / .bulk-row(.head) / .name / .wd / .cnt / .bulk-empty / .bulk-reason / .bulk-hint`，供 Task 3 弹窗使用

- [ ] **Step 1: 在 CSS 模板串末尾（`.chart-empty` 块与收尾反引号之间）插入**

```css
/* ===== 批量铺排预览 ===== */
.bulk-scope { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:12px; font-size:12px; }
.bulk-tag { background:#efe3f6; color:#5a1d78; border-radius:999px; padding:0 8px; line-height:18px; font-size:11px; font-weight:600; }
.bulk-range { color:#6a6178; }
.bulk-count { display:flex; align-items:center; gap:10px; font-size:13px; padding:8px 10px; background:#f7f1fa; border-radius:8px; margin-bottom:8px; }
.bulk-count b { color:#16a34a; font-size:14px; }
.bulk-count .skip { color:#6a6178; }
.bulk-count.none b { color:#d97706; }
.bulk-list { max-height:260px; overflow-y:auto; border:1px solid #efe8f5; border-radius:8px; margin-bottom:8px; }
.bulk-row { display:grid; grid-template-columns:1fr auto auto; gap:12px; align-items:center; padding:7px 10px; font-size:12px; border-top:1px solid #f5f0f9; }
.bulk-row:first-child { border-top:none; }
.bulk-row .name { font-weight:600; color:#241f2e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bulk-row .wd { color:#9b91a7; font-size:11px; white-space:nowrap; }
.bulk-row .cnt { color:#6a6178; white-space:nowrap; }
.bulk-row .cnt b { color:#16a34a; font-weight:600; }
.bulk-row .cnt .skip { color:#9b91a7; }
.bulk-row.head { font-weight:600; color:#9b91a7; font-size:11px; background:#fcfafd; }
.bulk-empty { border:1px dashed #e0d2ef; border-radius:8px; padding:18px 12px; text-align:center; font-size:12px; color:#9b91a7; margin-bottom:8px; }
.bulk-reason { font-size:12px; color:#d97706; margin:-2px 0 8px; }
.bulk-hint { font-size:11px; color:#9b91a7; line-height:1.5; }
```

- [ ] **Step 2: 无逻辑可单测——留给 Task 4 的浏览器实测核样式类是否生效**

---

### Task 3: 重写 `bulkPlanDialog`（视图层预览 + 确认）

**Files:**
- Modify: `src/views/calendar.js`
  - import 行（第 1 行）：把 `previewExpand` 并入 expand 导入
  - 函数 `bulkPlanDialog`（现约 1035-1080 行）整体替换

**Interfaces:**
- Consumes: `previewExpand`（Task 1）；`weeksCovering/getWeekLabel/getWeekDates`（已 import 于 week.js 第 5 行）；`expandWeeks/createSchedule`（已 import）；`openModal/showToast/saveSchedule/getCache`（已 import）
- Produces: 无（视图收口）。弹窗 = 范围行 + 计数条 + 预览列表/空态 + 原因 + 提示；主按钮「开始铺排」当 `totalNew === 0` 时禁用

- [ ] **Step 1: 修改 import 行**

把 `src/views/calendar.js` 第 1 行：

```js
import { expandWeeks } from '../core/expand.js';
```

改为：

```js
import { expandWeeks, previewExpand } from '../core/expand.js';
```

- [ ] **Step 2: 整体替换 `bulkPlanDialog` 函数**

```js
function bulkPlanDialog() {
  // 范围 = 当前浏览范围（周 = 当前浏览周；月 = 浏览月覆盖的整段自然周，所见即所铺）
  const isMonth = timeScale === 'month';
  const weekStarts = isMonth ? weeksCovering(monthAnchor) : [currentWeekStart];
  let scopeProjects = data.projects;
  if (viewMode === 'project') scopeProjects = data.projects.filter(p => p.id === viewTargetId);
  const key = s => `${s.date}|${s.projectId}|${s.slotLabel}`;
  const preview = previewExpand(scopeProjects, weekStarts, new Set(data.schedules.map(key)));

  const scopeText = viewMode === 'project'
    ? `项目·${data.projects.find(p => p.id === viewTargetId)?.name ?? ''}`
    : '总览';
  const firstEnd = weekStarts.length === 1 ? getWeekLabel(weekStarts[0])
    : `${getWeekDates(weekStarts[0])[0]} ~ ${getWeekDates(weekStarts[weekStarts.length - 1])[6]}`;
  const scopeLine = isMonth
    ? `${monthAnchor}（覆盖 ${firstEnd}）`
    : firstEnd;

  const body = document.createElement('div');

  // 范围行
  const scopeRow = document.createElement('div');
  scopeRow.className = 'bulk-scope';
  const tag = document.createElement('span');
  tag.className = 'bulk-tag';
  tag.textContent = isMonth ? '月粒度' : '周粒度';
  const range = document.createElement('span');
  range.className = 'bulk-range';
  range.textContent = scopeLine;
  const dim = document.createElement('span');
  dim.className = 'bulk-range';
  dim.textContent = scopeText;
  scopeRow.append(tag, range, dim);
  body.appendChild(scopeRow);

  // 计数条
  const count = document.createElement('div');
  count.className = 'bulk-count' + (preview.totalNew === 0 ? ' none' : '');
  const cNew = document.createElement('b');
  cNew.textContent = `将新建 ${preview.totalNew} 个班次`;
  const cSkip = document.createElement('span');
  cSkip.className = 'skip';
  cSkip.textContent = `已存在跳过 ${preview.totalSkip}`;
  count.append(cNew, cSkip);
  body.appendChild(count);

  const wdText = days => [...days].sort((a, b) => a - b).map(d => '日一二三四五六'[d]).join('、');

  if (preview.perTask.length > 0) {
    // 预览明细
    const list = document.createElement('div');
    list.className = 'bulk-list';
    const head = document.createElement('div');
    head.className = 'bulk-row head';
    const hName = document.createElement('span'); hName.textContent = '任务';
    const hCnt = document.createElement('span'); hCnt.className = 'cnt'; hCnt.textContent = '新建/跳过';
    const hWd = document.createElement('span'); hWd.className = 'wd'; hWd.textContent = '重复星期';
    head.append(hName, hCnt, hWd);
    list.appendChild(head);
    for (const t of preview.perTask) {
      const name = data.projects.find(p => p.id === t.projectId)?.name ?? t.projectId;
      const row = document.createElement('div');
      row.className = 'bulk-row';
      const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = name;
      const cnt = document.createElement('span'); cnt.className = 'cnt';
      cnt.innerHTML = `<b>${t.created}</b><span class="skip"> / ${t.skipped}</span>`;
      const wd = document.createElement('span'); wd.className = 'wd';
      wd.textContent = t.weekDays.length ? `每周${wdText(t.weekDays)}` : '一次性';
      row.append(nm, cnt, wd);
      list.appendChild(row);
    }
    body.appendChild(list);
  } else {
    const empty = document.createElement('div');
    empty.className = 'bulk-empty';
    empty.textContent = '该范围无启用中的周期任务（一次性任务请手动建班次）';
    body.appendChild(empty);
  }

  // 禁用原因（仅 when totalNew === 0 且已有说明时）
  const reasonText = preview.totalNew === 0 && preview.perTask.length > 0
    ? '范围内周期班次已全部铺好，无需新建'
    : '';
  if (reasonText) {
    const reason = document.createElement('div');
    reason.className = 'bulk-reason';
    reason.textContent = reasonText;
    body.appendChild(reason);
  }

  const hint = document.createElement('div');
  hint.className = 'bulk-hint';
  hint.textContent = '仅启用中的周期任务会铺排；新建班次为空壳（不分配人员）；已存在的自动跳过。';
  body.appendChild(hint);

  // footer：主按钮「开始铺排」（取消由 openModal 左侧自动补）
  const footer = document.createElement('div');
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'btn btn-primary';
  ok.textContent = '开始铺排';
  ok.disabled = preview.totalNew === 0;
  footer.appendChild(ok);
  const modal = openModal({ title: '批量铺排', body, footer, closeText: '取消' });

  ok.onclick = async () => {
    const existing = new Set(data.schedules.map(key));
    const rows = expandWeeks(scopeProjects, weekStarts[0], weekStarts.length, createSchedule);
    let created = 0;
    for (const sch of rows) {
      if (!existing.has(key(sch))) {
        await saveSchedule(sch);
        created++;
      }
    }
    data = getCache();
    modal.close();
    const skipped = rows.length - created;
    showToast(`已铺排当前${isMonth ? '月' : '周'} · 新建 ${created} · 跳过 ${skipped}`, created ? 'success' : 'info');
    renderCalendar(document.querySelector('#view'));
  };
}
```

- [ ] **Step 3: 自查函数体无语法错**

重点核对：模板串/闭包配对；`weekStarts.length - 1` 取末覆盖周；内联 `innerHTML` 只含整数与写死文本（无外部字符串注入）；`ok.disabled` 在 `totalNew===0` 时禁用。

---

### Task 4: spec.md 语义同步（.ai 规约）

**Files:**
- Modify: `.ai/spec.md`（§4.1 展开 小节、§5.2「批量铺排」条目）

**Interfaces:**
- Consumes: 本批最终行为定稿
- Produces: spec 与行为一致（spec 只反映当前态，无历史区）

- [ ] **Step 1: 改写 §4.1 展开 描述**

把 §4.1 代码块内「选中某周 → 遍历所有 active 项目 × 其 weekDays 命中该周的天」一句，改为覆盖「当前浏览范围」口径（周/月），其余句保留：

```markdown
展开 = 仅「批量铺排」按钮触发（expandWeeks，幂等去重），或手动建班次。
周历渲染不再自动展开（ensureExpanded 已移除）——删除班次不会被自动复活；
新任务需批量铺排或手动建班次后才出现在周历。
铺排当前浏览范围（周 = 当前浏览周；月 = 浏览月覆盖的整段自然周）→ 遍历范围内每个覆盖周的
        active 项目 × 其 weekDays 命中日 → 按项目每个 slot 生成班次（date + projectId + slotLabel + staffIds=[]）
一次性任务（weekDays=[]）不自动展开，领导手动建班次。
```

- [ ] **Step 2: 改写 §5.2「批量铺排」条目**

把现条目：

```markdown
- **批量铺排**：工具栏按钮 → 弹窗输入 N（1-4）周 → 对接下来 N 周按 active 项目 weekDays+slots 展开班次空壳（幂等去重、不分配人员），用于提前计划；起点 = 当前浏览锚点对应周的周一（周粒度 = 当前周；月粒度 = 月初所在周）。
```

改为：

```markdown
- **批量铺排**：工具栏按钮 → 打开「预览 + 确认」弹窗，铺满**当前浏览范围**（周 = 当前浏览周单周；月 = 浏览月覆盖的整段自然周 ≤6，首尾含跨周邻月灰列，所见即所铺）——按范围内 active 项目 weekDays×slots 展开班次空壳（幂等去重、不分配人员）。弹窗实时预览「将新建 / 已存在跳过」按任务列明细，范围外不铺；主按钮「开始铺排」确认后才写库，预计新建为 0 时禁用并提示原因（无周期任务 / 已全部铺好）。想铺更远 → 翻到目标周/月再点。
```

- [ ] **Step 3: 核对 §5.2 无残留旧口径**（如月粒度「批量铺排锚点」相关表述已并入新条目）

---

### Task 5: 全量验证（单测 + 浏览器实测）

**Files:** 无（验证）

- [ ] **Step 1: 跑全量单测**

Run: `npm test`
Expected: 全部 PASS（94 基线 + 新增 4 = 98）。

- [ ] **Step 2: 启动 dev server 并浏览器实测弹窗交互**

Run: `node ./node_modules/vite/bin/vite.js --port 5173 --strictPort`（后台）

核对清单（Playwright MCP 或手测）：
1. **周粒度总览**：开「批量铺排」→ 范围行显示周粒度 + 当前周日期范围 + 总览；计数条「将新建 N」；明细行任务名/新建/重复星期正确。
2. **月粒度总览**：切「月」→ 开弹窗 → 范围行 `YYYY-MM（覆盖 X~Y）`；点「开始铺排」后**末覆盖周确有新建班次**（修复旧 N≤4 铺不满 bug）；toast「已铺排当前月 · 新建 N · 跳过 M」。
3. **预览准确性**：任意粒度打开弹窗记住 N → 执行 → 网格新增卡片数 = N、toast 新建数 = N。
4. **幂等**：同一范围再开弹窗 → 计数条为「将新建 0 · 已存在跳过 M」→ 主按钮禁用 + 出现「范围内周期班次已全部铺好」提示。
5. **项目维度**：切「项目·某周期任务」→ 弹窗只列该任务；切「项目·某一次性任务」→ 空态「无启用中的周期任务」+ 主按钮禁用。
6. **人员维度**：确认「批量铺排」按钮不出现（只读视图，回归）。
7. **样式**：无手写内联 cssText 残留；列表超高内部滚动不溢出弹窗。

- [ ] **Step 3: 交付归拢（不提交）**
  - 更新 `.ai/memory.md`：09-05 批次记录（含「批量铺排改为铺当前浏览范围 + 预览确认」决策与关键实现点），供末尾统一提交。
  - 本批次候选提交内容 = 代码改动 + `.ai/spec.md` + `.ai/memory.md` + 设计文档（specs/） + 本计划（plans/），等 Tao 指示经 commit 技能统一提交。

---

## 自审记录

- **Spec 覆盖**：设计文档 §3（previewExpand）→ Task 1；§4（弹窗 UI/交互、N=0 禁用/分因提示）→ Task 3；§4 体例对齐（`.bulk-*`）→ Task 2；§5 边界 → Task 3 + Task 5 清单；§6 spec 同步 → Task 4；§7 验证 → Task 5。无缺口。
- **无占位**：所有代码步骤含完整代码；无 TBD/TODO。
- **类型一致**：`previewExpand` 返回结构与调用方（Task 3）逐字段对齐；`weekStarts` 由 `weeksCovering(monthAnchor)`（月）/`[currentWeekStart]`（周）两处统一；`ok.disabled`、`reasonText` 分支与 spec 文案一致。
- **已知取舍**：`perTask` 行含一次性任务说明文案（`一次性`）为防御展示——previewExpand 不含一次性任务（created/skipped 恒 0 被滤），此分支理论上不可达，保留无害。
