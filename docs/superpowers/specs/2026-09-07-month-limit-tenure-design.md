# 系统设置补充：月疲劳上限 + 同任务连任上限设计

> 2026-09-07 与 Tao 逐项确认。范围：给系统补两条新的排班约束——①**月维度上限**（每人字段 + 设置默认，硬约束一票否决，月粒度三合一：拦截 + 月 chip 红黄 + hover/摘要带上限），含**月疲劳积分**与**月高强度次数**两档（疲劳 + 高强并行，各自独立上限）；②**同一任务连任上限**（全局设置默认 3、0=关闭，硬拦 + 无他人可选豁免）。均进入硬性过滤，评分均衡公式不变。

> **2026-09-07 实现中追加（Tao 拍板）**：原 "不做月高强度" 的 YAGNI 被推翻——高强度上限拆周/月两档：每人 `maxMonthlyHeavyCount`（0 = 禁排高强度整个自然月）+ 设置 `defaultMonthlyHeavyCount` 默认 8，三合一红黄同月疲劳；新增 `ctx.heavyByMonth` 计数轨道（buildContext 聚合 / cloneCtx 深拷贝 / accumulateDelta ±）。

---

## 1. 背景与问题

现系统只有**单周透支保护**（`maxWeeklyFatigue` / `maxHeavyTaskCount`，按班次所在自然周滚动窗口硬拦）与**移动窗口均衡标尺**（`balanceWindowDays`，只进打分不进过滤）：

- **缺整月统筹**：月粒度视图只展示「本月累计 N」，无月上限约束——某人整月被堆到远超合理总量也没有硬性拦截；周上限按周滚动，管不住"每周都在上限内、但整月无度堆积"。
- **缺轮换纪律**：同一任务（尤其按周重复的周期任务）可能被同一个人连任多期，无人手时更是如此——没有机制提示"该轮换他人了"，也无强制轮换的杠杆。

本次在既有硬过滤体系内**对称扩展**：月上限复刻周上限的「每人字段 + 设置默认 + 三态文案 + 红黄 chip」全套；连任上限新增一条全局轮换规则，仅在确实无人可选时豁免保运转。

## 2. 语义决策（Tao 拍板）

1. **月疲劳上限 = 硬约束，同周上限三合一**：超上限则该自然月内拒绝再排此人（一票否决，覆盖拖拽/自动/替补/分配全入口）+ 月 chip「本月 X / 上限」超限红黄。
2. **月上限归属 = 每人字段 + 设置给默认**：复刻 `maxWeeklyFatigue ↔ defaultWeeklyFatigue` 结构（人员卡片/编辑弹窗逐人可调；系统设置「新建人员默认」给新人/Excel 缺省默认）。
3. **月窗口口径 = 固定自然月**（`YYYY-MM`），与月粒度/月 chip 完全同口径。**已知副作用接受**：自然月非滚动窗口，月底/月初相邻两天分属两月，会有「月底卡死、月初突松」的边界表现（周上限当初改用滚动窗口是为消此突刺，月上限定位是整月统筹，保留固定自然月语义）。
4. **连任判定对象 = 同一任务整体合并计数**（不分星期几、时段，同任务全部排班归并）。连续单位 =「该任务实际发生的自然周」：某周该任务无任何排班 = 空窗，**不中断**（不影响链）；某周该任务有排班但无此人（他人接手）= **中断清零**。
5. **连任行为 = 硬拦 + 无他人可选时豁免**：默认拒绝继续连任（原因文案带已连任期数）；但当扣除本人后该班次无任何通过其余硬规则的候选时，连任拦截不成立 → 放行并提示，保运转不空班。
6. **连任上限值 = 全局设置参数**（范围 0~26，**0 = 关闭该约束**），默认 3：允许连任 N 期，第 N+1 期强制轮换（含未来已排定班次计入段长，防批量预排绕开）。
7. **拦截时刻 = 每次"将某人写入某班次"的落库动作**（新建分配/替换/拖拽/自动填充/闪电），`simulateAutoFill` 预览与执行同一决策通道自动感知。已落库的历史超限不回溯删除。
8. **互不叠加豁免**：周上限 / 月上限 / 连任三条各自独立触发，无交叉兜底。

