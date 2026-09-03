# [时间] 2026-09-03
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **09-03 批次已完成、未提交（working tree 在案）**：
  - **任务视图**（Tao 点名：给执行人员看「任务要做什么」）：数据配置 → 任务管理 tab 头部「任务视图」按钮就地切换纯展示态——条目 = 名称 + 元信息行（劳累火焰×n+轻松/中等/高强度、N人/班、时段 chips、时间段、排序后「每周X、Y」；文本段与 chip 分离、片段「·」连接）+ 说明全文（不折叠、pre-wrap 保留换行）；无说明灰字占位；**停用任务不入视图** + 头部「已隐藏停用 N 项」；「导出图片」离屏 1200px 白卡构图（标题「任务说明」无日期 + 导出时间 + 共 N 项，`Tasks-任务说明图-日期.png`），字号层级：标题 22 / 任务名 17 近黑 / 说明 15 lh1.8（Tao 选层级加强档）；导出图片钮 = btn-default 白款（Tao：不要深紫）
  - **疲劳分析日/周/月维度**：工具栏 seg 切自然日/周/月窗口，导航按粒度步进（日±1 天带「· 周X」/ 周±7 / 月±1 月 `2026-09`）；统计行班次文案随粒度；**周上限语义仅周视图**（日/月不判超限：无红章/姓名不红/无超限统计格）；**跨粒度切按窗口中心日换算**（日=当天/周=周四/月=15 号）保持阅读位置——修「周积分 4 → 月 2」对比错位（Tao 实测发现：周 8/31~9/6 跨月，8/31 积分入周不入 9 月）；返回当前钮随粒度动态命名 今天/本周/本月（Tao：今天有歧义）
  - **侧栏菜单点击重置默认态**（Tao：现在都历史暂留）：main.js switchView 去掉已激活项 early-return、每击先 resetViewDefaults——周历回本周+总览（resetCalendarView 清 cal_view 记忆）/ 配置回「人员管理」（删 config_tab）/ 分析回周粒度本周（resetAnalysisView）；页内操作（翻周/tab/删除重渲染）不受影响
- **前批次已全部提交**（76ef78a 等 09-02 批）——已清账
- **dist**：⏳ 旧构建，需 `node build.js` 更新（Tao 要求时才构建）

## 🧠 核心决策
- **任务视图展示语义（09-03 定稿）**：视图是给执行人员看的「任务说明手册」——名称+说明为主、元信息轻量行内；停用任务不进入（不排班则无需执行说明）但计数明示；页面视图与导出图共用同套 CSS 类（.tview-*），导出 = 离屏克隆 list 而非页面截图
- **疲劳分析窗口口径（09-03 定稿）**：日/周/月 = 独立自然窗口，**非嵌套累计**（跨月自然周的部分班次按各自窗口归属，月可小于周）；周上限 `maxWeeklyFatigue` 语义仅对周窗口成立
- **粒度切换保持阅读位置（09-03）**：切粒度 = 以当前窗口中心日换算到新窗口，绝不跳「今天」窗口；「今天」语义按钮随粒度动态命名（今天/本周/本月）——固定「今天」在周/月粒度名不符实
- **侧栏菜单语义（09-03 Tao 拍板）**：点菜单 = 回默认视图（含重复点击当前页）；重置逻辑收口在 main.js switchView 的 resetViewDefaults，**禁止放进 render 函数**（renderCalendar/renderConfig 等页内多路径调用会被重置打断）
- 09-02 决策（删除语义/confirmDialog 惯例/footer 次左主右/弹窗栈/焦点落容器/btn-danger 收敛/cfg-pane 三机制/名称筛选）已在上一批代码与 pitfalls 固化，行为仍生效

## ⚠️ 待办与注意
- [待办] 提交 09-03 本批（config/exportImage/theme/analysis/calendar/main + spec/memory 同步已就位）——提交粒度 Tao 拍板
- [注意] 视图重置只在 switchView 做：新页面若有「菜单进入默认态」需求照此模式导出 reset 函数，勿在 render 里重置
- [注意] config_tab/cal_view 被菜单进入清除，但页内操作重渲染与刷新停留仍靠它们；renderConfig keepTab 的 document 级 .seg 查询依赖「单容器 + switchView 先清 DOM」架构，勿改动查询范围
- [注意] 导出任务说明图标题固定「任务说明」不带日期（meta 已有导出时间）；日期只在文件名
- [注意] 疲劳分析口径对照：日/月数值与周不具包含关系，先看窗口标签再比较（跨月周 8/31~9/6 vs 月 2026-09）
- [注意] modal footer 次左主右 DOM 序；confirmDialog 全站统一；cfg-pane 滚动三机制（pitfalls#31）；openModal 焦点落 box 容器；满员四入口拦截一致；导出图克隆去 .cal-today/.cal-add-day/.sch-smart
- [注意] 周历调试先查 `is_sched:cal_view`：现在菜单进入会清掉它，但手动改 localStorage 调试维度仍可用
- [注意] `ctx.weeklyFatigue` 名为周语义实为「传入窗口全量聚合」（buildContext 只挡 weekStart 前），analysis 日/月窗口直接复用
- [注意] 改侧边栏样式两处同步（index.html 首屏段 + theme.js）；拖拽回归手测（pitfalls#4）；系统设置 `.set-group { flex:none }`；score-rules 动参数前 grep DEFAULT_SETTINGS
- [注意] 本环境 Playwright 截图 Read 不可用——canvas（疲劳柱图）视觉依赖 Tao 自查
