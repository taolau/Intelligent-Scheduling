# 排班删除改造设计（分配弹窗「暂存+确认保存」 + 批量删除多选）

> 2026-09-07 与 Tao 逐项确认。范围：排班视图（calendar.js）删除语义重做——单张删除入口从「排班分配」弹窗底部撤出，改弹窗为「暂存编辑 + 确认保存一次性落库」；删除统一收口到工具栏新增的「批量删除」多选流程（勾选 → 二次确认 → 批量删除）。

---

## 1. 背景与问题

当前「删除一个班次」唯一入口 = 点开班次卡 → 「排班分配」弹窗（`scheduleDialog`）底部**红色「删除班次」按钮**（calendar.js ~532-544）。该弹窗内加人/移人全部**即时落库**（每点一次 `saveSchedule` + 整窗 `renderCalendar`），弹窗没有「保存/收尾」概念，删除作为破坏性操作与日常排人挤在同一 footer。

Tao 指出的问题与目标：
- 破坏性删除与常规编辑同处一窗，误点风险高；希望删除移出弹窗，集中成可控的**批量删除**。
- 分配弹窗里每点一下都立即写库 + 刷新身后日历，改到一半想反悔已不可撤销；希望**弹窗内暂存、点「确认保存」才一次性落库**，关闭即放弃。

## 2. 语义决策（Tao 拍板）

1. **对象**：排班视图（周/月历格子里的班次卡 `.sch-card`）的删除。不是数据配置页的任务删除。
2. **弹窗删除移除 + 确认保存**：「排班分配」弹窗去掉红色「删除班次」；内部编辑改为**暂存模型**，footer 主按钮 = 「确认保存」（btn-primary，右置），保存才落库、无改动禁用；直接关闭/ESC = 放弃本次改动，不写库。
3. **删除收口到批量删除**：工具栏新增「批量删除」按钮（总览 / 项目维度显示；**人员只读维度隐藏**，同 智能排班/批量铺排 现有隐藏逻辑）。点击进入**多选态**，可连点当前可见班次卡勾选；网格上方浮 `.cal-batch-bar`（已选计数 + 删除所选(红) + 取消）；删除走二次确认后批量执行。
4. **多选范围 = 当前可见卡片**（所见即所选，天然限界）：周 = 当前周面板；月 = 整月各面板；总览 = 全部；项目 = 该任务筛选下的班次。人员维度（只读）不提供批量删除入口，故无「删该人所属班次」的语义纠结。
5. **自动退出多选态**：任何引发重渲染的外部操作（翻周/月、切粒度/维度、侧栏菜单重进、其他写库后重渲染）自动清空选择退出；卡片勾选本身用 DOM 局部 class 切换、不重渲染。

---

## 3. 改动一：`scheduleDialog` 暂存化 + 确认保存（`src/views/calendar.js`）

### 3.1 状态模型

- 打开弹窗时快照 `origStaffIds = [...sch.staffIds]`；克隆工作副本 `draft = { ...sch, staffIds: [...sch.staffIds] }` 与 `dctx = cloneCtx(ctx)`。
- 弹窗内所有读与改（候选 filter/score/info、已排 chips、进度、满员 no-slot 判定）一律改用 `draft` + `dctx`，**不触碰真实 `sch` / `ctx`**，不调用 `saveSchedule`。
  - 现多处引用模块级 `ctx` 与 `sch.staffIds` 的代码改指向局部 `dctx` / `draft.staffIds`（`filterCandidate(s, sch, projectById, ctx)`、`scoreCandidate`、`narrateReasons`、`applyDelta(ctx, …)`、fatigueByWeek 读取等）。
- 增/移仍即时反馈：候选行点选 → `draft.staffIds.push` + `applyDelta(dctx, +1)` + 行 `.picked` 高亮；chip × / 再点已选行取消 → `draft.staffIds` 过滤 + `applyDelta(dctx, -1)`（加回候选走整窗 renderBody 重算，逻辑同现行为，只是不落库）。中间态只在 `dctx` 上加减，天然可撤销。
- **净差提交**：确认保存时按**集合差**算净增/净减（不逐操作回放，避免中间「加又删」对真实 ctx 多写）：
  - 对 `orig` 有而 `draft` 无的 id：`applyDelta(ctx, sid, draft, -1)`。
  - 对 `draft` 有而 `orig` 无的 id：`applyDelta(ctx, sid, draft, +1)`。
  - 随后 `saveSchedule(draft)` → 关窗 → 重渲染。
