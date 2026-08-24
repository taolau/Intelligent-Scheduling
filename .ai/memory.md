# [时间] 2026-08-24
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **智能排班系统**：✅ v1 全部开发完成（13 个任务）— 纯前端无框架，41 单测全绿，dist/index.html 单文件打包通过
- **存储层修复**：✅ IndexedDB → localStorage（file:// 双击即用）— 详见 pitfalls#5
- **UI 打磨**：✅ 按钮/表单/组件一致化完成 — theme.js 设计令牌 + 全局样式注入，fields.js 结构化表单，编辑弹窗告别 JSON 输入、校验错误行内提示；file:// 渲染 + CDP 真实点击交互验证通过（新增任务/人员弹窗、周几 chips、时段行增删、多选、行内错误、Escape）
- **git**：⏳ v1 的 16 提交 + 本次 UI 打磨改动**均未提交/未推送**（Tao 要求晚点统一提交）
- **浏览器验证**：✅ v1 手测 + UI 打磨 CDP 交互验证通过；拖拽/动画/hover 等纯视觉细节待 Tao 最终浏览器手测

## 🧠 核心决策
- 技术选型、算法规则、数据模型均已定稿并固化在 `spec.md`，此处不重复
- 本 Sprint 仍影响行为的落地决策：
  - 智能排班手动触发（不自动）；请假按"人+某天"整处理
  - buildContext 返回对象**必须含 schedules**（供 filter 重叠检测），否则运行崩溃
  - **UI 样式体系**：theme.js 设计令牌 + `injectGlobalStyles()` 注入全局类（`.btn*`/`.field`/`.input`/`.table`/`.modal*`/`.toast*`/`.cal-*`/`.sch-card`/`.staff-chip`），视图挂 class 而非内联 cssText —— 内联样式无法表达 `:hover`/`:focus` 伪类，类体系是交互反馈的前提；样式随 JS 内联进单文件，build.js 不改

## ⚠️ 待办与注意
- [待办] **统一提交**：UI 打磨改动（theme.js/fields.js/model.js/main.js/modal.js/toast.js/config.js/calendar.js/analysis.js/index.html/model.test.js）+ 原有改动（.ai/*、db.js、test/db.test.js、package.json）按 Tao 安排一次性提交
- [待办] git push 全部提交到远程仓库（用户已要求）
- [待办] 真实场景试用：录入周日任务（投影/接待/做饭/洗碗等）验证算法手感
- [注意] 存储介质已换 localStorage：**dev（http）模式录的数据在 file:// 下读不到**（IndexedDB 与 localStorage 不互通），试用期可重录或 JSON 导出/导入
- [注意] 上午(08:00-12:00)与中午(11:30-13:00)时段重叠，导致智能排班拒绝中午班次——这是**正确的**硬性过滤行为；若实际期望中午可排，需调整时段配置而非改算法
- [注意] UI 打磨只改了 class 未动 dnd.js，真实拖拽回归手测待做；Playwright 无法完整模拟 dataTransfer，需原生 DragEvent 构造（见 pitfalls#4）；本机无 Chrome，浏览器验证用 Edge headless CDP（见 pitfalls#7）
