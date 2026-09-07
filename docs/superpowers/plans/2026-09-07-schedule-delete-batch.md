# 排班删除改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 排班视图删除语义重做——「排班分配」弹窗删除按钮撤出并改「暂存编辑 + 确认保存一次性落库」；删除统一收口到工具栏「批量删除」多选流程（勾选 → 二次确认 → 批量删除，三轨 ctx 回退）。

**Architecture:** 全部改动集中在 `src/views/calendar.js`（scheduleDialog 暂存化 + 模块级批量多选态状态 + 工具栏/批量条/卡片多选渲染分支）与 `src/ui/theme.js`（新增 `.cal-batch-*` / 卡选择态 / `.asg-savehint` 样式）。无 core 层改动、无新增 localStorage key。

**Tech Stack:** 原生 ES Modules；node:test 回归；无新依赖。

## Global Constraints

- **本批次不做中间提交**（项目惯例 = Tao 拍板单批提交）。任务全部完成后，由 commit 技能统一提交（含同批设计文档 `docs/superpowers/specs/2026-09-07-schedule-delete-batch-design.md`）。
- 文案全部简体中文；不写内联 `cssText` 到**新**增 UI（复用 theme 类）；不改 `build.js`、不产 `dist`、不新增 localStorage key、不动 core/。
- 真实班次对象与真实 `ctx` 在弹窗打开期间**绝不被暂存操作污染**：暂存只写 `draft`（工作副本）与 `dctx`（`cloneCtx(ctx)` 克隆）。落库唯一入口 = 「确认保存」；批量删除唯一入口 = 批量条「删除所选」二次确认。
- ctx 计数回退唯一实现 = `accumulateDelta`（`src/core/auto.js`）；视图层薄壳 `applyDelta(ctxObj, sid, sch, sign)`（`calendar.js:518`）已存在，不得绕过。
- 删除目标 = 班次卡（Schedule 记录），不是任务/人员配置。

---

### Task 1: `scheduleDialog` 暂存化 + 「确认保存」（`calendar.js` 全函数替换）

**Files:**
- Modify: `src/views/calendar.js:523-823`（整段替换 `scheduleDialog` 函数）

**Interfaces:**
- Consumes: 既有模块变量 `data`/`ctx`；既有 import `cloneCtx`（substitute.js）、`saveSchedule`、`applyDelta`、`openModal`、`showToast`、`renderCalendar`、`filterCandidate/scoreCandidate/narrateReasons`、`getWeekStart`——均已在文件内/import 清单中，无需新增。
- Produces: 新弹窗语义——内部 `origStaffIds`（快照）/ `draft`（工作副本）/ `dctx`（克隆 ctx）/ `dirty()`；footer 主钮「确认保存」（`btn-primary`，无改动禁用）；点「确认保存」按**净差**写真实 ctx + `saveSchedule(draft)` 一次落库并重渲染；关闭/ESC = 放弃不落库。**不再有删除入口**（后续 Task 2 批量删除接管）。

- [ ] **Step 1: 用下列完整函数替换 `scheduleDialog`（现 `calendar.js:523-823`）**

旧函数包含删除分支（`delBtn`、`deleteSchedule()`）与每次增/移后即时 `saveSchedule`/`renderCalendar`。以下版本整段换掉：