- 提交时的 toast 汇总：净增/净减人数（如「已保存：新增 2 人 · 班次 N 人」）；若净增人员中有**当日达预警阈值**者（`warnDailyCount`），并入提醒（替代原逐点点击的预警 toast）。

### 3.2 按钮与提示

- footer = 自动「关闭」(左) + 「确认保存」(右, btn-primary)。**无 pending 改动（净差为 0）时确认保存禁用**；标题/禁用原因用 title 说明。
- 弹窗 body 底部加一行灰字 hint：「改动暂存，点「确认保存」生效；直接关闭不保存」。
- **删除分支整段移除**（calendar.js 现 `delBtn` 构造 + `confirmDialog` + `deleteSchedule()` 内 ctx 回退与 `removeSchedule` 全部删除——批量删除路径接管 ctx 回退）。

### 3.3 边界

| 情形 | 处理 |
| --- | --- |
| 打开即满员（capacity 满） | 现「仅显满员绿条、不渲染候选」逻辑保留，基于 `draft` 计数；移人后才 renderBody 出候选 |
| 打开后移人再放弃（直接关闭） | 不落库；真实 `sch`/`ctx` 未动 |
| 加人后又取消（净差 0） | 确认保存禁用；关闭即弃 |
| 候选/受限列表正确性 | 全部基于 `dctx` 现算（移除成员后 renderBody 重算会使其按 `dctx` 正确回到候选/受限） |
| 替换弹窗 / 拖拽 / 智能排班 / 批量铺排 | 不受影响（本次只改 scheduleDialog 与新增批量删除两条路径） |

---

## 4. 改动二：批量删除多选态（`calendar.js` + `theme.js`）

### 4.1 模块级状态与生命周期

- 模块级：`let batchDeleteActive = false; const batchSel = new Set();`（sch.id 集合）。
- `renderCalendar(container, opts)` 增加可选参：顶部若 `batchDeleteActive && !opts?.keepBatch` → 自动退出多选态（置 false + 清空 batchSel），保证外部一切重渲染都自动退出。进入/退出多选态本身用 `keepBatch` 自渲染，不触发自动退出。

### 4.2 工具栏与批量条

- 工具栏（right 动作组，非 staff 维度）在 智能排班/批量铺排/导出图片 间新增「批量删除」`delBatchBtn = btn('批量删除', …)`。点击：`batchDeleteActive=true; batchSel.clear(); renderCalendar(container, { keepBatch:true })`。
- 多选态下，工具栏下插入 `.cal-batch-bar`：
  - 左文案：「批量删除 · 已选 <b id=…>N</b> 个班次，点卡片勾选/取消」。
  - 右：[删除所选 (N)]（btn-danger，N=0 禁用）+ [取消]（btn-default，=`退出多选态`）。
- 勾选切换（不重渲染）：`toggleBatchSel(schId, card)` → 有则从 `batchSel` 删并去掉 `.selected`，无则加入并加 `.selected`；同时更新计数文案与删除钮禁用态（计数 = `document.querySelectorAll('.sch-card.selected').length`）。

### 4.3 卡片多选渲染（`renderScheduleCard`）

`buildGridPanel`/`renderScheduleCard` 已按 `readOnly` 分支。多选态仅在非只读视图出现（staff 不显示入口 → 天然不会在此态），判定用模块 `batchDeleteActive`：

- `batchDeleteActive` 时：卡片加 `.sch-card.selectable`（左上角勾选圆点标记，选中变 ✓/高亮），**替换常规点击行为**——`card.onclick` 不打开 `scheduleDialog`，改为 `toggleBatchSelect`；内部人名 chip 不挂 `onclick`/拖拽、智能排班⚡按钮不渲染或点击不触发，避免小目标误触进入替换/填充；`enableDrop` 不绑。任何落在卡片上的点击都视为「勾选/取消」。
- 非多选态维持现状（点卡开分配弹窗 / 点人名开替换 / ⚡单班次填充 / 拖拽）。

### 4.4 删除所选（二次确认）

