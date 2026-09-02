# [时间] 2026-09-02
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **09-02 配置页两批合并未提交（Tao 多轮验收已收敛，working tree 全量在案）**：
  - **早批**：时段四 chip 点选 + 弹窗布局、互填 ⇄ 钮 + 三列表约束（编辑只提示 + Excel 导入收敛例外）、人员默认上限可配置化——决策明细见本文件历史版本与 git diff，均已编码（theme/config/fields/model/excel + model.test）
  - **本批（本会话新增）**：设置弹窗 → 数据配置页第三 tab「系统设置」；三 tab 容器化布局重构（cfg-frame：tab 固定 + cfg-head 按钮行固定 + cfg-scroll 内容容器内滚，人员/任务/设置一致）；系统设置左右等宽双面板 UI 定稿；slotTaskLimit 时段文案修正（自主安排与早中晚四槽各自计数）；页面改名「基础配置」→「数据配置」；btn-soft 淡紫按钮；spec/storage.md/score-rules.md/project_map 全同步（见待办提交清单）
- **前批次已全部提交**（6892c59 / 71fe0ca / e957c92 / d6674b1 74 绿 / 096a7a7 知识库）——已清账
- **存储演进研讨**：⏸️ 搁置 - 文件备份大块不做
- **dist**：⏳ 旧构建，提交后需 `node build.js` 更新（Tao 要求时才构建）

## 🧠 核心决策
- **配置页三 tab 统一框架定稿（09-02 本批，Tao 多轮迭代）**：`.cfg-frame`（flex:1 撑满）内 seg（tab 固定）+ `.cfg-head`（操作按钮固定行）+ `.cfg-scroll`（`flex:1; overflow-y:auto` 容器内滚动，与周历同构）；人员/任务/设置三 tab 同一结构；**设置 tab 无顶部按钮，activate 时 head 置 `display:none` 防空隙**；config_tab 值域扩 `settings`（storage.md 已登记）
- **系统设置页双面板布局定稿（09-02 本批）**：左右两面板**等宽平分**（.cfg-split flex）+ 各自独立滚动（.set-pane-body flex:1 overflow）；左「系统参数」= 标题行（紫底圆角图标块 + 16/700 深紫标题 + 灰副题，下细线）+ 标题行右侧按钮（**恢复默认 btn-default、保存 btn-soft 淡紫**——Tao 否掉深紫实底「碍眼」）；三参数组 = 白卡 + **浅紫渐变头带**（带内两行：14.5/700 紫标题 + 12px 灰 desc，Tao 三轮否掉纯文字/竖条后定稿「组要容器感」）；右「系统怎么算」= 编号紫圆（1-4）+ 13.5/700 标题 + 打分公式浅紫块 + 紫点列表（5/3/3/1）+ 灰 note。**Tao 否决史**：单列居中限宽（两侧空白多）→ sticky 侧栏（左内容放不下）→ 左右面板各内滚定稿
- **设置保存交互定稿**：改动暂存不落盘，左面板标题行「保存」统一生效（钳制 min、空串回默认、`trim+isFinite` 判定防吞 0，见 pitfalls#30）；「恢复默认」只回填输入框不落盘、提示「点击保存后生效」
- **时段计数语义澄清（09-02 本批）**：早/中/晚/**自主安排四槽各自独立计数**（filter 按 `staffId|date|slotLabel` 分组，同段超限拒绝、异段互不挤占）——参数 hint 与 spec 4.4 措辞已改一致（原「自主安排不占时段」表述误导，行为本就如此）
- **页面命名定稿（09-02 本批，Tao 提出）**：侧边栏「基础配置」→「**数据配置**」（main.js + spec 5.1/模块注释/流程线 + project_map + score-rules 全同步；docs/方案 历史文档不动）
- **早批决策归档提示**：chip/卡片视觉、互填钮形态、三列表约束、默认上限可配置、时段 chip 编辑等均已完成编码，决策明细随早批提交说明，memory 不再滚动（如回滚需查 git）

## ⚠️ 待办与注意
- [待办] 提交 09-02 全批（当前 working tree：theme/config/fields/model/excel/main.js + model.test + .ai/spec/memory/pitfalls + docs/storage/score-rules/project_map 变更记录均已就位）：建议按功能拆 4-5 提交（①系统设置 tab + 布局重构 + 改名：theme/config/main；②早批 chip/互填/默认上限原三拆方案；.ai 与 docs 随相应提交或单独知识库提交）
- [注意] Tao 浏览器 `is_sched:settings` 曾存过旧值（早批测试）导致页面默认显示非 2/1——已引导「设置页恢复默认+保存」还原（Tao 已处理）；改代码默认值对已有 localStorage 无效，先恢复默认或删 key
- [注意] score-rules.md 维护规则：动参数前 grep DEFAULT_SETTINGS 核对数字（本批已把名词表过时的默认 6/1 修为 10/2、弹窗字样修为系统设置页）
- [注意] 系统设置双栏/面板改样式需知：矮视口下左栏内容滚动依赖 `.set-group { flex:none }`（pitfalls#29），勿随意移除
- [注意] 导出图=静态视图：克隆时移除 `.cal-today`/`.cal-today-flag`/`.cal-add-day`/`.sch-smart`，勿在克隆里残留功能性 UI
- [注意] 周历调试先查 `is_sched:cal_view` 维度状态：过滤视图下 DOM 卡片不全 ≠ 数据丢失（08-31 差点误判）
- [注意] `ctx.weeklyFatigue` 锚定首个班次所在周（buildContext 用 `schedules[0]?.date`），跨周浏览统计按浏览周现算
- [注意] 改侧边栏样式需两处同步：index.html 首屏内联段 + theme.js 侧边栏段（pitfalls#14）
- [注意] 拖拽回归手测：Playwright 无法模拟 dataTransfer（pitfalls#4，用原生 DragEvent+DataTransfer 构造）