```js
function scheduleDialog(sch) {
  const project = data.projects.find(p => p.id === sch.projectId);
  const projectById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const capacity = project?.requiredCapacity ?? 1;
  const body = document.createElement('div');
  const footer = document.createElement('div');
  let tagFilter = []; // 候选标签多选过滤（弹窗级临时，视图层过滤不参与算法）
  let nameQuery = ''; // 候选名称搜索（同弹窗级临时，与 tagFilter 叠加为与关系）
  const allTags = () => [...new Set(data.staffs.flatMap(s => s.tags ?? []))].sort((a, b) => a.localeCompare(b, 'zh'));

  // 暂存模型：draft = 工作副本、dctx = 弹窗内演进 ctx——本弹窗不写真实 sch/ctx。
  // 点「确认保存」才按净差写真实 ctx 并 saveSchedule；直接关闭/ESC = 放弃本次改动（不落库）。
  const origStaffIds = [...sch.staffIds];
  const draft = { ...sch, staffIds: [...sch.staffIds] };
  const dctx = cloneCtx(ctx);
  const dirty = () => {
    if (origStaffIds.length !== draft.staffIds.length) return true;
    const o = new Set(origStaffIds);
    return draft.staffIds.some(id => !o.has(id));
  };

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn-primary';
  okBtn.textContent = '确认保存';
  okBtn.title = '把本次加/移的人员一次性落库（无改动时不可用）';
  okBtn.disabled = true;
  footer.appendChild(okBtn);
  const modal = openModal({ title: '排班分配', body, footer });

  okBtn.onclick = async () => {
    const o = new Set(origStaffIds);
    const added = draft.staffIds.filter(id => !o.has(id));        // 净增
    const removed = origStaffIds.filter(id => !draft.staffIds.includes(id)); // 净减
    for (const sid of removed) applyDelta(ctx, sid, draft, -1);
    for (const sid of added) applyDelta(ctx, sid, draft, +1);
    await saveSchedule(draft);
    modal.close();
    const parts = [];
    if (added.length) parts.push(`新增 ${added.length}`);
    if (removed.length) parts.push(`移出 ${removed.length}`);
    showToast(parts.length ? `已保存 · ${parts.join('、')}` : '已保存', 'success');
    const warnDaily = ctx.settings?.warnDailyCount ?? 0;
    if (warnDaily > 0) {
      const warns = added.filter(id => (ctx.dailyCounts.get(`${id}|${draft.date}`) ?? 0) >= warnDaily)
        .map(id => data.staffs.find(s => s.id === id)?.name ?? id);
      if (warns.length) showToast(`${warns.join('、')} 当日已达预警阈值 ${warnDaily} 个任务`, 'info');
    }
    renderCalendar(document.querySelector('#view'));
  };
  function syncDirty() { okBtn.disabled = !dirty(); }

  function renderBody() {
    body.innerHTML = '';
    const filled = draft.staffIds.length;
    const full = filled >= capacity;

    const head = document.createElement('div');
    head.className = 'asg-head';
    const titleRow = document.createElement('div');
    titleRow.className = 'asg-title';
    titleRow.innerHTML = `<span>${project?.name ?? draft.projectId}</span>${project ? `<span class="sch-badge">${ICON_FIRE.repeat(project.fatigueScore)}</span>` : ''}`;
    const sub = document.createElement('div');
    sub.className = 'asg-sub';
    sub.innerHTML = `${draft.date} · ${draft.slotLabel}${project?.timeRange ? ` · ${project.timeRange.start}–${project.timeRange.end}` : ''}`;
    head.append(titleRow, sub);

    const progress = document.createElement('div');
    progress.className = 'asg-progress';
    const bar = document.createElement('div');
    bar.className = `asg-bar${full ? ' full' : ''}`;
    const fillEl = document.createElement('div');
    fillEl.className = 'asg-fill';
    fillEl.style.width = `${Math.min(100, (filled / capacity) * 100)}%`;
    bar.appendChild(fillEl);
    const label = document.createElement('span');
    label.className = 'asg-progress-label';
    label.textContent = full ? `✓ 已满员 ${filled}/${capacity}` : `已排 ${filled}/${capacity} 人`;
    progress.append(bar, label);

    const filledSec = document.createElement('div');
    filledSec.className = 'asg-section';
    filledSec.textContent = '已排人员';
    const chips = document.createElement('div');
    chips.className = 'asg-chips';
    function renderChips() {
      chips.innerHTML = '';
      if (draft.staffIds.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'asg-empty';
        empty.textContent = '暂无人员，从下方选择加入';
        chips.appendChild(empty);
        return;
      }
      for (const sid of draft.staffIds) chips.appendChild(makeChip(sid));
    }
    function makeChip(sid) {
      const staff = data.staffs.find(s => s.id === sid);
      const chip = document.createElement('span');
      chip.className = 'asg-chip';
      const chipName = document.createElement('span');
      chipName.textContent = staff?.name ?? sid;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'asg-chip-x';
      rm.title = '移除';
      rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      rm.onclick = () => { // 暂存移除（不落库）：整窗重绘，被移者按 dctx 重算回候选
        draft.staffIds = draft.staffIds.filter(id => id !== sid);
        applyDelta(dctx, sid, draft, -1);
        syncDirty();
        renderBody();
      };
      chip.append(chipName, rm);
      return chip;
    }
    function updateProgressBar() {
      const filled = draft.staffIds.length;
      const full = filled >= capacity;
      bar.classList.toggle('full', full);
      fillEl.style.width = `${Math.min(100, (filled / capacity) * 100)}%`;
      label.textContent = full ? `✓ 已满员 ${filled}/${capacity}` : `已排 ${filled}/${capacity} 人`;
    }
    renderChips();
    updateProgressBar();

    const listSec = document.createElement('div');
    listSec.className = 'asg-section';
    const secHead = document.createElement('div');
    secHead.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const secTitle = document.createElement('span');
    secTitle.textContent = '可选人员';
    secHead.appendChild(secTitle);
    const list = document.createElement('div');
    if (full) {
      // 满员：仅显示提示，不渲染候选行（无「＋ 添加」入口）；移除一人后 renderBody 重算即恢复
      const done = document.createElement('div');
      done.className = 'asg-full';
      done.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M20 6L9 17l-5-5"/></svg>本班次已满员';
      list.appendChild(done);
    } else {
      // 候选过滤（视图层，算法判断不变）：名称搜索 + 标签多选；切行 display 不重建 DOM（输入不失焦）
      const nameInput = document.createElement('input');
      nameInput.className = 'input asg-name-input';
      nameInput.type = 'text';
      nameInput.placeholder = '搜姓名';
      nameInput.value = nameQuery;
      nameInput.title = '按姓名过滤候选行';
      secHead.appendChild(nameInput);
      const candTags = allTags();
      if (candTags.length) {
        const fsel = createSelect({
          multiple: true,
          placeholder: '按标签筛',
          options: candTags.map(t => ({ value: t, label: t })),
          value: tagFilter,
        });
        fsel.classList.add('asg-tag-sel');
        fsel.title = '按标签过滤候选名单（不影响算法排序）';
        fsel.addEventListener('change', () => { tagFilter = fsel.value; refresh(); });
        secHead.appendChild(fsel);
      }
      const none = document.createElement('div');
      none.className = 'asg-empty';
      none.style.display = 'none';
      // 候选分两区：可添加（按推荐分排序）/ 暂不可添加（受限原因集中；默认折叠，原因单行省略）
      const secAvail = document.createElement('div');
      secAvail.className = 'asg-cand-sec';
      const headAvail = document.createElement('div');
      headAvail.className = 'asg-subhead';
      const listAvail = document.createElement('div');
      listAvail.className = 'asg-cand-list';
      secAvail.append(headAvail, listAvail);
      const secLimited = document.createElement('div');
      secLimited.className = 'asg-cand-sec asg-limited';
      const headLimited = document.createElement('div');
      headLimited.className = 'asg-subhead collap';
      const listLimited = document.createElement('div');
      listLimited.className = 'asg-cand-list';
      listLimited.hidden = true; // 暂不可添加默认折叠
      secLimited.append(headLimited, listLimited);
      list.append(none, secAvail, secLimited);
      const pickedRows = new Map(); // sid -> 本次点选已加入的行（保留高亮，不整窗重绘）
      const availEntries = []; // 可添加候选 {staff,row,info}，按推荐分排序
      let limitedOpen = false;
      for (const s of data.staffs) {
        if (draft.staffIds.includes(s.id)) continue; // 已在班者进上方 chips，不重复作候选
        const res = filterCandidate(s, draft, projectById, dctx);
        const row = document.createElement('div');
        row.className = 'assign-row' + (res.ok ? ' pickable' : ' blocked');
        row.dataset.name = s.name;
        row.dataset.tags = JSON.stringify(s.tags ?? []);
        const name = document.createElement('span');
        name.className = 'assign-name';
        name.textContent = s.name;
        if (s.status === 'new') {
          const tag = document.createElement('span');
          tag.className = 'assign-tag';
          tag.textContent = '新入';
          name.appendChild(tag);
        }
        row.appendChild(name);
        if (res.ok) {
          const info = document.createElement('span');
          info.className = 'assign-info';
          info.textContent = `周疲劳 ${dctx.fatigueByWeek.get(`${s.id}|${getWeekStart(draft.date)}`) ?? 0}/${s.maxWeeklyFatigue}`;
          row.append(name, info); // 无右侧常驻「＋ 添加」（点击整行即加，不再占位）
          const { score, breakdown } = scoreCandidate(s, draft, projectById, dctx);
          row.dataset.score = String(score);
          // 优选理由副行（同替换弹窗人话规则）：擅长原因 / 窗口偏少建议优先等，选人依据更清晰
          const reco = narrateReasons(s, draft, projectById, breakdown, dctx);
          if (reco.length) {
            const re = document.createElement('span');
            re.className = 'assign-reco';
            re.textContent = reco.join('；');
            row.appendChild(re);
          }
          availEntries.push({ staff: s, row, info });
        } else {
          const why = document.createElement('span');
          why.className = 'assign-why';
          const reasons = res.reasons.join('；');
          why.textContent = reasons;
          why.title = reasons; // 单行省略时 hover 看全文
          row.append(name, why);
          listLimited.appendChild(row);
        }
      }
      // 可添加按推荐分（擅长 + 窗口均衡）降序；stable 保持同分原序
      availEntries.sort((a, b) => (Number(b.row.dataset.score) || 0) - (Number(a.row.dataset.score) || 0));
      for (const it of availEntries) listAvail.appendChild(it.row);
      const fullNow = () => draft.staffIds.length >= capacity;
      const syncNoSlot = () => { // 满员后其余未选行置灰禁点
        const f = fullNow();
        for (const it of availEntries) {
          const r = it.row;
          if (r.classList.contains('picked')) r.classList.remove('no-slot');
          else r.classList.toggle('no-slot', f);
        }
      };
      const refresh = () => {
        syncNoSlot();
        const hitOf = row => (!nameQuery || row.dataset.name.includes(nameQuery))
          && (!tagFilter.length || tagFilter.every(t => JSON.parse(row.dataset.tags || '[]').includes(t)));
        let addable = 0;
        let any = false;
        for (const it of availEntries) {
          const r = it.row;
          const hit = hitOf(r);
          r.style.display = hit ? '' : 'none';
          if (hit) any = true;
          if (hit && !r.classList.contains('picked') && !r.classList.contains('no-slot')) addable++;
        }
        let limited = 0;
        for (const r of listLimited.querySelectorAll('.assign-row')) {
          const hit = hitOf(r);
          r.style.display = hit ? '' : 'none';
          if (hit) { any = true; limited++; }
        }
        headAvail.textContent = pickedRows.size ? `已选 ${pickedRows.size} · 可添加 ${addable}` : `可添加 ${addable}`;
        secAvail.style.display = (addable > 0 || pickedRows.size > 0) ? '' : 'none';
        headLimited.textContent = `${limitedOpen ? '▾' : '▸'} 暂不可添加 ${limited}`;
        secLimited.style.display = limited ? '' : 'none';
        listLimited.hidden = !limitedOpen;
        none.style.display = any ? 'none' : '';
        if (!any) {
          const totalRows = availEntries.length + listLimited.querySelectorAll('.assign-row').length;
          none.textContent = totalRows === 0 ? '暂无可用人员'
            : nameQuery
              ? (tagFilter.length ? `未找到名称含「${nameQuery}」且带所选标签的候选人员` : `未找到名称含「${nameQuery}」的人员`)
              : '所选标签下暂无候选人员，可清除标签过滤';
        }
      };
      nameInput.addEventListener('input', () => { nameQuery = nameInput.value.trim(); refresh(); });
      headLimited.onclick = () => { limitedOpen = !limitedOpen; refresh(); };
      const unselect = ({ staff, row, info }) => {
        if (!draft.staffIds.includes(staff.id)) return;
        draft.staffIds = draft.staffIds.filter(id => id !== staff.id);
        applyDelta(dctx, staff.id, draft, -1);
        pickedRows.delete(staff.id);
        row.classList.remove('picked');
        info.textContent = `周疲劳 ${dctx.fatigueByWeek.get(`${staff.id}|${getWeekStart(draft.date)}`) ?? 0}/${staff.maxWeeklyFatigue}`;
        renderChips();
        updateProgressBar();
        refresh(); // 取消后不再满员则其余 no-slot 自动解除
        syncDirty();
      };
      const pick = ({ staff, row, info }) => {
        if (row.classList.contains('no-slot')) return; // 他人满员置灰禁点
        if (row.classList.contains('picked')) { unselect({ staff, row, info }); return; } // 再点一次 = 取消选中
        if (draft.staffIds.length >= capacity) return;
        draft.staffIds.push(staff.id);
        applyDelta(dctx, staff.id, draft, 1);
        pickedRows.set(staff.id, row);
        row.classList.add('picked');
        row.classList.remove('no-slot');
        info.textContent = '✓ 已选';
        renderChips();
        updateProgressBar();
        refresh();
        syncDirty();
      };
      for (const it of availEntries) it.row.onclick = () => pick(it);
      refresh();
    }
    listSec.appendChild(secHead);
    const saveHint = document.createElement('div');
    saveHint.className = 'asg-savehint';
    saveHint.textContent = '改动暂存：点「确认保存」一次性生效；直接关闭/取消即放弃。';
    body.append(head, progress, filledSec, chips, listSec, list, saveHint);
  }
  renderBody();
}
```