## 3. 数据模型（`src/data/model.js`）

### 3.1 Staff 新增字段 `maxMonthlyFatigue`

- `Staff.maxMonthlyFatigue: Number`（每人自然月劳累积分上限）。
- `createStaff` 加 `maxMonthlyFatigue: fields.maxMonthlyFatigue ?? defaults.maxMonthlyFatigue ?? DEFAULT_SETTINGS.defaultMonthlyFatigue`（对齐现有 `maxWeeklyFatigue` 行写法）。
- `validateStaff` 加 `{ cond: s.maxMonthlyFatigue < 1, field: 'maxMonthlyFatigue', msg: '月疲劳上限必须 >= 1' }`。
- 旧人员数据无该字段 → 读取兜底（走 createStaff 默认链，见兼容节）。

### 3.2 `DEFAULT_SETTINGS` 新增两键

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `defaultMonthlyFatigue` | `40` | 新建人员/Excel 缺省时的月上限（范围 1~999） |
| `tenureLimit` | `3` | 同一任务连任上限（0 = 关闭；范围 0~26） |

- `getSettings`/`saveSettings` 已是 `{ ...DEFAULT_SETTINGS, ...saved }` 全键合并 → 旧 localStorage / 旧 JSON 备份缺这两键自动补默认，零迁移成本。
- 消费端逐键兜底 `ctx.settings?.tenureLimit ?? DEFAULT_SETTINGS.tenureLimit`（沿用 pitfalls #28：禁止整体解构一把 `??`）。

## 4. 算法层（`src/core/filter.js` + `src/core/substitute.js`）

### 4.1 R1 月疲劳上限（filter 第 8 条硬规则）

```
monthKey = schedule.date.slice(0, 7)                 // YYYY-MM，与 ctx.fatigueByMonth 键同构
f = ctx.fatigueByMonth?.get(`${staff.id}|${monthKey}`) ?? 0
f + project.fatigueScore > staff.maxMonthlyFatigue → 拒绝
```

- 直接复用现有 `fatigueByMonth` 计数轨道（`substitute.js buildContext` 三轨之一，键 `${sid}|YYYY-MM`），无需新增 ctx 计数。
- **文案三分**（沿用 pitfalls #27 现状/预测态，不写死"将超限"）：
  - `f > 上限` → `本月劳累积分已超限（上限 ${maxMonthlyFatigue}）`
  - `f === 上限` → `本月劳累积分已达上限（${maxMonthlyFatigue}）`
  - 其余 → `本月劳累积分将超限（上限 ${maxMonthlyFatigue}）`
- 约束对象为自然人（含 `new`）；`rest`/`left` 已被前置规则拦截不进入本判断。

### 4.2 R2 同任务连任上限（filter 第 9 条硬规则，`tenureLimit > 0` 才生效）

**连续段定义**：对某任务 P，取其全部排班的所在自然周（`getWeekStart(date)`）去重升序 = P 的"有发生周集" `Ws`。对某 staff，其在 `Ws` 中被选中（该周 P 的任一班次 `staffIds` 含此人）的周连成极大连续块（相邻两选中周之间在 `Ws` 序中相邻，无未被选中的"有发生周"夹在中间）= 该 staff 在 P 上的一个段 `{start, end, len}`（len = 块内周数）。

**判定**（将 staff 写入日期 D、所在自然周 W0 的 P 班次）：
- 若 W0 已含 staff（同周另一班次已是此人）→ 段不变，不额外触发。
- 否则：找 staff 在 P 上**与 W0 相接**的段（W0 ∈ 段，或 W0 与段在 `Ws` 序中相邻——即段端与 W0 之间无其他"有发生周"）。把 W0 并入后，合并段长可能同时吃进过去一段 + 未来一段。
- 合并段长 `> tenureLimit` → 拒绝（允许连任 N 期，第 N+1 期拦截）。含未来已排定段计入 → 批量预排未来无法绕过（逐期加入时各自触发）。

