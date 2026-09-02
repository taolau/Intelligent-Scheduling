# [时间] 2026-09-02
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **09-02 批次未提交（配置页增强批 + 晚间验收修复批，working tree 在案）**：
  - **删除体系**：人员/任务卡底栏加删除钮（左删除/右编辑，Tao 点名删除在左）；引用保护——人员被任一班次引用、任务被排班或人员三列表配置引用时禁删（toast 提示走「退出/停用」）；零引用经确认弹窗删除。周历删除班次同步改造
  - **弹窗改造**（modal.js）：新增 confirmDialog 二次确认弹窗（取消左/红「确认」右、box-confirm 400 窄宽，Tao 否掉「删除」文案与两击按钮交互）；弹窗栈（嵌套 ESC 只关顶层）；footer 惯例统一「次钮左/主钮右」→ openModal DOM 序 closeBtn 先、param footer 后
  - **配置页筛选 + 面板**：人员/任务 tab 新增按钮左侧名称实时筛选框（隐藏不匹配卡片不重建 DOM）；卡片区装入浅紫面板 .cfg-pane（内容少贴高无滚、超高面板内滚），cfg-scroll 改定位层
  - **疲劳分析**：柱体 + 右上角图例色块紫 → 黄渐变 #fbbf24→#d97706（Tao 连提两处）
  - store.js 新增 removeStaff/removeProject；theme.js .btn-del 红字删除钮 + box-confirm + lg-fatigue 黄色
  - **周历满员拦截**（Tao 验收）：scheduleDialog 满员仅渲染绿条「本班次已满员」、候选行整体不渲染（「＋ 添加」入口消失无从超员；移除一人 renderBody 重算恢复）；满员卡片底部不再渲染「已满」容量行（.full 绿框视觉已表达）——至此四加人入口拦截一致：弹窗/拖拽 dropStaff/闪电/全局智能排班
  - **弹窗焦点修复**（Tao 验收「光晕卡住」）：openModal 焦点改落弹窗容器（box tabindex=-1 + focus）+ .modal-box:focus outline:none——原 closeBtn.focus() 触发 Chromium :focus-visible 键盘启发式（打开前碰过键盘即点亮）光晕常驻（点弹窗内容不转移焦点）；修后按钮不无故亮环、Tab 键盘可达不损
  - **btn-danger 收敛**（Tao：大红不优雅）：实心大红白字 → 浅红底红字三态 #fee2e2→#fecaca→#fca5a5（hover 外光晕一并去除），与 btn-soft 淡紫款同构；全站仅两处用（删除班次/确认弹窗「确认」）
  - **手动建班次弹窗重构**（Tao 点名优化）：裸文本行 → field() 同构表单；时段下拉 → 四 chip 单选（day-chip 同构）；任务下拉 searchable；日期 hint 实时回显「周X」；必填校验（旧版空值静默存脏班次）；无任务空态提示 + 创建钮禁用；创建成功 toast；跨周日期创建后 currentWeekStart 跟随跳转（创建即所见）
- **前批次已全部提交**（a52cc4e 09-02 整合批 / 096a7a7 / d6674b1 等）——已清账
- **dist**：⏳ 旧构建，提交后需 `node build.js` 更新（Tao 要求时才构建）