- [ ] **Step 2: 自查函数替换正确性**

- 整段替换后，`delBtn`/`deleteSchedule`/`removeSchedule` 在本函数内不再出现（删除分支已移除）。
- 函数内**不再出现** `sch.staffIds` 赋值 / `saveSchedule`（增移路径）/ `renderCalendar` 调用——全部改走 `draft`/`dctx`/`syncDirty()`，唯一落库在 `okBtn.onclick`。
- 确认无引用残留：`removeSchedule` import 保留（Task 2 批量删除仍用）；`confirmDialog` import 保留（Task 2 用）。
- 残留核对：`grep -n 'ctx\.\|applyDelta(ctx\|saveSchedule\|renderCalendar' calendar.js` 中，落在本函数体内的命中只允许是 `okBtn.onclick` 里的净差写真实 ctx 那一段（`applyDelta(ctx…±1)`、`saveSchedule(draft)`、`renderCalendar(...)`）；候选区/计数其余应全部是 `dctx`/`draft`，不得再有增移路径的写库。

---

### Task 2: 批量删除多选态（`calendar.js` 模块状态 + 工具栏/批量条 + 卡片渲染分支）

**Files:**
- Modify: `src/views/calendar.js`
  - ICON 常量区（~62 行，`ICON_BULK` 之后）追加 `ICON_TRASH`
  - `renderCalendar`（67 行）：加可选参 + 顶部自动退出兜底 + 工具栏按钮 + 批量条插入
  - 模块级状态 + 函数：加在 `applyDelta`（521 行）之后、`scheduleDialog` 之前
  - 工具栏事件绑定（181-185 行区）：加 `delBatchBtn.onclick`
  - `renderScheduleCard` 三处交互分支（443-448 / 481-484 / 495）

