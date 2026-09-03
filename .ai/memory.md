# [时间] 2026-09-03
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **09-03 批①已提交**（05babed：任务视图 / 疲劳分析日周月 / 菜单重置）——已清账
- **09-03 批② = 月视图批次：代码完成 + Playwright 冒烟全过，未提交（working tree 在案，提交粒度 Tao 拍板）**：
  - 视图：日历工具栏 周/月 seg 双粒度（粒度记忆 `cal_scale` 刷新停留、菜单进入清回周）；月 = 覆盖自然月的完整周面板纵向堆叠（非本月日 `.cal-out-month` 灰显照常可操作）；导航按粒度；周↔月按中心日换算（周四/15 号）保阅读位置；月粒度图片导出禁用
  - 算法：ctx 三轨（窗口/自然周/自然月，key 约定见 project_map 关键约定）；视图层 ± 计数统一 `applyDelta` helper；修旧 buildContext 全量当周用 bug
  - chip 口径随粒度：月 = 无周红黄 + 小字 `.cal-mfat` 月积分；替换/分配弹窗计数恒 = 班次所在自然周
  - 验证：94 测试全绿；冒烟 = 面板数/灰显列/跨月周换算/窗口均衡数字全对/加人满员/菜单重置/设置行，页面零 JS 报错，数据已还原
  - 改动：week/substitute/filter/score/model/keys/calendar/analysis/config/theme + 3 测试 + spec/project_map/score-rules/storage/memory
- **dist**：⏳ 旧构建（含批①②），需 `node build.js`（Tao 要求时才构建）

## 🧠 核心决策
- 09-03 批①（任务视图/疲劳分析窗口口径/侧栏菜单重置/粒度保位换算）与批②（均衡移动窗口/月视图/智能排班全库作用域）**决策已全部落 spec 正文**（4.2~4.4/§5/5.1/5.2/5.4 + score-rules/storage/project_map），行为仍生效，此处不再重复
- 09-02 决策（删除语义/confirmDialog 惯例/footer 次左主右/弹窗栈/焦点落容器/btn-danger 收敛/cfg-pane 三机制/名称筛选）已在代码与 pitfalls 固化，行为仍生效

## ⚠️ 待办与注意
- [待办] 提交 09-03 批②——提交粒度 Tao 拍板；提交前 Tao 自查视觉（月面板灰显底纹/chip 小字/纵滚条）与拖拽手测（pitfalls#4）
- [注意] 视图重置只在 main.js switchView 的 resetViewDefaults 做（周历清 cal_view+cal_scale 回周粒度）；新页面有「菜单进入默认态」需求照此模式导出 reset 函数，**禁止放进 render 函数**
- [注意] config_tab/cal_view 被菜单进入清除，但页内操作重渲染与刷新停留仍靠它们；renderConfig keepTab 的 document 级 .seg 查询依赖「单容器 + switchView 先清 DOM」架构，勿改动查询范围
- [注意] 导出任务说明图标题固定「任务说明」不带日期（meta 已有导出时间）；日期只在文件名
- [注意] 疲劳分析口径对照：日/月数值与周不具包含关系，先看窗口标签再比较（跨月周 8/31~9/6 vs 月 2026-09）
- [注意] modal footer 次左主右 DOM 序；confirmDialog 全站统一；cfg-pane 滚动三机制（pitfalls#31）；openModal 焦点落 box 容器；满员四入口拦截一致；导出图克隆去 .cal-today/.cal-add-day/.sch-smart
- [注意] 周历调试先查 `is_sched:cal_view`/`cal_scale`：菜单进入会清掉，手动改 localStorage 仍可用
- [注意] 改侧边栏样式两处同步（index.html 首屏段 + theme.js）；系统设置 `.set-group { flex:none }`；score-rules 动参数前 grep DEFAULT_SETTINGS
- [注意] 本环境 Playwright 截图 Read 不可用——canvas（疲劳柱图）与纯视觉项依赖 Tao 自查