## 🧠 核心决策
- **删除语义定稿（09-02 本批）**：删除仅用于零引用误建清理——人员出现在任一班次、任务被排班记录或人员配置（可胜任/擅长/不合适）引用时**禁止删除**并提示改用「退出」保留历史 /「停用」停止排班（这两个语义本为保留历史存在）；引用检查放行才弹确认。渲染层对已删 id 有 `?.name ?? id` 兜底但不作为删除放行的依据
- **破坏性操作确认惯例定稿（09-02 本批，Tao 连续纠偏）**：不用按钮两击（周历原「确认删除？」态被否）；一律 `confirmDialog` 弹窗二次确认——红 btn-danger 右置、文案「确认」不是「删除」、窄宽 box-confirm 400px（modal-box 默认 720 太宽）；删除卡片按钮常态无确认态
- **弹窗 footer 惯例（09-02 本批，Tao 提出）**：全站「次要钮（关闭/取消）在左、主按钮（保存/确认）在右」——openModal 组装序 = closeBtn 先 append、调用方主按钮 footer 参数后 append（flex-end 下即次左主右）；勿再 marginRight:auto 手工定位（周历删除钮曾用之已移除）
- **弹窗栈（modal.js）**：module 级 close 栈，ESC 只关顶层——支撑「排班分配 → 删除确认」嵌套而不误关底层编辑内容
- **弹窗焦点惯例（09-02 晚间定稿）**：openModal 打开时焦点落弹窗容器（box tabindex=-1）而非「关闭」钮——程序化 focus 按钮在 Chromium :focus-visible 键盘启发式下点亮光晕且常驻（「光晕卡住」根因）；键盘可达性不受损（Tab 进入容器）
- **配置页卡片区形态定稿**：卡片网格装入 `.cfg-pane`（bg #faf7fc、圆角 12、overflow hidden、max-height:100% 贴定位层）→ `.cfg-pane-body`（flex:1 + min-height:0 + overflow-y:auto）内滚；cfg-scroll 为 flex 定位层不再自滚；设置 tab 双 pane 自滚不受影响。机制三点防破坏见 pitfalls#31
- **名称筛选实现**：input 事件实时隐藏/显示卡片（按 .cfg-card-title includes，不重建 DOM——折叠态/开关局部更新不受扰）；筛空补「未找到名称含『x』的…」空态，数据本身为空的原生空态不受影响
- **疲劳分析配色（本批 Tao 指定）**：柱渐变与图例色块同步 `#fbbf24 → #d97706`（黄），柱顶数值紫字 #5a1d78、超限红章不动

## ⚠️ 待办与注意
- [待办] 提交 09-02 本批（增强批 + 晚间验收修复：modal/config/calendar/store/analysis/theme + .ai 同步已随批就位）——提交粒度 Tao 拍板：删除体系 + 弹窗改造 + 晚间修复同屏同主题可合一大提交，筛选/面板/柱色随附或另拆
- [注意] modal footer 已是「次左主右」DOM 序：新弹窗主按钮直接放 openModal footer 参数即可，勿再 marginRight:auto / 颠倒顺序（曾致周历删除钮与关闭分裂两端）
- [注意] confirmDialog 默认 confirmText='确认'、box-confirm 窄宽——破坏性操作全站统一走它，勿自造两击确认交互
- [注意] cfg-pane 滚动三点（pane max-height:100%、body flex:1+min-height:0+overflow-y:auto、cfg-scroll 定位层）见 pitfalls#31，勿随意移除
- [注意] openModal 焦点落 box 容器，勿改回 closeBtn.focus()（光晕 bug 复发）
- [注意] scheduleDialog 满员分支只渲染 asg-full 绿条、候选行在 else 分支；新增加人入口时核对四入口（弹窗/拖拽/闪电/智能）拦截一致
- [注意] .sch-capacity.ok 与满员容量行已无渲染路径（满员不渲染），保留作防御勿删
- [注意] 卡片删除/编辑绑定用 `[data-del]`/`[data-edit]` 属性查询——children 索引绑定曾致点击搜索框弹出新增弹窗（本批修复，未记 pitfalls）
- [注意] 本环境 Playwright 截图 Read 不可用（Unsupported Image）——canvas 与纯视觉验收依赖 Tao 自查
- [注意] 导出图=静态视图：克隆时移除 `.cal-today`/`.cal-today-flag`/`.cal-add-day`/`.sch-smart`，勿在克隆里残留功能性 UI
- [注意] 周历调试先查 `is_sched:cal_view` 维度状态：过滤视图下 DOM 卡片不全 ≠ 数据丢失（08-31 差点误判）
- [注意] `ctx.weeklyFatigue` 锚定首个班次所在周（buildContext 用 `schedules[0]?.date`），跨周浏览统计按浏览周现算
- [注意] 改侧边栏样式需两处同步：index.html 首屏内联段 + theme.js 侧边栏段（pitfalls#14）
- [注意] 拖拽回归手测：Playwright 无法模拟 dataTransfer（pitfalls#4，用原生 DragEvent+DataTransfer 构造）
- [注意] 系统设置双栏/面板改样式需知：矮视口下左栏内容滚动依赖 `.set-group { flex:none }`（pitfalls#29），勿随意移除
- [注意] score-rules.md 维护规则：动参数前 grep DEFAULT_SETTINGS 核对数字