**Interfaces:**
- Consumes: `batchDeleteActive`/`batchSel`（本任务定义）；`data`/`ctx`/`applyDelta`/`removeSchedule`/`confirmDialog`/`showToast`/`renderCalendar`/`data.schedules`（均已存在）；`ICON_TRASH`（本任务定义）。
- Produces: 模块级 `let batchDeleteActive = false; const batchSel = new Set();`；`exitBatchState()`；`toggleBatchSel(schId, card)`；`batchDeleteConfirm()`；`buildBatchBar(container)`；`renderCalendar(container, opts={keepBatch})`；工具栏按钮「批量删除」。

- [ ] **Step 1: ICON 常量追加**

在 `calendar.js` ~62 行 `ICON_BULK` 定义行之后插入：

```js
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
```

- [ ] **Step 2: 模块级状态与函数（插在 `applyDelta` 定义之后、`scheduleDialog` 之前）**

在 `calendar.js` 的 `applyDelta` 函数（518-521 行）结束的大括号之后、`scheduleDialog`（523 行）之前，插入：

```js
// ===== 批量删除多选态 =====
let batchDeleteActive = false;
const batchSel = new Set(); // 选中的班次 sch.id

function exitBatchState() { batchDeleteActive = false; batchSel.clear(); }

function toggleBatchSel(schId, card) {
  if (batchSel.has(schId)) {
    batchSel.delete(schId);
    card.classList.remove('selected');
    card.title = '选择该班次（可多选，点卡片切换）';
  } else {
    batchSel.add(schId);
    card.classList.add('selected');
    card.title = '取消选择该班次';
  }
  const n = batchSel.size;
  const del = document.querySelector('.cal-batch-del');
  const cnt = document.querySelector('.cal-batch-count');
  if (del) { del.disabled = n === 0; del.textContent = `删除所选 (${n})`; }
  if (cnt) cnt.textContent = String(n);
}

function batchDeleteConfirm() {
  const ids = [...batchSel];
  if (!ids.length) return;
  const previews = ids.slice(0, 5).map(id => {
    const s = data.schedules.find(x => x.id === id);
    const p = data.projects.find(x => x.id === s?.projectId);
    return s ? `${s.date.slice(5)} · ${s.slotLabel} · ${p?.name ?? s.projectId}` : '';
  }).filter(Boolean).join('\n');
  const more = ids.length > 5 ? `\n… 等共 ${ids.length} 个` : '';
  confirmDialog({
    title: '批量删除班次',
    message: `确认删除所选 ${ids.length} 个班次？删除后不可恢复。\n其中已排人员将从当日任务数与周/月疲劳计数中回退。\n${previews}${more}`,
    confirmText: `删除所选 ${ids.length} 个`,
    onConfirm: async () => {
      for (const id of ids) {
        const s = data.schedules.find(x => x.id === id);
        if (!s) continue;
        for (const sid of s.staffIds) applyDelta(ctx, sid, s, -1); // 三轨回退（唯一实现 accumulateDelta）
        await removeSchedule(id);
      }
      exitBatchState();
      showToast(`已删除 ${ids.length} 个班次`, 'success');
      renderCalendar(document.querySelector('#view'));
    },
  });
}

function buildBatchBar() {
  const bar = document.createElement('div');
  bar.className = 'cal-batch-bar';
  const tip = document.createElement('div');
  tip.className = 'cal-batch-tip';
  const pre = document.createElement('span');
  pre.textContent = '批量删除 · 已选 ';
  const cnt = document.createElement('b');
  cnt.className = 'cal-batch-count';
  cnt.textContent = '0';
  const post = document.createElement('span');
  post.textContent = ' 个班次，点卡片勾选/取消';
  tip.append(pre, cnt, post);
  const right = document.createElement('div');
  right.className = 'cal-batch-right';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'btn btn-danger cal-batch-del';
  del.textContent = '删除所选 (0)';
  del.disabled = true;
  del.onclick = () => batchDeleteConfirm();
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn-default';
  cancel.textContent = '取消';
  cancel.onclick = () => { exitBatchState(); renderCalendar(document.querySelector('#view')); };
  right.append(del, cancel);
  bar.append(tip, right);
  return bar;
}
```

