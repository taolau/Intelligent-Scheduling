# 周历布局改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 排班周历从「固定 4 时段行 × 7 天列网格」改造为「每天一列、列内按时段叠大卡片」，给卡片留足空间、正常情况无需卡片内滚动。

**Architecture:** 纯渲染层改造。calendar.js 重构 `renderCalendar` 的网格构建逻辑（去掉时段行/单元格，改为天列 + 时段大卡片 + 表头「＋」入口），并把 `smartFill` 抽取共享填充函数以支持单班次智能排班；theme.js 重写周历样式块（新布局类 + 时段四色），移除废弃的 `.cal-cell`/`.cal-slot`/`.cal-add` 等。数据模型、filter/score/expand/store 全部不动。

**Tech Stack:** 原生 ES Modules + CSS（设计令牌 theme.js 注入），无框架。视图层仅浏览器手测（本项目约定：算法层 node:test，views/ui 仅手测）。

## Global Constraints

- 纯原生 ES Modules + Web API，无框架；Vite dev / esbuild 单文件发布。
- **数据模型/算法零改动**：filter/score/expand/store.js 本次一律不碰（spec 2026-08-29 设计条目 ⑥）。
- **卡片高度随内容自适应**；正常情况完整展开不滚，任务爆多极端天允许溢出滚动兜底（不承诺"永不滚动"）。
- 时段四色**全周一致**：自主安排 `#f1e8f6` / 早 `#f9e8ef` / 中 `#ece4f8` / 晚 `#e6dcf0`；任务卡白底 + 时段色边框。
- 手动建班次入口**只在表头 hover「＋」**（`.cal-date:hover .cal-add-day`），卡片内不做建班次入口。
- 中文 UI；`#view` 容器滚动由 `.cal-grid` 自身 `overflow-y:auto` 承担（#view 无 overflow-y）。
- **提交时机**：Tao 指示「最后再一起提交」——本计划不做每任务独立提交，Task 3 统一提交（含此前未提交的今天表头旗子改动）。
- 构建：Tao 明确要求时才跑 `node build.js`，本次不构建 dist。

---

### Task 1: 周历渲染重构「天列 + 时段大卡片」

**Files:**
- Modify: `src/views/calendar.js` — `renderCalendar` 网格段（现 56-107 行）、`corner()` 函数（现 110-115 行）、新增 `ICON_ADD` 常量
- Modify: `src/ui/theme.js` — 周历样式块（现 282-348 行，从 `/* ===== 周历 ===== */` 到 `.staff-chip.over` 规则）

**Interfaces:**
- Consumes: `SLOT_LABELS`（model.js）、`getWeekDates/todayStr`（week.js）、`renderScheduleCard(sch)`、`enableDrop(el,{onDrop})`、`dropStaff(e, el)`、`manualCreate(date, slotLabel)`（slotLabel 可省略，弹窗内已有时段下拉）
- Produces: `.cal-grid`/`.cal-col`/`.cal-slot-card`/`.cal-slot-{0..3}`/`.cal-slot-chip`/`.cal-add-day` 类名约定；`slotCard.dataset.date` + `dataset.slot` 供 `dropStaff` 读取；`ICON_ADD` 常量

- [ ] **Step 1: calendar.js 新增 ICON_ADD 常量**

在 `ICON_TODAY_FLAG` 常量（现 24 行）之后追加：

```js
const ICON_ADD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block"><path d="M12 5v14M5 12h14"/></svg>';
```

- [ ] **Step 2: calendar.js 替换 renderCalendar 网格段**

将 `renderCalendar` 中从 `const grid = document.createElement('div');` 到 `container.appendChild(grid);` 的整段（现 56-107 行）替换为：

