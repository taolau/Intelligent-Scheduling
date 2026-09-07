# [定位] 物理导航：项目结构与模块映射
# [作用] 描述项目文件夹逻辑，帮助 AI 快速定位代码文件，防止创建冗余文件。
# [规则] 仅记录目录职责和核心文件关联，不记录具体函数逻辑。保持结构扁平清晰。
---

## 顶层

```
Intelligent-Scheduling/
  index.html          # 入口（含首屏侧边栏样式内联，消除 FOUC；发布时 esbuild 内联为 dist/index.html 单文件）
  package.json        # scripts: dev(vite) / build(esbuild单文件) / test(node:test)
  build.js            # 打包脚本 → dist/index.html（开发多模块,发布单文件）
  dist/               # 构建产物（gitignore,仅 index.html）
  docs/               # 本地文档（storage.md = localStorage key 全量登记表与维护规则；score-rules.md = 排班推荐分数规则人话手册，spec 4.x 为真源）
  test/               # node:test 单测（算法层+模型+数据层 db/store）
```

## src/ 模块职责

| 目录 | 文件 | 职责 | 依赖 |
| --- | --- | --- | --- |
| `data/` | `model.js` | 数据模型定义+校验（Project/Staff/Schedule） | 无 |
| | `keys.js` | localStorage key 集中登记处（KEYS 全量常量 + STORES 业务表名；新 key 唯一入口，配套 docs/storage.md） | 无 |
| | `db.js` | localStorage 持久化 + 内存 Map 索引（CRUD + writeAll 批量写，KEYS[storeName] 查表读写） | keys |
| | `store.js` | 增量缓存门面（saveXxx/removeXxx 增量更新 cache；loadAll 仅初始化/导入/重置；JSON备份/恢复；getSettings/saveSettings） | db/keys |
| `core/` | `week.js` | 周/日期/时间/月工具（纯函数；月首/月标签/`YYYY-MM` 键、中心日换算） | 无 |
| | `expand.js` | 按 weekDays+slots 展开班次；`expandWeeks` 批量展开连续 N 周 | week |
| | `filter.js` | 硬性过滤（一票否决，返回原因；周上限滚动窗口 + 月上限自然月 + 连任轮换，均三分文案；返回 tenureOnly 豁免标记） | week/tenure |
| | `score.js` | 打分（擅长 + 标签加分 + 移动窗口均衡，返回得分构成；标签加分 = 任务 bonusTags ∩ 人员 tags 每命中一标签 × tagBonus） | week |
| | `tenure.js` | 同任务连任判定纯函数（tenureRunAfterAdd：加入后连续占有段长；段轴 = 任务"有发生周"，空窗不中断/他人中断/未来计入） | 无 |
| | `substitute.js` | buildContext 上下文聚合（窗口/自然周/自然月计数 + projectWeeks/tenure/heavyByMonth 连任与月高强轨道）+ cloneCtx 深拷贝 + splitEligible 候选分池（连任豁免）+ 替补 Top3 推荐 | filter/score/week |
| | `auto.js` | 智能排班自动填充纯函数（simulateAutoFill 按序模拟决策不写库 + accumulateDelta 计数增减规则唯一实现：窗口/周月疲劳/周月高强/daily/slot/tenure） | filter/score/substitute/week |
| `views/` | `calendar.js` | 排班视图（核心交互；**周/月双粒度切换** 状态 is_sched:cal_scale，月 = 覆盖自然月的完整周面板纵向堆叠、非本月日灰显；**视图维度切换**：总览/项目/人员过滤+摘要，状态 is_sched:cal_view，**人员维度标签多选过滤**（页内临时态）工具栏下拉；工具栏**「导出图片」按钮**（周=当前周面板、月=整月长图，文件名带粒度+维度）；**智能排班 smartPlanDialog**（预览=core simulateAutoFill 模拟执行+确认批量落盘，范围=当前浏览范围）+ 闪电单班次；**批量铺排 bulkPlanDialog**（previewExpand 预览+确认）；**排班分配/替换弹窗候选标签过滤**（视图层，算法名单不变）；**替换弹窗 openReplaceDialog**（当天班次分组按时段排序、候选卡、完成态折叠绿条）；**分配弹窗 openScheduleDialog 暂存编辑 + 「确认保存」净差一次性落库**（关闭即弃）；**批量删除多选态**（工具栏入口，总览/项目可用，卡片勾选 + 二次确认 + 三轨回退，重渲染自动退出） | core+data+ui |
| | `config.js` | 数据配置页（三 tab：人员/任务/系统设置；**cfg-frame 框架**=tab+操作按钮固定、内容容器内滚；人员/任务卡片网格装入浅紫面板 `.cfg-pane`（面板内滚）+ 头部名称实时筛选 + 卡片开关/编辑/**删除**（引用保护 + confirmDialog 确认）；系统设置=左右双面板参数/规则页；tab 记忆 is_sched:config_tab） | data+ui+excel |
| | `analysis.js` | 疲劳分析柱状图（canvas） | core+data |
| `ui/` | `theme.js` | 设计令牌 tokens + 全局样式注入（按钮/表单/弹窗/表格/toast/周历类/卡片网格/开关）；**侧边栏样式与 index.html 首屏内联段同步维护** | 无 |
| | `icons.js` | 共享 SVG 图标常量（ICON_FIRE 劳累指数火焰等） | 无 |
| | `fields.js` | 表单构建：field()/setError()/rowsEditor() 结构化动态行 + **tagsInput() 标签 chip 输入**（同框可输可选：聚焦浮出已有标签候选、回车自创、去重；`allowCreate:false` = 只选不建不自创，供任务加分标签） | select |
| | `select.js` | 自定义下拉：createSelect 单选/多选统一组件（`searchable` 可搜索过滤），el.value 兼容原生 select 读取；面板 fixed 视口定位防弹窗裁剪 | theme |
| | `timepicker.js` | 时间选择器：createTimePicker 点击整个框弹时/分双列面板（小时 00-23、分钟 00-59，选分钟自动收起），el.value 返回 'HH:mm' 或 '' | theme |
| | `modal.js` | 弹窗（openModal 单点收口：遮罩点击不关、ESC/右上 X 关；**弹窗栈**嵌套 ESC 只关顶层；footer 惯例=次钮左/主钮右；**confirmDialog** 破坏性操作二次确认弹窗，box-confirm 窄宽） | theme |
| | `dnd.js` | 拖拽封装 | 无 |
| | `excel.js` | Excel 导入导出（SheetJS） | data/model |
| | `exportImage.js` | 排班图导出 PNG（周/月通用 exportScheduleImage；html2canvas 离屏克隆：固定 1200px 宽/标题区，克隆去交互 UI、解 overflow 防裁）+ 任务说明图导出 | excel(下载) |
| | `toast.js` | 提示 | theme |
| `main.js` | — | 入口装配三视图+导航 | views/* |

## 关键约定

- **算法层 core/ 是纯函数**（无 DOM/浏览器 API），可 node:test 单测；views/ui 依赖浏览器，仅手测。
- **数据流**：store.js 缓存为唯一真源，视图层经 `getCache()` 读、`saveXxx()` 写；`loadAll` 仅初始化/导入/重置时调用。
- **时段标签**：预置集合 `自主安排/早/中/晚`（model.js SLOT_LABELS），固定四行；全部无具体时间，负荷由数量上限+预警（settings）控制。
- **buildContext 必须返回 schedules**（filter 重叠检测依赖），勿精简。
- **ctx 计数三轨**（2026-09-03 双窗口重构后）：`fatigueWindow`/`heavyWindow` = 公平参考窗口累计（score 均衡消费，键 `sid`；窗口起点 `fatigueCutoff` = 今天 − `balanceWindowDays`，未来已分配班次 date ≥ 起点自然计入）；`fatigueByWeek`/`heavyByWeek` = 班次所在自然周（filter 周上限消费，键 `${sid}|周一首日期`）；`fatigueByMonth`/`heavyByMonth` = 班次所在自然月（月粒度 chip 展示，键 `${sid}|YYYY-MM`）；`dailyCounts`/`slotCounts` = 按日/时段键不变。视图层手动 ± 计数点必须三轨同步（统一 helper，勿散写）。