- [ ] **Step 3: `renderCalendar` 签名 + 顶部自动退出兜底**

把第 67 行：

```js
export async function renderCalendar(container) {
```

改为：

```js
export async function renderCalendar(container, opts = {}) {
  // 批量删除多选态：任何外部触发/重渲染自动退出（本态进入/退出自渲染走 opts.keepBatch）
  if (batchDeleteActive && !opts.keepBatch) exitBatchState();
```

- [ ] **Step 4: 工具栏按钮 + 批量条插入**

把 171-179 行块：

```js
  const autoBtn = btn('智能排班', true, false, ICON_ZAP), bulkBtn = btn('批量铺排', false, false, ICON_BULK);
  // 导出图片：直接按钮（无下拉）；周 = 当前周面板，月 = 整月视图长图（含首尾灰显邻月日）
  const exportBtn = btn('导出图片', false, false, ICON_IMAGE);
  left.append(prev, label, next, todayBtn);
  // 人员维度为只读视图：隐藏智能排班/批量铺排（导出仍可用，截图跟随当前视图）
  if (viewMode === 'staff') right.append(exportBtn);
  else right.append(autoBtn, bulkBtn, exportBtn);
  bar.append(left, right);
  container.appendChild(bar);
```

改为：

```js
  const autoBtn = btn('智能排班', true, false, ICON_ZAP), bulkBtn = btn('批量铺排', false, false, ICON_BULK);
  const delBatchBtn = btn('批量删除', false, false, ICON_TRASH);
  // 导出图片：直接按钮（无下拉）；周 = 当前周面板，月 = 整月视图长图（含首尾灰显邻月日）
  const exportBtn = btn('导出图片', false, false, ICON_IMAGE);
  left.append(prev, label, next, todayBtn);
  // 人员维度为只读视图：隐藏 智能排班/批量铺排/批量删除（导出仍可用，截图跟随当前视图）
  if (viewMode === 'staff') right.append(exportBtn);
  else right.append(autoBtn, bulkBtn, delBatchBtn, exportBtn);
  bar.append(left, right);
  container.appendChild(bar);
  if (batchDeleteActive) container.appendChild(buildBatchBar());
```