```js
  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const dates = getWeekDates(currentWeekStart);
  const today = todayStr();

  // 按「日期|时段」预分组，避免逐格 O(n²) 过滤
  const byKey = new Map();
  for (const s of data.schedules) {
    const key = `${s.date}|${s.slotLabel}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(s);
  }

  dates.forEach((d, i) => {
    const col = document.createElement('div');
    col.className = 'cal-col';

    const head = document.createElement('div');
    head.className = `cal-date${d === today ? ' cal-today' : ''}`;
    head.innerHTML = `${weekdayNames[i]}<br><b>${d.slice(5)}</b>`;
    if (d === today) {
      head.title = '今天';
      head.insertAdjacentHTML('beforeend', ICON_TODAY_FLAG);
    }
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'cal-add-day';
    addBtn.title = '为此日创建班次';
    addBtn.innerHTML = ICON_ADD;
    addBtn.onclick = () => manualCreate(d);
    head.appendChild(addBtn);
    col.appendChild(head);

    SLOT_LABELS.forEach((slotLabel, si) => {
      const scheds = byKey.get(`${d}|${slotLabel}`);
      if (!scheds || scheds.length === 0) return;
      const slotCard = document.createElement('div');
      slotCard.className = `cal-slot-card cal-slot-${si}`;
      slotCard.dataset.date = d;
      slotCard.dataset.slot = slotLabel;
      const chip = document.createElement('span');
      chip.className = 'cal-slot-chip';
      chip.textContent = slotLabel;
      slotCard.appendChild(chip);
      for (const sch of scheds) slotCard.appendChild(renderScheduleCard(sch));
      enableDrop(slotCard, { onDrop: (e) => dropStaff(e, slotCard) });
      col.appendChild(slotCard);
    });

    grid.appendChild(col);
  });
  container.appendChild(grid);
```

- [ ] **Step 3: calendar.js 删除不再使用的 corner()**

删除整段（现 110-115 行）：

```js
function corner(text, extra = '') {
  const c = document.createElement('div');
  c.innerHTML = text;
  c.className = `cal-corner${extra ? ' ' + extra : ''}`;
  return c;
}
```

- [ ] **Step 4: theme.js 重写周历样式块**

将 `/* ===== 周历 ===== */`（现 282 行）到 `.staff-chip.over` 规则（现 348 行）之间的全部内容替换为：

```css
/* ===== 周历 ===== */
.cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:12px; align-items:start;
  flex:1; min-height:0; overflow-y:auto; font-size:13px; }
.cal-col { display:flex; flex-direction:column; gap:8px; min-width:0; }

.cal-date { position:relative; background:#f7f1fa; color:#380c4a; border-radius:8px;
  padding:7px 6px; text-align:center; font-weight:600; font-size:13px; }
