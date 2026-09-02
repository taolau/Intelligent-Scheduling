# [时间] 2026-09-02
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **09-02 批次（三叠代码完成待提交，Tao 验收拍板中）**：①任务说明字段全链路（5 文件）+ 周历闪电入口修复（calendar.js）；②替换弹窗 UI 重构（标题「人员替换」/头部规范/时段排序/候选卡两行/完成态折叠）+ 超限文案三态 + weekdayLabel + 分值圆整（theme/calendar/filter/week/score/substitute + 测试，72 绿）；③**打分系数可配置化**（preferredBonus 15 / balanceFactor 5 入 DEFAULT_SETTINGS+设置弹窗，score/substitute 读 settings）+ docs/score-rules.md 分数规则人话手册新建 + spec 4.3 参数化（74 绿，浏览器实测系数 5→1 候选分 15→3 链路通）
- **.ai 文件体系重整理（09-02）**：spec 变更记录区整区删除（Tao 拍板：spec 只反映当前规范 0-6 章，不设 changelog）；验证分级规范入 CLAUDE.md 心法 6、spec 维护纪律入心法 7；4.4/5.2 语义已对齐「未满员」
- **09-01 批次已全部提交**（6892c59 周历弹窗+疲劳+替换 / 71fe0ca key 规范化 / e957c92 下拉+卡片折叠 / 知识库 7739560+7a2825b）
- **存储演进研讨**：⏸️ 搁置 - Tao 决定文件备份大块先不做（方案 A/B/C、B 档按周分桶延后）
- **dist**：⏳ 旧构建，提交后需 `node build.js` 更新（Tao 要求时才构建）

## 🧠 核心决策
- **打分系数可配置化（09-02，Tao 拍板）**：preferredBonus(擅长加分 15)/balanceFactor(均衡系数 5) 从代码写死改为 DEFAULT_SETTINGS + 配置页「设置」弹窗五行（保存即生效，智能排班/替换/推荐同源）；scoreCandidate 逐键 `ctx.settings?.x ?? DEFAULT` 兜底（settings 部分缺键时整体解构 → undefined → NaN，测试抓出）；均衡系数语义=「防累话语权」天平：系数 1 时擅长者永远优先（均衡虚设）、系数 5 时疲劳高出平均 3 分即扣光擅长红利（15÷5）；UI 校验下限 1（弱化但不支持完全关均衡）
- **分数规则文档定位（09-02，Tao 拍板）**：`docs/score-rules.md` = 排班管理者人话版规则手册（术语表/9 条拒绝/打分/算例/参数/操作对照）；**spec 4.x 仍为算法真源**——先改 spec 再同步本文措辞与算例；与 spec 同纪律只反映当前态不设历史；文档内数字必须与代码核对（发现 spec 6 曾写「可配置」但实现未接入的偏差）
- **替换弹窗交互定稿（09-02，Tao 三轮反馈）**：标题固定「人员替换」（姓名不重复进标题）；头部纯文本信息排版=姓名 17px+状态徽标+副行「今日 N 个班次 · 周劳累积分 X/Y」（超限红字）——**否决史**：初稿头部加了紫底首字圆头像，Tao 否「纯多余的，要规范一点」→ 去掉装饰、与分配弹窗头部同构；班次组**按时段行序排序**（SLOT_LABELS 序=自主安排/早/中/晚，与周历网格一致，Tao 要求）；候选卡=主行（姓名+圆整分徽章，Top1 紫）+副行推荐理由（中性灰，非拒因红）+「选此替补」常驻按钮（hover 紫底）；替换成功整组**折叠为绿条**（✓ 已由 X 替换 + 组信息保留，done class 供重算循环跳过）；分值显示圆整（Math.round，理由内 points 与徽章同源）
- **超限文案三态（09-02，Tao 指出修复）**：filter 四条超限 reason 按**当前值**三分——`cur>limit`「已超限（上限 N）」/ `cur===limit`「已达上限（N）」/ `cur<limit 且加后超`「将超限」（仅疲劳检查可能，其余 +1 型只有前两态）；判定逻辑不变纯文案分态；与 chip 视觉层级对齐（>`上限`=over 红、`=`=warn 黄）；UI 全链路渲染 filter reasons（分配/替换/拖拽/智能排班）单点修复全通
- **任务说明查看交互（09-02，Tao 三轮拍板）**：卡片恒定一行「任务说明」（行数 5→6 固定，卡片等高保持；空值「—」）；文字超 2 行时折叠态 `-webkit-line-clamp:2` 末尾**省略号「…」**标识 + 点击文字行内展开/收起全文 + hover 原生 title 看全。**否决史**：+N chip 折叠（Tao：说明是详情不是 tag 列表）→ max-height 无省略号（Tao：末尾应有点击标识）→ line-clamp 按行数截断定稿（无像素依赖，抗字体缩放）；foldText 测量=先清 clamp 全显测 offsetHeight/行高 判超 2 行，再决定挂不挂点击
- **新增任务默认时段（09-02，Tao 提出）**：`createProject` slots 默认 `[{label:'自主安排'}]`（原 []）——弹窗初始一行可改可删；Excel 导入显式传 slots（空 [] 不触发 ??）不受影响；测试钉住断言同步
- **配置卡片多值折叠方案（09-01，Tao 拍板）**：多值 tag 字段限 2 行 + 「+N」chip 点击行内展开/收起；RO 监听宽度变化重折叠；foldTags 现兼管 tag 行（+N chip）与说明行（foldText 分支，无 .tag 时查 .v-text）
- **存储演进搁置**：文件系统备份（方案 A/B/C）、B 档按周分桶均延后，维持 localStorage 单 key 现状