- [ ] **Step 5: 批量删除按钮事件**

在 181-185 行区（`autoBtn.onclick = () => smartPlanDialog();` 等附近）追加：

```js
  delBatchBtn.onclick = () => {
    batchDeleteActive = true;
    batchSel.clear();
    renderCalendar(container, { keepBatch: true });
    // 当前可见区无可删班次（空周/空月/空态）→ 退出并提示，避免空选择态
    if (!document.querySelectorAll('.cal-slot-card .sch-card.selectable').length) {
      exitBatchState();
      renderCalendar(container);
      showToast('当前视图没有可删除的班次', 'info');
    }
  };
```

- [ ] **Step 6: 卡片多选渲染分支（三处局部替换）**

**6a.** 把 443-448 行交互块：

```js
  if (!readOnly) {
    card.title = '点击手动分配人员';
    card.onclick = () => scheduleDialog(sch);
    // 落点精确到卡片：拖到哪张任务卡片，人就进哪个班次（同格多班次不再取第一个）
    enableDrop(card, { onDrop: (e) => dropStaff(e, sch.id) });
  }
```

改为：

```js
  if (batchDeleteActive && !readOnly) {
    // 批量删除态：整卡点击即勾选/取消（不打开分配弹窗），右上角勾选点随选中填充
    card.classList.add('selectable');
    card.title = batchSel.has(sch.id) ? '取消选择该班次' : '选择该班次（可多选，点卡片切换）';
    if (batchSel.has(sch.id)) card.classList.add('selected');
    card.onclick = () => toggleBatchSel(sch.id, card);
    const tick = document.createElement('span');
    tick.className = 'sch-sel-tick';
    tick.textContent = '✓';
    card.appendChild(tick);
  } else if (!readOnly) {
    card.title = '点击手动分配人员';
    card.onclick = () => scheduleDialog(sch);
    // 落点精确到卡片：拖到哪张任务卡片，人就进哪个班次（同格多班次不再取第一个）
    enableDrop(card, { onDrop: (e) => dropStaff(e, sch.id) });
  }
```

**6b.** 把 481-484 行人名 chip 块：

```js
    if (!readOnly) { // 只读视图：不可拖拽，仍可点击人名进入替换弹窗
      enableDrag(chip, { onDragStart: (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ staffId: sid, scheduleId: sch.id })); } });
    }
    chip.onclick = (e) => { e.stopPropagation(); openReplaceDialog(staff, sch); };
```

改为：

```js
    if (!readOnly && !batchDeleteActive) { // 只读/批量删除态：不可拖拽
      enableDrag(chip, { onDragStart: (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ staffId: sid, scheduleId: sch.id })); } });
    }
    // 批量删除态：人名不单独开替换——点击事件冒泡到卡片即勾选；只读（人员维度）仍可点人名替换
    if (!batchDeleteActive) chip.onclick = (e) => { e.stopPropagation(); openReplaceDialog(staff, sch); };
```

**6c.** 把 495 行（未满员 else 分支内）的智能排班行开关：

```js
    if (!readOnly) {
      // 底部一行：需/缺 N 人（左）+ 智能排班小图标（右）；闪电与工具栏「智能排班」同款
```

改为：

```js
    if (!readOnly && !batchDeleteActive) {
      // 底部一行：需/缺 N 人（左）+ 智能排班小图标（右）；闪电与工具栏「智能排班」同款
```

（6c 改后，批量删除态下未满员班次走 `else` 分支只显示 `cap` 文本，无 ⚡，避免误触。）

- [ ] **Step 7: 自查批量删除路径**

- `grep batchDeleteActive`：出现于 模块定义（Step2）、renderCalendar 顶部（Step3）、工具栏构建 delBatchBtn 不出现态判断/批量条插入（Step4）、delBatchBtn.onclick（Step5）、renderScheduleCard 6a/6b/6c。
- 选卡交互不触发整窗重渲染（`toggleBatchSel` 只加/删 class + 改条上计数，无 `renderCalendar` 调用）。
- 「删除所选」确认后对每个班次先 `applyDelta(ctx,…,-1)` 回退再 `removeSchedule(id)`；最终 `exitBatchState()` + 一次 `renderCalendar`。
- `renderScheduleCard` 里 `sch` 仍指传入的真实班次对象（批量删除只读它，不改）。