.cal-date b { display:block; font-size:11px; font-weight:500; color:#6a6178; margin-top:2px; }
.cal-date.cal-today { background:#efe3f6; color:#5a1d78; }
.cal-date.cal-today b { color:#5a1d78; font-weight:600; }
.cal-add-day { position:absolute; top:4px; right:4px; width:20px; height:20px; border:none;
  border-radius:6px; background:#5a1d78; color:#fff; cursor:pointer; padding:0;
  display:flex; align-items:center; justify-content:center; opacity:0;
  transition:opacity .12s, background-color .12s; }
.cal-add-day:hover { background:#48115f; }
.cal-date:hover .cal-add-day { opacity:1; }
.cal-today-flag { position:absolute; top:4px; left:4px; color:#5a1d78; }

.cal-slot-card { position:relative; border-radius:10px; padding:8px;
  display:flex; flex-direction:column; gap:6px; }
.cal-slot-card.cal-slot-0 { background:#f1e8f6; --sb:#c9b0e0; }
.cal-slot-card.cal-slot-1 { background:#f9e8ef; --sb:#e6bcd0; }
.cal-slot-card.cal-slot-2 { background:#ece4f8; --sb:#c2b2e0; }
.cal-slot-card.cal-slot-3 { background:#e6dcf0; --sb:#b8a6d4; }
.cal-slot-chip { align-self:flex-end; font-size:10px; font-weight:600; color:#380c4a;
  background:rgba(255,255,255,.75); border-radius:999px; padding:1px 7px; }
.drop-target { outline:2px solid #5a1d78; outline-offset:-2px; }

/* ===== 周历工具栏分组（保留） ===== */
.cal-bar { display:flex; gap:8px; align-items:center; justify-content:space-between; margin-bottom:12px;
  flex-wrap:wrap; }
.cal-bar-group { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }

/* ===== 班次卡片状态 ===== */
.cal-slot-card .sch-card { border:1px solid var(--sb, #c9b0e0); background:#fff;
  border-radius:8px; padding:6px; margin-bottom:0;
  display:flex; flex-direction:column; gap:4px;
  transition:box-shadow .15s,transform .15s; }
.cal-slot-card .sch-card:hover { box-shadow:0 2px 6px rgba(90,29,120,.12); transform:translateY(-1px); }
.cal-slot-card .sch-card.short { border-color:#fed7aa; background:#fff7ed; }
.cal-slot-card .sch-card.full { border-color:#bbf7d0; background:#f0fdf4; }
.sch-title { font-weight:600; font-size:12px; }
.sch-meta { display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#6a6178; }
.sch-time { color:#9b91a7; font-size:10px; }
.sch-badge { display:inline-flex; align-items:center; gap:1px; }
.sch-staff { display:flex; flex-wrap:wrap; }
.sch-cap-row { display:flex; align-items:center; justify-content:space-between; gap:6px; }
.sch-capacity { font-size:11px; color:#d97706; font-weight:500; }
.sch-capacity.ok { color:#16a34a; }
.sch-smart { border:none; background:#5a1d78; color:#fff; border-radius:6px;
  font-size:11px; padding:2px 8px; cursor:pointer; transition:background-color .12s; }
.sch-smart:hover { background:#48115f; }

/* ===== 人员 chip 疲劳状态 ===== */
.staff-chip { display:inline-block; background:#fff; border:1px solid #e0d2ef; border-radius:999px;
  padding:1px 8px; margin:2px; cursor:grab; font-size:12px;
  transition:background-color .15s,border-color .15s; }
.staff-chip:hover { background:#f7f1fa; border-color:#c9b0e0; }
.staff-chip.warn { border-color:#fbbf24; background:#fffbeb; color:#b45309; }
.staff-chip.over { border-color:#f87171; background:#fef2f2; color:#b91c1c; font-weight:500; }
```

> 说明：`.cal-slot-card` 用 CSS 变量 `--sb` 承载时段边框色；`.sch-card.short/.full`（缺员/满员）写在 `--sb` 规则之后以同特异性覆盖其边框色。`.sch-cap-row`/`.sch-smart` 在 Task 2 才被 JS 使用，此处先行定义（无害）。

- [ ] **Step 5: 验证新布局渲染**

启动 dev server（Tao 通常已占用 5173；若被占则换端口）：`node ./node_modules/vite/bin/vite.js --port 5174 --strictPort`，浏览器打开。逐项确认：
- 周历显示 7 天列，**无**「时段」列与四行网格，无整列底色。
- 忙日（有数据的天）列内出现时段大卡片，颜色按 自主/早/中/晚 四色区分；大卡片右上角有时段 chip。
- 空日（当天无班次）只显示表头（周几+日期），列内空白。
- 鼠标悬停表头 → 右上角「＋」出现；点击弹「手动建班次」，可选日期/时段/任务，创建成功。
- 今天表头紫色底 + 左上角旗子。
- 卡片内**无内部滚动条**；任务多时卡片自然变高、周历整体可纵向滚动。

---

### Task 2: 单班次智能排班（fillSchedule 抽取 + 空班次卡片「＋ 智能排班」）

**Files:**
- Modify: `src/views/calendar.js` — `smartFill`（现 451-492 行）重构为 `fillSchedule`+`smartFill`+`smartFillOne`；`renderScheduleCard` 尾部（现 172-175 行）

**Interfaces:**
- Consumes: `filterCandidate`/`scoreCandidate`（core）、`ctx`、`saveSchedule`（store）、`SLOT_LABELS`
- Produces: `async function fillSchedule(sch) → Promise<{filled:number, warned:string[]}>`；`async function smartFillOne(sch)`；`renderScheduleCard` 对空班次渲染 `.sch-cap-row` + `.sch-smart` 按钮

- [ ] **Step 1: 抽取 fillSchedule 并重构 smartFill**

将 `smartFill` 整段（现 451-492 行）替换为下面三个函数：

```js
async function fillSchedule(sch) {
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const project = projectById[sch.projectId];
  let filled = 0;
  const warned = [];
  const warnDaily = ctx.settings?.warnDailyCount ?? 0;
  while (sch.staffIds.length < project.requiredCapacity) {
    const candidates = data.staffs
      .filter(s => !sch.staffIds.includes(s.id))
      .map(s => ({ s, res: filterCandidate(s, sch, projectById, ctx) }))
      .filter(x => x.res.ok);
    if (candidates.length === 0) break;
    let best = null;
    for (const c of candidates) {
      const { score } = scoreCandidate(c.s, sch, projectById, ctx);
      if (!best || score > best.score) best = { s: c.s, score };
    }
    sch.staffIds.push(best.s.id);
    const dailyKey = `${best.s.id}|${sch.date}`;
    const slotKey = `${best.s.id}|${sch.date}|${sch.slotLabel}`;
    const dailyAfter = (ctx.dailyCounts?.get(dailyKey) ?? 0) + 1;
    ctx.dailyCounts.set(dailyKey, dailyAfter);
    ctx.slotCounts.set(slotKey, (ctx.slotCounts?.get(slotKey) ?? 0) + 1);
    ctx.weeklyFatigue.set(best.s.id, (ctx.weeklyFatigue.get(best.s.id) ?? 0) + project.fatigueScore);
    if (project.fatigueScore === 3) ctx.heavyCounts.set(best.s.id, (ctx.heavyCounts.get(best.s.id) ?? 0) + 1);
    if (warnDaily > 0 && dailyAfter >= warnDaily) warned.push(best.s.id);
    await saveSchedule(sch);
    filled++;
  }
  return { filled, warned };
}

async function smartFillOne(sch) {
  const { filled, warned } = await fillSchedule(sch);
  const warnMsg = warned.map(id => data.staffs.find(s => s.id === id)?.name ?? id).join('、');
  showToast(warnMsg ? `已填充 ${filled} 个名额；${warnMsg} 当日已达预警阈值` : `已填充 ${filled} 个名额`, filled ? 'success' : 'info');
  renderCalendar(document.querySelector('#view'));
}

async function smartFill() {
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const empties = data.schedules.filter(s => s.staffIds.length < (projectById[s.projectId]?.requiredCapacity ?? 1));
  empties.sort((a, b) => a.date.localeCompare(b.date)
    || (a.slotLabel === '自主安排' ? 1 : 0) - (b.slotLabel === '自主安排' ? 1 : 0)
    || SLOT_LABELS.indexOf(a.slotLabel) - SLOT_LABELS.indexOf(b.slotLabel));
  let filled = 0;
  const warnedAll = new Set();
  for (const sch of empties) {
    const { filled: f, warned } = await fillSchedule(sch);
    filled += f;
    warned.forEach(id => warnedAll.add(id));
  }
  const warnMsg = [...warnedAll].map(id => data.staffs.find(s => s.id === id)?.name ?? id).join('、');
  const msg = warnMsg ? `智能排班完成：填充 ${filled} 个名额；${warnMsg} 当日已达预警阈值` : `智能排班完成：填充 ${filled} 个名额`;
  showToast(msg, filled ? 'success' : 'info');
  renderCalendar(document.querySelector('#view'));
}
```

- [ ] **Step 2: renderScheduleCard 空班次加「＋ 智能排班」**

将 `renderScheduleCard` 尾部（现 172-175 行）：

```js
  const cap = document.createElement('div');
  cap.className = `sch-capacity${filled >= capacity ? ' ok' : ''}`;
  cap.textContent = filled >= capacity ? '已满' : (filled === 0 ? `需 ${capacity} 人` : `缺 ${capacity - filled} 人`);
  card.appendChild(cap);
  return card;
```

替换为：

```js
  const cap = document.createElement('div');
  cap.className = `sch-capacity${filled >= capacity ? ' ok' : ''}`;
  cap.textContent = filled >= capacity ? '已满' : (filled === 0 ? `需 ${capacity} 人` : `缺 ${capacity - filled} 人`);
  if (filled === 0) {
    const row = document.createElement('div');
    row.className = 'sch-cap-row';
    const smart = document.createElement('button');
    smart.type = 'button';
    smart.className = 'sch-smart';
    smart.textContent = '＋ 智能排班';
    smart.onclick = (e) => { e.stopPropagation(); smartFillOne(sch); };
    row.append(cap, smart);
    card.appendChild(row);
  } else {
    card.appendChild(cap);
  }
  return card;
```

- [ ] **Step 3: 验证单班次智能排班**

浏览器逐项确认：
- 空班次（无人）卡片底部出现「＋ 智能排班」按钮，点击**不**触发卡片点击（不弹分配弹窗），只填这一个班次并 toast「已填充 N 个名额」。
- 满员/缺员卡片不显示该按钮（`.sch-cap-row` 仅空班次出现）。
- 工具栏「智能排班」仍填充本周全部空班次，toast 文案不变。
- 被硬性过滤（休假/请假/黑名单/疲劳超限等）的人员不会被填入；当日达预警阈值时 toast 提示。

---

### Task 3: 清理确认 + 全量回归验证 + 统一提交

**Files:**
- Modify: （无代码改动；仅确认清理）
- Delete: `layout-mockup.html`（设计示例已完成使命）
- Commit: `src/views/calendar.js`、`src/ui/theme.js`（含此前未提交的今天表头旗子改动）、删除 mockup

- [ ] **Step 1: 确认无遗留旧类/函数**

Run: `grep -rn "cal-cell\|cal-slot\|cal-add\|cal-corner\|corner(" src/`
Expected: **无输出**（除 `cal-slot-card`/`cal-slot-chip`/`cal-slot-{0..3}` 外，旧 `.cal-cell`/`.cal-slot`/`.cal-add`/`.cal-corner`/`corner()` 全部清除）。

- [ ] **Step 2: 删除设计示例文件**

```bash
git rm layout-mockup.html
```

- [ ] **Step 3: 全量回归验证（浏览器手测清单）**

在 dev server 下逐项确认，任一项异常即回退排查：
- 排班周历：7 天列 + 时段大卡片 + 四色区分 + chip；空日仅表头；表头 hover「＋」建班次；今天表头紫底+旗子。
- 新建班次：表头「＋」→ 选日期/时段/任务 → 创建后出现在对应列对应时段大卡片。
- 分配人员：点班次卡片弹「排班分配」，加入/移除人员计数同步（周疲劳/高强度/日任务数/时段数），达阈值 toast。
- 拖拽：拖人员 chip 到其他时段大卡片，非法移动红字阻止、合法移动计数正确、目标满员阻止。
- 删除班次：分配弹窗「删除班次」两步确认后删除，计数回退。
- 请假替补：点人员 chip → 标记请假 → 逐班次替补推荐 / 替换。
- 智能排班：工具栏全量 + 空班次卡片单班次，均正常。
- 批量铺排：展开未来 N 周，空班次卡片显示「需 X 人」+「＋ 智能排班」。
- 周切换 / 今天按钮：定位正确，无 UTC 偏移（pitfalls#9）。

- [ ] **Step 4: 统一提交（Tao 指示"最后再一起提交"）**

```bash
git add src/views/calendar.js src/ui/theme.js
git commit -m "$(cat <<'EOF'
[周历] 布局改造：每天一列+时段大卡片+表头建班次入口+单班次智能排班；今天列高亮改表头旗子

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git status --short
```

> 本次提交同时收编此前已批准的「今天列整列底色移除 → 表头紫色底+右上角小旗子」改动（同一文件同一设计语系）。知识库固化（spec/memory）已在 `2cd6169` 提交，不再重复。
