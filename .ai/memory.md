# [时间] 2026-09-01
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **09-01 配置卡片折叠优化批次（代码完成，Tao 自测中）**：config.js + theme.js——两 tab 卡片多值字段限 2 行折叠「+N」（点击展开/收起）+ 任务卡「时间段」恒定「—」占位 + 空值统一「—」，同排卡片等高、key 横向对齐（详录见待验收后 spec 固化）
- **09-01 存储 key 规范化 + 下拉组件优化两批（代码完成，待提交）**：keys.js/docs/storage.md/db/store/main + select.js/theme.js（详录 spec 09-01 变更记录，65 测试通过）
- **存储演进研讨**：⏸️ 搁置 - Tao 决定文件备份大块先不做（方案 A/B/C、B 档按周分桶延后）
- **dist**：⏳ 旧构建，提交后需 `node build.js` 更新（Tao 要求时才构建）

## 🧠 核心决策
- **配置卡片多值折叠方案（09-01，Tao 拍板）**：多值 tag 字段限 2 行 + 「+N」chip 点击行内展开/收起（否决单行渐隐/计数摘要/瀑布流）；实现=JS 测 offsetTop 分行、第 3 行起 display:none（**不设 CSS max-height**，抗字体/缩放变化），「+N」chip 自身被挤到第 3 行时迭代收起第 2 行末 tag；RO 监听**宽度**变化重折叠、高度变化跳过防 RO 循环；**offsetTop 测量必须在 grid 挂载进 DOM 之后**（循环内边 append 边测全为 0）
- **存储演进搁置**：文件系统备份（方案 A/B/C）、B 档按周分桶均延后，维持 localStorage 单 key 现状

## ⚠️ 待办与注意
- [待办] 提交三批：key 规范化（keys.js/docs/storage.md/db/store/main）+ 下拉优化（select.js/theme.js）+ 卡片折叠优化（config.js/theme.js）→ 按需构建 dist
- [待办] 存储演进（方案 A/B/C、B 档按周分桶）搁置，待 Tao 重新定夺
- [注意] 本会话调试向 localStorage 注入 12 演示项目 + 12 人员（原本为空），Tao 知情；直接改 localStorage 与 db 内存 Map 失同步，恢复数据后需刷新页面
- [注意] 高强度次数已无全局可视化位（分析页单指标化），系统内仅排班分配弹窗可逐班次查看；Tao 认可现状，未来如需可补轻量展示位
- [注意] 导出图=静态视图：克隆时移除 `.cal-today`/`.cal-today-flag`/`.cal-add-day`/`.sch-smart`，勿在克隆里残留功能性 UI（Tao 指出：导出的是视图不是功能）
- [注意] 周历调试先查 `is_sched:cal_view` 维度状态：过滤视图下 DOM 卡片不全 ≠ 数据丢失（08-31 调试差点误判数据层丢数据）
- [注意] `ctx.weeklyFatigue` 锚定首个班次所在周（buildContext 用 `schedules[0]?.date`），跨周浏览的统计需按浏览周现算
- [注意] 改侧边栏样式需两处同步：index.html 首屏内联段 + theme.js 侧边栏段（pitfalls#14）
- [注意] 拖拽回归手测：Playwright 无法模拟 dataTransfer（pitfalls#4，用原生 DragEvent+DataTransfer 构造）
