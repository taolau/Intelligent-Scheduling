# 任务加分标签设计（按人员标签给任务加分）

> 2026-09-07 与 Tao 逐项确认。范围：在既有「人员标签」（`Staff.tags` 自由文本，纯分组/筛选、不参与算法）基础上，新增**任务级加分标签**——任务从全库已有人员标签池中挑选若干「加分标签」，凡带命中标签的人员按命中标签数累加加分，类似擅长加分进打分排序。纯加分，不参与硬性过滤。

---

## 1. 背景与问题

人员标签（09-07 批次上线）目前是自由文本分组元数据：`Staff.tags` 用于卡片展示、人员/排班过滤，**不参与算法**。Tao 想要把标签复用到「打分」维度：任务的某些标签代表该任务需要的**特质/角色**（如「组长」「值班」），凡人员带着这些标签，就该像「擅长该任务」一样在推荐排序中加分——让标签从纯视图收窄升级为排序依据。

与擅长加分的区别：擅长是**人员侧**对具体任务声明（`preferredProjects: [{projectId, reason}]`，带手工原因）；加分标签是**任务侧**声明一批标签特质，任何带标签的人都自动命中，无需逐人逐任务配置。

## 2. 语义决策（Tao 拍板）

1. **触发**：任务配了 N 个加分标签 `bonusTags`，某人的 `staff.tags` 与 `bonusTags` 交集为 K → **每命中一个标签 +一次分**（K 个标签 → K 次累加）。不是「命中任一即一次」。
2. **分值**：新增**独立系统设置参数「标签加分」（默认 15，min≥1）**，与「擅长加分」并列可单独调，不复用 `preferredBonus`。
3. **来源**：任务编辑弹窗配加分标签**只选已有人员标签池、禁止回车自创**（选了没人有的标签无意义）。`tagsInput` 需新增「只选不建」模式。
4. **Excel**：任务 Excel 模板 / 导出加「加分标签」列（分号分隔）；导入只接纳全库已有标签、不认识的一律丢弃并在提示里报丢弃数。人员 Excel 不动。
5. **可见**：任务配置卡片始终显示「加分标签」行（空显 `—`）+ 分配/替换弹窗候选行推荐理由副行展示命中标签；**不加到任务视图/说明导出图**。
6. **理由排布**：擅长命中与标签命中同时出现时，推荐理由副行用「；」**一行拼接**（现 `narrateReasons` 返回数组后 `join('；')` 已如此，零改动）。
7. **状态**：不区分人员状态，`new` 命中标签照常加分（同擅长加分——`new` 仅均衡恒 0，见 spec 4.3）。

---

## 3. 数据模型（`src/data/model.js` + `score.js`）

### 3.1 Project 新增字段 `bonusTags`

- `Project.bonusTags: String[]`（标签文本数组，引用人员标签池；自由文本不做格式校验）。
- `createProject` 加 `bonusTags: fields.bonusTags ?? []`；旧数据无该字段读作 `[]`。
- `validateProject` **不新增**校验（纯文本数组，无非法形态）。

### 3.2 系统设置新增 `tagBonus`

- `DEFAULT_SETTINGS` 加 `tagBonus: 15`。
- 消费端逐键兜底 `ctx.settings?.tagBonus ?? DEFAULT_SETTINGS.tagBonus`（沿用 pitfalls #28：部分缺键时 `undefined * n = NaN` 静默）。

### 3.3 打分集成（`score.js scoreCandidate`）

```
命中标签 K = |staff.tags ∩ project.bonusTags|
每个命中标签 push 一条：{ label:'标签加分', points: tagBonus, reason: '<标签名>' }
```

- 需要拿到当前 project 的 bonusTags——`scoreCandidate(staff, schedule, projectById, ctx)` 已收 `projectById`，按 `schedule.projectId` 取 `project.bonusTags ?? []`，无需改签名。
- 标签加分与擅长加分**独立叠加**：同一人既擅长该项目又带加分标签，两项都加。
- 硬性过滤不动：加分标签只进打分排序，不参与 `filterCandidate` 一票否决。

### 3.4 人话理由（`substitute.js narrateReasons`）

- 命中标签的 breakdown 条目 → 合并为一句：`带标签「A、B」，适合本项目`（多个命中标签并进同一对引号，逗号分隔；单标签就是 `带标签「A」，适合本项目`）。
- 与「擅长加分」理由并列时由调用方既有 `join('；')` 拼接成一行（方案 A，Tao 选定）。

---

## 4. UI 改动（`src/views/config.js` + `src/ui/fields.js` + `src/views/calendar.js`）

### 4.1 `tagsInput` 新增「只选不建」模式（`fields.js`）

- `tagsInput` 加选项 `allowCreate = true`（默认保持现人员编辑行为）。
- `allowCreate:false` 时：
  - 候选浮层照常（排除已选、键入即时过滤）；
  - 输入文本无匹配候选时**回车不自创**——面板灰字提示（如「回车不会新建标签，请从上方候选选择」）或对无匹配回车仅关闭面板；
  - 已有 `options` 池为空时不浮层（无可选项）。