---

### Task 3: theme.js 样式（`.cal-batch-*` + 卡选择态 + `.asg-savehint`）

**Files:**
- Modify: `src/ui/theme.js`（CSS 模板串末尾，`.smart-hint` 规则之后、收尾反引号 `695` 之前插入）

**Interfaces:**
- Consumes: 无（纯 CSS 追加）。
- Produces: 类 `.cal-batch-bar / .cal-batch-tip(b) / .cal-batch-right / .cal-batch-del / .sch-card.selectable(.selected) / .sch-sel-tick / .asg-savehint`。Task 2（批量条/勾选态）与 Task 1（暂存 hint）消费。

- [ ] **Step 1: 在 CSS 模板串末尾插入**

在 `theme.js` 的 `.smart-hint { … }` 规则行与文件收尾反引号 `` ` `` 之间插入：

```css

/* ===== 排班删除改造：批量删除多选态 + 分配弹窗暂存提示 ===== */
.cal-batch-bar { display:flex; align-items:center; justify-content:space-between; gap:10px;
  background:#fdf0ef; border:1px solid #fecaca; border-radius:8px;
  padding:7px 10px; margin:-4px 0 10px; font-size:12px; color:#7f1d1d; }
.cal-batch-tip { display:flex; align-items:center; gap:2px; }
.cal-batch-tip b { color:#dc2626; font-size:13px; }
.cal-batch-right { display:flex; gap:8px; }
.sch-card.selectable { position:relative; cursor:pointer; }
.sch-card.selectable:hover { box-shadow:0 2px 6px rgba(220,38,38,.18); outline:1px solid #fca5a5; }
.sch-card.selectable.selected { outline:2px solid #dc2626; outline-offset:-2px; background:#fff7f7; box-shadow:none; transform:none; }
.sch-sel-tick { position:absolute; top:3px; right:3px; width:16px; height:16px; border-radius:50%;
  border:1px solid #f9a8a8; background:#fff; color:transparent; font-size:10px; line-height:14px;
  text-align:center; pointer-events:none; }
.sch-card.selectable.selected .sch-sel-tick { background:#dc2626; border-color:#dc2626; color:#fff; }
.asg-savehint { font-size:11px; color:#9b91a7; margin-top:12px; line-height:1.5; }
```

- [ ] **Step 2: 无逻辑可单测——样式生效由 Task 5 浏览器实测核对**

---

### Task 4: spec.md 语义同步（.ai 规约）

**Files:**
- Modify: `.ai/spec.md`（§5.2「排班分配弹窗」相关条目 + 删除语义）

**Interfaces:**
- Consumes: Task 1-3 定稿行为。
- Produces: spec 与行为一致（spec 只反映当前态，无历史区）。

- [ ] **Step 1: 改写 §5.2 分配弹窗条目**

定位现条目（含「点行即加 · 保留已选」「分配弹窗候选两区」等）。在其下补充/改述「编辑落库 = 暂存 + 确认保存」语义，把现文中「点击可添加行 = 加入该人…再点一次已选行 = 取消选中」的即时落库表述，改写为**弹窗内暂存、点「确认保存」一次性落库、关闭即放弃**（加/移实时反馈高亮/chips/进度不变，仅落库时机后置；无改动时确认保存禁用）。用下列整段替换该候选条目标记段落：

```markdown
  - **分配「点行即加 · 暂存 + 确认保存」**：弹窗打开即快照班次原有人，内部只编辑**工作副本**（加人 = 暂存勾选、chip × 移除 = 暂存移除），计数与候选在弹窗内克隆 ctx 上实时演进，**不落库**。底部主钮「确认保存」（无改动禁用）按**净差**（净增/净减人员）一次性写库并关窗，toast 汇总新增/移出人数；直接关闭/ESC = 放弃本次改动。**删除不在此弹窗**——班次删除统一走工具栏「批量删除」（见下）。
```

- [ ] **Step 2: 在 §5.2 补「批量删除」条目（放「拖拽人名」条目附近）**

```markdown
- **批量删除班次**：工具栏按钮（**总览 / 项目维度**显示；人员只读维度不出现）→ 进入**多选态**：网格上方浮「批量删除 · 已选 N 个班次，点卡片勾选/取消」条，当前可见班次卡均可勾选（左上角勾选点填充、选中高亮描边）；多选态下点卡 = 勾选/取消（不开分配弹窗，人名/⚡/拖拽均不触发）。「删除所选 (N)」（N=0 禁用）→ `confirmDialog` 二次确认（列 N 与前 ≤5 条预览）→ 确认后逐班次对其已排人员做**三轨 ctx 回退**（窗口/自然周/自然月 + 日/时段，同 accumulateDelta）再删除，toast「已删除 N 个班次」。多选范围 = 当前可见班次（周 = 当前周、月 = 整月各面板、总览 = 全部、项目 = 该任务）；**任何翻周/月、切粒度/维度、菜单重进等重渲染自动退出多选态**；空视图点入口提示「当前视图没有可删除的班次」。
```

- [ ] **Step 3: 核对 §5.2 无残留「删除班次在分配弹窗」/ 旧即时落库表述**

---

### Task 5: 全量验证（单测回归 + 浏览器实测 + memory 记档）

**Files:** 无（验证/记档）

- [ ] **Step 1: 跑全量单测（core 无改动，回归看护）**

Run: `npm test`
Expected: 全部 PASS（基线 105）。

- [ ] **Step 2: 语法自检**

Run: `node --check src/views/calendar.js && node --check src/ui/theme.js`
Expected: 无输出（通过）。

- [ ] **Step 3: 启动 dev server 浏览器实测（大改，跨组件 + 数据流一致性）**

Run: `node ./node_modules/vite/bin/vite.js --port 5173 --strictPort`（后台）

核对清单（Playwright MCP）：
1. **分配弹窗暂存放弃**：点班次卡 → 加 1 人（高亮/chips/进度实时变）→ 直接「关闭」→ 班次未变、无落库；重开弹窗人员如初。
2. **分配弹窗保存**：加 1 人 →「确认保存」→ 落库 + 关窗 + 网格 card 出现该人名 chip + toast「已保存 · 新增 1」；staff chip 周疲劳/当日计数正确。无改动时「确认保存」禁用（title 说明）。
3. **先移后加净差**：满员班次先 chip × 移出 1 人（候选重现）再加另 1 人 →「确认保存」→ 净差 1 进 1 出落库；对应两人三轨计数正确（不因中间态多写/漏写）。
4. **批量删除**：点工具栏「批量删除」→ 批量条出现；点卡片勾选（勾选点填充）计数「已选 N」联动；再点取消单张计数回落；「删除所选」→ 二次确认（列预览）→ 确认后卡片消失、staff chip 疲劳/当日计数回退、toast「已删除 N」、批量条消失、按钮态还原。
5. **自动退出**：多选态下翻周/切月/切「项目/人员」维度/侧栏重进 → 选择清空、批量条消失、卡恢复可点开分配弹窗。
6. **只读维度**：切「人员」维度 → 「批量删除」按钮不出现；切「总览/项目」出现。
7. **空态**：翻到无任何班次的周/月 → 点「批量删除」→ toast「当前视图没有可删除的班次」且不进入多选态。
8. **样式**：无新增内联 cssText（新增 UI 全用类）；批量条/勾选态/选中描边观感正常；分配弹窗底部灰 hint 文案可见。
- 测试数据还原：遵守 pitfalls #33（备份走 localStorage 临时 key）+ memory「还原后核对卡片行 + 弹窗数」注意。

- [ ] **Step 4: memory.md 记档（不提交）**

更新 `.ai/memory.md`：新增「09-07 批次 3（未提交）——排班删除改造」条目：分配弹窗改「暂存 + 确认保存」（净差落库、关闭即弃、无改动禁用）、删除移出弹窗、工具栏「批量删除」多选态（总览/项目可用、自动退出、二次确认、三轨回退）；补核心决策一行；随批次 1/2 一并 /commit。

---

## 自审记录

- **Spec 覆盖**（对照 `docs/superpowers/specs/2026-09-07-schedule-delete-batch-design.md`）：
  - §3 scheduleDialog 暂存化（draft/dctx/净差/确认保存/禁用/hint/删除分支移除）→ Task 1。
  - §4.1 模块状态与生命周期（renderCalendar 兜底自动退出）→ Task 2 Step 2/3。
  - §4.2 工具栏按钮 + 批量条（计数/删除/取消）→ Task 2 Step 4/5 + Task 3。
  - §4.3 卡片多选渲染（selectable/selected/tick、覆盖 chip/⚡/拖拽）→ Task 2 Step 6 + Task 3。
  - §4.4 二次确认 + 三轨回退 → Task 2 Step 2（batchDeleteConfirm）。
  - §4.5 空态防呆 → Task 2 Step 5（无可删 toast）；§4.6 样式 → Task 3。
  - §5 文件/同步（spec/memory，无新 key、无 core 改动）→ Task 4/5。
- **无占位**：所有代码步骤含完整代码/精确锚点；无 TBD/TODO。
- **类型一致**：`toggleBatchSel(schId, card)`、`batchDeleteConfirm()`、`buildBatchBar()`、`renderCalendar(container, opts={keepBatch})`、`exitBatchState()` 在 Task 2 各步与 Task 1 消费处（okBtn 后 `renderCalendar(document.querySelector('#view'))` 走默认不 keepBatch = 自动退出）签名一致；`batchSel` 是 `Set`，`.has/.add/.delete/.size` 用法一致。
- **已知取舍**：① 删除不再有弹窗内单张入口，单张删除需走批量删除勾 1 张——符合 Tao 拍板（「删除统一走批量删除」）；② 分配弹窗候选「已选」高亮仍即时反馈但**无逐次 toast**（聚合到确认保存的汇总 toast），避免「假落库」误导。
