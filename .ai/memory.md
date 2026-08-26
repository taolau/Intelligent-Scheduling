# [时间] 2026-08-26
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **品牌**：✅ 完成 - 标签/左上角改「民数记 Numbers」（主标题 + 紫色小字 NUMBERS 副标题双层品牌区、蒜图标渐变圆角容器、浏览器标签「民数记 Numbers」）
- **色系升级**：✅ 完成 - 蒜皮紫 → **莓果梅紫**（主 #5a1d78），theme.js 8 组映射 + analysis 渐变 + favicon/body 全量替换，无旧紫残留
- **UI 精致化**：✅ 完成 - 双阴影带紫偏置 + 卡片 hover 上浮、中性色（文字/边框/背景）全向紫偏置、聚焦外发光柔和 .14、弹窗/下拉/toast 双阴影、遮罩深紫黑
- **疲劳分析页**：✅ 完成 - canvas DPR 适配（高清锐利）+ 弹性填满容器（消除下方空白）+ 空态 + 网格线带紫
- **git**：⏳ 本次品牌/色系/UI/分析改动待统一提交（save 后执行）
- **dist**：⏳ 旧构建，需 `node build.js`

## 🧠 核心决策
- **莓果梅紫设计语言**（长期，已入 spec）：主 #5a1d78 / hover #48115f / active #380c4a / 浅底 #f7f1fa / 活跃底 #efe3f6 / 边框 #e0d2ef / 深边框 #c9b0e0 / 页面底 #f7f4f8；**阴影与中性色全部带紫偏置**（告别 Tailwind 纯灰）
- **品牌名**：民数记 Numbers（浏览器标签 + 左上角双层品牌区），呼应排班统计主题
- **Canvas 图表铁律**（长期，已入 spec）：canvas 缓冲必须 × devicePixelRatio + setTransform，否则高分屏模糊；图表容器 flex:1 填满避免下方空白
- **时区铁律**（长期，已入 spec）：日期一律本地 todayStr()/toDateStr()，禁 toISOString
- **布局**：body 100vh + overflow hidden，内容在各滚动容器，grid minmax(0,1fr)
- **下拉 select**：面板 fixed 视口定位
- 智能排班手动触发 / buildContext 含 schedules（长期，已入 spec）

## ⚠️ 待办与注意
- [待办] 统一提交本次改动（save 后执行，量大建议分批）
- [待办] dist/index.html 旧构建，需 `node build.js` 更新（含莓果梅紫全套 + 分析页修复）
- [注意] 时区陷阱已入 pitfalls：本地凌晨/周切换会踩
- [注意] 拖拽回归手测待做：Playwright 无法模拟 dataTransfer（pitfalls#4）
- [注意] Canvas 绘制必须 DPR 适配，否则高分屏模糊（待入 pitfalls#11，待 Tao 确认）