- 「删除所选 (N)」→ `confirmDialog`：
  - title「批量删除班次」，`confirmText`「确认删除」，红 `btn-danger`。
  - message（`pre-line`，可多行）：首行「确认删除所选 N 个班次？删除后不可恢复。」；次段「其中已排人员将从当日任务数与周/月疲劳计数中回退。」；再列前 ≤5 行预览 `MM-DD · 时段 · 任务名`（超出显示「… 等共 N 个」），供确认前核对。
- 确认后遍历 `[...batchSel]`：对每个 `sch`，先对其每名已排人员 `applyDelta(ctx, sid, sch, -1)`（三轨：窗口/自然周/自然月 + 日/时段，规则唯一实现 `accumulateDelta`，与单张删除同源），再 `removeSchedule(sch.id)`。全部完成后：退出多选态 + 重渲染 + toast「已删除 N 个班次」。

### 4.5 空态与防呆

| 情形 | 处理 |
| --- | --- |
| 点入口但当前视图无班次卡 | 不进入多选态，toast「当前视图暂无班次」 |
| 多选态下选中 0 张 | 删除钮禁用 |
| 项目维度空态（早退空态卡） | 同「无班次卡」处理 |
| 月粒度跨面板多选 | 各面板卡片统一可勾，删除跨周生效 |

### 4.6 样式（`src/ui/theme.js`）

新增 `.cal-batch-*` 段 + 卡选择态：
- `.cal-batch-bar`（工具栏下方横条，浅底）。
- `.sch-card.selectable`（hover 提示可勾选 + 光标）。
- `.sch-card.selected`（描边/高亮选中态，配套左上角勾选 tick 视觉）。
- 体例对齐：不写内联 cssText，全部收敛进 theme.js 该段。

---

## 5. 涉及文件与文档同步

| 文件 | 改动 |
| --- | --- |
| `src/views/calendar.js` | scheduleDialog 暂存化（3.1/3.2）；删除分支整段移除；新增 batch 状态 + 工具栏按钮 + `.cal-batch-bar` + 卡片多选渲染分支 + toggleBatchSel + 批量删除确认（4.x）；renderCalendar 自动退出兜底 |
| `src/ui/theme.js` | 新增 `.cal-batch-*` 与 `.sch-card.selectable/.selected` 样式段（4.6） |
| `.ai/spec.md` | 5.2「排班分配弹窗」条目：删除移出 + 「点行即加·保留已选」改为「弹窗内暂存、确认保存一次性落库、关闭即放弃」；5.2 工具栏与删除语义补「批量删除」多选条目（含总览/项目可用、人员只读不出现、自动退出、二次确认、三轨回退） |
| `.ai/memory.md` | 记 09-07 批次 3（删除改造） |
| `docs/superpowers/specs/` | 本文档 |

无新增 localStorage key、无 core 层纯函数改动（批量删除的 ctx 回退复用现有 `applyDelta`/`accumulateDelta`；净差计算为弹窗内少量集合差，不必抽 core）。

## 6. 验证分级

- **node:test**：跑全量确认 105 全绿（core 层无改动，回归看护）。
- **Playwright 实测（大改，跨组件联动 + 数据流一致性，按 CLAUDE.md 分级开实测）**：
  1. 分配弹窗：暂存加人后直接关闭 → 班次未变；重开暂存加人后「确认保存」→ 落库 + 人员 chip 出现 + 计数正确；「无改动时确认保存禁用」。
  2. 分配弹窗：先移后加再保存 → 净差落库、真实 ctx（周疲劳/当日数）正确，不因中间态多写。
  3. 批量删除：进入多选 → 勾选多张（含跨时段/跨面板）→ 计数正确 → 取消单张 → 二次确认删除 → 卡片消失、其余卡上 staff chip 疲劳/当日计数回退、toast 计数与所选一致。
  4. 自动退出：多选态下翻周/切粒度/切维度 → 选择清空且按钮态还原。
- 测试数据还原：遵守 pitfalls #33（备份走 localStorage 临时 key）/ memory「还原后核对卡片行 + 弹窗数」注意事项。

## 7. 体例注意（复用既有约定）

- footer 按钮顺序 = 次要左 / 主按钮右；破坏性批量删除用红 `btn-danger`（经 confirmDialog）；确认保存非破坏用 `btn-primary`。
- 卡片多选态覆盖小目标交互（人名 chip / ⚡ / 拖拽）是防误触关键，勿只拦 card.onclick。
- 不新增 store 批量删除 API（单条 `removeSchedule` 循环即可）；不新增 localStorage key。