**ctx 预聚合**（`substitute.js buildContext` 一次性产出，filter O(1) 读，不即时扫 schedules）：
- `ctx.projectWeeks`：`Map<projectId, weekStart[]>`（升序有发生周，供找"相接"判断用）。
- `ctx.tenureSegs`：`Map<sid|projectId, {start,end,len}[]>`（按周起点排序）。
- 两者随 `cloneCtx` 克隆（auto 逐班决策感知前面分配）。
- ⚠ ctx 若未来新增"谁构建 ctx 谁保证这两表"约束，勿精简（对齐 pitfalls #1：聚合上下文返回字段 = 下游算法消费字段的并集）。

**豁免**（扣除本人后无他人可选）：
- 语义 = 该班次把此人排除后，遍历其余 staffs 无一通过**其余**硬规则 → 连任拦截放行，reasons 中该条替换为提示性文案（放行仍在候选内）。
- 因豁免需要"整班候选视野"（单个 `filterCandidate` 调用看不到其他人），本次抽一个**统一候选评估 helper**，替换/分配弹窗/智能排班/闪电/拖拽共用：
  - helper 先对全部 staffs 跑既有 filter（连任原因带标记可区分）；
  - 若"因连任被拦者"是唯一可能填补者（剔除其本人后其余无人通过）→ 该本人豁免放行；
  - 否则正常按 filter 结果展示/决策。
- 各入口行为一致，是本需求引入的唯一一次小重构（现各入口各自 for…filterCandidate）。

### 4.3 打分与均衡

`scoreCandidate` **零改动**——月上限/连任只进硬过滤与红黄展示，均衡公式与 `balanceWindowDays` 语义不变。

## 5. UI 改动（`src/views/calendar.js` + `src/views/config.js`）

### 5.1 月粒度 chip 红黄补齐（calendar.js）

- `staffChipClass` 月粒度分支现直接 `return 'staff-chip'`（不判）→ 改为：
  - `mf > staff.maxMonthlyFatigue` → `staff-chip over`（红）
  - `mf >= staff.maxMonthlyFatigue * 0.8` → `staff-chip warn`（黄，对称周粒度 0.8 阈值；Tao 保留黄级）
  - 否则原样
- hover 文案月分支 `本月累计 ${mf}` → `本月累计 ${mf}/${staff.maxMonthlyFatigue} · 本周 … · 当日 …`。
- 人员维度摘要行（月粒度）`疲劳 ${fatigue}` → `疲劳 ${fatigue}/${st?.maxMonthlyFatigue ?? 0}`。
- 周粒度不受影响（周上限红黄语义照旧；月上限只在月粒度做红黄，spec 5.2「周上限语义仅周粒度」不改——月 chip 红黄换绑到月上限）。

### 5.2 人员卡片 / 编辑弹窗（config.js）

- 人员卡片 rows：在「周疲劳上限」行后加「月疲劳上限」行，值 `s.maxMonthlyFatigue`。
- 编辑弹窗：加「月疲劳上限」数字输入（min 1），与周疲劳/高强度上限同区；保存 `createProject`→`createStaff` 带新字段；`validateStaff` 错误按 `byField.maxMonthlyFatigue` 显示。

### 5.3 系统设置 tab（config.js renderSettings 区 + RULE_SECS）

- 「新建人员默认」组加一行 `defaultMonthlyFatigue`（min 1，hint：新人的单月劳累积分上限，按自然月累计；默认高于周上限一个量级，仅拦整月无度堆积）。
- **新增第四组白卡「排班轮换」**（Tao 拍板独立成组，不入「班次数量上限」）：
  - `tenureLimit`（min 0，max 26），name「同一任务连任上限」，hint：同一任务连续 N 期排到同一人后强制轮换；填 0 = 关闭该约束；仅当无其他可排人选时允许连任保运转。
  - 恢复默认 / 保存随整组走（SET_GROUPS 驱动，自动兼容）。
- 页底「系统怎么算」RULE_SECS 同步：
  - 「谁能被排：一票否决」加两条：月自然月疲劳超个人「月疲劳上限」；同一任务连任达上限（N+1 期）须轮换——无他人可选时豁免。
  - 「疲劳与高强度怎么累计」加一段：月疲劳积分 = 所在自然月已排班次劳累指数之和（自然月固定窗口、非滚动）；连任 = 该任务连续有排班的周里同人接手期数，中间他人接手即重新计数。
  - 打分/预警段不动。

