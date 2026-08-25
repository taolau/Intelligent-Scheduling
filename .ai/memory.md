# [时间] 2026-08-25
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **侧边栏导航**：✅ 完成 - 顶部 tab 改左侧可收缩侧栏（浅色/SVG 线框图标/收起 56px 窄条/localStorage 持久化），Tao 拍板「收起成图标窄条+SVG+浅色」
- **自定义下拉 Select**：✅ 完成 - 新增 src/ui/select.js，单选+多选统一组件（选项打勾/hover/键盘导航/多选标签增删/点击外部关闭）
- **按钮优化**：✅ 完成 - 按压 scale(.97)/hover 投影/active 内阴影/圆角 8px/字重 500
- **表单元素+周历+表格**：✅ 完成 - 周几 chips 胶囊化（.day-chip）、输入框 hover/圆角 7px、周历卡片 hover 上浮+虚线空格、表格斑马纹
- **git**：⏳ 四轮 UI 改动待统一提交（本次 save 后执行）
- **浏览器验证**：✅ 全部 Playwright 真实点击验证 + 41 单测全绿

## 🧠 核心决策
- **UI 设计语言**（长期，已入 spec）：8px 圆角统一、主色 #2563eb、按压/悬停反馈（scale+投影+inset）、圆角胶囊 chips
- **自定义下拉组件 select.js**：单选/多选统一 API，`el.value` getter/setter 兼容原生 select 读取方式，options 支持字符串或 {value,label}
- **侧栏体系**：`.sidebar` + `.collapsed` 类切换宽度 208↔56px，CSS 过渡；收起态 label 用 CSS 隐藏，原生 `title` 做 tooltip
- 智能排班手动触发 / buildContext 含 schedules：长期决策，已在 spec.md，此处不重复

## ⚠️ 待办与注意
- [待办] 统一提交四轮 UI 改动（本次 save 后执行）
- [待办] 真实场景试用：录入周日任务（投影/接待/做饭/洗碗）验证算法手感
- [注意] 存储介质已换 localStorage：dev(http) 与 file:// 数据不互通，试用期可重录或 JSON 导出/导入
- [注意] 上午(08-12)与中午(11:30-13:00)时段重叠 → 智能排班拒绝中午班次是**正确**过滤行为
- [注意] 拖拽回归手测待做；Playwright 无法模拟 dataTransfer，需原生 DragEvent 构造
- [注意] 后台 dev server 直接用 `node ./node_modules/vite/bin/vite.js` 跑，勿用 npm run dev+tee（TaskStop 杀不干净会残留孤儿进程占端口）
- [注意] 本机 Playwright MCP 现已可用，无需 Edge CDP 兜底（原 pitfalls#7 已过时，待更新）