- 关键：`openPanel` 内 `if (!pool.length || open) return` 与回车自创分支按 `allowCreate` 分流，避免回归人员标签的可自创行为。

### 4.2 任务编辑弹窗（`config.js editProjectDialog`）

- 标签池 `tagPool = [...new Set(staffs.flatMap(s => s.tags ?? []))].sort(zh)`（与 `editStaffDialog` 同源）。
- 弹窗内（如「重复星期/时段」下方）加 field「加分标签」，控件 = `tagsInput({ initial: target.bonusTags ?? [], options: tagPool, allowCreate:false })`，hint 说明「从人员已有标签中选，命中即加分」。
- 保存时 `createProject({ ..., bonusTags: tagsCtrl.value })`。

### 4.3 任务配置卡片（`config.js renderProjects`）

- 卡片 rows 增加「加分标签」行：`p.bonusTags` 非空 → tag chip 组；空 → `<span class="empty">—</span>`（Tao 选定空显 —）。
- 位置：作为任务排班偏好，建议「时段」行之后、「时间段」之前。

### 4.4 候选行推荐理由副行（`calendar.js` / `substitute.js` 消费端）

- `narrateReasons` 增加对 `label === '标签加分'` 的处理后，分配弹窗 `scheduleDialog` 候选行副行、替换弹窗 `openReplaceDialog` 候选卡副行自动带上命中标签理由（两处均走 `narrateReasons` 输出），无需逐弹窗改造。

### 4.5 系统设置 tab（`config.js` renderSettings 区）

- 「推荐打分」参数卡加一行「标签加分」，`min:1`，默认回填 `tagBonus`，行内说明「命中任务加分标签的每个标签加分（按命中标签数累加）」，随整组保存/恢复默认。
- 页底「系统怎么算」规则区打分公式行更新为 `总分 = 擅长加分 + 标签加分 + 均衡加分`，附标签加分一句说明。

---

## 5. Excel（`src/ui/excel.js`）

- **列**：任务模板 / 导出 / 导入加「加分标签(选填;分号隔开,可多个)」列，位于 `任务说明(选填)` 与 `启用(选填…)` 之间（对齐 `STAFF_BASE_COLS` 的「标签」命名风格）。多标签 `;` 分隔（沿用 `parseTags` 分号切分语义）。需同步三处：`PROJECT_BASE_COLS`、`PROJECT_SAMPLE`（示例行补一列）、`exportProjects` 行数组补一值。
- **导出**：`(p.bonusTags ?? []).join(';')`，插在 `active` 值前。
- **导入**：解析分号 → 只保留「导入时全库已有人员标签池」（`getCache().staffs.flatMap(s => s.tags ?? [])` 并集）中存在的文本，不认识的丢弃；返回消息附加 `…丢弃 N 个不存在的加分标签`。全丢则列置空，不整体中断任务行导入（防导入顺序/新旧数据导致误伤整行）。

---

## 6. 兼容性 & 边界

| 项 | 处理 |
| --- | --- |
| 旧任务数据无 `bonusTags` | `createProject` / 读取处 `?? []` 兜底 |
| 旧 `settings` 缺 `tagBonus` | 消费端逐键 `?? DEFAULT_SETTINGS.tagBonus` |
| 人员删除某标签、无任何任务/人员再用 | 加分标签存的是任务侧文本快照，引用不强校验——任务仍持有该文本、当前无人命中即自然不加分，不报错、不清扫 |
| 任务加分标签文本与人员池不同步 | 同上一行：文本匹配是运行时求交集，不存在外键失效 |
| 替换/拖拽/智能排班 | 全走同一 `scoreCandidate`，自动获得标签加分，无需逐入口改 |

---

## 7. 测试（node:test 算法层）

- `score.test.js`：
  - 命中 1 个加分标签 → +tagBonus；
  - 命中多个（交集 2+）→ 累加 2×tagBonus；
  - 擅长 + 标签同时命中 → 两项都加；
  - `staff.status === 'new'` 命中标签照加；
  - 无命中 → 无「标签加分」breakdown；
  - `project.bonusTags` 缺失 / 空数组 → 按无命中处理不崩；
  - `settings` 部分传入缺 `tagBonus` → 兜底默认 15（防 #28）。
- `substitute.test.js`（若 narrateReasons 有单测）或 score 内：人话理由含 `带标签「…」`。
- `model.test.js`：`createProject` 默认 `bonusTags: []`。
- Excel 标签解析（若导入解析抽纯函数）：丢弃不存在标签并返回丢弃数。

---

## 8. 不做（YAGNI）

- 加分标签不参与硬性过滤 / 新入高强度否决判定。
- 不加任务视图 / 导出说明图。
- 不新增「任务侧自由新建标签」。
- 不做每标签独立权重（全走统一 `tagBonus` 设置值）。