## ⚠️ 待办与注意
- [待办] 提交 09-02 批次（建议拆三块）：①任务说明 5 文件 + calendar.js 闪电修复；②替换弹窗 UI（theme/calendar）+ 超限三态（filter）+ weekdayLabel（week/score/substitute 圆整）+ 对应测试；③打分系数可配置化（model/config/score/substitute + 测试）+ spec 4.3 + docs/score-rules.md（新文件）；.ai 文件本轮已同步，随任一提交；提交后按需构建 dist
- [待办] 存储演进（方案 A/B/C、B 档按周分桶）搁置，待 Tao 重新定夺
- [注意] 本会话调试向 localStorage 注入 12 演示项目 + 12 人员（原本为空），Tao 知情；其后改动：张三 maxWeeklyFatigue 4、新增王五 S3、09-02 班次多轮重建（现为张三 3 班次：自主浇花/早搬运/晚搬运）、设置已恢复默认五行；直接改 localStorage 与 db 内存 Map 失同步，恢复数据后需刷新页面
- [注意] 高强度次数已无全局可视化位（分析页单指标化），系统内仅排班分配弹窗可逐班次查看；Tao 认可现状，未来如需可补轻量展示位
- [注意] 导出图=静态视图：克隆时移除 `.cal-today`/`.cal-today-flag`/`.cal-add-day`/`.sch-smart`，勿在克隆里残留功能性 UI（Tao 指出：导出的是视图不是功能）
- [注意] 周历调试先查 `is_sched:cal_view` 维度状态：过滤视图下 DOM 卡片不全 ≠ 数据丢失（08-31 调试差点误判数据层丢数据）
- [注意] `ctx.weeklyFatigue` 锚定首个班次所在周（buildContext 用 `schedules[0]?.date`），跨周浏览的统计需按浏览周现算
- [注意] 改侧边栏样式需两处同步：index.html 首屏内联段 + theme.js 侧边栏段（pitfalls#14）
- [注意] 拖拽回归手测：Playwright 无法模拟 dataTransfer（pitfalls#4，用原生 DragEvent+DataTransfer 构造）
