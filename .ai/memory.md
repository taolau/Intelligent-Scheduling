# [时间] 2026-09-04
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **09-03 双批已提交**（05babed 任务视图/疲劳窗口 + 03fb835 月视图/公平窗口）——已清账
- **09-04 批次（未提交，working tree 在案，提交粒度 Tao 拍板）**：
  - 侧栏菜单改名：排班周历 → **「排班管理」**（main.js views 注册表 label，纯文案，切换靠 key 不依赖文案）
  - 月视图非本月日**「可点灰」**（语义不变仍可操作）：theme.js 从整列 opacity .6 禁用感 → 轻淡化 .75 + hover 该列恢复全亮/底色回温；calendar.js 日期头加 tooltip「相邻月份日期，班次照常可操作」
  - 排班导出改造：工具栏**去 Excel 下拉 → 直接「导出图片」按钮**；**月粒度支持整月长图导出**（exportImage.js 把 exportWeekImage 泛化为 exportScheduleImage(content,{filename,title,subtitle})，克隆解 height/overflow 防裁）；文件名 `Numbers-排班图-{周|月}-{总览|项目·名|人员·名}-{周首|YYYY-MM}.png`（维度名清洗非法字符）；excel.js 删 exportAttendance（含孤儿 getWeekDates 导入）、theme.js 删 .cal-export* 下拉样式
  - 测试种子脚本落档 `docs/脚本/测试数据-播种.js`（8 任务/11 人/~190 班次，跨过去 5 周~未来 2 周；Console 粘贴即用，直接覆盖三表无备份，改前先导出 JSON）
  - 验证：导出图待 Tao 自查（周回归/月长图灰列与分隔条/无 +与闪电残留/文件名粒度维度/Excel 入口消失）
- **dist**：⏳ 旧构建（含 09-03），需 `node build.js`（Tao 要求时才构建）

## 🧠 核心决策
- 导出语义（已落 spec 5.2/5.5，行为生效）：排班页**只提供「导出图片」**，xlsx 考勤导出**彻底移除**（存档走图片 + JSON）；图片按当前粒度——周 = 单面板，月 = **整月长图还原视图**（含周分隔条与首尾灰显邻月日）
- 09-03 决策（ctx 三轨/月视图双粒度/公平窗口均衡）已在 spec 正文固化，行为仍生效，此处不再重复

## ⚠️ 待办与注意
- [待办] Tao 自查 09-04 导出图批次后提交（提交粒度 Tao 拍板）；spec 已同步
- [注意] 视图重置只在 main.js switchView 的 resetViewDefaults（周历清 cal_view+cal_scale 回周粒度）；新页面有「菜单进入默认态」需求照此导出 reset 函数，禁止放进 render
- [注意] 导出图克隆去 .cal-today/.cal-add-day/.sch-smart；周/月内容原是 flex:1+overflow 滚动容器，克隆须解 height:auto/overflow:visible 防裁
- [注意] 侧栏**文字**在 main.js views 注册表改（排班管理/数据配置/疲劳分析），**样式**两处同步（index.html 首屏段 + theme.js）
- [注意] 疲劳分析日/月与周数值不具包含关系，先看窗口标签再比较；周历调试查 is_sched:cal_view/cal_scale（菜单进入会清）
- [注意] 覆盖真实数据前的备份须存 localStorage 临时 key（跨 reload 存活，pitfalls#33）；控制台种子脚本已据此无备份直写