## 6. Excel（`src/ui/excel.js`）

- **列**：人员模板 / 导出 / 导入加「月疲劳上限(选填)」列，位于「高强度次数上限」与「标签」之间（对齐 `STAFF_TEMPLATE_COLS` 现有列序）。同步三处：列定义、示例行、导出行数组。
- **导入**：`Number(r['月疲劳上限(选填)'])`，`Number.isFinite` 才取、否则 `settings.defaultMonthlyFatigue`——显式 isFinite 判空，绝不用 `||` 兜底（教训 #30：0 不是合法月上限所以无 0 语义，但空串/NaN 需拦，仍走 isFinite 分支）。alias 兼容旧表头（无该列 = 留空 = 默认）。
- 任务侧不动。

## 7. 兼容性 & 边界

| 项 | 处理 |
| --- | --- |
| 旧 staff 无 `maxMonthlyFatigue` | `createStaff`/读取 `?? defaults` 兜底 → 回落到当前 `defaultMonthlyFatigue` |
| 旧 settings / 旧 JSON 备份缺 `defaultMonthlyFatigue`/`tenureLimit` | `getSettings` 全键合并补默认，消费端逐键 `?? DEFAULT_SETTINGS` |
| JSON 备份/恢复/重置 | settings 单例随行、staff 字段随三表走，零改动 |
| 无新 localStorage key | `docs/storage.md` 无需登记（settings 键明细若已列则补两键） |
| 历史已落库超限连任 | 不回溯删；只拦未来新增 |
| 豁免成立仍可能无其他分差 | 豁免只保运转，不保证该人分高——照常打分排序 |
| `simulateAutoFill` 预览与实际 | 同决策通道（含豁免 helper）→ 结果一致 |
| 边界：自然月月初/月末、跨年 12→1 | 月键 `slice(0,7)` 自然翻转，无特殊处理 |

## 8. 测试（node:test 算法层）

- `filter.test.js`：
  - 月上限：三态文案（已超/已达/将超）、自然月边界（同月累计不跨月）、周上限与月上限独立各拦各的。
  - 连任：合并计数（跨星期几/时段归一周）、空窗不中断、他人接手中断清零、未来已排定续任计入段长、`tenureLimit=0` 跳过、第 N 期放行第 N+1 期拦截。
  - 豁免：扣除本人后无他人 → 放行；有他人 → 仍拦。
- `substitute.test.js`：`projectWeeks`/`tenureSegs` 聚合正确（含跨周、跨月、空窗、他人打断）。
- `auto.test.js`（若 simulate 有覆盖）：逐班决策感知前面分配导致连任触发、豁免走通。
- `model.test.js`：Staff 新字段默认与校验、DEFAULT_SETTINGS 新键默认。
- UI 手测面：月 chip 红黄/hover 上限、分配弹窗「暂不可添加」原因带连任/月超限、豁免放行提示、设置第四组 + 恢复默认。

## 9. 知识库同步（实现时一并）

- `.ai/spec.md`：§3.2 Staff 表加 `maxMonthlyFatigue` 行；§4.2 硬性过滤补第 8/9 条（月上限、连任 + 豁免）；§6 参数表加 `defaultMonthlyFatigue`/`tenureLimit`；§5.2 月 chip 红黄口径更新（红黄换绑月上限）。
- `.ai/memory.md` / `.ai/project_map.md` / `.ai/pitfalls.md` 视实现结果补充。
- `docs/score-rules.md` 人话手册同步两条新规则。

## 10. 不做（YAGNI）

- 连任不做打分降权的软方案（Tao 选硬拦 + 豁免）。
- 不做每人连任上限字段（全局一个 `tenureLimit`，每人可调对轮换纪律无意义）。
- 不改均衡公式 / `balanceWindowDays` / 移动窗口语义。
- 月上限不接 Excel 的示例/别名扩散到任务侧。
- 对已落库的历史超限不做追溯性清扫/批量删除。
